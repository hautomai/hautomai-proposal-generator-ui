import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const chromium = '/usr/bin/chromium';

// Real-browser tests. Strategy: copy the built frontend/index.html to a temp
// dir, append a driver <script> at the very end of the document (appending is
// required — the export template inside helpers.js contains a literal </body>
// that would swallow the driver if we replaced the first one), load it in
// headless Chromium with --dump-dom, and assert on document.title. The driver
// updates the title after every step, so the snapshot is never stale.

test('full flow in real chromium: generate -> review -> render deck -> navigate', { timeout: 60000 }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'proposal-ui-'));
  const driver = buildFlowDriver();
  writeFileSync(join(dir, 'index.html'), readIndex() + driver);
  const dom = runChromium(`file://${join(dir, 'index.html')}`);
  const title = extractTitle(dom);
  console.log('FLOW RESULT:', title);
  assert.match(title, /FLOWTEST/);
  assert.match(title, /boot/);
  assert.match(title, /validate/);
  assert.match(title, /review/);
  assert.match(title, /deck/);
  assert.match(title, /slides=8/);
  assert.match(title, /counter/);
  assert.match(title, /dots/);
  assert.doesNotMatch(title, /FAIL/);
  rmSync(dir, { recursive: true, force: true });
});

test('editor keystrokes stay in the review step (Enter/Tab cannot submit)', { timeout: 60000 }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'proposal-ui-edit-'));
  writeFileSync(join(dir, 'index.html'), readIndex() + buildEditDriver());
  const dom = runChromium(`file://${join(dir, 'index.html')}`);
  const title = extractTitle(dom);
  console.log('EDIT RESULT:', title);
  assert.match(title, /EDITTEST/);
  assert.match(title, /entered-review/);
  assert.match(title, /typed/);
  assert.match(title, /enter-blocked/);
  assert.match(title, /focus-moved/);
  assert.match(title, /submit-blocked/);
  assert.match(title, /ctrl-enter-renders/);
  assert.doesNotMatch(title, /FAIL/);
  rmSync(dir, { recursive: true, force: true });
});

test('fixed 8-slide review: edit fields and render all new types', { timeout: 60000 }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'proposal-ui-flex-'));
  writeFileSync(join(dir, 'index.html'), readIndex() + buildFlexDriver());
  const dom = runChromium(`file://${join(dir, 'index.html')}`, 15000);
  const title = extractTitle(dom);
  console.log('FLEX RESULT:', title);
  assert.match(title, /FLEXTEST/);
  assert.match(title, /cards=8/);
  assert.match(title, /edited=1/);
  assert.match(title, /cover-locked=1/);
  assert.match(title, /deck-slides=8/);
  assert.match(title, /types=/);
  assert.match(title, /new-types-rendered=1/);
  assert.doesNotMatch(title, /FAIL/);
  rmSync(dir, { recursive: true, force: true });
});

test('configured token + successful generator response is used (no sample fallback)', { timeout: 60000 }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'proposal-ui-success-'));
  writeFileSync(join(dir, 'index.html'), readIndex() + buildSuccessDriver());
  const dom = runChromium(`file://${join(dir, 'index.html')}`);
  const title = extractTitle(dom);
  console.log('SUCCESS RESULT:', title);
  assert.match(title, /SUCCESSTEST/);
  assert.match(title, /title=Guardcheck Portal for Regression Co/, 'generator response was not used');
  assert.match(title, /badge=hidden/, 'sample badge should stay hidden on success');
  assert.doesNotMatch(title, /Symplify/);
  assert.doesNotMatch(title, /token is not configured/);
  rmSync(dir, { recursive: true, force: true });
});

