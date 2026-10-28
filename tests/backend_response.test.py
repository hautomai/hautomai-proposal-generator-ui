import os
import sys
import types
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from unittest.mock import patch

# Modal is optional in the test environment; provide a tiny import stub.
if 'modal' not in sys.modules:
    modal = types.ModuleType('modal')
    class _App:
        def __init__(self, *args, **kwargs): pass
        def function(self, *args, **kwargs):
            return lambda fn: fn
    modal.App = _App
    modal.Image = types.SimpleNamespace(debian_slim=lambda: types.SimpleNamespace(pip_install=lambda *a, **k: None))
    modal.Secret = types.SimpleNamespace(from_name=lambda name: name)
    modal.fastapi_endpoint = lambda *a, **k: (lambda fn: fn)
    sys.modules['modal'] = modal

from modal_app import generate_proposal, _build_replacements, ANALYSIS_PROMPT


class TestBackendContract(unittest.TestCase):
    def test_response_contains_proposal_and_email(self):
        proposal = {'proposalTitle': 'Test proposal'}
        with patch('modal_app._analyze_transcript', return_value=proposal), \
             patch('modal_app._create_proposal_document', return_value='https://docs.google.com/document/d/1/edit'), \
             patch.dict(os.environ, {'API_AUTH_TOKEN': 'secret'}, clear=False):
            result = generate_proposal(
                {'transcript': 'hello', 'company_name': 'Acme', 'consultant_email': 'a@example.com'},
                authorization='Bearer secret',
            )
        self.assertTrue(result['success'])
        self.assertEqual(result['proposal'], proposal)
        self.assertEqual(result['consultantEmail'], 'a@example.com')
        self.assertEqual(result['documentUrl'], 'https://docs.google.com/document/d/1/edit')

    def test_missing_required_input_is_rejected(self):
        with patch.dict(os.environ, {'API_AUTH_TOKEN': 'secret'}, clear=False):
            with self.assertRaises(Exception):
                generate_proposal({}, authorization='Bearer secret')

    def test_prompt_instructs_slides_array_format(self):
        self.assertIn('slides', ANALYSIS_PROMPT)
        self.assertIn('"type"', ANALYSIS_PROMPT)
        self.assertIn('cover', ANALYSIS_PROMPT)
        self.assertIn('terms', ANALYSIS_PROMPT)

    def test_build_replacements_extracts_from_slides(self):
        repl = _build_replacements(
            {
                'proposalTitle': 'Deck title',
                'slides': [
                    {'type': 'signal', 'intro': 'the gap', 'nodes': [
                        {'title': 'Manual work', 'desc': 'Slow'},
                    ]},
                    {'type': 'volume', 'cards': [{'title': 'Qualified research'}], 'metrics': ['50+ records / week']},
                    {'type': 'tools', 'tools': [{'role': 'Research', 'name': 'Apollo'}]},
                ],
            },
            'Acme', 'Hautomai', '$1,950',
        )
        self.assertIn('Manual work', repl['{{problemSection}}'])
        self.assertIn('the gap', repl['{{problemSection}}'])
        self.assertIn('Qualified research', repl['{{scopeSection}}'])
        self.assertIn('50+ records / week', repl['{{timelineSection}}'])

    def test_build_replacements_falls_back_to_flat_fields(self):
        repl = _build_replacements(
            {'proposalTitle': 'T', 'problemPoint1': 'Flat problem'},
            'Acme', 'Hautomai', '$1,950',
        )
        self.assertIn('Flat problem', repl['{{problemSection}}'])


if __name__ == '__main__':
    unittest.main()
