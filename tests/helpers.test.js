const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../frontend/src/helpers.js');

test('depositAmount formats valid currency and rejects invalid values', () => {
  assert.equal(H.depositAmount('$4,500'), '$2,250.00');
  assert.equal(H.depositAmount(''), '');
  assert.equal(H.depositAmount('not a price'), '');
});

test('inputHash is stable and includes relevant fields', () => {
  const a = { transcript:'t', company_name:'c', consultant_name:'n', price:'10', consultant_email:'e' };
  assert.equal(H.inputHash(a), H.inputHash({...a}));
  assert.notEqual(H.inputHash(a), H.inputHash({...a, price:'11'}));
});

test('normalization supplies missing fields and coerces lists', () => {
  const p = H.normalizeProposal({ scopeItems:'one\ntwo', timelineItems:[] });
  assert.equal(p.proposalTitle, '[missing]');
  assert.deepEqual(p.scopeItems, ['one','two']);
  assert.deepEqual(p.timelineItems, ['[missing]']);
  assert.ok(H.missingCount(p) > 0);
});

test('timeline phases parse business-day durations', () => {
  assert.deepEqual(H.phase('Build: 5 business days'), {label:'Build', duration:'5 business days'});
  assert.deepEqual(H.phase('Unstructured phase'), {label:'Unstructured phase', duration:''});
});

test('slideModel creates eight template slides in fixed order', () => {
  const p = {};
  for (let i=1;i<=5;i++) { p[`problemPoint${i}`]=`Problem ${i}`; p[`problemDesc${i}`]=`Description ${i}`; p[`solutionPoint${i}`]=`Solution ${i}`; p[`solutionDesc${i}`]=`Description ${i}`; }
  p.proposalTitle='Title'; p.serviceType='service'; p.problemIntro='intro'; p.solutionIntro='intro'; p.scopeItems=['a','b']; p.timelineItems=['Build: 2 business days'];
  const slides = H.slideModel(p,{company:'C',consultant:'N',price:'$100',terms:'T'});
  assert.deepEqual(slides.map(s => s.type), ['cover','signal','architecture','volume','tools','investment','close','terms']);
});

test('slideModel enforces the fixed 8-slide template for slides[] input', () => {
  const src = [
    { type: 'cover', title: 'T', serviceType: 'lead generation' },
    { type: 'signal', eyebrow: 'E', heading: 'H', nodes: [{ tag: '01 · SIGNAL', title: 'A', desc: 'D' }] },
    { type: 'tools', eyebrow: 'E', heading: 'H', tools: [{ role: 'Sending', name: 'Instantly', desc: 'D', price: '$47' }] },
    { type: 'terms', heading: 'Terms', termsText: 'Approval.' }
  ];
  const result = H.slideModel({ slides: src }, { company: 'Acme', consultant: 'C', terms: 'Fallback' });
  assert.deepEqual(result.map(s => s.type), H.TEMPLATE_ORDER);
  assert.equal(result[0].type, 'cover');
  assert.equal(result[0].company, 'Acme');
  assert.equal(result[1].type, 'signal');
  assert.equal(result[1].nodes.length, 1);
  assert.equal(result[2].type, 'architecture');
  assert.equal(result[4].type, 'tools');
  assert.equal(result[4].tools.length, 1);
  assert.equal(result[5].type, 'investment');
  assert.equal(result[7].type, 'terms');
  assert.equal(result[7].termsText, 'Approval.');
});

test('slideModel fills investment panels from meta for slides[]', () => {
  const slides = [{ type: 'investment', eyebrow: 'I', heading: 'H', panels: [] }];
  const result = H.slideModel({ slides }, { price: '$4,500' });
  const invest = result.find(s => s.type === 'investment');
  assert.equal(invest.panels.length, 2);
  assert.equal(invest.panels[0].amount, '$4,500');
  assert.equal(invest.panels[1].amount, '$2,250.00');
});

test('normalizeToSlides converts old flat format into the fixed template', () => {
  const flat = { proposalTitle: 'T', serviceType: 's', problemIntro: 'intro', scopeItems: ['x'],
    problemPoint1: 'P1', problemDesc1: 'D1', solutionPoint1: 'S1', solutionDesc1: 'D2' };
  const slides = H.normalizeToSlides(flat);
  assert.deepEqual(slides.map(s => s.type), H.TEMPLATE_ORDER);
  assert.equal(slides[0].type, 'cover');
  assert.equal(slides[0].title, 'T');
  assert.ok(slides.find(s => s.type === 'signal').nodes.length, 'problem points mapped onto signal');
  const arch = slides.find(s => s.type === 'architecture');
  assert.ok(arch.nodes.length, 'solution points mapped onto architecture');
  assert.ok(slides.some(s => s.type === 'terms'));
});

test('missingCount counts missing fields across slides', () => {
  const slides = [
    { type: 'cover', title: 'T', serviceType: 's', subtitle: '' },
    { type: 'tools', eyebrow: '', heading: '', tools: [{ role: '', name: 'N', desc: '', price: '' }] }
  ];
  const count = H.missingCount(slides);
  assert.ok(count > 0, 'expected some missing fields');
  assert.equal(H.missingCount([{ type: 'cover', title: 'T', serviceType: 's' }]), 0);
});

test('exportDocument inlines CSS and markup', () => {
  const html = H.exportDocument('<section class="slide">x</section>', '.slide{color:red}', 'show();', 'Acme', 'today');
  assert.match(html, /\.slide\{color:red\}/);
  assert.match(html, /<section class="slide">x<\/section>/);
  assert.doesNotMatch(html, /src=["']frontend/);
});

test('exportDocument produces a self-contained deck (slide visibility, fit script, print)', () => {
  const html = H.exportDocument('<section class="slide active">x</section>', '.slide{color:red}', 'show();', 'Acme', 'today');
  assert.match(html, /\.slide\{position:absolute;inset:0;visibility:hidden/);
  assert.match(html, /\.slide\.active\{visibility:visible/);
  assert.match(html, /Math\.min\(innerWidth\/1920,innerHeight\/1080\)/);
  assert.match(html, /@media print/);
  assert.match(html, /page-break-before:always/);
  assert.match(html, /break-inside:avoid/);
  assert.doesNotMatch(html, /<\/script><\/body><\/html><script>/);
});