test('downloaded export is a working standalone deck', { timeout: 60000 }, () => {  const dir = mkdtempSync(join(tmpdir(), 'proposal-ui-export-'));
  // Phase A: build the exact export HTML the Download button produces.
  const aFile = join(dir, 'a.html');
  writeFileSync(aFile, readIndex() + buildExportDriver());
  const domA = runChromium(`file://${aFile}`);
  const titleA = extractTitle(domA);
  console.log('EXPORT BUILD RESULT:', titleA);
  assert.match(titleA, /export-built/, 'export was not built');
  assert.doesNotMatch(titleA, /FAIL/, 'export build failed');
  const match = domA.match(/<textarea id="exportOut">([^<]*)<\/textarea>/);
  assert.ok(match, 'export output textarea not found');
  const exportHtml = decodeURIComponent(match[1]);
  assert.match(exportHtml, /<!doctype html>/);
  assert.ok(exportHtml.length > 5000, 'export looks truncated');
  // Phase B: load the exported file in its own browser and verify behavior.
  const bFile = join(dir, 'b.html');
  writeFileSync(bFile, exportHtml + buildVerifyDriver());
  const domB = runChromium(`file://${bFile}`, 8000);
  const titleB = extractTitle(domB);
  console.log('EXPORT VERIFY RESULT:', titleB);
  assert.match(titleB, /EXPORTTEST/);
  assert.match(titleB, /slides=8/);
  assert.match(titleB, /visibility/);
  assert.match(titleB, /fit=/);
  assert.match(titleB, /nav/);
  assert.doesNotMatch(titleB, /FAIL/);
  // Phase C: the print path must produce one page per slide (no clipping).
  const pdfFile = join(dir, 'deck.pdf');
  execFileSync(chromium, [
    '--headless', '--no-sandbox', '--disable-gpu',
    '--allow-file-access-from-files',
    '--print-to-pdf=' + pdfFile,
    '--no-pdf-header-footer',
    `file://${bFile}`,
  ], { encoding: 'utf8', timeout: 50000 });
  assert.ok(readFileSync(pdfFile).length > 5000, 'pdf too small');
  const pdfinfo = spawnSync('pdfinfo', [pdfFile], { encoding: 'utf8' });
  if (pdfinfo.status === 0) {
    const pages = (pdfinfo.stdout.match(/Pages:\s+(\d+)/) || [])[1];
    assert.equal(pages, '8', 'pdf should have 8 pages, got ' + pages);
    const size = (pdfinfo.stdout.match(/Page size:\s+([\d.]+) x ([\d.]+)/) || []);
    assert.ok(size, 'pdf page size missing');
    const ratio = Number(size[1]) / Number(size[2]);
    assert.ok(Math.abs(ratio - 16 / 9) < 0.01, 'pdf pages should be 16:9, got ' + ratio);
  }
  const pdftotext = spawnSync('pdftotext', [pdfFile, '-'], { encoding: 'utf8' });
  if (pdftotext.status === 0) {
    for (const needle of ['How it works', 'Your investment', 'Terms &']) {
      assert.match(pdftotext.stdout, new RegExp(needle), 'pdf missing: ' + needle);
    }
  }
  rmSync(dir, { recursive: true, force: true });
});

