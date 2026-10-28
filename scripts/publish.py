#!/usr/bin/env python3
"""Publish a proposal deck to Netlify under an unguessable token URL.

Build-only mode (default):
    python3 scripts/publish.py dist/sample-deck.html
writes dist/<token>/index.html (with a noindex robots meta), records the token
in dist/manifest.json, and prints the local path.

Deploy mode (uploads dist/ to a Netlify site and prints the public URL):
    python3 scripts/publish.py dist/sample-deck.html --deploy

Credentials are read from the repo-root .env when not already exported, or
passed explicitly:
    NETLIFY_AUTH_TOKEN / NETLIFY_TOKEN  — Netlify personal access token
    NETLIFY_SITE_ID                     — the site to deploy to (omitted: the
                                          site is created automatically as
                                          <slug>-proposals and saved to .env)

If the site does not exist yet it is created via the Netlify API and its id is
persisted in .env (NETLIFY_SITE_ID) so later deploys just work.

Netlify deploy protocol used:
  1. POST   /sites/{site_id}/deploys             body {"files": {path: sha1}}
  2. PUT    /deploys/{deploy_id}/files/{path}    raw file bytes
  3. POST   /deploys/{deploy_id}                 finalize (empty body)
  4. GET    /sites/{site_id}                     for the published base URL
"""
import argparse
import hashlib
import json
import os
import re
import secrets
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

API = 'https://api.netlify.com/api/v1'
NOINDEX = '<meta name="robots" content="noindex,nofollow">'
TOKEN_BYTES = 24
ENV_FILE = Path(__file__).resolve().parents[1] / '.env'


def load_env(env_file=ENV_FILE):
    """Hydrate os.environ from the repo-root .env without overriding exports."""
    if not env_file.exists():
        return
    for line in env_file.read_text(encoding='utf-8').splitlines():
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            key, value = line.split('=', 1)
            os.environ.setdefault(key, value.strip().strip('"\''))


def persist_env(key, value, env_file=ENV_FILE):
    """Write/update one key in .env (or create the file) preserving all others."""
    lines = env_file.read_text(encoding='utf-8').splitlines() if env_file.exists() else []
    out = []
    replaced = False
    for line in lines:
        if line.startswith(key + '='):
            out.append(f'{key}={value}')
            replaced = True
        else:
            out.append(line)
    if not replaced:
        out.append(f'{key}={value}')
    env_file.write_text('\n'.join(out) + '\n', encoding='utf-8')


def netlify_auth_token():
    return os.environ.get('NETLIFY_AUTH_TOKEN') or os.environ.get('NETLIFY_TOKEN') or ''


def create_site(auth_token, name):
    """Create (or fetch an existing) Netlify site and return its id."""
    status, site = _netlify_request('POST', f'{API}/sites', auth_token, {'name': name})
    return site['id']


def make_token(nbytes=TOKEN_BYTES):
    return secrets.token_urlsafe(nbytes)


def inject_noindex(html):
    if NOINDEX in html:
        return html
    if '<head>' in html:
        return html.replace('<head>', '<head>\n' + NOINDEX, 1)
    return html


def company_from_title(html):
    match = re.search(r'<title>(.*?)</title>', html, re.S | re.I)
    return (match.group(1).strip() if match else '') or None


def manifest_path(dist_dir):
    return Path(dist_dir) / 'manifest.json'


def manifest_load(dist_dir):
    path = manifest_path(dist_dir)
    if path.exists():
        try:
            return json.loads(path.read_text(encoding='utf-8'))
        except (ValueError, OSError):
            return []
    return []


def manifest_save(dist_dir, manifest):
    manifest = sorted(manifest, key=lambda entry: entry.get('created', ''))
    manifest_path(dist_dir).write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')


def build(export_html, dist_dir, source_name=None):
    """Write dist/<token>/index.html and record the token. Returns (token, file_path)."""
    dist = Path(dist_dir)
    dist.mkdir(parents=True, exist_ok=True)
    token = make_token()
    target_dir = dist / token
    target_dir.mkdir(parents=True, exist_ok=True)
    file_path = target_dir / 'index.html'
    file_path.write_text(inject_noindex(export_html), encoding='utf-8')
    manifest = manifest_load(dist_dir)
    manifest.append({
        'token': token,
        'url': '/' + token + '/',
        'created': datetime.now(timezone.utc).isoformat(),
        'company': company_from_title(export_html),
        'source': source_name or file_path.name,
    })
    manifest_save(dist_dir, manifest)
    return token, file_path


def _netlify_request(method, url, token, payload=None, headers=None, raw=None):
    merged = {'Authorization': 'Bearer ' + token}
    if headers:
        merged.update(headers)
    data = raw
    if payload is not None and raw is None:
        data = json.dumps(payload).encode('utf-8')
        merged.setdefault('Content-Type', 'application/json')
    req = urllib.request.Request(url, data=data, method=method, headers=merged)
    try:
        with urllib.request.urlopen(req, timeout=60) as response:
            body = response.read()
            return response.status, json.loads(body) if body else {}
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode('utf-8', errors='replace')
        raise RuntimeError(f'Netlify API {method} {url} -> {exc.code}: {detail[:400]}') from exc


