import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('publish', ROOT / 'scripts' / 'publish.py')
publish = importlib.util.module_from_spec(spec)
spec.loader.exec_module(publish)

SAMPLE = '<!doctype html><html><head><meta charset="utf-8"><title>Acme proposal</title></head><body>x</body></html>'
NOINDEX = publish.NOINDEX


class TestInjectNoindex(unittest.TestCase):
    def test_adds_meta_after_head(self):
        out = publish.inject_noindex(SAMPLE)
        self.assertIn(NOINDEX, out)
        self.assertLess(out.index(NOINDEX), out.index('<title>'))

    def test_idempotent(self):
        once = publish.inject_noindex(SAMPLE)
        self.assertEqual(publish.inject_noindex(once), once)


class TestCompany(unittest.TestCase):
    def test_extracts_title(self):
        self.assertEqual(publish.company_from_title(SAMPLE), 'Acme proposal')

    def test_no_title_returns_none(self):
        self.assertIsNone(publish.company_from_title('<html><body></body></html>'))


class TestToken(unittest.TestCase):
    def test_token_has_entropy(self):
        seen = {publish.make_token() for _ in range(200)}
        self.assertEqual(len(seen), 200)
        for token in seen:
            self.assertGreaterEqual(len(token), 24)
            self.assertRegex(token, r'^[A-Za-z0-9_-]+$')


class TestBuild(unittest.TestCase):
    def test_build_writes_token_folder_and_manifest(self):
        with tempfile.TemporaryDirectory() as tmp:
            dist = Path(tmp) / 'dist'
            token, file_path = publish.build(SAMPLE, str(dist), source_name='a.html')
            self.assertTrue(file_path.is_file())
            self.assertEqual(file_path, dist / token / 'index.html')
            html = file_path.read_text(encoding='utf-8')
            self.assertIn('<title>Acme proposal</title>', html)
            self.assertIn(NOINDEX, html)
            manifest = publish.manifest_load(str(dist))
            self.assertEqual(len(manifest), 1)
            self.assertEqual(manifest[0]['token'], token)
            self.assertEqual(manifest[0]['url'], f'/{token}/')
            self.assertEqual(manifest[0]['company'], 'Acme proposal')

    def test_second_build_appends(self):
        with tempfile.TemporaryDirectory() as tmp:
            publish.build(SAMPLE, tmp)
            token2, _ = publish.build(SAMPLE, tmp)
            manifest = publish.manifest_load(tmp)
            self.assertEqual(len(manifest), 2)
            self.assertEqual(manifest[-1]['token'], token2)


class TestEnv(unittest.TestCase):
    def test_load_and_persist_roundtrip(self):
        # load_env() uses setdefault, so an ambient value (e.g. the real
        # NETLIFY_SITE_ID in the repo .env) would win over the temp file.
        publish.os.environ.pop('NETLIFY_SITE_ID', None)
        with tempfile.TemporaryDirectory() as tmp:
            env = Path(tmp) / '.env'
            env.write_text('ALPHA=1\nPROPOSAL_API_TOKEN=x\n', encoding='utf-8')
            publish.load_env(env)
            self.assertEqual(publish.os.environ.get('ALPHA'), '1')
            publish.persist_env('NETLIFY_SITE_ID', 'site123', env)
            text = env.read_text(encoding='utf-8')
            self.assertIn('ALPHA=1', text)
            self.assertIn('NETLIFY_SITE_ID=site123', text)
            publish.load_env(env)
            self.assertEqual(publish.os.environ.get('NETLIFY_SITE_ID'), 'site123')

    def test_persist_updates_existing_key_in_place(self):
        with tempfile.TemporaryDirectory() as tmp:
            env = Path(tmp) / '.env'
            env.write_text('SITE_ID=old\nKEEP=yes\n', encoding='utf-8')
            publish.persist_env('SITE_ID', 'new', env)
            text = env.read_text(encoding='utf-8')
            self.assertIn('SITE_ID=new', text)
            self.assertNotIn('SITE_ID=old', text)
            self.assertIn('KEEP=yes', text)
            self.assertEqual(len([l for l in text.splitlines() if l.startswith('SITE_ID=')]), 1)


if __name__ == '__main__':
    unittest.main()