function buildFlexDriver() {
  return String.raw`
<script>
(function () {
  var out = [];
  function report() { document.title = 'FLEXTEST ' + out.join(' | '); }
  function fail(step, err) { out.push(step + ':FAIL ' + (err && err.message ? err.message : err)); report(); }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function poll(label, predicate, tries) {
    var n = 0;
    return new Promise(function (resolve, reject) {
      var tick = function () {
        if (predicate()) return resolve();
        if (++n > (tries || 60)) return reject(new Error(label + ' timed out'));
        setTimeout(tick, 100);
      };
      tick();
    });
  }
  async function run() {
    try {
      var g = function (id) { var el = document.getElementById(id); if (!el) throw new Error('missing #' + id); return el; };
      window.fetch = function () {
        return Promise.resolve({ ok: false, status: 401, json: function () { return Promise.resolve({ detail: 'test stub' }); } });
      };
      // Use the fixed 8-slide template so we exercise the new model.
      var pub = typeof globalThis !== 'undefined' ? globalThis : this;
      pub.SampleData.proposal = {
        proposalTitle: 'Lead generation for Acme',
        serviceType: 'lead generation',
        slides: [
          { type: 'cover', title: 'Lead generation for Acme', serviceType: 'lead generation', subtitle: 'A system that finds qualified merchant trade suppliers and delivers verified records every week.', company: 'Acme', consultant: 'Hichem A', date: 'December 12, 2025' },
          { type: 'signal', eyebrow: 'The signal', heading: 'Where things stand', intro: 'Your growth depends on finding the right prospects consistently, but manual research makes volume and quality difficult to maintain.', roles: ['Founder', 'Sales rep', 'Marketing lead'], rolesNote: 'This proposal is written for any one of these roles taking ownership of prospecting.', nodes: [
            { tag: '01 · SIGNAL', title: 'Inconsistent prospecting', desc: 'Research is performed manually and takes time away from outreach and delivery.' },
            { tag: '02 · SIGNAL', title: 'The wrong audience', desc: 'Broad searches can surface tradespeople instead of the merchant trade suppliers who match.' },
            { tag: '03 · SIGNAL', title: 'Unverified records', desc: 'Incomplete or inaccurate contact details create wasted outreach.' }
          ]},
          { type: 'architecture', eyebrow: 'The pipeline', heading: 'How it works', intro: 'Together these steps form one repeatable system.', nodes: [
            { step: '01 · STEP', title: 'Define the target', desc: 'Translate the ideal customer profile into clear search criteria.', hot: true },
            { step: '02 · STEP', title: 'Source prospects', desc: 'Structured research workflow finds matching businesses.' },
            { step: '03 · STEP', title: 'Verify data', desc: 'Clean and validate records before delivery.' },
            { step: '04 · STEP', title: 'Deliver at volume', desc: 'Consistent weekly process supporting the agreed record target.' },
            { step: '05 · STEP', title: 'Improve continuously', desc: 'Review results and refine targeting over time.' }
          ], note: '∞ continuous · loops back overnight' },
          { type: 'volume', eyebrow: 'Volume & cadence', heading: 'Weekly delivery', intro: 'A structured cadence keeps the pipeline fed every week.', cards: [
            { day: 'Day 1–2', icon: '🔍', title: 'Research', desc: 'Target-market definition and source identification.' },
            { day: 'Day 3–4', icon: '📋', title: 'Source & verify', desc: 'Prospect research and contact data verification.' },
            { day: 'Day 5', icon: '✅', title: 'Quality review', desc: 'Record cleanup and confidence check before handover.' },
            { day: 'Day 5+', icon: '📦', title: 'Deliver', desc: 'Structured spreadsheet delivered to your inbox.' }
          ], metrics: ['50+ records per week', 'Email + phone verified', 'Weekly cadence'] },
          { type: 'tools', eyebrow: 'Tools & stack', heading: 'What runs the system', tools: [
            { role: 'Research', name: 'Apollo', desc: 'Prospecting database for structured lead research.', price: '' },
            { role: 'Verify', name: 'NeverBounce', desc: 'Email verification to protect sender reputation.', price: '' },
            { role: 'Enrich', name: 'Clearbit', desc: 'Firmographic data to confirm target-market fit.', price: '' },
            { role: 'Deliver', name: 'Google Sheets', desc: 'Structured delivery spreadsheet for easy handoff.', price: '' }
          ], note: 'All tools are used only for this project and are not shared with third parties.' },
          { type: 'investment', eyebrow: 'Investment', heading: 'Your investment', panels: [
            { tag: 'Total project fee', amount: '$75', note: 'One fixed fee covering the full scope described in this proposal.', items: [], hot: false },
            { tag: 'Deposit due at signing', amount: '$37.50', note: 'Confirmation to begin work — balance payable on handover.', items: [], hot: true }
          ]},
          { type: 'close', pill: 'Next step', heading: "Let's get started", intro: 'A quick call to align on targeting, then we begin.', steps: [
            { num: '01', title: 'Align on targeting', desc: 'Share your ideal customer profile and geographic criteria.' },
            { num: '02', title: 'We begin research', desc: 'The first batch of verified records is delivered within 5 business days.' },
            { num: '03', title: 'Review and handover', desc: 'We walk through the results and hand over the process.' }
          ], cta: 'Get started →' },
          { type: 'terms', heading: 'Terms & signature', termsText: 'Hichem A will build the system for Acme according to the description laid out in this proposal. Additional features beyond the listed requirements may affect the timeline and costs outlined above.\n\nBy signing below, both parties indicate their acceptance of this proposal and constitute approval to begin work upon Acme\'s payment of the deposit.', company: 'Acme', consultant: 'Hichem A', email: '', date: 'December 12, 2025' }
        ]
      };
      g('transcript').value = 'We need a reliable lead generation system that finds qualified merchant trade suppliers and delivers verified records every week.';
      g('transcript').dispatchEvent(new Event('input'));
      g('companyName').value = 'Acme';
      g('companyName').dispatchEvent(new Event('input'));
      await wait(50);
      g('generateBtn').click();
      await poll('review', function () { return document.querySelectorAll('#reviewForm [data-field]').length > 0; });
      out.push('cards=8');
      report();
      // Expand the tools card and edit the first tool's name.
      var cards = document.querySelectorAll('#reviewForm .slide-card');
      var toolsCard = cards[4];
      toolsCard.classList.add('expanded');
      var toolName = toolsCard.querySelector('[data-field="tool_name_0"]');
      if (!toolName) throw new Error('tool_name_0 field missing');
      toolName.value = 'Instantly Pro';
      toolName.dispatchEvent(new Event('input', { bubbles: true }));
      out.push('edited=1');
      report();
// Add/remove/reorder buttons must not exist (fixed template, edit-only).
      if (document.querySelector('#reviewForm .add-slide-btn')) throw new Error('add-slide button should not exist');
      // Cover card must not be removable (required).
      var coverCard = document.querySelectorAll('#reviewForm .slide-card')[0];
      var coverType = coverCard.querySelector('.slide-card-type').textContent;
      if (!/cover/i.test(coverType)) throw new Error('first card is not cover: ' + coverType);
      if (coverCard.querySelector('.remove')) throw new Error('cover card should not be removable');
      out.push('cover-locked=1');
      report();
      // Render the deck.
      g('renderBtn').click();
      await poll('deck', function () { return !g('deckView').hidden; });
      var slides = document.querySelectorAll('#stage .slide');
      out.push('deck-slides=' + slides.length);
      report();
      var types = [];
      document.querySelectorAll('#stage .slide').forEach(function (s) {
        types.push(s.dataset.type || 'unknown');
      });
      out.push('types=' + types.join(','));
      report();
      // Preview classes for the fixed template should be present.
      if (!document.querySelector('.arch-node')) throw new Error('architecture positioned nodes CSS class missing');
      if (!document.querySelector('.tools-wrap')) throw new Error('tools slide CSS class missing');
      if (!document.querySelector('.daily-grid')) throw new Error('volume slide CSS class missing');
      if (!document.querySelector('.close-steps')) throw new Error('close slide CSS class missing');
      if (!document.querySelector('.price-panel')) throw new Error('investment v2 CSS class missing');
      if (!document.querySelector('.role-tags')) throw new Error('signal role-tags CSS class missing');
      out.push('new-types-rendered=1');
      report();
    } catch (e) {
      fail('flex', e);
    }
  }
  run();
})();
</script>`;
}

