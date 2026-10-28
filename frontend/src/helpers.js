/* Pure helpers for the Proposal Generator UI. Browser and Node compatible. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ProposalHelpers = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const MISSING = '[missing]';

  function text(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : MISSING;
  }
  function list(value) {
    if (Array.isArray(value)) return value.length ? value.map(text) : [MISSING];
    if (typeof value === 'string' && value.trim()) return value.split(/\r?\n/).map(text).filter(Boolean);
    return [MISSING];
  }
  function nodeList(value) {
    if (!Array.isArray(value)) return [];
    return value.map((item) => {
      if (typeof item === 'string') return { title: text(item), desc: '', tag: '', step: '' };
      return Object.assign(
        { title: text(item.title), desc: text(item.desc), tag: text(item.tag), step: text(item.step) },
        item
      );
    });
  }
  function toolList(value) {
    if (!Array.isArray(value)) return [];
    return value.map((item) => ({
      role: text(item.role), name: text(item.name), desc: text(item.desc), price: text(item.price)
    }));
  }
  function panelList(value) {
    if (!Array.isArray(value)) return [];
    return value.map((item) => ({
      tag: text(item.tag), amount: text(item.amount), note: text(item.note),
      items: list(item.items), hot: Boolean(item.hot), promo: text(item.promo)
    }));
  }
  function stepList(value) {
    if (!Array.isArray(value)) return [];
    return value.map((item, i) => ({
      num: text(item.num || String(i + 1).padStart(2, '0')),
      title: text(item.title), desc: text(item.desc)
    }));
  }
  function phaseList(value) {
    if (!Array.isArray(value)) return [];
    return value.map((item) => {
      if (typeof item === 'string') return phase(item);
      return { label: text(item.label), duration: text(item.duration) };
    });
  }
  function phase(value) {
    const match = String(value).match(/^\s*(.*?)\s*:\s*(\d+(?:\.\d+)?)\s+business\s+days?\s*$/i);
    return match ? { label: match[1], duration: `${match[2]} business day${match[2] === '1' ? '' : 's'}` } : { label: text(value), duration: '' };
  }

  /* ── Slide type registry (fixed template) ────────────────────────────── */
  // The deck always renders these 8 slides, in this order, matching the
  // hand-tuned design (tmp.html + a closing Terms/signature slide).
  const TEMPLATE_ORDER = ['cover', 'signal', 'architecture', 'volume', 'tools', 'investment', 'close', 'terms'];
  const SLIDE_TYPES = {
    cover: {
      required: true,
      label: 'Cover',
      fields: ['title', 'serviceType', 'subtitle', 'company', 'consultant', 'date']
    },
    signal: {
      required: false,
      label: 'The signal',
      fields: ['eyebrow', 'heading', 'intro', 'roles', 'rolesNote', 'nodes']
    },
    architecture: {
      required: false,
      label: 'How it works',
      fields: ['eyebrow', 'heading', 'intro', 'nodes', 'note']
    },
    volume: {
      required: false,
      label: 'Volume & cadence',
      fields: ['eyebrow', 'heading', 'intro', 'cards', 'metrics']
    },
    tools: {
      required: false,
      label: 'Tools & stack',
      fields: ['eyebrow', 'heading', 'tools', 'note']
    },
    investment: {
      required: false,
      label: 'Investment',
      fields: ['eyebrow', 'heading', 'panels']
    },
    close: {
      required: false,
      label: 'Close',
      fields: ['pill', 'heading', 'intro', 'steps', 'cta']
    },
    terms: {
      required: true,
      label: 'Terms & signature',
      fields: ['heading', 'termsText', 'company', 'consultant', 'email', 'date']
    }
  };

  function emptySlide(type) {
    var base = { type: type };
    SLIDE_TYPES[type].fields.forEach(function (key) {
      var arrayKeys = ['nodes', 'tools', 'panels', 'steps', 'cards', 'roles', 'metrics', 'items'];
      base[key] = arrayKeys.indexOf(key) > -1 ? [] : '';
    });
    return normalizeSlide(base);
  }

  function normalizeSlide(slide) {
    var type = slide && SLIDE_TYPES[slide.type] ? slide.type : 'signal';
    var def = SLIDE_TYPES[type];
    var s = Object.assign({ type: type }, slide);
    def.fields.forEach(function (key) {
      if (key === 'nodes') { s.nodes = nodeList(s.nodes); }
      else if (key === 'tools') { s.tools = toolList(s.tools); }
      else if (key === 'panels') { s.panels = panelList(s.panels); }
      else if (key === 'steps') { s.steps = stepList(s.steps); }
      else if (key === 'phases') { s.phases = phaseList(s.phases); }
      else if (key === 'cards') {
        s.cards = Array.isArray(s.cards) ? s.cards.map(function (c) {
          if (typeof c === 'string') return { day: text(c), icon: '', title: text(c), desc: '' };
          return { day: text(c.day), icon: text(c.icon), title: text(c.title), desc: text(c.desc) };
        }) : [];
      }
      else if (key === 'metrics' || key === 'roles' || key === 'items') { s[key] = list(s[key]); }
      else { s[key] = text(s[key]); }
    });
    return s;
  }

  /* ── Old-format → fixed-template conversion ──────────────────────────── */
  function normalizeToSlides(input) {
    var source = input && typeof input === 'object' ? input : {};
    var provided = {};
    if (source.slides && Array.isArray(source.slides) && source.slides.length) {
      source.slides.forEach(function (s) {
        if (s && s.type && SLIDE_TYPES[s.type]) provided[s.type] = normalizeSlide(s);
      });
    }
    // Old flat format: 9-slot structure collapsed into the 8-slide template.
    if (!Object.keys(provided).length && source.proposalTitle !== undefined) {
      var p = {};
      ['proposalTitle', 'serviceType', 'problemIntro', 'solutionIntro'].forEach(function (k) { p[k] = text(source[k]); });
      for (var i = 1; i <= 5; i += 1) {
        ['problemPoint' + i, 'problemDesc' + i, 'solutionPoint' + i, 'solutionDesc' + i].forEach(function (k) { p[k] = text(source[k]); });
      }
      p.roles = list(source.leadRoles || []);
      p.rolesNote = text(source.signalNote);
      p.archNote = text(source.architectureNote);
      provided.cover = normalizeSlide({ type: 'cover', title: p.proposalTitle, serviceType: p.serviceType, subtitle: '' });
      var probNodes = Array.from({ length: 5 }, function (_, j) {
        return { tag: '0' + (j + 1) + ' · SIGNAL', title: p['problemPoint' + (j + 1)], desc: p['problemDesc' + (j + 1)] };
      }).filter(function (n) { return n.title !== MISSING || n.desc !== MISSING; });
      if (probNodes.length) {
        provided.signal = normalizeSlide({
          type: 'signal', eyebrow: 'The signal', heading: 'Where things stand',
          intro: p.problemIntro || p.problemPoint1, roles: list(source.signalRoles || []),
          rolesNote: p.rolesNote, nodes: probNodes
        });
      }
      var solNodes = Array.from({ length: 5 }, function (_, j) {
        return { step: '0' + (j + 1) + ' · STEP', title: p['solutionPoint' + (j + 1)], desc: p['solutionDesc' + (j + 1)] };
      }).filter(function (n) { return n.title !== MISSING || n.desc !== MISSING; });
      if (solNodes.length) {
        provided.architecture = normalizeSlide({
          type: 'architecture', eyebrow: 'The pipeline', heading: 'How it works', intro: p.solutionIntro,
          nodes: solNodes, note: p.archNote
        });
      }
      if (p.solutionIntro !== MISSING) {
        provided.close = normalizeSlide({
          type: 'close', pill: 'Next step', heading: "Let's get started", intro: p.solutionIntro,
          steps: [], cta: 'Get started →'
        });
      }
    }
    return TEMPLATE_ORDER.map(function (type) { return provided[type] || emptySlide(type); });
  }

  /* ── Backward-compat normalizeProposal (returns flat fields) ─────────── */
  var scalarFields = ['proposalTitle', 'serviceType', 'problemIntro', 'solutionIntro'];
  var pointFields = [];
  for (var fi = 1; fi <= 5; fi += 1) pointFields.push('problemPoint' + fi, 'problemDesc' + fi, 'solutionPoint' + fi, 'solutionDesc' + fi);
  function normalizeProposal(input) {
    var source = input && typeof input === 'object' ? input : {};
    var out = {};
    scalarFields.forEach(function (key) { out[key] = text(source[key]); });
    pointFields.forEach(function (key) { out[key] = text(source[key]); });
    out.scopeItems = list(source.scopeItems);
    out.timelineItems = list(source.timelineItems);
    return out;
  }
  function isEmptyVal(v) { return v === MISSING || (typeof v === 'string' && v.trim() === ''); }
  function missingCount(slidesOrProposal) {
    if (!slidesOrProposal) return 0;
    if (Array.isArray(slidesOrProposal)) {
      var count = 0;
      slidesOrProposal.forEach(function (slide) {
        Object.keys(slide).forEach(function (key) {
          if (key === 'type') return;
          var val = slide[key];
          if (Array.isArray(val)) {
            val.forEach(function (item) {
              if (item === MISSING) count += 1;
              else if (item && typeof item === 'object') {
                Object.keys(item).forEach(function (k) { if (isEmptyVal(item[k])) count += 1; });
              }
            });
          } else if (isEmptyVal(val)) {
            count += 1;
          }
        });
      });
      return count;
    }
    var out = 0;
    Object.values(slidesOrProposal).forEach(function (value) {
      var values = Array.isArray(value) ? value : [value];
      values.forEach(function (item) { if (item === MISSING) out += 1; });
    });
    return out;
  }
  function depositAmount(price) {
    if (typeof price !== 'string' && typeof price !== 'number') return '';
    var value = String(price).replace(/[$,\s]/g, '');
    if (!value || !/^\d+(?:\.\d+)?$/.test(value)) return '';
    return '$' + (Number(value) / 2).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function stableHash(value) {
    var input = String(value);
    var hash = 2166136261;
    for (var i = 0; i < input.length; i += 1) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }
  function inputHash(fields) {
    return stableHash(['transcript', 'company_name', 'consultant_name', 'price', 'consultant_email'].map(function (key) { return key + '=' + (fields[key] || ''); }).join('\u0000'));
  }

  /* ── slideModel: accepts slides[] or old flat format ─────────────────── */
  function missing(value) { return value === MISSING || value === ''; }
  function fillFromMeta(out, key, info) {
    if (missing(out[key])) out[key] = info[key];
    else out[key] = out[key];
    return out[key];
  }

  function slideModel(slidesOrProposal, meta) {
    var info = Object.assign({ company: MISSING, consultant: MISSING, email: '', date: '', price: '', terms: '' }, meta || {});
    var byType = {};
    if (slidesOrProposal && Array.isArray(slidesOrProposal.slides)) {
      slidesOrProposal.slides.forEach(function (s) { if (s && SLIDE_TYPES[s.type]) byType[s.type] = normalizeSlide(s); });
    } else if (slidesOrProposal && Array.isArray(slidesOrProposal)) {
      slidesOrProposal.forEach(function (s) { if (s && SLIDE_TYPES[s.type]) byType[s.type] = normalizeSlide(s); });
    } else {
      normalizeToSlides(slidesOrProposal || {}).forEach(function (s) { byType[s.type] = s; });
    }
    var slides = TEMPLATE_ORDER.map(function (type) { return byType[type] || emptySlide(type); });
    slides = slides.map(function (s) {
      var out = Object.assign({}, s);
      if (out.type === 'cover') {
        fillFromMeta(out, 'company', info);
        fillFromMeta(out, 'consultant', info);
        fillFromMeta(out, 'date', info);
      } else if (out.type === 'terms') {
        fillFromMeta(out, 'company', info);
        fillFromMeta(out, 'consultant', info);
        fillFromMeta(out, 'email', info);
        fillFromMeta(out, 'date', info);
        fillFromMeta(out, 'termsText', info);
      } else if (out.type === 'investment') {
        if (!out.panels || !out.panels.length) {
          out.panels = panelList([
            { tag: 'Total project fee', amount: info.price, note: 'One fixed fee covering the full scope described in this proposal.', items: [], hot: false },
            { tag: 'Deposit due at signing', amount: depositAmount(info.price) || MISSING, note: 'Confirmation to begin work — balance payable on handover.', items: [], hot: true }
          ]);
        }
      }
      return out;
    });
    return slides;
  }

  function slug(value) { return String(value || 'proposal').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'proposal'; }
  function escapeHtml(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]; }); }
  function exportDocument(slidesHtml, css, navJs, company, date, signJs) {
    var closeTag = '<' + '/script>';
    var deckCss = '\n  body{margin:0;background:#111;overflow:hidden}\n  .deck-export{position:fixed;inset:0;overflow:hidden}\n  .stage{position:absolute;left:50%;top:50%;width:1920px;height:1080px;margin-left:-960px;margin-top:-540px;transform-origin:center center}\n  .stage-inner{width:100%;height:100%;position:relative}\n  .slide{position:absolute;inset:0;visibility:hidden;opacity:0;pointer-events:none;transition:opacity .55s ease,transform .55s ease;transform:translateX(24px)}\n  .slide.active{visibility:visible;opacity:1;pointer-events:auto;transform:translateX(0)}\n  .slide.active .stage-inner>*{animation:rise .65s both;animation-delay:calc(var(--n,0)*80ms)}\n  @keyframes rise{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}\n  @media (prefers-reduced-motion:reduce){.slide,.slide.active{transition:none}.slide.active .stage-inner>*{animation:none}}\n  @page{size:1920px 1080px;margin:0}\n  @media print{\n    body{background:#fff;overflow:visible}\n    .deck-export{position:static;inset:auto;overflow:visible}\n    .controls{display:none!important}\n    .stage{position:static!important;transform:none!important;margin:0!important;overflow:visible!important;height:auto!important;width:auto!important;padding:0!important;background:none!important}\n    .stage:before{display:none!important}\n    .stage-inner{height:1080px!important}\n    .slide{position:relative!important;visibility:visible!important;opacity:1!important;transform:none!important;width:1920px;height:1080px;overflow:hidden;background:var(--paper);break-inside:avoid;break-before:page;page-break-before:always}\n    .slide:first-child{break-before:auto;page-break-before:auto}\n    .slide.active .stage-inner>*{animation:none!important}\n    .slide{-webkit-print-color-adjust:exact;print-color-adjust:exact}\n    .stage,.panel{-webkit-print-color-adjust:exact;print-color-adjust:exact}\n  }\n  ';
    var fitter = '(function(){var s=document.querySelector(\'.stage\');function f(){var r=Math.min(innerWidth/1920,innerHeight/1080);if(s)s.style.transform=\'scale(\'+r+\')\';}addEventListener(\'resize\',f);f();})();';
    var sign = signJs ? '<script>' + signJs + closeTag : '';
    return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + escapeHtml(company) + ' proposal</title><style>' + css + deckCss + '</style></head><body><main id="deck" class="deck-export"><div class="stage">' + slidesHtml + '</div></main><nav class="controls" aria-label="Presentation controls"></nav><script>' + fitter + closeTag + '<script>' + navJs + closeTag + sign + '</body></html>';
  }

  return { MISSING: MISSING, TEMPLATE_ORDER: TEMPLATE_ORDER, SLIDE_TYPES: SLIDE_TYPES, emptySlide: emptySlide, normalizeSlide: normalizeSlide, normalizeToSlides: normalizeToSlides, normalizeProposal: normalizeProposal, missingCount: missingCount, depositAmount: depositAmount, stableHash: stableHash, inputHash: inputHash, phase: phase, slideModel: slideModel, slug: slug, escapeHtml: escapeHtml, exportDocument: exportDocument };
});
