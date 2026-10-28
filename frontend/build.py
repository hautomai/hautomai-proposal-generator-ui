#!/usr/bin/env python3
"""Build the single-file browser artifact without third-party dependencies."""
from pathlib import Path
import os

ROOT = Path(__file__).parent
shell = (ROOT / 'shell.html').read_text(encoding='utf-8')
replacements = {
    '/* INJECT_HELPERS */': (ROOT / 'src/helpers.js').read_text(encoding='utf-8'),
    '/* INJECT_SIGNING */': (ROOT / 'src/signing.js').read_text(encoding='utf-8'),
    '/* INJECT_STYLES */': (ROOT / 'src/styles.js').read_text(encoding='utf-8'),
    '/* INJECT_SAMPLE */': (ROOT / 'src/sample-data.js').read_text(encoding='utf-8'),
    '/* INJECT_APP */': (ROOT / 'src/app.js').read_text(encoding='utf-8'),
}
for marker, content in replacements.items():
    # The source modules contain literal `</script>` only in generated export
    # templates. Escape it so the browser cannot terminate the containing tag.
    shell = shell.replace(marker, content.replace('</script>', '<\\/script>'))

# Never read the repository's unrelated credentials automatically. Values
# are supplied explicitly at build time (or through .env in the repo root).
env_file = ROOT.parent / '.env'
env_values = dict(os.environ)
if env_file.exists():
    for line in env_file.read_text(encoding='utf-8').splitlines():
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            key, value = line.split('=', 1)
            env_values.setdefault(key, value.strip().strip('"\''))


def js_quote(value):
    return value.replace('\\', '\\\\').replace("'", "\\'")


shell = shell.replace('__PROPOSAL_API_TOKEN__', js_quote(env_values.get('PROPOSAL_API_TOKEN', '')))
shell = shell.replace('__CONSULTANT_NAME__', js_quote(env_values.get('CONSULTANT_NAME', '')))
shell = shell.replace('__CONSULTANT_EMAIL__', js_quote(env_values.get('CONSULTANT_EMAIL', '')))
(ROOT / 'index.html').write_text(shell, encoding='utf-8')
print(f'Wrote {ROOT / "index.html"}')
if not env_values.get('PROPOSAL_API_TOKEN'):
    print('Warning: no PROPOSAL_API_TOKEN found; the UI will use fallback data.')