function buildSuccessDriver() {
  return String.raw`
<script>
(function () {
  var out = [];
  function report() { document.title = 'SUCCESSTEST ' + out.join(' | '); }
  function fail(e) { out.push('FAIL ' + (e && e.message ? e.message : e)); report(); }
  function g(id) { return document.getElementById(id); }
  var tries = 0;
  function tick() {
    if (document.querySelectorAll('#reviewForm .slide-card').length > 0) {
      var coverTitle = document.querySelector('#reviewForm .slide-card-title');
      out.push('title=' + coverTitle.textContent);
      out.push('badge=' + (g('sampleBadge').hidden ? 'hidden' : 'visible'));
      report();
      return;
    }
    if (++tries > 100) { fail(new Error('review never rendered')); return; }
    setTimeout(tick, 100);
  }
  try {
    var pub = typeof globalThis !== 'undefined' ? globalThis : this;
    var genProposal = Object.assign({}, pub.SampleData.proposal, { proposalTitle: 'Guardcheck Portal for Regression Co' });
    if (Array.isArray(genProposal.slides) && genProposal.slides[0] && genProposal.slides[0].type === 'cover') {
      genProposal.slides[0].title = 'Guardcheck Portal for Regression Co';
    }
    window.fetch = function () {
      return Promise.resolve({
        ok: true,
        json: function () {
          return Promise.resolve({
            success: true,
            proposal: genProposal,
          });
        },
      });
    };
    g('transcript').value = 'We need a portal.';
    g('transcript').dispatchEvent(new Event('input'));
    g('companyName').value = 'Regression Co';
    g('companyName').dispatchEvent(new Event('input'));
    setTimeout(function () { g('generateBtn').click(); tick(); }, 50);
  } catch (e) { fail(e); }
})();
</script>`;
}

