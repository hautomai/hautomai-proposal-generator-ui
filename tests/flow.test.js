const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = fs.readFileSync('frontend/src/app.js', 'utf8');

test('review render button prevents form submission and calls render flow', () => {
  assert.match(source, /on\('renderBtn','click',renderFromReview\)/);
  assert.match(source, /function renderFromReview\(event\)/);
  assert.match(source, /state\.step='deck'/);
});

test('review editor blocks implicit form submission on Enter and Tab', () => {
  assert.match(source, /reviewForm\.addEventListener\('submit'/);
  assert.match(source, /reviewForm\.addEventListener\('keydown', reviewKeydown\)/);
  assert.match(source, /function reviewKeydown\(event\)/);
  assert.match(source, /focusNextField\(node\)/);
  const html = fs.readFileSync('frontend/shell.html', 'utf8');
  assert.match(html, /id="renderBtn" type="button"/);
  assert.match(html, /id="backFromReview" type="button"/);
});

test('deck controls are present in the shell', () => {
  const html = fs.readFileSync('frontend/shell.html', 'utf8');
  for (const id of ['renderBtn', 'stage', 'editDeck', 'downloadBtn', 'printBtn', 'prevBtn', 'nextBtn']) assert.match(html, new RegExp(`id="${id}"`));
});

test('sign & accept is wired into deck, export, and shell signing module', () => {
  assert.match(source, /terms-accept/);
  assert.match(source, /root\.SignDeckSource/);
  assert.match(source, /if\(root\.SignDeck\) root\.SignDeck\(\)/);
  const signing = fs.readFileSync('frontend/src/signing.js', 'utf8');
  assert.match(signing, /SignDeckSource/);
  assert.match(signing, /localStorage/);
  const shell = fs.readFileSync('frontend/shell.html', 'utf8');
  assert.match(shell, /INJECT_SIGNING/);
});
