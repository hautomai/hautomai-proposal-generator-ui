(function (root) {
  // Adapted conceptually from zarazhangrui/frontend-slides (MIT); all CSS is local.
  const base = `
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Syne:wght@500;600;700;800&display=swap');
  :root{--bg:#0A0A0A;--panel:#111111;--panel-2:#171717;--ink:#F5F3EE;--muted:#9A9A94;--line:rgba(245,243,238,.14);--accent:#C9FF4A;--accent-soft:rgba(201,255,74,.07);--accent-dim:rgba(201,255,74,.05);--accent-line:rgba(201,255,74,.24);--accent-glow:rgba(201,255,74,.25);--accent-dot:rgba(201,255,74,.65);--accent-faint:rgba(201,255,74,.14);--accent-2:#8FE35D;--warm:#F3C969;--danger:#FF7D6E;--paper:#0A0A0A;--stage-bg:#0A0A0A;--slide-bg:#0A0A0A;--shadow:0 30px 80px rgba(0,0,0,.38)}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);font-family:'IBM Plex Mono',monospace}
  .stage{background:var(--bg)}
  .slide{background:var(--bg);color:var(--ink)}
  .slide::before{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle at 85% 10%,var(--accent-soft),transparent 30%),radial-gradient(circle at 10% 95%,rgba(243,201,105,.04),transparent 28%)}

  /* === TYPOGRAPHY === */
  .display{font-family:'Syne',sans-serif;font-weight:800;letter-spacing:-.06em;line-height:.95}
  .h1{font-size:92px}.h2{font-size:62px}.h3{font-size:34px}
  .body{font-family:'IBM Plex Mono',monospace;font-size:23px;line-height:1.42;color:var(--muted)}
  .eyebrow{font-size:17px;letter-spacing:.16em;text-transform:uppercase;color:var(--accent)}
  .kicker{font-size:15px;letter-spacing:.12em;text-transform:uppercase;color:#77776F}
  h1,h2,h3,h4,p{margin:0}
  strong{color:var(--ink)}
  .accent{color:var(--accent)}.muted{color:var(--muted)}.mono{font-family:'IBM Plex Mono',monospace}

  /* === COMMON CHROME === */
  .stage-inner{width:100%;height:100%;position:relative;padding:0;overflow:hidden}
  .chrome{position:absolute;left:68px;right:68px;top:50px;display:flex;justify-content:space-between;z-index:4}
  .logo{font-family:'Syne',sans-serif;font-weight:800;font-size:28px;letter-spacing:-.04em}
  .logo i{color:var(--accent);font-style:normal}
  .page{font-size:15px;color:#6E6E67}
  .footer{position:absolute;left:68px;right:68px;bottom:45px;display:flex;justify-content:space-between;font-size:14px;color:#6E6E67;z-index:4}

  /* === COMPONENTS === */
  .panel{background:rgba(17,17,17,.88);border:1px solid var(--line);border-radius:28px;box-shadow:var(--shadow)}
  .pill{display:inline-flex;align-items:center;gap:10px;border:1px solid var(--accent-line);background:var(--accent-dim);padding:12px 18px;border-radius:999px;color:var(--accent);font-size:15px}
  .pill .dot{width:8px;height:8px;border-radius:50%;background:var(--accent);box-shadow:0 0 18px var(--accent-dot)}
  .arrow{color:var(--accent);font-size:28px}
  .missing{font-style:italic;border:1px dashed var(--accent);padding:2px 8px;color:var(--accent)}

  /* === ANIMATIONS === */
  @keyframes rise{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
  @keyframes scan{0%{transform:translateX(-110%)}100%{transform:translateX(520%)}}
  .scanline{position:absolute;left:0;top:0;width:210px;height:100%;background:linear-gradient(90deg,transparent,var(--accent-soft),transparent);transform:translateX(-110%);animation:scan 6s ease-in-out infinite}

  /* === SLIDE 1 — COVER === */
  .cover-grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px);background-size:90px 90px;-webkit-mask-image:linear-gradient(to bottom,rgba(0,0,0,.85),transparent 90%);mask-image:linear-gradient(to bottom,rgba(0,0,0,.85),transparent 90%)}
  .cover-orb{position:absolute;width:470px;height:470px;right:130px;top:190px;border-radius:50%;background:radial-gradient(circle at 40% 35%,var(--accent-glow),var(--accent-dim) 46%,transparent 67%);filter:blur(5px)}
  .cover-signal{position:absolute;right:150px;bottom:155px;width:480px;height:220px;border-top:1px solid var(--accent-line);transform:skewX(-26deg) rotate(-10deg);opacity:.7}
  .cover-signal::before,.cover-signal::after{content:"";position:absolute;left:0;right:0;height:1px;background:var(--accent-faint)}
  .cover-signal::before{top:33%}.cover-signal::after{top:66%}
  .cover-title{position:absolute;left:68px;top:215px;width:1000px}
  .cover-title .h1{font-size:104px;margin:26px 0 30px}
  .cover-sub{width:780px;font-size:23px;line-height:1.42;color:#A4A49D}
  .cover-meta{position:absolute;left:68px;right:68px;bottom:92px;display:flex;gap:36px;align-items:center;justify-content:space-between}
  .cover-meta span{color:#6B6B64;font-size:15px}
  .cover-meta b{color:var(--ink);font-weight:500}

  /* === SLIDE — SIGNAL === */
  .current-left{position:absolute;left:68px;top:155px;width:650px}
  .current-left .eyebrow{margin-bottom:0}
  .current-left h2{font-size:70px;margin:24px 0 0;letter-spacing:-.05em}
  .current-left p{margin-top:26px;width:540px}
  .role-tags{display:flex;flex-wrap:wrap;gap:10px;margin-top:30px;width:560px}
  .role-tag{font-size:14px;border:1px solid var(--line);border-radius:10px;padding:9px 14px;color:#B9B9B1}
  .role-note{margin-top:20px;font-size:13px;color:#6E6E67;width:540px;line-height:1.5}
  .flow-row{position:absolute;left:790px;right:75px;top:225px;height:520px;display:flex;align-items:center;gap:20px}
  .node{flex:1;min-height:230px;max-width:266px;padding:25px;position:relative}
  .node .tag{color:#696962;font-size:14px;margin-bottom:18px}
  .node h3{font-family:'Syne';font-size:26px;letter-spacing:-.04em;line-height:1.1}
  .node p{margin:18px 0 0;color:#7F7F77;font-size:15px;line-height:1.5}
  .flow-arrow{font-size:33px;color:#66665E;flex:none}
  .redflag{position:absolute;left:68px;bottom:106px;display:flex;align-items:center;gap:15px;color:#A8A89F;font-size:15px;width:650px}
  .redflag .mark{width:11px;height:11px;border-radius:50%;background:var(--accent);box-shadow:0 0 14px var(--accent-dot);flex-shrink:0}

  /* === SLIDE 6 — INVESTMENT === */
  .invest-title{position:absolute;left:68px;top:175px}
  .invest-title h2{font-size:74px;margin:18px 0 0}
  .invest-board{position:absolute;left:68px;right:68px;top:420px;display:grid;grid-template-columns:1fr 1fr;gap:24px;align-items:stretch}
  .invest-col{padding:44px 40px;position:relative;min-height:340px}
  .invest-col .lbl{font-size:14px;color:#77776F;letter-spacing:.12em;text-transform:uppercase}
  .invest-col .amt{font-family:'Syne';font-weight:800;font-size:118px;line-height:1;letter-spacing:-.06em;margin-top:34px;color:var(--ink)}
  .invest-col .note{margin-top:30px;font-size:15px;color:#8A8A82;line-height:1.5}
  .invest-col.hot{border-color:var(--accent-line)}
  .invest-col.hot .amt{color:var(--accent)}

  /* === SLIDE 9 — TERMS === */
  .terms-grid{position:absolute;inset:0;background-image:linear-gradient(90deg,transparent 49.95%,rgba(255,255,255,.05) 50%,transparent 50.05%),linear-gradient(rgba(255,255,255,.03) 1px,transparent 1px);background-size:50% 100%,100% 90px}
  .terms-left{position:absolute;left:68px;top:175px;width:900px;height:520px}
  .terms-left h2{font-size:96px;margin:22px 0 0}
  .terms-text{margin-top:34px;width:830px;font-size:20px;line-height:1.55;color:#9C9C94;overflow:hidden}
  .terms-right{position:absolute;right:95px;top:250px;width:620px}
  .terms-step{padding:21px 0;border-bottom:1px solid var(--line);display:grid;grid-template-columns:64px 1fr;gap:16px}
  .terms-step:last-child{border-bottom:0}
  .terms-step .snum{color:var(--accent);font-size:15px;padding-top:4px}
  .terms-step h3{font-family:'Syne';font-size:26px;margin:0 0 8px;letter-spacing:-.03em}
  .terms-step p{color:#7E7E76;font-size:14px;line-height:1.5}
  .terms-sign{position:absolute;right:95px;bottom:120px;width:460px;border-top:2px solid var(--ink);padding-top:22px;text-align:right;color:#6E6E67;font-size:15px;line-height:1.6}
  .terms-sign strong{font:600 26px 'Syne',sans-serif;color:var(--ink)}

  /* === SLIDE 9 — SIGN & ACCEPT === */
  .terms-accept{position:absolute;left:68px;bottom:105px;width:800px;display:flex;gap:22px;align-items:center}
  .accept-pad{flex:1 1 auto;min-width:0}
  .accept-head{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:12px}
  .accept-head>span:first-child{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--accent)}
  .signed-badge{display:none;align-items:center;gap:8px;color:var(--accent);font-size:12px;letter-spacing:.1em;text-transform:uppercase}
  .terms-accept.signed .signed-badge{display:inline-flex}
  .pad-box{border:1px dashed var(--accent-line);border-radius:12px;overflow:hidden}
  .sign-canvas,.sign-copy{display:block;width:100%;height:150px}
  .sign-canvas{background:rgba(255,255,255,.04);touch-action:none;cursor:crosshair}
  .sign-copy{object-fit:contain;background:rgba(255,255,255,.04)}
  .sign-hint{margin-top:8px;font-size:11px;color:#6E6E67;letter-spacing:.02em}
  .terms-accept.signed .sign-canvas,.terms-accept.signed .sign-hint{display:none}
  .accept-side{width:250px;flex:none}
  .sign-before{display:flex;flex-direction:column;gap:10px}
  .terms-accept.signed .sign-before{display:none}
  .sign-after{display:none}
  .terms-accept.signed .sign-after{display:flex;flex-direction:column;gap:12px}
  .sign-label{display:block;font-size:11px;color:var(--muted)}
  .sign-field{display:block;width:100%;margin-top:6px;background:rgba(255,255,255,.04);border:1px solid var(--line);border-radius:8px;color:var(--ink);font:500 13px 'IBM Plex Mono',monospace;padding:10px 12px;outline:none}
  .sign-field:focus{border-color:var(--accent)}
  .sign-btn{display:block;width:100%;border-radius:8px;border:1px solid var(--accent-line);background:var(--accent-dim);color:var(--accent);font:600 12px 'IBM Plex Mono',monospace;letter-spacing:.08em;text-transform:uppercase;padding:11px 0;cursor:pointer;transition:background .15s}
  .sign-btn:hover{background:var(--accent);color:#0A0A0A}
  .sign-btn.alt{background:none;border-color:var(--line);color:#8A8A82}
  .sign-btn.alt:hover{background:var(--accent-dim);color:var(--accent)}
  .stamp{border:1px solid var(--accent-line);border-radius:12px;background:var(--accent-dim);padding:14px 16px}
  .stamp strong{display:block;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--accent)}
  .stamp-line{display:block;margin-top:8px;font-size:12px;color:var(--muted);line-height:1.5}
  .stamp-name{color:var(--ink);font-weight:600}
  .stamp-date{display:block;margin-top:2px}

  /* === SLIDE — ARCHITECTURE (positioned nodes) === */
  .full-title{position:absolute;left:68px;top:130px;width:660px}
  .full-title h2{font-size:72px;margin:20px 0;letter-spacing:-.05em}
  .full-title p{width:610px}
  .arch{position:absolute;left:780px;right:68px;top:160px;height:740px}
  .arch .arch-num{position:absolute;left:0;top:0;font-size:15px;color:#6E6E67}
  .arch-node{position:absolute;width:230px;min-height:150px;padding:22px;z-index:2;background:rgba(17,17,17,.9)}
  .arch-node h4{margin:10px 0 8px;font-family:'Syne';font-size:24px;letter-spacing:-.04em}
  .arch-node span{font-size:12px;color:#77776E;line-height:1.45;display:block}
  .arch-node .step{font-size:12px;color:var(--accent);letter-spacing:.08em;text-transform:uppercase}
  .arch-node.hot{border-color:var(--accent-line);box-shadow:var(--shadow)}
  .n1{left:0;top:250px}.n2{left:275px;top:55px}.n3{left:545px;top:250px}.n4{left:815px;top:55px}.n5{left:275px;top:485px}.n6{left:545px;top:485px}
  .arch-line{position:absolute;height:1px;background:linear-gradient(90deg,var(--accent-faint),var(--accent-line),var(--accent-faint));transform-origin:left center;z-index:1}
  .l12{left:210px;top:315px;width:120px;transform:rotate(-31deg)}
  .l23{left:505px;top:315px;width:120px;transform:rotate(31deg)}
  .l34{left:775px;top:315px;width:120px;transform:rotate(-31deg)}
  .l35{left:655px;top:315px;width:100px;transform:rotate(90deg);opacity:.5}
  .l56{left:505px;top:555px;width:120px;transform:rotate(0deg)}
  .loop{position:absolute;right:30px;bottom:6px;color:#6B6B63;font-size:13px}
  .loop i{color:var(--accent);font-style:normal}
  .arch-note{position:absolute;left:68px;bottom:100px;color:#7E7E76;font-size:14px;line-height:1.5;width:660px}

  /* === SLIDE — VOLUME === */
  .daily-title{position:absolute;left:68px;top:130px}
  .daily-title h2{font-size:70px;margin:19px 0;letter-spacing:-.05em}
  .daily-title p{width:820px;margin-top:6px}
  .daily-grid{position:absolute;left:68px;right:68px;top:465px;display:grid;grid-template-columns:repeat(4,1fr);gap:20px}
  .day-card{min-height:360px;padding:30px;position:relative}
  .day-card .day{font-size:13px;color:#6D6D65;letter-spacing:.12em;text-transform:uppercase}
  .day-card h3{font-family:'Syne';font-size:36px;margin:24px 0 14px;letter-spacing:-.04em}
  .day-card p{color:#92928A;font-size:15px;line-height:1.55}
  .day-card .icon{position:absolute;right:28px;top:26px;width:50px;height:50px;border:1px solid var(--accent-line);border-radius:14px;display:grid;place-items:center;color:var(--accent);font-size:14px}
  .metric-strip{position:absolute;left:68px;right:68px;bottom:103px;display:flex;gap:10px}
  .metric{padding:10px 13px;border-radius:9px;border:1px solid var(--line);font-size:12px;color:#77776F}
  .metric b{color:var(--ink);font-weight:500}

  /* === SLIDE — TOOLS === */
  .tools-title{position:absolute;left:68px;top:130px}
  .tools-title h2{font-size:70px;margin:19px 0}
  .tools-wrap{position:absolute;left:68px;right:68px;top:345px;display:grid;grid-template-columns:repeat(4,1fr);gap:20px;height:520px}
  .tool-card{padding:30px;position:relative}
  .tool-card .role{font-size:12px;color:#77776F;letter-spacing:.1em;text-transform:uppercase}
  .tool-card h3{font-family:'Syne';font-size:29px;margin:16px 0 12px;letter-spacing:-.04em}
  .tool-card p{font-size:14.5px;line-height:1.55;color:#92928A}
  .tool-card .price{position:absolute;left:30px;bottom:26px;color:var(--accent);font-family:'Syne';font-weight:700;font-size:16px}
  .tools-note{position:absolute;left:68px;bottom:100px;color:#7E7E76;font-size:14px;width:1100px;line-height:1.5}

  /* === SLIDE — INVESTMENT V2 === */
  .invest-wrap{position:absolute;left:68px;right:68px;top:335px;display:grid;grid-template-columns:1fr 1fr;gap:26px;height:560px}
  .price-panel{padding:42px;position:relative;display:flex;flex-direction:column}
  .price-panel .ptag{font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#77776F}
  .price-panel .pnum{font-family:'Syne';font-weight:800;font-size:60px;letter-spacing:-.04em;margin:16px 0 8px;color:var(--ink)}
  .price-panel .pnote{color:var(--muted);font-size:15px;margin-bottom:22px;max-width:400px}
  .price-panel .plist{margin-top:auto;display:flex;flex-direction:column;gap:13px}
  .price-line{display:flex;gap:11px;align-items:flex-start;font-size:14.5px;color:#B0B0A8;line-height:1.42}
  .price-line .bullet{width:7px;height:7px;border-radius:50%;background:var(--accent);margin-top:6px;flex-shrink:0}
  .promo-pill{position:absolute;right:32px;top:32px}

  /* === SLIDE — CLOSE === */
  .close-grid{position:absolute;inset:0;background-image:linear-gradient(90deg,transparent 49.95%,rgba(255,255,255,.05) 50%,transparent 50.05%),linear-gradient(rgba(255,255,255,.03) 1px,transparent 1px);background-size:50% 100%,100% 90px}
  .close-left{position:absolute;left:68px;top:195px;width:900px}
  .close-left h2{font-size:98px;margin:23px 0 0}
  .close-left p{margin-top:30px;width:730px;font-size:21px;color:#9C9C94;line-height:1.5}
  .close-steps{position:absolute;right:95px;top:250px;width:630px}
  .close-step{padding:21px 0;border-bottom:1px solid var(--line);display:grid;grid-template-columns:60px 1fr;gap:15px}
  .close-step:last-child{border-bottom:0}
  .close-step .snum{color:var(--accent);font-size:15px;padding-top:4px}
  .close-step h3{margin:0 0 8px;font-family:'Syne';font-size:27px;letter-spacing:-.03em}
  .close-step p{margin:0;color:#7E7E76;font-size:14px;line-height:1.5}
  .cta{position:absolute;right:68px;bottom:102px;padding:17px 21px;border-radius:11px;color:#0B0B0B;background:var(--accent);font-family:'Syne';font-weight:700;font-size:18px}

  `;
  const single = [
    { id: 'Acme-signal', name: 'Acme signal', description: 'Fixed Acme × Hautomai design.', css: base }
  ];
  root.ProposalStyles = { all: single, get: (id) => single.find((item) => item.id === id) || single[0], sample: () => [single[0]] };
})(typeof globalThis !== 'undefined' ? globalThis : this);