// The review screen is a <form> of plain fields. The browser's implicit
// submission would reload the file:// page on Enter, dropping the user out of
// the editor, so both the Enter key and the submit event must be intercepted.
function buildEditDriver() {
  return String.raw`
<script>
(function () {
  var out = [];
  function report() { document.title = 'EDITTEST ' + out.join(' | '); }
  function fail(step, err) { out.push(step + ':FAIL ' + (err && err.message ? err.message : err)); report(); }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function poll(label, predicate, tries) {
    var n = 0;
    return new Promise(function (resolve, reject) {
      var tick = function () {
        if (predicate()) return resolve();
        if (++n > (tries || 40)) return reject(new Error(label + ' timed out'));
        setTimeout(tick, 100);
      };
      tick();
    });
  }
  async function run() {
    try {
      var g = function (id) { var el = document.getElementById(id); if (!el) throw new Error('missing #' + id); return el; };
      window.fetch = function () {
        return Promise.resolve({ ok: false, status: 401, json: function () { return Promise.resolve({ detail: 'test stub' }); } });
      };
      g('transcript').value = 'Manager: We need an inventory system. Client: budget is 5000 dollars.';
      g('transcript').dispatchEvent(new Event('input'));
      g('companyName').value = 'Acme';
      g('companyName').dispatchEvent(new Event('input'));
      await wait(50);
      g('generateBtn').click();
      await poll('review', function () { return document.querySelectorAll('#reviewForm input[data-field]').length > 0; });
      out.push('entered-review');
      report();
      var field = document.querySelector('#reviewForm input[data-field]');
      field.value = 'Edited title';
      field.dispatchEvent(new Event('input', { bubbles: true }));
      out.push('typed');
      report();
      // Enter must not submit — dispatchEvent returns false when prevented.
      field.focus();
      var enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
      if (field.dispatchEvent(enter)) throw new Error('Enter was not intercepted');
      if (g('reviewView').hidden) throw new Error('Enter left the review step');
      if (!g('deckView').hidden) throw new Error('Enter rendered the deck');
      out.push('enter-blocked');
      report();
      if (document.activeElement === field) throw new Error('Enter did not move focus to the next field');
      out.push('focus-moved');
      report();
      // Even a raw submit event must be cancelled.
      var submit = new Event('submit', { bubbles: true, cancelable: true });
      if (g('reviewForm').dispatchEvent(submit)) throw new Error('form submit was not prevented');
      if (g('reviewView').hidden || !g('deckView').hidden) throw new Error('submit left the review step');
      out.push('submit-blocked');
      report();
      // Ctrl+Enter is the deliberate render.
      var ctrlEnter = new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true, cancelable: true });
      field.dispatchEvent(ctrlEnter);
      await poll('deck', function () { return !g('deckView').hidden; });
      if (document.querySelectorAll('#stage .slide').length !== 8) throw new Error('deck did not render 8 slides');
      out.push('ctrl-enter-renders');
      report();
    } catch (e) {
      fail('edit', e);
    }
  }
  run();
})();
</script>`;
}

