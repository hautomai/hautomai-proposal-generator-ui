(function (root) {
  var H = root.ProposalHelpers, S = root.ProposalStyles, sample = root.SampleData;
  var SLIDE_TYPES = {
    cover: { required: true, label: 'Cover', fields: ['title', 'serviceType', 'subtitle', 'company', 'consultant', 'date'] },
    signal: { required: false, label: 'The signal', fields: ['eyebrow', 'heading', 'intro', 'roles', 'rolesNote', 'nodes'] },
    architecture: { required: false, label: 'How it works', fields: ['eyebrow', 'heading', 'intro', 'nodes', 'note'] },
    volume: { required: false, label: 'Volume & cadence', fields: ['eyebrow', 'heading', 'intro', 'cards', 'metrics'] },
    tools: { required: false, label: 'Tools & stack', fields: ['eyebrow', 'heading', 'tools', 'note'] },
    investment: { required: false, label: 'Investment', fields: ['eyebrow', 'heading', 'panels'] },
    close: { required: false, label: 'Close', fields: ['pill', 'heading', 'intro', 'steps', 'cta'] },
    terms: { required: true, label: 'Terms & signature', fields: ['heading', 'termsText', 'company', 'consultant', 'email', 'date'] }
  };
  var API_URL = 'https://securha-n8n--proposal-generator-generate-proposal.modal.run';
  var API_TOKEN = '__PROPOSAL_API_TOKEN__';
  var CONSULTANT_NAME = '__CONSULTANT_NAME__';
  var CONSULTANT_EMAIL = '__CONSULTANT_EMAIL__';
  var state = { view:'panel', step:'idle', styles:[], style:null, proposal:null, meta:null, slides:[], index:0, sample:false, sampleNote:'', error:'', cache:null, fromDeck:false };
  var $ = function (id) { return document.getElementById(id); };
  var esc = H.escapeHtml;

  function el(tag, attrs, html) { var node=document.createElement(tag); if(attrs) Object.entries(attrs).forEach(function(e){node.setAttribute(e[0],e[1]);}); node.innerHTML=html||''; return node; }
  function on(id, type, fn) { var node=$(id); if(!node){ console.error('UI init: missing #'+id); return; } node.addEventListener(type, fn); }
  function missing(value) { return value===H.MISSING?'<span class="missing">[missing]</span>':esc(value); }

  function init() {
    if (CONSULTANT_NAME.indexOf('__') !== 0) $('consultantName').value=CONSULTANT_NAME;
    if (CONSULTANT_EMAIL.indexOf('__') !== 0) $('consultantEmail').value=CONSULTANT_EMAIL;
    on('fileInput','change',readFile); on('transcript','input',updateCount);
    on('generateBtn','click',generate); on('retryBtn','click',generate); on('backPanel','click',showPanel); on('backFromReview','click',showPanel);
    on('companyName','input',validate); on('consultantName','input',validate); on('consultantEmail','input',validate); on('price','input',validate);
    on('renderBtn','click',renderFromReview); on('editDeck','click',showReview); on('downloadBtn','click',download); on('printBtn','click',function(){window.print();});
    on('prevBtn','click',function(){move(-1);}); on('nextBtn','click',function(){move(1);}); document.addEventListener('keydown',keyHandler); window.addEventListener('resize',scaleStage); updateCount();
    // The editor is a <form> of plain fields. Left alone, the browser's
    // implicit submission would reload the file:// page on Enter and throw
    // the user out of the editor, so every implicit submit is blocked.
    var reviewForm = $('reviewForm');
    if (reviewForm) {
      reviewForm.addEventListener('submit', function(event) { event.preventDefault(); });
      reviewForm.addEventListener('keydown', reviewKeydown);
    }
  }

  // Enter stays inside the editor: it moves to the next field instead of
  // submitting, and Ctrl/Cmd+Enter is the deliberate "render the deck".
  function reviewKeydown(event) {
    if (event.key !== 'Enter') return;
    var node = event.target;
    var isTextarea = node && node.tagName === 'TEXTAREA';
    if (isTextarea && !event.ctrlKey && !event.metaKey) return; // newline
    event.preventDefault();
    if (event.ctrlKey || event.metaKey) { renderFromReview(event); return; }
    focusNextField(node);
  }

  function focusNextField(node) {
    var form = $('reviewForm');
    if (!form || !node || !node.matches) return;
    var fields = [].slice.call(form.querySelectorAll('input, textarea, button'));
    var from = fields.indexOf(node);
    if (from === -1) return;
    for (var i = from + 1; i < fields.length; i += 1) {
      if (fields[i].disabled) continue;
      fields[i].focus();
      if (fields[i].type !== 'checkbox' && typeof fields[i].select === 'function') fields[i].select();
      return;
    }
  }
  function readFile(event) { var file=event.target.files[0]; if (!file) return; var reader=new FileReader(); reader.onload=function(){$('transcript').value=reader.result; updateCount();}; reader.readAsText(file); }
  function updateCount() { var n=$('transcript').value.length; $('charCount').textContent=n.toLocaleString()+' characters'; $('largeWarning').hidden=n<=200000; validate(); }
  function validate() { var transcript=$('transcript').value.trim(); var company=$('companyName').value.trim(); var ok=Boolean(transcript && company); $('generateBtn').disabled=!ok || state.step==='analyzing'; $('transcriptError').textContent=transcript?'':'Transcript is required'; $('companyError').textContent=company?'':'Company name is required'; }
  function fields() { return { transcript:$('transcript').value, company_name:$('companyName').value.trim(), consultant_name:$('consultantName').value.trim()||'Consultant', consultant_email:$('consultantEmail').value.trim(), price:$('price').value.trim() }; }

  /* ── Generate ──────────────────────────────────────────────────────── */
  var defaultStyle = S.all[0];
  async function generate() {
    validate(); if ($('generateBtn').disabled && state.step!=='failed') return; var input=fields(), hash=H.inputHash(input); state.error=''; state.sample=false;
    if (state.cache && state.cache.hash===hash) { state.proposal=state.cache.proposal; state.meta=state.cache.meta; state.slides=null; state.sample=false; state.style=defaultStyle; state.step='review'; renderReview(); return; }
    state.step='analyzing'; setStatus('Analyzing transcript…','loading'); $('generateBtn').disabled=true; $('retryBtn').hidden=true;
    try {
      if (!API_TOKEN || API_TOKEN.indexOf('__') === 0) throw new Error('API token is not configured. Run python frontend/build.py with PROPOSAL_API_TOKEN set.');
      var controller=new AbortController(), timer=setTimeout(function(){controller.abort();},150000);
      var response=await fetch(API_URL,{method:'POST',headers:{'Authorization':'Bearer '+API_TOKEN,'Content-Type':'application/json'},body:JSON.stringify(input),signal:controller.signal}); clearTimeout(timer);
      var body=await response.json(); if (!response.ok) throw new Error(body.detail||'Request failed ('+response.status+')'); if (!body.success) throw new Error(body.error||'The proposal generator returned an error.'); if (!body.proposal) throw new Error('The endpoint did not return proposal content.');
      state.proposal=body.proposal; state.meta=makeMeta(input,body); state.slides=null; state.cache={hash:hash,proposal:state.proposal,meta:state.meta}; state.style=defaultStyle; state.step='review'; setStatus('Analysis complete.','success'); renderReview();
    } catch (error) { state.error=error.name==='AbortError'?'The request timed out after 150 seconds.':error.message; state.sample=true; state.sampleNote=state.error.indexOf('API token is not configured')>-1?'SAMPLE DATA — API token not configured. Add PROPOSAL_API_TOKEN to .env and rebuild.':'SAMPLE DATA — generator unreachable (' + state.error + ')'; state.proposal=sample.proposal; state.meta=makeMeta(Object.assign({},sample.inputs,{transcript:sample.transcript}),{}); state.slides=null; state.style=defaultStyle; state.step='review'; setStatus('Could not reach the generator. '+state.error,'error'); $('sampleBadge').hidden=false; $('sampleBadge').textContent=state.sampleNote; if($('retryBtn')) $('retryBtn').hidden=false; renderReview(); }
  }
  function makeMeta(input,body) { return { company:input.company_name, consultant:input.consultant_name, email:body.consultantEmail||input.consultant_email, date:new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}), price:input.price, terms:(input.consultant_name||'Consultant')+' will build the system for '+input.company_name+' according to the description laid out in this proposal. Additional features beyond the listed requirements may affect the timeline and costs outlined above.\n\nBy signing below, both parties indicate their acceptance of this proposal and constitute approval to begin work upon '+input.company_name+"'s payment of the deposit." }; }
  function setStatus(message,type) { $('status').textContent=message; $('status').className='status '+(type||''); }

  /* ── Review step (fixed 8 slide cards, edit-only) ─────────────────── */
  function renderReview() {
    showOnly('reviewView');
    var slides = getSlides();
    var form = $('reviewForm');
    form.innerHTML = '';

    var container = el('div', {class:'review-slides'});
    slides.forEach(function(slide, i) { container.appendChild(renderSlideCard(slide, i, slides.length)); });
    form.appendChild(container);

    updateAttention();
  }

  function getSlides() {
    if (state.slides && state.slides.length) return state.slides;
    state.slides = H.slideModel(state.proposal || {}, state.meta || {});
    return state.slides;
  }

  function getSlideHeading(slide) {
    if (!slide) return '';
    return slide.title || slide.heading || slide.termsText || slide.pill || '';
  }

  function renderSlideCard(slide, index, total) {
    var def = SLIDE_TYPES[slide.type] || SLIDE_TYPES.signal;
    var heading = getSlideHeading(slide);

    var card = el('div', {class:'slide-card' + (!heading || heading === '[missing]' ? ' slide-card-empty' : ''), 'data-index': index});

    var head = el('div', {class:'slide-card-head'});
    head.innerHTML = '<span class="slide-card-type">'+esc(def.label)+'</span>'
      + '<span class="slide-card-title'+(heading==='[missing]'||!heading?' empty':'')+'">'+esc(heading==='[missing]'?'Untitled slide':heading||'Untitled slide')+'</span>';

    head.addEventListener('click', function() {
      card.classList.toggle('expanded');
    });

    var body = el('div', {class:'slide-card-body'});
    body.innerHTML = renderSlideFields(slide);
    attachFieldListeners(body, slide);

    card.appendChild(head);
    card.appendChild(body);
    return card;
  }

  function renderSlideFields(slide) {
    var html = '';
    var type = slide.type;
    if (type === 'cover') {
      html += fieldInput('title', slide.title, 'Title');
      html += fieldInput('serviceType', slide.serviceType, 'Service type');
      html += fieldInput('subtitle', slide.subtitle, 'Subtitle');
      html += fieldInput('company', slide.company, 'Company');
      html += fieldInput('consultant', slide.consultant, 'Consultant');
      html += fieldInput('date', slide.date, 'Date');
    } else if (type === 'signal') {
      html += fieldInput('eyebrow', slide.eyebrow, 'Eyebrow');
      html += fieldInput('heading', slide.heading, 'Heading');
      html += fieldTextarea('intro', slide.intro, 'Intro text');
      html += '<div class="sub-heading">Roles</div>';
      html += '<div class="repeat-row" data-repeat="roles">';
      html += fieldAddButton('add_roles_0', 'roles', 'Add role');
      (slide.roles || []).forEach(function(role, i) {
        html += fieldInput('role_'+i, role, 'Role '+(i+1));
      });
      html += '</div>';
      html += fieldInput('rolesNote', slide.rolesNote, 'Roles footnote');
      html += '<div class="sub-heading">Signal nodes</div>';
      (slide.nodes || []).forEach(function(node, i) {
        html += '<div style="margin-bottom:12px;padding:10px;border:1px solid var(--line);border-radius:8px;">';
        html += fieldInput('node_tag_'+i, node.tag, 'Tag');
        html += fieldInput('node_title_'+i, node.title, 'Title');
        html += fieldTextarea('node_desc_'+i, node.desc, 'Description');
        html += '</div>';
      });
    } else if (type === 'architecture') {
      html += fieldInput('eyebrow', slide.eyebrow, 'Eyebrow');
      html += fieldInput('heading', slide.heading, 'Heading');
      html += fieldTextarea('intro', slide.intro, 'Intro text');
      html += '<div class="sub-heading">Pipeline nodes</div>';
      (slide.nodes || []).forEach(function(node, i) {
        html += '<div style="margin-bottom:12px;padding:10px;border:1px solid var(--line);border-radius:8px;">';
        html += fieldInput('node_step_'+i, node.step, 'Step');
        html += fieldInput('node_title_'+i, node.title, 'Title');
        html += fieldTextarea('node_desc_'+i, node.desc, 'Description');
        html += '<label class="field"><input type="checkbox" data-field="node_hot_'+i+'"'+(node.hot?' checked':'')+'> Highlight</label>';
        html += '</div>';
      });
      html += fieldInput('note', slide.note, 'Footer note');
    } else if (type === 'volume') {
      html += fieldInput('eyebrow', slide.eyebrow, 'Eyebrow');
      html += fieldInput('heading', slide.heading, 'Heading');
      html += fieldTextarea('intro', slide.intro, 'Intro text');
      html += '<div class="sub-heading">Day cards</div>';
      (slide.cards || []).forEach(function(card, i) {
        html += '<div style="margin-bottom:12px;padding:10px;border:1px solid var(--line);border-radius:8px;">';
        html += fieldInput('card_day_'+i, card.day, 'Label');
        html += fieldInput('card_icon_'+i, card.icon, 'Icon');
        html += fieldInput('card_title_'+i, card.title, 'Title');
        html += fieldTextarea('card_desc_'+i, card.desc, 'Description');
        html += '</div>';
      });
      html += '<div class="sub-heading">Metrics</div>';
      (slide.metrics || []).forEach(function(m, i) {
        html += fieldInput('metric_'+i, m, 'Metric');
      });
      html += fieldAddButton('add_metric', 'metrics', 'Add metric');
    } else if (type === 'tools') {
      html += fieldInput('eyebrow', slide.eyebrow, 'Eyebrow');
      html += fieldInput('heading', slide.heading, 'Heading');
      html += '<div class="sub-heading">Tools</div>';
      (slide.tools || []).forEach(function(tool, i) {
        html += '<div style="margin-bottom:12px;padding:10px;border:1px solid var(--line);border-radius:8px;">';
        html += fieldInput('tool_role_'+i, tool.role, 'Role');
        html += fieldInput('tool_name_'+i, tool.name, 'Name');
        html += fieldTextarea('tool_desc_'+i, tool.desc, 'Description');
        html += fieldInput('tool_price_'+i, tool.price, 'Price');
        html += '</div>';
      });
      html += fieldInput('note', slide.note, 'Footer note');
    } else if (type === 'investment') {
      html += fieldInput('eyebrow', slide.eyebrow, 'Eyebrow');
      html += fieldInput('heading', slide.heading, 'Heading');
      html += '<div class="sub-heading">Price panels</div>';
      (slide.panels || []).forEach(function(panel, i) {
        html += '<div style="margin-bottom:12px;padding:10px;border:1px solid var(--line);border-radius:8px;">';
        html += fieldInput('panel_tag_'+i, panel.tag, 'Label');
        html += fieldInput('panel_amount_'+i, panel.amount, 'Amount');
        html += fieldInput('panel_note_'+i, panel.note, 'Note');
        html += fieldInput('panel_promo_'+i, panel.promo, 'Promo pill text');
        html += '<label class="field"><input type="checkbox" data-field="panel_hot_'+i+'"'+(panel.hot?' checked':'')+'> Highlight</label>';
        html += '<div class="sub-heading">Included items</div>';
        (panel.items || []).forEach(function(item, j) {
          html += fieldInput('panel_item_'+i+'_'+j, item, 'Item');
        });
        html += '</div>';
      });
    } else if (type === 'close') {
      html += fieldInput('pill', slide.pill, 'Pill text');
      html += fieldInput('heading', slide.heading, 'Heading');
      html += fieldTextarea('intro', slide.intro, 'Intro text');
      html += '<div class="sub-heading">Next steps</div>';
      (slide.steps || []).forEach(function(step, i) {
        html += fieldInput('step_num_'+i, step.num, 'Number');
        html += fieldInput('step_title_'+i, step.title, 'Title');
        html += fieldTextarea('step_desc_'+i, step.desc, 'Description');
      });
      html += fieldInput('cta', slide.cta, 'CTA button text');
    } else if (type === 'terms') {
      html += fieldInput('heading', slide.heading, 'Heading');
      html += fieldTextarea('termsText', slide.termsText, 'Terms text');
      html += fieldInput('company', slide.company, 'Company');
      html += fieldInput('consultant', slide.consultant, 'Consultant');
      html += fieldInput('email', slide.email, 'Email');
      html += fieldInput('date', slide.date, 'Date');
    }
    return html;
  }

  function fieldAddButton(key, arrayKey, label) {
    return '<button type="button" class="add-field-btn" data-add-field="'+key+'" data-array="'+arrayKey+'">+ '+esc(label)+'</button>';
  }

  function fieldInput(key, value, label) {
    return '<div class="field"><label>'+esc(label)+'</label><input data-field="'+key+'" value="'+esc(value==='[missing]'?'':value)+'"></div>';
  }
  function fieldTextarea(key, value, label) {
    return '<div class="field"><label>'+esc(label)+'</label><textarea data-field="'+key+'">'+esc(value==='[missing]'?'':value)+'</textarea></div>';
  }

  function attachFieldListeners(body, slide) {
    body.querySelectorAll('[data-field]').forEach(function(input) {
      input.addEventListener('input', function() {
        var key = input.dataset.field;
        var val = input.type === 'checkbox' ? input.checked : input.value;
        if (key.indexOf('node_') === 0) {
          var parts = key.split('_');
          var idx = parseInt(parts[2], 10);
          var prop = parts[1] === 'hot' ? 'hot' : parts[1];
          if (!slide.nodes) slide.nodes = [];
          if (!slide.nodes[idx]) slide.nodes[idx] = {};
          slide.nodes[idx][prop] = val;
        } else if (key.indexOf('role_') === 0) {
          var rIdx = parseInt(key.split('_')[1], 10);
          if (!slide.roles) slide.roles = [];
          slide.roles[rIdx] = val;
        } else if (key.indexOf('card_') === 0) {
          var parts2 = key.split('_');
          var idx2 = parseInt(parts2[2], 10);
          var prop2 = parts2[1];
          if (!slide.cards) slide.cards = [];
          if (!slide.cards[idx2]) slide.cards[idx2] = {};
          slide.cards[idx2][prop2] = val;
        } else if (key.indexOf('metric_') === 0) {
          var idx3 = parseInt(key.split('_')[1], 10);
          if (!slide.metrics) slide.metrics = [];
          slide.metrics[idx3] = val;
        } else if (key.indexOf('tool_') === 0) {
          var parts3 = key.split('_');
          var idx4 = parseInt(parts3[2], 10);
          var prop3 = parts3[1];
          if (!slide.tools) slide.tools = [];
          if (!slide.tools[idx4]) slide.tools[idx4] = {};
          slide.tools[idx4][prop3] = val;
        } else if (key.indexOf('panel_') === 0) {
          var parts5 = key.split('_');
          if (parts5[1] === 'item') {
            var pi = parseInt(parts5[2], 10);
            var pj = parseInt(parts5[3], 10);
            if (!slide.panels) slide.panels = [];
            if (!slide.panels[pi]) slide.panels[pi] = {};
            if (!slide.panels[pi].items) slide.panels[pi].items = [];
            slide.panels[pi].items[pj] = val;
          } else {
            var idx7 = parseInt(parts5[2], 10);
            var prop5 = parts5[1] === 'hot' ? 'hot' : parts5[1];
            if (!slide.panels) slide.panels = [];
            if (!slide.panels[idx7]) slide.panels[idx7] = {};
            slide.panels[idx7][prop5] = val;
          }
        } else if (key.indexOf('step_') === 0) {
          var parts6 = key.split('_');
          var idx8 = parseInt(parts6[2], 10);
          var prop6 = parts6[1];
          if (!slide.steps) slide.steps = [];
          if (!slide.steps[idx8]) slide.steps[idx8] = {};
          slide.steps[idx8][prop6] = val;
        } else {
          slide[key] = val;
        }
        updateCardHeading(body.closest('.slide-card'), slide);
        updateAttention();
      });
    });
    body.querySelectorAll('[data-add-field]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var arrayKey = btn.dataset.array;
        if (!Array.isArray(slide[arrayKey])) slide[arrayKey] = [];
        slide[arrayKey].push('');
        renderReview();
      });
    });
  }

  function updateCardHeading(card, slide) {
    if (!card) return;
    var heading = getSlideHeading(slide);
    var titleEl = card.querySelector('.slide-card-title');
    if (titleEl) {
      titleEl.textContent = heading === '[missing]' || !heading ? 'Untitled slide' : heading;
      titleEl.className = 'slide-card-title' + (!heading || heading === '[missing]' ? ' empty' : '');
    }
  }

  function updateAttention() {
    if (!$('reviewForm')) return;
    var slides = getSlides();
    var count = H.missingCount(slides);
    $('attention').textContent = count ? count + ' field' + (count===1?'':'s') + ' need attention' : 'All fields look good';
  }

  function collectReview() {
    return getSlides();
  }

  function renderFromReview(event) {
    if (event) event.preventDefault();
    if (state.fromDeck && !window.confirm('Apply edits and re-render? The deck will reset to slide 1.')) { resumeDeck(); return; }
    state.fromDeck = false;
    try {
      state.slides = collectReview();
      $('fatalError').hidden = true;
      showDeck();
    } catch (error) {
      var message = 'Could not render deck: ' + (error && error.message ? error.message : error);
      $('fatalError').textContent = message;
      $('fatalError').hidden = false;
      console.error(error);
    }
  }

  function showReview() { state.fromDeck = state.step === 'deck'; renderReview(); }
  function resumeDeck() { state.step = 'deck'; state.view = 'deck'; showOnly('deckView'); scaleStage(); }

  /* ── Deck rendering ────────────────────────────────────────────────── */
  function showDeck() {
    if (!state.meta || !state.style) throw new Error('Details or visual style is missing.');
    if (!state.slides || !state.slides.length) {
      state.slides = H.slideModel(state.proposal || {}, state.meta);
    }
    if (!state.slides.length) throw new Error('No slides were generated.');
    state.index = 0;
    state.view = 'deck';
    state.step='deck';
    renderDeck();
  }

  function renderDeck() {
    showOnly('deckView');
    $('deckTheme').textContent = state.style.css;
    var container = $('stage');
    container.innerHTML = state.slides.map(function(slide) { return renderSlide(slide); }).join('');
    if(root.SignDeck) root.SignDeck();
    updateNav();
    scaleStage();
  }

  function slideChrome(slide, index, total) {
    var pad = (index + 1).toString().padStart(2, '0');
    var n = String(total).padStart(2, '0');
    var roleMap = {
      cover: ['Hautomai', 'Automation systems built around your workflow'],
      signal: ['Current state', 'Manual work, many moving parts'],
      architecture: ['System', 'How it works'],
      volume: ['Capacity', 'Sending infrastructure'],
      tools: ['Stack', 'What runs the system'],
      investment: ['Investment', 'One fee · clear milestones'],
      close: ['Next step', 'Let\'s get started'],
      terms: ['Hautomai', 'Approval to begin on signature']
    };
    var role = roleMap[slide.type] || ['', ''];
    return '<div class="chrome" style="--n:0"><div class="logo">Hautom<i>ai</i></div><div class="page">'+pad+' / '+n+'</div></div>'
      + '<div class="footer" style="--n:5"><span>'+esc(role[0])+'</span><span>'+esc(role[1])+'</span></div>';
  }

  /* ── Per-type slide renderers ──────────────────────────────────────── */
  var renderers = {};

  renderers.cover = function(slide) {
    var sub = slide.subtitle || 'A ' + (slide.serviceType || 'project') + ' engagement, laid out in one place — scope, path, milestones, and investment.';
    return '<div class="cover-grid"></div><div class="cover-orb"></div><div class="cover-signal"></div><div class="scanline"></div>'
      + '<div class="cover-title" style="--n:1"><div class="pill"><span class="dot"></span>' + missing(slide.serviceType) + '</div>'
      + '<h1 class="display h1">' + missing(slide.title) + '</h1>'
      + '<div class="cover-sub">' + esc(sub) + '</div></div>'
      + '<div class="cover-meta" style="--n:2"><span>Prepared for <b>' + missing(slide.company) + '</b> · ' + missing(slide.consultant) + '</span><span>' + missing(slide.date) + '</span></div>';
  };

  renderers.signal = function(slide) {
    var nodes = slide.nodes || [];
    var roles = slide.roles || [];
    var intro = slide.intro || slide.rolesNote || 'Where things stand right now.';
    return '<div class="current-left" style="--n:1"><div class="eyebrow">' + missing(slide.eyebrow) + '</div>'
      + '<h2 class="display">' + missing(slide.heading) + '</h2>'
      + '<p class="body">' + missing(intro) + '</p>'
      + (roles.length ? '<div class="role-tags">' + roles.filter(function(r){return r;}).map(function(r){return '<span class="role-tag">' + missing(r) + '</span>';}).join('') + '</div>' : '')
      + (slide.rolesNote ? '<div class="role-note">' + esc(slide.rolesNote) + '</div>' : '')
      + '</div>'
      + '<div class="flow-row" style="--n:2">' + nodes.map(function(x) {
        return '<div class="panel node"><div class="tag">' + missing(x.tag) + '</div><h3>' + missing(x.title) + '</h3><p>' + missing(x.desc) + '</p></div>';
      }).join('<div class="flow-arrow">→</div>') + '</div>'
      + '<div class="redflag" style="--n:3"><span class="mark"></span><span>Every step here is automatable — without removing your control.</span></div>';
  };

  renderers.architecture = function(slide) {
    var nodes = slide.nodes || [];
    var positions = ['n1','n2','n3','n4','n5','n6'];
    return '<div class="full-title" style="--n:1"><div class="eyebrow">' + missing(slide.eyebrow) + '</div>'
      + '<h2 class="display">' + missing(slide.heading) + '</h2>'
      + '<p class="body">' + missing(slide.intro) + '</p></div>'
      + '<div class="arch" style="--n:2">'
      + '<div class="arch-num">' + String(nodes.length) + ' moving parts</div>'
      + '<div class="arch-line l12"></div><div class="arch-line l23"></div><div class="arch-line l34"></div><div class="arch-line l35"></div><div class="arch-line l56"></div>'
      + nodes.slice(0, 6).map(function(x, i) {
        var hot = x.hot ? ' hot' : '';
        return '<div class="arch-node ' + positions[i] + ' panel' + hot + '"><div class="step">' + missing(x.step) + '</div><h4>' + missing(x.title) + '</h4><span>' + missing(x.desc) + '</span></div>';
      }).join('')
      + '<div class="loop">∞ <i>continuous</i> · loops back overnight</div>'
      + '</div>'
      + (slide.note ? '<div class="arch-note" style="--n:3">' + esc(slide.note) + '</div>' : '');
  };

  renderers.volume = function(slide) {
    var cards = slide.cards || [];
    var metrics = slide.metrics || [];
    var intro = slide.intro || '';
    return '<div class="daily-title" style="--n:1"><div class="eyebrow">' + missing(slide.eyebrow) + '</div>'
      + '<h2 class="display">' + missing(slide.heading) + '</h2>'
      + '<p class="body">' + missing(intro) + '</p></div>'
      + '<div class="daily-grid" style="--n:2">' + cards.map(function(c) {
        return '<div class="panel day-card"><div class="day">' + missing(c.day) + '</div><div class="icon">' + missing(c.icon) + '</div><h3>' + missing(c.title) + '</h3><p>' + missing(c.desc) + '</p></div>';
      }).join('') + '</div>'
      + (metrics.length ? '<div class="metric-strip" style="--n:3">' + metrics.map(function(m) {
        return '<div class="metric">' + esc(m) + '</div>';
      }).join('') + '</div>' : '');
  };

  renderers.tools = function(slide) {
    var tools = slide.tools || [];
    return '<div class="tools-title" style="--n:1"><div class="eyebrow">' + missing(slide.eyebrow) + '</div>'
      + '<h2 class="display">' + missing(slide.heading) + '</h2></div>'
      + '<div class="tools-wrap" style="--n:2">' + tools.map(function(t) {
        return '<div class="panel tool-card"><div class="role">' + missing(t.role) + '</div><h3>' + missing(t.name) + '</h3><p>' + missing(t.desc) + '</p><div class="price">' + missing(t.price) + '</div></div>';
      }).join('') + '</div>'
      + (slide.note ? '<div class="tools-note" style="--n:3">' + esc(slide.note) + '</div>' : '');
  };

  renderers.investment = function(slide) {
    var panels = slide.panels || [];
    return '<div class="invest-title" style="--n:1"><div class="eyebrow">' + missing(slide.eyebrow) + '</div><h2 class="display">' + missing(slide.heading) + '</h2></div>'
      + '<div class="invest-wrap" style="--n:2">' + panels.map(function(p) {
        var cls = 'panel price-panel' + (p.hot ? ' hot' : '');
        var html = '';
        if (p.promo) html += '<div class="promo-pill"><div class="pill" style="font-size:13px;padding:9px 14px;"><span class="dot"></span> ' + esc(p.promo) + '</div></div>';
        html += '<div class="ptag">' + missing(p.tag) + '</div>';
        html += '<div class="pnum">' + missing(p.amount) + '</div>';
        html += '<div class="pnote">' + missing(p.note) + '</div>';
        if (p.items && p.items.length) {
          html += '<div class="plist">' + p.items.filter(function(item){return item;}).map(function(item) {
            return '<div class="price-line"><span class="bullet"></span> ' + esc(item) + '</div>';
          }).join('') + '</div>';
        }
        return '<div class="' + cls + '">' + html + '</div>';
      }).join('') + '</div>';
  };

  renderers.close = function(slide) {
    var steps = slide.steps || [];
    return '<div class="close-grid"></div>'
      + '<div class="close-left" style="--n:1"><div class="pill"><span class="dot"></span> ' + missing(slide.pill) + '</div>'
      + '<h2 class="display">' + missing(slide.heading) + '</h2>'
      + '<p>' + missing(slide.intro) + '</p></div>'
      + '<div class="close-steps" style="--n:2">' + steps.filter(function(s){return s;}).map(function(s) {
        return '<div class="close-step"><div class="snum">' + missing(s.num) + '</div><div><h3>' + missing(s.title) + '</h3><p>' + missing(s.desc) + '</p></div></div>';
      }).join('') + '</div>'
      + (slide.cta ? '<div class="cta" style="--n:3">' + esc(slide.cta) + '</div>' : '');
  };

  renderers.terms = function(slide) {
    return '<div class="terms-grid"></div>'
      + '<div class="terms-left" style="--n:1"><div class="pill"><span class="dot"></span> Signature</div>'
      + '<h2 class="display">' + missing(slide.heading) + '</h2>'
      + '<div class="terms-text">' + missing(slide.termsText).replace(/\n/g, '<br>') + '</div></div>'
      + '<div class="terms-right" style="--n:2">'
      + '<div class="terms-step"><div class="snum">01</div><div><h3>' + missing(slide.consultant) + '</h3><p>' + missing(slide.email) + '</p></div></div>'
      + '<div class="terms-step"><div class="snum">02</div><div><h3>' + missing(slide.company) + '</h3><p>Date of proposal · ' + missing(slide.date) + '</p></div></div></div>'
      + '<div class="terms-sign" style="--n:3"><strong>' + missing(slide.consultant) + '</strong><div>' + missing(slide.email) + '</div></div>'
      + '<div class="terms-accept panel" style="--n:4"><div class="accept-pad"><div class="accept-head"><span>Client acceptance</span><span class="signed-badge">✓ Signed</span></div><div class="pad-box"><canvas class="sign-canvas" width="540" height="150" aria-label="Signature pad"></canvas></div><div class="sign-hint">Draw your signature. It is stored in this page only — nothing is uploaded.</div></div><div class="accept-side"><div class="sign-before"><label class="sign-label">Signer name<input class="sign-field" id="signName" type="text" placeholder="Alex Doe"></label><label class="sign-label">Email · optional<input class="sign-field" id="signEmail" type="email" placeholder="alex@company.com"></label><button type="button" class="sign-btn act">Sign &amp; accept</button><button type="button" class="sign-btn alt">Clear</button></div><div class="sign-after"><button type="button" class="sign-btn act" id="signArchive">Download signed copy</button><div class="stamp"><strong>Accepted &amp; signed</strong><span class="stamp-line"><b class="stamp-name"></b><span class="stamp-date"></span></span></div></div></div></div>';
  };

  function renderSlide(slide) {
    var index = state.slides.indexOf(slide);
    var total = state.slides.length;
    var renderer = renderers[slide.type] || renderers.signal;
    var content = renderer(slide);
    return '<section class="slide ' + (index === state.index ? 'active' : '') + '" data-type="' + slide.type + '"><div class="stage-inner">' + slideChrome(slide, index, total) + content + '</div></section>';
  }

  /* ── Navigation ────────────────────────────────────────────────────── */
  function updateNav() {
    $('counter').textContent = (state.index + 1) + ' / ' + state.slides.length;
    $('progress').innerHTML = state.slides.map(function(_, i) {
      return '<button type="button" class="dot ' + (i === state.index ? 'active' : '') + '" aria-label="Go to slide ' + (i + 1) + '" data-index="' + i + '"></button>';
    }).join('');
    $('progress').querySelectorAll('.dot').forEach(function(b) { b.addEventListener('click', function() { state.index = Number(b.dataset.index); renderDeck(); }); });
    $('prevBtn').disabled = state.index === 0;
    $('nextBtn').disabled = state.index === state.slides.length - 1;
  }
  function move(delta) { state.index = Math.max(0, Math.min(state.slides.length - 1, state.index + delta)); renderDeck(); }
  function keyHandler(event) { if (state.step !== 'deck') return; if (event.target && event.target.isContentEditable) return; if (event.key === 'ArrowRight' || event.key === ' ') { event.preventDefault(); move(1); } else if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1); } else if (event.key === 'Home') { state.index = 0; renderDeck(); } else if (event.key === 'End') { state.index = state.slides.length - 1; renderDeck(); } else if (event.key === 'Escape') showPanel(); }

  /* ── View switching ────────────────────────────────────────────────── */
  function showOnly(id) { ['panelView','stylesView','reviewView','deckView'].forEach(function(x) { $(x).hidden = x !== id; }); if (id === 'deckView') { state.view = 'deck'; $('topbar').classList.add('deck-topbar'); $('backPanel').textContent = 'Back to editor'; } else { $('topbar').classList.remove('deck-topbar'); $('backPanel').textContent = 'Control panel'; if ($('deckTheme')) $('deckTheme').textContent = ''; } }
  function showPanel() { state.step = 'idle'; state.view = 'panel'; showOnly('panelView'); validate(); }
  function scaleStage() { if (state.step !== 'deck') return; var stage = $('stage'); var ratio = Math.min(window.innerWidth / 1920, window.innerHeight / 1080); stage.style.transform = 'scale(' + ratio + ')'; stage.style.transformOrigin = 'center center'; }

  /* ── Export ────────────────────────────────────────────────────────── */
  function download() {
    var html = H.exportDocument($('stage').innerHTML, state.style.css, document.getElementById('exportNav').textContent, state.meta.company, state.meta.date, root.SignDeckSource);
    var blob = new Blob([html], {type: 'text/html'}), a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'proposal-' + H.slug(state.meta.company) + '-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '.html';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function() { URL.revokeObjectURL(a.href); }, 1000);
  }

  document.addEventListener('DOMContentLoaded', init);
})(typeof globalThis !== 'undefined' ? globalThis : this);
