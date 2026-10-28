(function (root) {
  function install() {
    if (typeof document === 'undefined') return;
    var card = document.querySelector('.terms-accept');
    if (!card || card._signInstalled) return;
    card._signInstalled = true;

    var canvas = card.querySelector('.sign-canvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var box = card.querySelector('.pad-box');
    var nameField = card.querySelector('#signName');
    var emailField = card.querySelector('#signEmail');
    var actBtn = card.querySelector('.act');
    var clearBtn = card.querySelector('.alt');
    var archiveBtn = card.querySelector('#signArchive');

    var store = null;
    try { store = JSON.parse(window.localStorage.getItem(KEY()) || 'null'); } catch (err) { store = null; }

    var ink = 0, drawing = false, last = null, pointerSeen = false;

    function usingPointer(e) { return e.pointerId != null; }
    function point(e) {
      var r = canvas.getBoundingClientRect();
      var cx = typeof e.clientX === 'number' ? e.clientX : 0;
      var cy = typeof e.clientY === 'number' ? e.clientY : 0;
      return {
        x: (cx - r.left) * (canvas.width / Math.max(1, r.width)),
        y: (cy - r.top) * (canvas.height / Math.max(1, r.height))
      };
    }
    function strokeTo(dest) {
      ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = '#F5F3EE';
      ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(dest.x, dest.y); ctx.stroke();
      last = dest;
    }
    function start(e) {
      if (usingPointer(e)) pointerSeen = true;
      if (!usingPointer(e) && pointerSeen) return;
      e.preventDefault();
      drawing = true; last = point(e); ink += 1;
      if (canvas.setPointerCapture && usingPointer(e)) { try { canvas.setPointerCapture(e.pointerId); } catch (err) {} }
    }
    function move(e) {
      if (!usingPointer(e) && pointerSeen) return;
      if (!drawing) return;
      e.preventDefault();
      strokeTo(point(e));
    }
    function end(e) {
      if (!usingPointer(e) && pointerSeen) return;
      if (!drawing) return;
      drawing = false;
      if (canvas.releasePointerCapture && usingPointer(e)) { try { canvas.releasePointerCapture(e.pointerId); } catch (err) {} }
    }

    canvas.addEventListener('pointerdown', start);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    canvas.addEventListener('touchend', end);
    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    canvas.addEventListener('mouseup', end);
    canvas.addEventListener('mouseleave', end);

    function KEY() { return 'proposal-sign:' + (typeof location !== 'undefined' ? location.pathname : ''); }
    function slug(v) {
      return String(v || 'proposal').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'proposal';
    }
    function formatDate(iso) {
      if (!iso) return '';
      try { return new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }); } catch (err) { return ''; }
    }
    function showSigned() {
      card.classList.add('signed');
      if (box && store && store.signature) {
        var img = document.createElement('img');
        img.className = 'sign-copy';
        img.alt = 'Signature';
        img.src = store.signature;
        box.innerHTML = '';
        box.appendChild(img);
      }
      var sn = card.querySelector('.stamp-name'), sd = card.querySelector('.stamp-date');
      if (sn) sn.textContent = store && store.signerName ? store.signerName : 'Client';
      if (sd) sd.textContent = store ? formatDate(store.signedAt) : '';
    }
    function accept() {
      if (store && store.signature) return;
      if (ink === 0) { alert('Please draw your signature before accepting.'); return; }
      var signature = canvas.toDataURL('image/png');
      store = {
        token: typeof location !== 'undefined' ? location.pathname.split('/').filter(Boolean).pop() || '' : '',
        company: document.title,
        signerName: nameField && nameField.value ? nameField.value.trim() : 'Client',
        email: emailField && emailField.value ? emailField.value.trim() : '',
        signature: signature,
        signedAt: new Date().toISOString()
      };
      try { window.localStorage.setItem(KEY(), JSON.stringify(store)); } catch (err) {}
      showSigned();
    }
    function clearPad() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ink = 0;
    }
    function archive() {
      if (!store) return;
      showSigned();
      var html = '<!doctype html>' + document.documentElement.outerHTML;
      var blob = new Blob([html], { type: 'text/html' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = slug(store.company) + '-signed-' + String(store.signedAt || '').slice(0, 10) + '.html';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    }

    if (actBtn) actBtn.addEventListener('click', accept);
    if (clearBtn) clearBtn.addEventListener('click', clearPad);
    if (archiveBtn) archiveBtn.addEventListener('click', archive);
    if (store && store.signature) showSigned();
  }

  root.SignDeck = install;
  root.SignDeckSource = '(' + install.toString() + ')();';
  if (typeof window !== 'undefined' && window.document) {
    if (document.querySelector('.terms-accept')) install();
    document.addEventListener('DOMContentLoaded', function () { setTimeout(install, 0); });
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);