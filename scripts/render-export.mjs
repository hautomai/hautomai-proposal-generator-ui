#!/usr/bin/env node
// Render the standalone proposal-deck export that the app's Download HTML
// button produces, using the sample fallback data, and write it to a file.
// Useful for previewing the final artifact and for seeding publish.py.
//
//   node scripts/render-export.mjs sample-deck.html [companyName]
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const chromium = '/usr/bin/chromium';
const ROOT = process.cwd();
const outPath = process.argv[2] || 'sample-deck.html';
const company = process.argv[3] || 'Symplify Marketing';

function run(fileUrl, budget = 10000) {
  return execFileSync(chromium, [
    '--headless', '--no-sandbox', '--disable-gpu', '--allow-file-access-from-files',
    '--virtual-time-budget=' + budget, '--dump-dom', fileUrl,
  ], { encoding: 'utf8', timeout: 60000 });
}
const title = (dom) => (dom.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
const cwd = resolve(ROOT);

const driver = `<script>
(function(){
  var out=[]; function rep(){document.title='RENDER '+out.join('|');}
  function fail(e){out.push('FAIL '+(e&&e.message||e));rep();}
  if(window.top!==window.self){rep();return;}
  (async function(){
    try{
      var g=function(id){var el=document.getElementById(id);if(!el)throw new Error('missing '+id);return el;};
      g('transcript').value='We need a reliable lead generation system that finds qualified merchant trade suppliers and delivers verified records every week.';
      g('transcript').dispatchEvent(new Event('input'));
      g('companyName').value='${company.replace(/'/g, '')}';
      g('companyName').dispatchEvent(new Event('input'));
      await new Promise(function(r){setTimeout(r,50)});
      g('generateBtn').click();
      var n=0; while(g('styleGrid').children.length===0 && n<60){await new Promise(function(r){setTimeout(r,100)});n++;}
      if(g('styleGrid').children.length===0) throw new Error('no styles rendered');
      g('styleGrid').children[0].click();
      while(document.querySelectorAll('#reviewForm [data-key]').length===0 && n<80){await new Promise(function(r){setTimeout(r,100)});n++;}
      g('renderBtn').click();
      while(g('deckView').hidden && n<100){await new Promise(function(r){setTimeout(r,100)});n++;}
      var H=window.ProposalHelpers;
      var html=H.exportDocument(g('stage').innerHTML,g('deckTheme').textContent,g('exportNav').textContent,g('companyName').value,'today',window.SignDeckSource);
      var t=document.createElement('textarea'); t.id='exportOut'; t.textContent=encodeURIComponent(html); document.body.appendChild(t);
      out.push('built'); rep();
    }catch(e){fail(e);}
  })();
})();<\/script>`;

const dir = mkdtempSync(join(tmpdir(), 'render-export-'));
const entry = join(dir, 'index.html');
writeFileSync(entry, readFileSync(join(cwd, 'frontend/index.html'), 'utf8') + driver);
const dom = run('file://' + entry);
const result = title(dom).replace(/[\s\S]*RENDER /, '').trim();
if (!/built/.test(result)) {
  rmSync(dir, { recursive: true, force: true });
  console.error('render-export failed:', result);
  process.exit(1);
}
const match = dom.match(/<textarea id="exportOut">([^<]*)<\/textarea>/);
const html = decodeURIComponent(match[1]);
const out = resolve(cwd, outPath);
writeFileSync(out, html);
rmSync(dir, { recursive: true, force: true });
console.log('Wrote', out, `(${html.length} bytes)`);