/* Jumper XP Calculator — app script (unofficial). */
(() => {
'use strict';

/* ---------------- constants (leaderboard snapshot) ---------------- */
const SNAPSHOT = { totalXp: 246668625, wallets: 2774656, date: '11 Sep 2026', month: 'Sep 2026' };
const EVM_RE = /^0x[a-fA-F0-9]{40}$/;
const SOL_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const isDesktop = () => window.matchMedia('(min-width: 901px) and (pointer: fine)').matches;
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (id) => document.getElementById(id);

/* ---------------- formatting ---------------- */
const fmtInt = (n) => Math.round(n).toLocaleString('en-US');
const fmtMoney = (n) => {
  if (!isFinite(n)) return '$0';
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(2).replace(/\.?0+$/, '') + 'B';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M';
  if (n >= 1e4) return '$' + fmtInt(n);
  if (n >= 100) return '$' + n.toFixed(0);
  return '$' + n.toFixed(2);
};
const fmtBig = (n) => (n >= 1e9 ? (n / 1e9).toFixed(2) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(n >= 1e8 ? 1 : 2) + 'M' : fmtInt(n));
const short = (a) => (a.length > 14 ? a.slice(0, 6) + '…' + a.slice(-4) : a);

/* fill snapshot text */
$('snapDate').textContent = SNAPSHOT.month; $('snapDate2').textContent = SNAPSHOT.date; $('sDate').textContent = SNAPSHOT.date;
$('totalXpInline').textContent = fmtBig(SNAPSHOT.totalXp); $('sTotal').textContent = fmtBig(SNAPSHOT.totalXp);
$('walletsInline').textContent = fmtBig(SNAPSHOT.wallets); $('walletsInline2').textContent = fmtBig(SNAPSHOT.wallets); $('sWallets').textContent = fmtBig(SNAPSHOT.wallets);

/* ---------------- reveal on scroll ---------------- */
const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.12 });
document.querySelectorAll('.rv').forEach((el) => io.observe(el));

/* ---------------- parallax (scroll + mouse) ---------------- */
const layers = [...document.querySelectorAll('[data-depth]')];
let mx = 0, my = 0, tx = 0, ty = 0;
window.addEventListener('mousemove', (e) => { tx = (e.clientX / innerWidth - .5) * 2; ty = (e.clientY / innerHeight - .5) * 2; }, { passive: true });
function parallaxLoop() {
  mx += (tx - mx) * .06; my += (ty - my) * .06;
  const sy = window.scrollY;
  for (const el of layers) {
    const d = parseFloat(el.dataset.depth);
    const isLay = el.classList.contains('lay');
    const px = isLay ? mx * 40 * d : mx * 30 * d, py = (isLay ? my * 40 * d : my * 30 * d) + sy * d * (isLay ? .25 : .12);
    el.style.transform = `translate3d(${px}px, ${py}px, 0)`;
  }
  requestAnimationFrame(parallaxLoop);
}
if (!reduced) parallaxLoop();

/* ---------------- count-up ---------------- */
function countUp(el, to, fmt, ms = 1100) {
  const from = 0, t0 = performance.now();
  (function step(t) {
    const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3);
    el.textContent = fmt(from + (to - from) * e);
    if (k < 1) requestAnimationFrame(step);
  })(t0);
}

/* ---------------- state ---------------- */
const state = { fdv: 1e8, pct: 10, results: null };
const rangeEl = $('pct'), fdvEl = $('fdv');
function setPct(v) { state.pct = v; rangeEl.value = v; rangeEl.style.setProperty('--p', v + '%'); $('pctLabel').textContent = (v % 1 ? v.toFixed(1) : v) + '%'; $('stepPct').textContent = $('pctLabel').textContent; render(false); }
function setFdv(v) { state.fdv = Math.max(1, v || 0); $('fdvLabel').textContent = fmtMoney(state.fdv); $('stepFdv').textContent = fmtMoney(state.fdv); document.querySelectorAll('#fdvPresets .chip').forEach((c) => c.classList.toggle('on', +c.dataset.v === state.fdv)); render(false); }
rangeEl.addEventListener('input', () => setPct(+rangeEl.value));
fdvEl.addEventListener('input', () => setFdv(+fdvEl.value));
document.querySelectorAll('#fdvPresets .chip').forEach((c) => c.addEventListener('click', () => { fdvEl.value = c.dataset.v; setFdv(+c.dataset.v); }));
setPct(10); setFdv(1e8);