def sha1_hex(data):
    return hashlib.sha1(data).hexdigest()


def deploy(dist_dir, auth_token, site_id, token=None, wait_seconds=120):
    """Upload dist/ (or just <token>/ + manifest.json when token is given) to Netlify."""
    dist = Path(dist_dir)
    files = {}
    for path in sorted(dist.rglob('*')):
        if path.is_file():
            rel = str(path.relative_to(dist))
            if token and not (rel.startswith(token + '/') or rel == 'manifest.json'):
                continue
            files[rel] = sha1_hex(path.read_bytes())

    status, deploy = _netlify_request(
        'POST', f'{API}/sites/{site_id}/deploys', auth_token, {'files': files})
    deploy_id = deploy.get('id')
    if not deploy_id:
        raise RuntimeError(f'Netlify did not return a deploy id: {deploy}')

    for rel in files:
        body = (dist / rel).read_bytes()
        _netlify_request(
            'PUT', f'{API}/deploys/{deploy_id}/files/{rel}', auth_token,
            raw=body, headers={'Content-Type': 'application/octet-stream'})

    # The finalize step is best-effort: some accounts reject it with 404 and
    # auto-promote the deploy to `ready` once every file has been uploaded.
    try:
        _netlify_request('POST', f'{API}/deploys/{deploy_id}', auth_token, {})
    except RuntimeError:
        pass
    return _wait_deploy(deploy_id, auth_token, wait_seconds)


def _wait_deploy(deploy_id, auth_token, wait_seconds):
    deadline = time.time() + wait_seconds
    last_state = ''
    while time.time() < deadline:
        status, deploy = _netlify_request('GET', f'{API}/deploys/{deploy_id}', auth_token)
        state = deploy.get('state', '')
        if state != last_state:
            last_state = state
            print(f'  deploy status: {state}')
        if state in ('ready', 'current'):
            return deploy
        if state in ('error', 'failed'):
            raise RuntimeError(f'Netlify deploy failed: {deploy.get("error_message") or deploy}')
        time.sleep(3)
    raise RuntimeError('Timed out waiting for the Netlify deploy to become ready.')


def site_base_url(site_id, auth_token):
    status, site = _netlify_request('GET', f'{API}/sites/{site_id}', auth_token)
    return (site.get('ssl_url') or site.get('url') or '').rstrip('/')


def main(argv=None):
    parser = argparse.ArgumentParser(description='Publish a proposal deck under a token URL.')
    parser.add_argument('export', help='path to the standalone proposal deck HTML')
    parser.add_argument('--dir', default='dist', help='build output directory (default: dist)')
    parser.add_argument('--slug', help='source label recorded in manifest.json (default: file name)')
    parser.add_argument('--site-id', help='Netlify site id (default: $NETLIFY_SITE_ID, or auto-created)')
    parser.add_argument('--site-name', default='hautomai-proposals',
                        help='Netlify site name used when auto-creating (default: hautomai-proposals)')
    parser.add_argument('--deploy', action='store_true', help='upload dist/ to Netlify and print the URL')
    load_env()
    args = parser.parse_args(argv)

    export_path = Path(args.export)
    if not export_path.is_file():
        parser.error(f'export file not found: {export_path}')
    export_html = export_path.read_text(encoding='utf-8')

    token, file_path = build(export_html, args.dir, source_name=args.slug or export_path.name)
    print(f'Built {file_path} (token path /{token}/)')

    if not args.deploy:
        print('No deploy requested. Drag the dist/ folder into Netlify, or re-run with --deploy.')
        return 0

    auth_token = netlify_auth_token()
    if not auth_token:
        print('Deploy requires a Netlify personal access token missing on this machine:', file=sys.stderr)
        print('  Add NETLIFY_TOKEN=<token> to .env (or export NETLIFY_AUTH_TOKEN).', file=sys.stderr)
        print('  Create one at https://app.netlify.com/user/applications/personal', file=sys.stderr)
        print('dist/ is built and ready; deploy once credentials are set.', file=sys.stderr)
        return 2

    site_id = args.site_id or os.environ.get('NETLIFY_SITE_ID', '')
    if not site_id:
        print(f'No NETLIFY_SITE_ID configured — creating site "{args.site_name}".')
        site_id = create_site(auth_token, args.site_name)
        persist_env('NETLIFY_SITE_ID', site_id)
        print(f'Created site {args.site_name} (id {site_id[:8]}…) and saved NETLIFY_SITE_ID to .env')

    print('Uploading to Netlify…')
    deploy(args.dir, auth_token, site_id, token=token)
    base = site_base_url(site_id, auth_token)
    url = f'{base}/{token}/'
    print(f'LIVE: {url}')
    return 0


if __name__ == '__main__':
    sys.exit(main())