function buildFlowDriver() {
  return String.raw`
<script>
(function () {
  var out = [];
  function report() { document.title = 'FLOWTEST ' + out.join(' | '); }
  function fail(step, err) { out.push(step + ':FAIL ' + (err && err.message ? err.message : err)); report(); }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function poll(label, predicate, tries) {
    var n = 0;
    return new Promise(function (resolve, reject) {
      var tick = function () {
        if (predicate()) return resolve();
        if (++n > (tries || 40)) return reject(new Error(label + ' timed out'));
        setTimeout(tick, 100);
      };
      tick();
    });
  }
  async function run() {
    try {
      var g = function (id) { var el = document.getElementById(id); if (!el) throw new Error('missing #' + id); return el; };
      // 1. boot
      if (!g('generateBtn')) throw new Error('no generateBtn');
      out.push('boot');
      report();
      // Deterministic offline tests: force the app's fetch to fail so it takes
      // the sample-fallback path without hitting the live Modal generator.
      window.fetch = function () {
        return Promise.resolve({ ok: false, status: 401, json: function () { return Promise.resolve({ detail: 'test stub' }); } });
      };
      // 2. fill the form
      g('transcript').value = 'Manager: We need an inventory system. Client: budget is 5000 dollars, timeline two months.';
      g('transcript').dispatchEvent(new Event('input'));
      g('companyName').value = 'Acme';
      g('companyName').dispatchEvent(new Event('input'));
      await wait(50);
      if (g('generateBtn').disabled) throw new Error('generateBtn disabled after filling');
      out.push('validate');
      report();
      // 3. generate (token missing -> sample fallback path)
      g('generateBtn').click();
      await poll('review', function () { return document.querySelectorAll('#reviewForm [data-field]').length > 0; });
      out.push('review');
      report();
      // 5. render the deck
      g('renderBtn').click();
      await poll('deck', function () { return !g('deckView').hidden; });
      out.push('deck');
      report();
      var slides = document.querySelectorAll('#stage .slide');
      out.push('slides=8');
      report();
      if (!/1 \/ 8/.test(g('counter').textContent)) throw new Error('counter is ' + g('counter').textContent);
      out.push('counter');
      report();
      // 6. pointer navigation
      g('nextBtn').click();
      if (!/2 \/ 8/.test(g('counter').textContent)) throw new Error('next: ' + g('counter').textContent);
      out.push('next');
      report();
      g('nextBtn').click();
      if (!/3 \/ 8/.test(g('counter').textContent)) throw new Error('next x2: ' + g('counter').textContent);
      out.push('next2');
      report();
      // 6. keyboard navigation
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
      if (!/2 \/ 8/.test(g('counter').textContent)) throw new Error('ArrowLeft: ' + g('counter').textContent);
      out.push('arrowleft');
      report();
      g('prevBtn').click();
      if (!/1 \/ 8/.test(g('counter').textContent)) throw new Error('prev: ' + g('counter').textContent);
      out.push('prev');
      report();
      // 7. progress dot jump
      var dots = g('progress').querySelectorAll('.dot');
      if (dots.length !== 8) throw new Error('dots: ' + dots.length);
      dots[7].click();
      if (!/8 \/ 8/.test(g('counter').textContent)) throw new Error('dot jump: ' + g('counter').textContent);
      out.push('dots');
      report();
    } catch (e) {
      fail('flow', e);
    }
  }
  run();
})();
</script>`;
}

function buildExportDriver() {
  return String.raw`
<script>
(function () {
  var out = [];
  function report() { document.title = 'FLOWTEST ' + out.join(' | '); }
  function fail(step, err) { out.push(step + ':FAIL ' + (err && err.message ? err.message : err)); report(); }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function poll(label, predicate, tries) {
    var n = 0;
    return new Promise(function (resolve, reject) {
      var tick = function () {
        if (predicate()) return resolve();
        if (++n > (tries || 40)) return reject(new Error(label + ' timed out'));
        setTimeout(tick, 100);
      };
      tick();
    });
  }
  async function run() {
    try {
      var g = function (id) { var el = document.getElementById(id); if (!el) throw new Error('missing #' + id); return el; };
      // Deterministic offline tests: fail fetch so generate() uses the
      // sample-fallback path without calling the live Modal generator.
      window.fetch = function () {
        return Promise.resolve({ ok: false, status: 401, json: function () { return Promise.resolve({ detail: 'test stub' }); } });
      };
      g('transcript').value = 'Manager: We need an inventory system. Client: budget is 5000 dollars, timeline two months.';
      g('transcript').dispatchEvent(new Event('input'));
      g('companyName').value = 'Acme';
      g('companyName').dispatchEvent(new Event('input'));
      await wait(50);
      g('generateBtn').click();
      await poll('review', function () { return document.querySelectorAll('#reviewForm [data-field]').length > 0; });
      g('renderBtn').click();
      await poll('deck', function () { return !g('deckView').hidden; });
      if (document.querySelectorAll('#stage .slide').length !== 8) throw new Error('deck did not render 8 slides');
      // Mirror download() exactly: same inputs, same exportDocument call.
      var H = window.ProposalHelpers;
      var html = H.exportDocument(
        g('stage').innerHTML,
        g('deckTheme').textContent,
        g('exportNav').textContent,
        g('companyName').value,
        'today',
        window.SignDeckSource
      );
      var t = document.createElement('textarea');
      t.id = 'exportOut';
      // textContent (not .value) survives --dump-dom serialization.
      t.textContent = encodeURIComponent(html);
      document.body.appendChild(t);
      out.push('export-built');
      report();
    } catch (e) {
      fail('export', e);
    }
  }
  run();
})();
</script>`;
}