/* ---------------- address input ---------------- */
const addrEl = $('addr');
const parseAddrs = () => [...new Set(addrEl.value.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean))];
addrEl.addEventListener('input', () => { const n = parseAddrs().length; $('addrCount').textContent = n + (n === 1 ? ' wallet' : ' wallets'); });
$('demo').addEventListener('click', () => { addrEl.value = '0x1234567890abcdef1234567890abcdef12345678'; addrEl.dispatchEvent(new Event('input')); lookup(true); });

function showErr(msg) { const e = $('err'); e.textContent = msg; e.style.display = msg ? 'block' : 'none'; }

async function lookup(demo = false) {
  const addrs = parseAddrs();
  showErr('');
  if (!addrs.length) return showErr('Paste at least one wallet address.');
  if (addrs.length > 10) return showErr('Up to 10 wallets at a time.');
  const bad = addrs.filter((a) => !(EVM_RE.test(a) || SOL_RE.test(a)));
  if (bad.length) return showErr('This doesn’t look like an EVM or Solana address: ' + short(bad[0]));

  const go = $('go'); go.disabled = true; $('goTxt').innerHTML = '<span class="spinner"></span> Looking up';
  try {
    let results;
    if (demo) {
      await new Promise((r) => setTimeout(r, 600));
      results = [{ address: addrs[0], chain: 'evm', found: true, points: 1337, position: 14210, demo: true }];
    } else {
      const r = await fetch('/api/xp?address=' + encodeURIComponent(addrs.join(',')));
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Lookup failed');
      results = j.results;
    }
    state.results = results;
    render(true);
    document.getElementById('resultsSec').scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.__burst && window.__burst();
  } catch (e) {
    showErr(e.message === 'Failed to fetch' ? 'Could not reach the API. If you’re previewing the HTML locally, deploy to Vercel so /api/xp exists.' : e.message);
  } finally { go.disabled = false; $('goTxt').textContent = 'Check my XP'; }
}
$('go').addEventListener('click', () => lookup(false));
addrEl.addEventListener('keydown', (e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') lookup(false); });

/* ---------------- render ---------------- */
function calc() {
  const rs = state.results || [];
  const xp = rs.reduce((a, r) => a + (r.points || 0), 0);
  const share = xp / SNAPSHOT.totalXp;
  const value = share * (state.pct / 100) * state.fdv;
  const best = rs.filter((r) => r.position).sort((a, b) => a.position - b.position)[0];
  return { xp, share, value, best, perPct: share * .01 * state.fdv };
}
let lastXp = -1;
function render(animate) {
  if (!state.results) return;
  const c = calc();
  $('resultEmpty').style.display = 'none'; $('resultBody').style.display = 'block';
  const multi = state.results.length > 1;
  $('resTag').textContent = (multi ? 'Combined Jumper XP' : 'Your Jumper XP') + (state.results[0].demo ? ' · example' : '');
  if (animate && c.xp !== lastXp) { countUp($('resXp'), c.xp, fmtInt); countUp($('resVal'), c.value, fmtMoney); lastXp = c.xp; }
  else { $('resXp').textContent = fmtInt(c.xp); $('resVal').textContent = fmtMoney(c.value); }
  $('valFdv').textContent = fmtMoney(state.fdv); $('valPct').textContent = $('pctLabel').textContent;
  $('resShare').textContent = (c.share * 100).toFixed(5) + '% of all XP · ' + fmtMoney(c.value / Math.max(1, c.xp) ) + ' per XP';
  $('resPerPct').textContent = fmtMoney(c.perPct);
  $('stepXp').textContent = fmtInt(c.xp) + ' XP'; $('stepVal').textContent = '= ' + fmtMoney(c.value);
  $('resWallets').textContent = state.results.length;
  if (c.best) {
    const top = c.best.position / SNAPSHOT.wallets * 100;
    $('resRank').textContent = (multi ? 'best rank #' : 'rank #') + fmtInt(c.best.position);
    $('resTop').textContent = top < 0.01 ? 'top 0.01%' : 'top ' + (top < 1 ? top.toFixed(2) : top.toFixed(1)) + '%';
  } else { $('resRank').textContent = c.xp ? 'unranked' : 'no XP found'; $('resTop').textContent = '—'; }
  const t = $('walletTable');
  if (multi) {
    t.innerHTML = '<table><tr><th>Wallet</th><th>Chain</th><th style="text-align:right">Rank</th><th style="text-align:right">XP</th></tr>' +
      state.results.map((r) => `<tr><td>${short(r.address)}</td><td class="dim">${r.chain === 'solana' ? 'Solana' : 'EVM'}</td><td class="r dim">${r.position ? '#' + fmtInt(r.position) : '—'}</td><td class="r">${fmtInt(r.points || 0)}</td></tr>`).join('') + '</table>';
  } else t.innerHTML = '';
}

/* ---------------- 3D tilt ---------------- */
const card = $('result');
if (isDesktop() && !reduced) {
  card.addEventListener('mousemove', (e) => {
    const r = card.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    card.style.transform = `rotateX(${(0.5 - y) * 14}deg) rotateY(${(x - 0.5) * 16}deg) translateZ(6px)`;
    card.style.setProperty('--gx', x * 100 + '%'); card.style.setProperty('--gy', y * 100 + '%');
    card.style.boxShadow = `${(0.5 - x) * 40}px ${(0.5 - y) * 40}px 80px rgba(0,0,0,.45), 0 0 60px rgba(225,95,245,.15)`;
  });
  card.addEventListener('mouseleave', () => { card.style.transition = 'transform .6s cubic-bezier(.22,1,.36,1), box-shadow .6s'; card.style.transform = ''; card.style.boxShadow = ''; setTimeout(() => (card.style.transition = ''), 600); });
}

/* ---------------- share card ---------------- */
const logo = new Image(); logo.src = '/logo.jpg';
function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function drawShareCard() {
  const c = calc(), cv = $('shareCanvas'), ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
  const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#1d0f36'); g.addColorStop(1, '#0a0418'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const orb = ctx.createRadialGradient(1000, 100, 0, 1000, 100, 500); orb.addColorStop(0, 'rgba(225,95,245,.45)'); orb.addColorStop(1, 'rgba(225,95,245,0)'); ctx.fillStyle = orb; ctx.fillRect(0, 0, W, H);
  const orb2 = ctx.createRadialGradient(150, 600, 0, 150, 600, 450); orb2.addColorStop(0, 'rgba(139,92,246,.4)'); orb2.addColorStop(1, 'rgba(139,92,246,0)'); ctx.fillStyle = orb2; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(196,169,245,.25)'; ctx.lineWidth = 2; roundRect(ctx, 40, 40, W - 80, H - 80, 28); ctx.stroke();
  if (logo.complete && logo.naturalWidth) { ctx.save(); roundRect(ctx, 80, 80, 72, 72, 18); ctx.clip(); ctx.drawImage(logo, 80, 80, 72, 72); ctx.restore(); }
  ctx.fillStyle = '#f4efff'; ctx.font = '600 30px "Space Grotesk", Inter, sans-serif'; ctx.fillText('Jumper XP', 172, 112);
  ctx.fillStyle = '#b7a8d9'; ctx.font = '500 20px Inter, sans-serif'; ctx.fillText('unofficial calculator', 172, 142);
  ctx.fillStyle = '#b7a8d9'; ctx.font = '600 22px Inter, sans-serif'; ctx.fillText((state.results.length > 1 ? 'COMBINED XP · ' + state.results.length + ' WALLETS' : 'MY JUMPER XP').toUpperCase(), 80, 230);
  ctx.fillStyle = '#ffffff'; ctx.font = '700 118px "Space Grotesk", Inter, sans-serif'; ctx.fillText(fmtInt(c.xp), 76, 340);
  ctx.fillStyle = '#b7a8d9'; ctx.font = '600 22px Inter, sans-serif'; ctx.fillText(`WORTH AT ${fmtMoney(state.fdv)} FDV · ${$('pctLabel').textContent} TO XP`, 80, 410);
  const tg = ctx.createLinearGradient(80, 0, 700, 0); tg.addColorStop(0, '#ffffff'); tg.addColorStop(1, '#ff8df8'); ctx.fillStyle = tg; ctx.font = '700 80px "Space Grotesk", Inter, sans-serif'; ctx.fillText(fmtMoney(c.value), 76, 495);
  if (c.best) { ctx.fillStyle = 'rgba(196,169,245,.15)'; roundRect(ctx, 80, 530, 300, 46, 23); ctx.fill(); ctx.fillStyle = '#c4a9f5'; ctx.font = '600 22px Inter, sans-serif'; ctx.fillText($('resRank').textContent + ' · ' + $('resTop').textContent, 100, 561); }
  ctx.fillStyle = '#7d6ba3'; ctx.font = '500 18px Inter, sans-serif'; ctx.textAlign = 'right'; ctx.fillText(location.host || 'jumper-xp', W - 80, 570); ctx.fillText('not affiliated · not financial advice', W - 80, 545); ctx.textAlign = 'left';
  return cv;
}
const toBlob = (cv) => new Promise((r) => cv.toBlob(r, 'image/png'));
$('dlCard').addEventListener('click', async () => { const b = await toBlob(drawShareCard()); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'jumper-xp-card.png'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); });
$('copyCard').addEventListener('click', async () => {
  const btn = $('copyCard'); try { const b = await toBlob(drawShareCard()); await navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]); btn.textContent = 'Copied!'; } catch { btn.textContent = 'Copy not supported'; } setTimeout(() => (btn.textContent = 'Copy image'), 1800);
});
$('shareX').addEventListener('click', () => {
  const c = calc();
  const text = `I have ${fmtInt(c.xp)} Jumper XP${c.best ? ` (rank #${fmtInt(c.best.position)})` : ''} — worth ~${fmtMoney(c.value)} at ${fmtMoney(state.fdv)} FDV if ${$('pctLabel').textContent} goes to XP holders.\n\nCheck yours 👇\n${location.origin}`;
  window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(text), '_blank', 'noopener');
});

/* ---------------- physics chevrons (desktop only) ---------------- */
function initPhysics() {
  if (!window.Matter || !isDesktop() || reduced) return;
  const { Engine, Bodies, Body, Composite, Mouse, MouseConstraint, Events, Query } = Matter;
  const cv = $('physics'), ctx = cv.getContext('2d');
  const engine = Engine.create({ gravity: { y: 0.9 } });
  let W, H, walls = [];
  const bodies = [];
  const chev = document.createElement('canvas'); chev.width = chev.height = 120;
  const img = new Image(); img.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M31 22 L47 22 A9 9 0 0 1 53.5 24.8 L56 27.4 L45 38.5 L28.6 22.5 Z" fill="#e15ff5"/><path d="M50 41 L60 31 A9 9 0 0 1 72.7 31 L86.5 44.8 A9 9 0 0 1 86.5 57.5 L51 92.5 A9 9 0 0 1 38.5 92.5 L29 83 L58 54 L45.5 45.5 Z" fill="#c4a9f5"/></svg>`);
  function resize() {
    W = cv.width = innerWidth; H = cv.height = innerHeight;
    Composite.remove(engine.world, walls);
    walls = [Bodies.rectangle(W / 2, H + 40, W * 2, 80, { isStatic: true }), Bodies.rectangle(-40, H / 2, 80, H * 4, { isStatic: true }), Bodies.rectangle(W + 40, H / 2, 80, H * 4, { isStatic: true })];
    Composite.add(engine.world, walls);
  }
  resize(); window.addEventListener('resize', resize);
  function spawn(n, fromTop = true) {
    for (let i = 0; i < n; i++) {
      const s = 34 + Math.random() * 40;
      const b = Bodies.rectangle(Math.random() * W, fromTop ? -100 - Math.random() * 600 : H - 100, s * .6, s * .6, { restitution: .55, friction: .3, frictionAir: .012, angle: Math.random() * 6.28, chamfer: { radius: 8 } });
      b.size = s; b.alpha = .35 + Math.random() * .35; bodies.push(b); Composite.add(engine.world, b);
    }
  }
  spawn(18);
  const mouse = Mouse.create(document.body);
  const mc = MouseConstraint.create(engine, { mouse, constraint: { stiffness: .12, damping: .08, render: { visible: false } } });
  Composite.add(engine.world, mc);
  // Only let the physics layer grab when the pointer is over a chevron and not over UI.
  let overUI = false;
  document.body.addEventListener('mousedown', (e) => { overUI = !!e.target.closest('input,textarea,button,a,select,label,.card,.nav'); }, true);
  Events.on(mc, 'startdrag', () => { if (overUI) { mc.constraint.bodyB = null; mc.body = null; } });
  ['wheel', 'mousewheel', 'DOMMouseScroll'].forEach((ev) => mouse.element.removeEventListener(ev, mouse.mousewheel));
  mouse.element.removeEventListener('touchstart', mouse.mousedown); mouse.element.removeEventListener('touchmove', mouse.mousemove); mouse.element.removeEventListener('touchend', mouse.mouseup);
  window.addEventListener('mousemove', (e) => { const hit = Query.point(bodies, { x: e.clientX, y: e.clientY }).length; document.body.style.cursor = hit && !e.target.closest('input,textarea,button,a,.card') ? 'grab' : ''; }, { passive: true });
  window.__burst = () => { bodies.forEach((b) => Body.applyForce(b, b.position, { x: (Math.random() - .5) * .02 * b.mass, y: -.05 * b.mass * Math.random() })); };
  let last = performance.now();
  (function loop(t) {
    const dt = Math.min(32, t - last); last = t; Engine.update(engine, dt);
    ctx.clearRect(0, 0, W, H);
    for (const b of bodies) {
      if (b.position.y > H + 300) Body.setPosition(b, { x: Math.random() * W, y: -100 });
      ctx.save(); ctx.translate(b.position.x, b.position.y); ctx.rotate(b.angle); ctx.globalAlpha = b.alpha; ctx.drawImage(img, -b.size / 2, -b.size / 2, b.size, b.size); ctx.restore();
    }
    requestAnimationFrame(loop);
  })(last);
  cv.classList.add('active');
}
window.addEventListener('load', initPhysics);