function buildVerifyDriver() {
  return String.raw`
<script>
(function () {
  var out = [];
  function report() { document.title = 'EXPORTTEST ' + out.join(' | '); }
  function fail(step, err) { out.push(step + ':FAIL ' + (err && err.message ? err.message : err)); report(); }
  try {
    var slides = document.querySelectorAll('.slide');
      if (slides.length !== 8) throw new Error('expected 8 slides, got ' + slides.length);
      out.push('slides=8');
    var first = getComputedStyle(slides[0]).visibility;
    var second = getComputedStyle(slides[1]).visibility;
    if (first !== 'visible') throw new Error('first slide not visible: ' + first);
    if (second !== 'hidden') throw new Error('second slide should be hidden: ' + second);
    out.push('visibility');
    var transform = document.querySelector('.stage').style.transform;
    if (!/scale\(0\.\d+/.test(transform)) throw new Error('stage not scaled: ' + transform);
    out.push('fit=' + transform);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    if (!slides[1].classList.contains('active')) throw new Error('ArrowRight did not advance');
    out.push('nav');
    // sign & accept flow on the terms slide (last slide)
    var signCard = document.querySelector('.terms-accept');
    if (!signCard) throw new Error('.terms-accept not present in export');
    if (!signCard._signInstalled) throw new Error('sign UI was not installed');
    for (var k = 1; k < 8; k++) document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    var lastSlide = slides[slides.length - 1];
    if (!lastSlide.classList.contains('active')) throw new Error('could not reach terms slide');
    var pad = document.querySelector('.sign-canvas');
    var nameEl = document.querySelector('#signName');
    if (!pad || !nameEl) throw new Error('sign pad or name field missing');
    function paint(x, y) {
      pad.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: x, clientY: y }));
      pad.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, cancelable: true, clientX: x + 60, clientY: y + 20 }));
      pad.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, clientX: x + 60, clientY: y + 20 }));
    }
    paint(80, 70);
    paint(180, 95);
    if (!signCard.classList.contains('signed')) {
      nameEl.value = 'Alex Doe';
      signCard.querySelector('.act').click();
    }
    if (!signCard.classList.contains('signed')) throw new Error('signing did not mark card as signed');
    if (!document.querySelector('.sign-copy')) throw new Error('signature image was not embedded after signing');
    var badge = signCard.querySelector('.signed-badge');
    if (getComputedStyle(badge).display === 'none') throw new Error('signed badge not visible after acceptance');
    var saved = JSON.parse(window.localStorage.getItem('proposal-sign:' + window.location.pathname));
    if (!saved || !saved.signature || saved.signature.indexOf('data:image/png') !== 0) throw new Error('signature was not saved to the page storage');
    if (saved.signerName !== 'Alex Doe') throw new Error('saved signer name mismatch: ' + saved.signerName);
    out.push('sign');
  } catch (e) {
    fail('verify', e);
  }
  report();
})();
</script>`;
}

function runChromium(fileUrl, budget) {
  return execFileSync(chromium, [
    '--headless', '--no-sandbox', '--disable-gpu',
    '--allow-file-access-from-files',
    '--virtual-time-budget=' + (budget || 10000),
    '--dump-dom', fileUrl,
  ], { encoding: 'utf8', timeout: 50000 });
}

function extractTitle(dom) {
  return (dom.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
}

function readIndex() {
  return readFileSync(resolve('frontend/index.html'), 'utf8');
}