/* ---------------- Bridge Dash (desktop only) ---------------- */
function initGame() {
  if (!isDesktop()) return;
  const cv = $('gameCanvas'), ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
  const CHAINS = [['Ethereum', '#627eea'], ['Arbitrum', '#28a0f0'], ['Base', '#0052ff'], ['Optimism', '#ff0420'], ['Polygon', '#8247e5'], ['Solana', '#14f195'], ['Avalanche', '#e84142'], ['BNB', '#f3ba2f'], ['Linea', '#61dfff'], ['Scroll', '#ffdbb0'], ['zkSync', '#8c8dfc'], ['Berachain', '#f47226']];
  const FAILS = ['You got sandwiched. Slippage: 100%.', 'Bridge is "processing". Check back in 3 days.', 'You clicked a bridge link from a Discord DM.', 'MEV bot front-ran your entire net worth.', 'Wrong chain. Funds are safu (on someone else\'s wallet).', 'Gas estimation failed. Also, your soul.', 'Your tx was reorged into a different timeline.'];
  const g = { on: false, score: 0, best: +(localStorage.getItem('bd_best') || 0), combo: 1, islands: [], bots: [], gas: [], target: 0, t: 0, px: W / 2, py: H / 2, trail: [], particles: [], bridge: null, shake: 0 };
  $('gBest').textContent = fmtInt(g.best);
  function layout() {
    g.islands = [];
    const n = 8, cols = 4, rows = 2;
    const picks = CHAINS.slice().sort(() => Math.random() - .5).slice(0, n);
    picks.forEach((c, i) => { const cx = (i % cols + .5) * (W / cols) + (Math.random() - .5) * 60, cy = (Math.floor(i / cols) + .5) * (H / rows) + (Math.random() - .5) * 70; g.islands.push({ name: c[0], color: c[1], x: cx, y: cy, r: 38, pulse: Math.random() * 6 }); });
    g.target = Math.floor(Math.random() * n);
  }
  function reset() { g.score = 0; g.combo = 1; g.bots = []; g.gas = []; g.t = 0; g.trail = []; g.particles = []; g.bridge = null; layout(); addBot(); $('gScore').textContent = 0; $('gCombo').textContent = '×1'; $('gStatus').textContent = 'bridging…'; }
  function addBot() { const side = Math.random() < .5 ? -40 : W + 40; g.bots.push({ x: side, y: Math.random() * H, vx: 0, vy: 0, sp: 1.2 + g.t / 4000, wob: Math.random() * 10 }); }
  function addGas() { g.gas.push({ x: 60 + Math.random() * (W - 120), y: 60 + Math.random() * (H - 120), r: 0, max: 40 + Math.random() * 30, life: 0 }); }
  function burst(x, y, color, n = 24) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, s = 2 + Math.random() * 5; g.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, color }); } }
  function end(msg) { g.on = false; cv.style.cursor = ''; if (g.score > g.best) { g.best = g.score; localStorage.setItem('bd_best', g.best); $('gBest').textContent = fmtInt(g.best); } $('gMsg').textContent = msg; $('gTitle').textContent = 'Rekt at ' + fmtInt(g.score) + ' XP'; $('gSub').textContent = 'The bots got faster the longer you lived. Reminder: real bridges are safer with an aggregator. Allegedly.'; $('gStart').textContent = 'Bridge again'; $('gOverlay').classList.remove('hide'); $('gStatus').textContent = 'sandwiched'; g.shake = 18; }
  $('gStart').addEventListener('click', () => { reset(); g.on = true; $('gOverlay').classList.add('hide'); cv.style.cursor = 'none'; });
  cv.addEventListener('mousemove', (e) => { const r = cv.getBoundingClientRect(); g.px = (e.clientX - r.left) * (W / r.width); g.py = (e.clientY - r.top) * (H / r.height); });
  let lastBot = 0, lastGas = 0;
  function update(dt) {
    if (!g.on) return; g.t += dt;
    if (g.t - lastBot > Math.max(2200, 6000 - g.t / 10)) { addBot(); lastBot = g.t; }
    if (g.t - lastGas > 3500) { addGas(); lastGas = g.t; }
    // target reached?
    const tg = g.islands[g.target];
    if (Math.hypot(g.px - tg.x, g.py - tg.y) < tg.r) {
      const gain = 100 * g.combo; g.score += gain; g.combo = Math.min(10, g.combo + 1);
      $('gScore').textContent = fmtInt(g.score); $('gCombo').textContent = '×' + g.combo;
      burst(tg.x, tg.y, tg.color, 34); g.bridge = { from: tg, to: null, life: 1 };
      let nt; do { nt = Math.floor(Math.random() * g.islands.length); } while (nt === g.target); g.target = nt; g.bridge.to = g.islands[nt];
    }
    // bots chase
    for (const b of g.bots) {
      const dx = g.px - b.x, dy = g.py - b.y, d = Math.hypot(dx, dy) || 1;
      b.vx += (dx / d) * .09 * b.sp; b.vy += (dy / d) * .09 * b.sp; b.vx *= .96; b.vy *= .96; b.x += b.vx; b.y += b.vy; b.wob += .15;
      if (d < 22) { burst(g.px, g.py, '#ff5c8a', 40); end(FAILS[Math.floor(Math.random() * FAILS.length)]); return; }
    }
    // gas spikes
    for (const s of g.gas) { s.life += dt; s.r = s.max * Math.min(1, s.life / 800); if (s.life > 800 && s.life < 4000 && Math.hypot(g.px - s.x, g.py - s.y) < s.r) { g.score = Math.max(0, g.score - 50); g.combo = 1; $('gScore').textContent = fmtInt(g.score); $('gCombo').textContent = '×1'; s.life = 4000; burst(s.x, s.y, '#ffa940', 20); g.shake = 6; } }
    g.gas = g.gas.filter((s) => s.life < 4600);
    g.trail.push({ x: g.px, y: g.py }); if (g.trail.length > 14) g.trail.shift();
    for (const p of g.particles) { p.x += p.vx; p.y += p.vy; p.vx *= .96; p.vy = p.vy * .96 + .08; p.life -= .025; }
    g.particles = g.particles.filter((p) => p.life > 0);
    if (g.bridge) { g.bridge.life -= .012; if (g.bridge.life <= 0) g.bridge = null; }
  }
  function draw(t) {
    ctx.save(); if (g.shake > 0) { ctx.translate((Math.random() - .5) * g.shake, (Math.random() - .5) * g.shake); g.shake *= .85; if (g.shake < .4) g.shake = 0; }
    ctx.clearRect(-20, -20, W + 40, H + 40);
    // grid
    ctx.strokeStyle = 'rgba(196,169,245,.06)'; ctx.lineWidth = 1; for (let x = 0; x < W; x += 50) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); } for (let y = 0; y < H; y += 50) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    // bridge beam
    if (g.bridge && g.bridge.to) { ctx.save(); ctx.globalAlpha = g.bridge.life; ctx.strokeStyle = '#e15ff5'; ctx.lineWidth = 3; ctx.setLineDash([10, 8]); ctx.lineDashOffset = -t / 20; ctx.beginPath(); ctx.moveTo(g.bridge.from.x, g.bridge.from.y); ctx.lineTo(g.bridge.to.x, g.bridge.to.y); ctx.stroke(); ctx.restore(); }
    // islands
    g.islands.forEach((is, i) => {
      const isT = i === g.target && g.on; is.pulse += .05;
      if (isT) { const pr = is.r + 14 + Math.sin(is.pulse * 2) * 6; ctx.beginPath(); ctx.arc(is.x, is.y, pr, 0, 6.28); ctx.strokeStyle = is.color; ctx.lineWidth = 3; ctx.globalAlpha = .8; ctx.stroke(); ctx.globalAlpha = 1; const gl = ctx.createRadialGradient(is.x, is.y, 0, is.x, is.y, pr + 30); gl.addColorStop(0, is.color + '66'); gl.addColorStop(1, is.color + '00'); ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(is.x, is.y, pr + 30, 0, 6.28); ctx.fill(); }
      ctx.beginPath(); ctx.arc(is.x, is.y + 6, is.r, 0, 6.28); ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fill();
      ctx.beginPath(); ctx.arc(is.x, is.y, is.r, 0, 6.28); ctx.fillStyle = isT ? is.color : '#2a1a4d'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = is.color; ctx.stroke();
      ctx.fillStyle = isT ? '#0d0520' : '#e9dfff'; ctx.font = '600 12px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(is.name, is.x, is.y + 4);
      if (isT) { ctx.fillStyle = '#fff'; ctx.font = '700 11px Inter'; ctx.fillText('BRIDGE HERE', is.x, is.y - is.r - 22); }
    });
    // gas
    for (const s of g.gas) { const a = s.life > 4000 ? (4600 - s.life) / 600 : Math.min(1, s.life / 800); ctx.globalAlpha = a * .85; const gr = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r); gr.addColorStop(0, 'rgba(255,169,64,.6)'); gr.addColorStop(1, 'rgba(255,90,0,.05)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.28); ctx.fill(); ctx.strokeStyle = '#ffa940'; ctx.setLineDash([4, 6]); ctx.lineWidth = 1.5; ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = '#ffd7a3'; ctx.font = '700 11px Inter'; ctx.textAlign = 'center'; ctx.fillText('GAS SPIKE', s.x, s.y + 4); ctx.globalAlpha = 1; }
    // bots
    for (const b of g.bots) { const bob = Math.sin(b.wob) * 3; ctx.save(); ctx.translate(b.x, b.y + bob); ctx.fillStyle = '#ffcf5a'; roundRect(ctx, -16, -12, 32, 8, 4); ctx.fill(); ctx.fillStyle = '#ff5c8a'; roundRect(ctx, -16, -4, 32, 8, 2); ctx.fill(); ctx.fillStyle = '#ffcf5a'; roundRect(ctx, -16, 4, 32, 8, 4); ctx.fill(); ctx.fillStyle = '#0d0520'; ctx.beginPath(); ctx.arc(-6, 0, 2.2, 0, 6.28); ctx.arc(6, 0, 2.2, 0, 6.28); ctx.fill(); ctx.fillStyle = '#ff5c8a'; ctx.font = '700 9px Inter'; ctx.textAlign = 'center'; ctx.fillText('MEV', 0, -16); ctx.restore(); }
    // particles
    for (const p of g.particles) { ctx.globalAlpha = p.life; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, 6.28); ctx.fill(); } ctx.globalAlpha = 1;
    // player
    if (g.on) {
      g.trail.forEach((p, i) => { ctx.globalAlpha = i / g.trail.length * .5; ctx.fillStyle = '#e15ff5'; ctx.beginPath(); ctx.arc(p.x, p.y, 4 + i * .5, 0, 6.28); ctx.fill(); }); ctx.globalAlpha = 1;
      const gl = ctx.createRadialGradient(g.px, g.py, 0, g.px, g.py, 40); gl.addColorStop(0, 'rgba(225,95,245,.5)'); gl.addColorStop(1, 'rgba(225,95,245,0)'); ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(g.px, g.py, 40, 0, 6.28); ctx.fill();
      ctx.beginPath(); ctx.arc(g.px, g.py, 13, 0, 6.28); ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = '#e15ff5'; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = '#8b5cf6'; ctx.font = '700 11px Inter'; ctx.textAlign = 'center'; ctx.fillText('XP', g.px, g.py + 4);
    }
    ctx.restore();
  }
  let last = performance.now();
  (function loop(t) { const dt = Math.min(40, t - last); last = t; update(dt); draw(t); requestAnimationFrame(loop); })(last);
  layout();
}
initGame();

})();
