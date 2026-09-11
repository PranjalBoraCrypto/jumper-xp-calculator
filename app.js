/* Jumper XP — app script (unofficial community calculator). */
(() => {
'use strict';

/* ---------- leaderboard snapshot (refresh with scripts/estimate-total.mjs) ---------- */
const SNAPSHOT = { totalXp: 246668625, wallets: 2774656, date: '11 Sep 2026' };
/* rank → XP samples from the sorted leaderboard (37 log-spaced pages). */
const DIST=[[1,7813],[100,4832],[101,4823],[200,4341],[201,4341],[300,4066],[301,4064],[400,3871],[501,3710],[600,3596],[701,3458],[800,3378],[1001,3218],[1100,3151],[1401,3001],[1500,2958],[1901,2806],[2000,2772],[2601,2590],[2700,2570],[3501,2397],[3600,2379],[4701,2200],[4800,2188],[6301,1998],[6400,1987],[8401,1796],[8500,1788],[10901,1615],[11000,1609],[14901,1404],[15000,1400],[19901,1224],[20000,1221],[26901,1043],[27000,1041],[35901,885],[36000,884],[47901,741],[48000,740],[63901,611],[64000,611],[84901,503],[85000,503],[109901,415],[110000,415],[149901,331],[150000,331],[199901,288],[200000,288],[269901,202],[270000,201],[359901,144],[360000,143],[479901,103],[480000,102],[639901,73],[640000,73],[849901,52],[850000,52],[1099901,40],[1100000,40],[1399901,30],[1400000,30],[1699901,25],[1700000,25],[1999901,15],[2000000,15],[2299901,15],[2300000,15],[2599901,12],[2600000,12],[2774601,2],[2774656,2]];
const CUM = [0]; // cumulative XP up to and including each DIST point (unscaled)
for (let i = 1; i < DIST.length; i++) { const [r1, x1] = DIST[i - 1], [r2, x2] = DIST[i]; CUM[i] = CUM[i - 1] + (r2 - r1) * (x1 + x2) / 2; }
const SCALE = SNAPSHOT.totalXp / (CUM[CUM.length - 1] + DIST[DIST.length - 1][1]);
const xpAtRank = (r) => { r = Math.min(Math.max(1, r), SNAPSHOT.wallets); for (let i = 1; i < DIST.length; i++) if (r <= DIST[i][0]) { const [r1, x1] = DIST[i - 1], [r2, x2] = DIST[i]; return x1 + (x2 - x1) * (r - r1) / (r2 - r1); } return DIST[DIST.length - 1][1]; };
const cumXp = (r) => { r = Math.min(Math.max(0, r), SNAPSHOT.wallets); if (r === 0) return 0; for (let i = 1; i < DIST.length; i++) if (r <= DIST[i][0]) { const [r1, x1] = DIST[i - 1]; const x = xpAtRank(r); return (CUM[i - 1] + (r - r1) * (x1 + x) / 2 + x) * SCALE; } return SNAPSHOT.totalXp; };
const rankAtXp = (x) => { if (x > DIST[0][1]) return 0; let lo = 1, hi = SNAPSHOT.wallets; while (lo < hi) { const m = Math.floor((lo + hi + 1) / 2); if (xpAtRank(m) >= x) lo = m; else hi = m - 1; } return lo; }; // last rank with xp >= x

const EVM_RE = /^0x[a-fA-F0-9]{40}$/, SOL_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const $ = (id) => document.getElementById(id);
const desktop = () => matchMedia('(min-width: 921px) and (pointer: fine)').matches;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- formatting ---------- */
const fmtInt = (n) => Math.round(n).toLocaleString('en-US');
const trim = (s) => s.replace(/\.?0+$/, '');
const fmtMoney = (n) => !isFinite(n) ? '$0' : n >= 1e9 ? '$' + trim((n / 1e9).toFixed(2)) + 'B' : n >= 1e6 ? '$' + trim((n / 1e6).toFixed(2)) + 'M' : n >= 1e4 ? '$' + fmtInt(n) : n >= 100 ? '$' + n.toFixed(0) : '$' + n.toFixed(2);
const fmtBig = (n) => n >= 1e9 ? trim((n / 1e9).toFixed(2)) + 'B' : n >= 1e6 ? trim((n / 1e6).toFixed(n >= 1e8 ? 1 : 2)) + 'M' : fmtInt(n);
const short = (a) => (a.length > 14 ? a.slice(0, 6) + '…' + a.slice(-4) : a);
const pctText = (v) => (v % 1 ? v.toFixed(1) : String(v)) + '%';

$('hWallets').textContent = fmtBig(SNAPSHOT.wallets); $('fWallets').textContent = fmtInt(SNAPSHOT.wallets); $('fDate').textContent = SNAPSHOT.date; $('eqTotal').textContent = fmtBig(SNAPSHOT.totalXp);

/* ---------- ticker ---------- */
const items = [`<b>#1</b> wallet holds <em>7,813 XP</em>`, `<b>${fmtInt(SNAPSHOT.wallets)}</b> wallets with XP`, `median wallet <em>30 XP</em>`, `<b>${fmtBig(SNAPSHOT.totalXp)}</b> total XP on the board`, `rank 100 has <em>4,832 XP</em>`, `snapshot <b>${SNAPSHOT.date}</b>`, `EVM <b>+</b> Solana supported`, `no token announced <em>yet</em>`];
const tick = $('ticker'); tick.innerHTML = Array(4).fill(items.map((i) => `<span>${i}</span>`).join('')).join('');

/* ---------- scroll engine: lerped scroll, parallax, nav, ticker ---------- */
const pxEls = [...document.querySelectorAll('[data-px]')];           // fixed background layers
const pyEls = [...document.querySelectorAll('[data-py]')];           // in-flow elements, offset by distance from viewport centre
const nav = $('nav'), heroCopy = document.querySelector('.hero-copy');
let sy = scrollY, target = scrollY, vel = 0, tickX = 0, mx = 0, my = 0, tmx = 0, tmy = 0;
addEventListener('scroll', () => { target = scrollY; }, { passive: true });
addEventListener('mousemove', (e) => { tmx = e.clientX / innerWidth - .5; tmy = e.clientY / innerHeight - .5; }, { passive: true });
function frame() {
  const prev = sy; sy += (target - sy) * (reduced ? 1 : .12); vel = sy - prev;
  mx += (tmx - mx) * .05; my += (tmy - my) * .05;
  const vh = innerHeight, isD = desktop();
  if (!reduced) {
    for (const el of pxEls) el.style.transform = `translate3d(${mx * -20 * +el.dataset.px * 10}px, ${-sy * +el.dataset.px + my * -10}px, 0)`;
    for (const el of pyEls) {
      const r = el.getBoundingClientRect(); const rel = (r.top + r.height / 2 - vh / 2) / vh; // -1..1
      const py = +el.dataset.py * (isD ? 1 : .5), rot = +(el.dataset.rot || 0);
      const mouse = isD && el.classList.contains('logo') ? `rotateY(${mx * 10}deg) rotateX(${-my * 10}deg)` : '';
      const base = el.classList.contains('giant') ? 'translate(-50%,-50%) ' : el.classList.contains('foot-word') ? 'translateX(-50%) ' : '';
      const spin = el.id === 'spinner' ? `rotate(${el.dataset.spin || 0}deg)` : '';
      el.style.transform = `${base}translate3d(0, ${-rel * vh * py}px, 0) ${rot ? `rotate(${rel * rot * 180}deg)` : ''} ${mouse} ${spin}`;
    }
    if (heroCopy) { const k = isD ? Math.min(1, sy / (vh * .7)) : 0; heroCopy.style.opacity = 1 - k * .9; }
    tickX -= .6 + Math.min(12, Math.abs(vel) * .35); const w = tick.scrollWidth / 4; if (-tickX > w) tickX += w; tick.style.transform = `translate3d(${tickX}px,0,0)`;
  }
  nav.classList.toggle('scrolled', sy > 20);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
requestAnimationFrame(() => document.body.classList.add('in'));

/* ---------- reveal ---------- */
const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .12, rootMargin: '0px 0px -8% 0px' });
document.querySelectorAll('.rv').forEach((el) => io.observe(el));

/* ---------- count-up ---------- */
function countUp(el, to, fmt, ms = 1200) {
  const t0 = performance.now();
  (function step(t) { const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(to * e); if (k < 1) requestAnimationFrame(step); })(t0);
}

/* ---------- state + dials ---------- */
const state = { fdv: 1e8, pct: 10, results: null, mask: false, elig: 'tier', minXp: 100, topN: 100000, minLevel: 10, tiers: [{ upTo: 1000, share: 25 }, { upTo: 10000, share: 30 }, { upTo: 100000, share: 30 }, { upTo: Infinity, share: 15 }] };
const range = $('pct');
function syncChips(id, v) { document.querySelectorAll(`#${id} .chip[data-v]`).forEach((c) => c.classList.toggle('on', +c.dataset.v === v)); }
function setPct(v, from) {
  v = Math.min(100, Math.max(0.1, +v || 0)); state.pct = v;
  if (from !== 'range') range.value = Math.max(1, v); range.style.setProperty('--p', Math.max(1, v) + '%');
  if (from !== 'custom') $('pctCustom').value = '';
  $('pctLabel').textContent = pctText(v); $('eqPct').textContent = pctText(v); syncChips('pctChips', v); render(false);
}
function setFdv(v, from) {
  v = Math.max(1, +v || 0); state.fdv = v;
  if (from !== 'custom') $('fdvCustom').value = '';
  $('fdvLabel').textContent = fmtMoney(v); $('eqFdv').textContent = fmtMoney(v); syncChips('fdvChips', v); render(false);
}
range.addEventListener('input', () => setPct(range.value, 'range'));
$('pctCustom').addEventListener('input', (e) => { if (e.target.value) setPct(e.target.value, 'custom'); });
const parseMoney = (s) => { const m = String(s).trim().toLowerCase().replace(/[$,\s]/g, '').match(/^(\d*\.?\d+)([kmb])?$/); if (!m) return 0; return +m[1] * ({ k: 1e3, m: 1e6, b: 1e9 }[m[2]] || 1); };
$('fdvCustom').addEventListener('input', (e) => { const v = parseMoney(e.target.value); if (v) setFdv(v, 'custom'); });
document.querySelectorAll('#pctChips .chip[data-v]').forEach((c) => c.addEventListener('click', () => setPct(c.dataset.v)));
document.querySelectorAll('#fdvChips .chip[data-v]').forEach((c) => c.addEventListener('click', () => setFdv(c.dataset.v)));
setPct(10); setFdv(1e8);

/* ---------- lookup ---------- */
const addrEvm = $('addrEvm'), addrSol = $('addrSol');
function fieldState() {
  const e = addrEvm.value.trim(), so = addrSol.value.trim();
  const eOk = !e || EVM_RE.test(e), sOk = !so || SOL_RE.test(so);
  $('wfEvm').className = 'wfield' + (e ? (eOk ? ' ok' : ' bad') : ''); $('stEvm').textContent = e ? (eOk ? '✓' : '!') : '';
  $('wfSol').className = 'wfield' + (so ? (sOk ? ' ok' : ' bad') : ''); $('stSol').textContent = so ? (sOk ? '✓' : '!') : '';
  return { e, so, eOk, sOk };
}
const parseAddrs = () => { const f = fieldState(); const out = []; if (f.e) out.push(f.e); if (f.so) out.push(f.so); return out; };
[addrEvm, addrSol].forEach((el) => { el.addEventListener('input', fieldState); el.addEventListener('keydown', (e) => { if (e.key === 'Enter') lookup(false); }); });
$('demo').addEventListener('click', () => { addrEvm.value = '0x1234567890abcdef1234567890abcdef12345678'; addrSol.value = ''; fieldState(); lookup(true); });
$('go').addEventListener('click', () => lookup(false));
// Hero button: take the user to the wallet field and open the keyboard, so the tap has an obvious effect
$('heroGo').addEventListener('click', (e) => { e.preventDefault(); const panel = document.querySelector('.input-panel'); panel.scrollIntoView({ behavior: 'smooth', block: 'start' }); setTimeout(() => addrEvm.focus({ preventScroll: true }), 500); });
document.querySelector('.nav .cta').addEventListener('click', (e) => { e.preventDefault(); document.querySelector('.input-panel').scrollIntoView({ behavior: 'smooth', block: 'start' }); setTimeout(() => addrEvm.focus({ preventScroll: true }), 500); });
function notice(id, msg) { const el = $(id); el.textContent = msg || ''; el.style.display = msg ? 'block' : 'none'; }
const maskAddr = (a) => (a.startsWith('0x') ? '0x' : '') + '••••••••••••';
$('maskBtn').addEventListener('click', () => { state.mask = !state.mask; $('maskBtn').setAttribute('aria-pressed', state.mask); $('maskTxt').textContent = state.mask ? 'Show addresses' : 'Hide addresses'; render(false); });

async function lookup(demo) {
  const f = fieldState(), addrs = parseAddrs(); notice('err', ''); notice('warn', '');
  if (!addrs.length) return notice('err', 'Enter an EVM or a Solana wallet address (or both).');
  if (!f.eOk) return notice('err', 'That EVM address should be 0x followed by 40 hex characters.');
  if (!f.sOk) return notice('err', 'That doesn’t look like a Solana address (32–44 base58 characters).');
  const go = $('go'); go.disabled = true; $('goTxt').innerHTML = '<span class="spinner"></span> Asking Jumper';
  const t0 = performance.now(); startLoader();
  $('result').scrollIntoView({ behavior: 'smooth', block: desktop() ? 'center' : 'start' });
  try {
    let results;
    if (demo) { results = [{ address: addrs[0], chain: 'evm', found: true, points: 1337, position: 14210, demo: true }]; }
    else {
      const r = await fetch('/api/xp?address=' + encodeURIComponent(addrs.join(',')));
      const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Lookup failed');
      results = j.results;
      const limited = results.filter((x) => x.error === 'rate_limited'), other = results.filter((x) => x.error && x.error !== 'rate_limited');
      if (limited.length === results.length) throw new Error('Jumper’s API is rate-limiting requests right now. Wait a minute and try again.');
      if (limited.length) notice('warn', `Jumper rate-limited ${limited.length} of ${results.length} lookups — those show as 0. Try again in a minute.`);
      if (other.length) notice('warn', `Jumper’s API returned an error for ${other.length} wallet(s) (${other[0].error}).`);
    }
    await new Promise((r) => setTimeout(r, Math.max(0, 1500 - (performance.now() - t0))));
    await finishLoader();
    state.results = results; lastXp = -1; render(true);
    const card = $('result'); card.classList.remove('reveal'); void card.offsetWidth; card.classList.add('reveal'); card.addEventListener('animationend', function h(ev) { if (ev.animationName === 'flipIn') { card.classList.remove('reveal'); card.removeEventListener('animationend', h); } });
  } catch (e) { stopLoader(); const msg = e.message === 'Failed to fetch' ? 'Could not reach the API. Deploy on Vercel so /api/xp exists.' : e.message; notice('err', msg); if (!state.results) { $('resultEmpty').style.display = 'grid'; $('resultEmpty').querySelector('.big').textContent = 'Lookup failed'; $('resultEmpty').querySelector('div').lastChild.textContent = msg; } if (!desktop()) $('err').scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  finally { go.disabled = false; $('goTxt').textContent = 'Check my XP'; }
}

/* ---------- loader ---------- */
const LOAD_MSGS = ['Pinging Jumper…', 'Counting your hops…', 'Finding your rank…', 'Pricing your slice…'];
let loadTimer = null;
function startLoader() {
  const L = $('loader'), bar = $('loadBar'), msg = $('loadMsg'); $('resultEmpty').style.display = 'none'; L.classList.add('on'); $('result').classList.add('loading'); bar.style.width = '8%';
  let i = 0; const step = () => { msg.innerHTML = `<span>${LOAD_MSGS[i % LOAD_MSGS.length]}</span>`; bar.style.width = Math.min(88, 8 + (i + 1) * 24) + '%'; i++; }; step(); loadTimer = setInterval(step, 420);
}
async function finishLoader() { clearInterval(loadTimer); $('loadBar').style.width = '100%'; $('loadMsg').innerHTML = '<span>Done.</span>'; await new Promise((r) => setTimeout(r, 260)); $('loader').classList.remove('on'); $('result').classList.remove('loading'); }
function stopLoader() { clearInterval(loadTimer); $('loader').classList.remove('on'); $('result').classList.remove('loading'); }

/* ---------- render ---------- */
/* ---------- eligibility ---------- */
const ELIG_NAMES = { all: 'Everyone', min: 'Min XP', top: 'Top N', tier: 'Tiered', level: 'Pass Level' };
function eligSummary() {
  if (state.elig === 'min') return `≥ ${fmtInt(state.minXp)} XP`;
  if (state.elig === 'top') return `top ${fmtBig(state.topN)}`;
  if (state.elig === 'tier') return 'tiered';
  if (state.elig === 'level') return `Level ${state.minLevel}+`;
  return 'everyone';
}
function setElig(m) {
  state.elig = m; document.querySelectorAll('#eligSeg button').forEach((b) => b.classList.toggle('on', b.dataset.m === m));
  ['all', 'min', 'top', 'tier', 'level'].forEach((k) => ($('elig-' + k).hidden = k !== m));
  $('eligLabel').textContent = ELIG_NAMES[m]; updateEligNotes(); render(false);
}
function updateEligNotes() {
  $('nAll').textContent = fmtBig(SNAPSHOT.wallets);
  const rMin = rankAtXp(state.minXp); $('nMin').textContent = fmtInt(rMin); $('xMin').textContent = (cumXp(rMin) / SNAPSHOT.totalXp * 100).toFixed(1) + '%';
  const n = Math.min(state.topN, SNAPSHOT.wallets); $('nTop').textContent = fmtInt(n); $('xTop').textContent = fmtInt(xpAtRank(n)); $('sTop').textContent = (cumXp(n) / SNAPSHOT.totalXp * 100).toFixed(1) + '%';
  const lvMin = JXP.LEVELS[Math.min(100, Math.max(1, state.minLevel)) - 1][1], rL = rankAtXp(lvMin); $('lvlN').textContent = state.minLevel; $('lvlXp').textContent = fmtInt(lvMin); $('nLvl').textContent = fmtInt(rL); $('xLvl').textContent = (cumXp(rL) / SNAPSHOT.totalXp * 100).toFixed(1) + '%';
  const sum = state.tiers.reduce((a, t) => a + (+t.share || 0), 0); const el = $('tiersSum'); el.textContent = `Shares add up to ${sum}%` + (sum === 100 ? '' : ' — should be 100%'); el.classList.toggle('bad', sum !== 100);
}
document.querySelectorAll('#eligSeg button').forEach((b) => b.addEventListener('click', () => setElig(b.dataset.m)));
$('minXp').addEventListener('input', (e) => { state.minXp = Math.max(1, +e.target.value || 1); updateEligNotes(); render(false); });
$('minLevel').addEventListener('input', (e) => { state.minLevel = Math.min(100, Math.max(1, +e.target.value || 1)); updateEligNotes(); render(false); });
$('topN').addEventListener('input', (e) => { state.topN = Math.max(1, +e.target.value || 1); updateEligNotes(); render(false); });
(function buildTiers() {
  const box = $('tiersEdit');
  state.tiers.forEach((t, i) => {
    const last = i === state.tiers.length - 1;
    box.insertAdjacentHTML('beforeend', `<div class="n">T${i + 1}</div><div>${last ? '<input value="the rest" disabled>' : `<input type="number" min="1" data-i="${i}" data-k="upTo" value="${t.upTo}" inputmode="numeric">`}</div><div><input type="number" min="0" max="100" data-i="${i}" data-k="share" value="${t.share}" inputmode="decimal"></div>`);
  });
  box.addEventListener('input', (e) => { const i = +e.target.dataset.i, k = e.target.dataset.k; if (k) { state.tiers[i][k] = +e.target.value || 0; updateEligNotes(); render(false); } });
})();

setElig('tier');

/* ---------- valuation ---------- */
function calc() {
  const rs = state.results || [], xp = rs.reduce((a, r) => a + (r.points || 0), 0);
  const F = state.fdv * state.pct / 100; // dollars in the airdrop pool
  let value = 0, poolXp = SNAPSHOT.totalXp, eligibleXp = 0, note = '';
  if (state.elig === 'all') { eligibleXp = xp; value = xp / poolXp * F; }
  else if (state.elig === 'min') { poolXp = cumXp(rankAtXp(state.minXp)); for (const r of rs) if ((r.points || 0) >= state.minXp) eligibleXp += r.points; value = eligibleXp / poolXp * F; }
  else if (state.elig === 'level') { const lvMin = JXP.LEVELS[Math.min(100, Math.max(1, state.minLevel)) - 1][1]; poolXp = cumXp(rankAtXp(lvMin)); for (const r of rs) if ((r.points || 0) >= lvMin) eligibleXp += r.points; value = eligibleXp / poolXp * F; }
  else if (state.elig === 'top') { const n = Math.min(state.topN, SNAPSHOT.wallets); poolXp = cumXp(n); for (const r of rs) if (r.position && r.position <= n) eligibleXp += r.points; value = eligibleXp / poolXp * F; }
  else {
    const cut = state.tiers.map((t) => (isFinite(t.upTo) ? Math.min(t.upTo, SNAPSHOT.wallets) : SNAPSHOT.wallets));
    for (const r of rs) { if (!r.position) continue; let i = cut.findIndex((c) => r.position <= c); if (i < 0) i = cut.length - 1; const lo = i ? cut[i - 1] : 0; const tierXp = cumXp(cut[i]) - cumXp(lo); eligibleXp += r.points; value += r.points / tierXp * (state.tiers[i].share / 100) * F; }
    poolXp = NaN;
  }
  const best = rs.filter((r) => r.position).sort((a, b) => a.position - b.position)[0];
  const eligible = eligibleXp > 0;
  return { xp, value, eligible, eligibleXp, poolXp, best, perPct: state.pct ? value / state.pct : 0, perXp: eligibleXp ? value / eligibleXp : 0, tier: JXP.tierFor(best ? best.position : 0, SNAPSHOT.wallets) };
}
let lastXp = -1;
function render(animate) {
  if (!state.results) return;
  const c = calc(), multi = state.results.length > 1, t = c.tier;
  $('resultEmpty').style.display = 'none'; $('resultBody').style.display = 'grid'; $('shareRow').classList.add('show'); $('shareHint').classList.add('show');
  const card = $('result'); card.style.setProperty('--tc1', t.c1); card.style.setProperty('--tc2', t.c2); card.style.setProperty('--tglow', t.glow);
  if (card.dataset.tier !== String(t.id)) { $('emblem').innerHTML = JXP.emblemSVG(t, 170); card.dataset.tier = t.id; }
  $('tierNum').textContent = `TIER ${t.id} / 10`; $('tierName').textContent = t.name; $('tierLine').textContent = t.line;
  $('tierSub').textContent = c.best ? 'Top ' + fmtTop(c.best.position / SNAPSHOT.wallets * 100) : 'Unranked';
  $('resTag').textContent = (multi ? 'Combined Jumper XP' : 'Your Jumper XP') + (state.results[0].demo ? ' · example' : '');
  if (animate && c.xp !== lastXp) { countUp($('resXp'), c.xp, fmtInt); countUp($('resVal'), c.value, fmtMoney); countUp($('eqVal'), c.value, fmtMoney); lastXp = c.xp; }
  else { $('resXp').textContent = fmtInt(c.xp); $('resVal').textContent = c.eligible ? fmtMoney(c.value) : 'Not eligible'; $('eqVal').textContent = fmtMoney(c.value); }
  $('valueBox').classList.toggle('ineligible', !c.eligible);
  $('eqXp').textContent = fmtInt(c.xp); $('eqTotal').textContent = isFinite(c.poolXp) ? fmtBig(c.poolXp) : 'tiered';
  $('valFdv').textContent = fmtMoney(state.fdv); $('valPct').textContent = pctText(state.pct); $('valElig').textContent = eligSummary();
  $('resShare').textContent = !c.eligible ? (state.elig === 'min' ? `Below the ${fmtInt(state.minXp)} XP cutoff` : state.elig === 'top' ? `Outside the top ${fmtInt(state.topN)}` : state.elig === 'level' ? `Below Pass Level ${state.minLevel}` : 'No ranked XP') : isFinite(c.poolXp) ? (c.eligibleXp / c.poolXp * 100).toFixed(5) + '% of eligible XP' : 'Pro-rata inside your tier';
  $('resPerPct').textContent = fmtMoney(c.perPct); $('resPerXp').textContent = fmtMoney(c.perXp); $('resWallets').textContent = state.results.length;
  const lvW = state.results.slice().sort((x, y) => (y.points || 0) - (x.points || 0))[0], lv = JXP.levelFor(lvW ? lvW.points : 0);
  $('passLevel').textContent = 'Level ' + lv.level + (multi ? ' · ' + (lvW.chain === 'solana' ? 'SOL' : 'EVM') : '');
  $('passBar').style.width = (lv.progress * 100) + '%';
  $('passNext').textContent = lv.level >= 100 ? 'Max level reached' : `${fmtInt(lv.next)} XP to Level ${lv.level + 1} · ${fmtInt(lv.min)}–${fmtInt(lv.max)} XP band`;
  $('resRank').textContent = c.best ? (multi ? 'best rank #' : 'rank #') + fmtInt(c.best.position) : c.xp ? 'unranked' : 'no XP on this wallet';
  const showA = (r) => (state.mask ? maskAddr(r.address) : short(r.address));
  $('walletTable').innerHTML = '<table><tr><th>Wallet</th><th>Chain</th><th style="text-align:right">Rank</th><th style="text-align:right">XP</th></tr>' + state.results.map((r) => `<tr><td>${showA(r)}</td><td class="d">${r.chain === 'solana' ? 'Solana' : 'EVM'}</td><td class="r d">${r.position ? '#' + fmtInt(r.position) : r.error ? 'error' : '—'}</td><td class="r">${fmtInt(r.points || 0)}</td></tr>`).join('') + '</table>';
  updateLivebar(c);
  document.querySelectorAll('#ladder .rung').forEach((el) => { const me = +el.dataset.id === t.id; el.classList.toggle('me', me); if (me) { el.style.setProperty('--tc2', t.c2); el.style.setProperty('--tglow', t.glow); } });
}
/* ---------- mobile live bar: shows the live value while the card is off-screen ---------- */
const livebar = $('livebar'); let cardVisible = true, lbTier = 0;
new IntersectionObserver((es) => { cardVisible = es[0].intersectionRatio >= .12; syncLivebar(); }, { threshold: [0, .12, .5, 1] }).observe($('result'));
function syncLivebar() { const on = !!state.results && !cardVisible && !desktop(); livebar.classList.toggle('on', on); document.body.classList.toggle('has-bar', on); }
livebar.addEventListener('click', () => { $('result').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
function updateLivebar(c) {
  if (lbTier !== c.tier.id) { $('lbEmblem').innerHTML = JXP.emblemSVG(c.tier, 40); lbTier = c.tier.id; }
  const lv = JXP.levelFor(Math.max(...state.results.map((r) => r.points || 0)));
  $('lbTier').textContent = `${c.tier.name} · Level ${lv.level} · ${eligSummary()}`;
  const v = $('lbVal'), txt = c.eligible ? fmtMoney(c.value) : 'Not eligible'; if (v.textContent !== txt) { v.textContent = txt; v.classList.remove('bump'); void v.offsetWidth; v.classList.add('bump'); }
  syncLivebar();
}
const fmtTop = (p) => (p < .01 ? '0.01' : p < 1 ? p.toFixed(2) : p.toFixed(1)) + '%';

/* ---------- tier ladder ---------- */
$('ladder').innerHTML = JXP.TIERS.map((t) => `<div class="rung" data-id="${t.id}"><span class="you">You</span>${JXP.emblemSVG(t, 64)}<div class="n">${t.name}</div><div class="p">top ${t.pct * 100 >= 1 ? (t.pct * 100) : (t.pct * 100).toFixed(t.pct * 100 < .1 ? 2 : 1)}%</div></div>`).join('');

/* ---------- 3D tilt ---------- */
const card = $('result');
if (desktop() && !reduced) {
  card.addEventListener('mousemove', (e) => { const r = card.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height; card.style.transform = `rotateX(${(.5 - y) * 12}deg) rotateY(${(x - .5) * 14}deg)`; card.style.setProperty('--gx', x * 100 + '%'); card.style.setProperty('--gy', y * 100 + '%'); card.style.boxShadow = `${(.5 - x) * 40}px ${(.5 - y) * 40}px 90px rgba(0,0,0,.5), 0 0 80px rgba(225,95,245,.14)`; });
  card.addEventListener('mouseleave', () => { card.style.transition = 'transform .7s cubic-bezier(.16,1,.3,1), box-shadow .7s'; card.style.transform = ''; card.style.boxShadow = ''; setTimeout(() => (card.style.transition = ''), 700); });
}

/* ---------- share card (horizontal on desktop, vertical on mobile) ---------- */
const logo = new Image(); logo.src = '/logo.jpg';
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
const svgImage = (svg) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });
async function drawCard() {
  const c = calc(), t = c.tier, vertical = !desktop();
  const cv = $('shareCanvas'); cv.width = vertical ? 1080 : 1200; cv.height = vertical ? 1350 : 630;
  const ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
  try { await document.fonts.ready; } catch {}
  const em = await svgImage(JXP.emblemSVG(t, 400));
  // background
  const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#1b0e36'); g.addColorStop(.6, '#0e0620'); g.addColorStop(1, '#120826'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const o1 = ctx.createRadialGradient(W * .2, 0, 0, W * .2, 0, W * .6); o1.addColorStop(0, t.glow); o1.addColorStop(1, 'rgba(0,0,0,0)'); ctx.save(); ctx.globalAlpha = .45; ctx.fillStyle = o1; ctx.fillRect(0, 0, W, H); ctx.restore();
  const o2 = ctx.createRadialGradient(W, H, 0, W, H, W * .5); o2.addColorStop(0, 'rgba(225,95,245,.16)'); o2.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = o2; ctx.fillRect(0, 0, W, H);
  // texture: engineering grid (24px fine, 96px coarse) fading out where the content sits, plus an inset hairline frame and vignette
  ctx.save();
  const gridLayer = document.createElement('canvas'); gridLayer.width = W; gridLayer.height = H; const g2 = gridLayer.getContext('2d');
  const grid = (step, alpha) => { g2.strokeStyle = `rgba(255,255,255,${alpha})`; g2.lineWidth = 1; for (let x = .5; x < W; x += step) { g2.beginPath(); g2.moveTo(x, 0); g2.lineTo(x, H); g2.stroke(); } for (let y = .5; y < H; y += step) { g2.beginPath(); g2.moveTo(0, y); g2.lineTo(W, y); g2.stroke(); } };
  grid(24, .028); grid(96, .055);
  g2.globalCompositeOperation = 'destination-in'; const m = g2.createRadialGradient(W * .62, H * .45, 0, W * .62, H * .45, Math.max(W, H) * .75); m.addColorStop(.35, 'rgba(0,0,0,0)'); m.addColorStop(1, 'rgba(0,0,0,1)'); g2.fillStyle = m; g2.fillRect(0, 0, W, H);
  ctx.drawImage(gridLayer, 0, 0); ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,.06)'; ctx.lineWidth = 1; rr(ctx, 44, 44, W - 88, H - 88, 28); ctx.stroke();
  const vg0 = ctx.createRadialGradient(W / 2, 0, 0, W / 2, 0, H * 1.3); vg0.addColorStop(.45, 'rgba(0,0,0,0)'); vg0.addColorStop(1, 'rgba(0,0,0,.4)'); ctx.fillStyle = vg0; ctx.fillRect(0, 0, W, H);
  // border
  const bg = ctx.createLinearGradient(0, 0, W, H); bg.addColorStop(0, t.c2); bg.addColorStop(.5, 'rgba(255,255,255,.25)'); bg.addColorStop(1, t.c1); ctx.strokeStyle = bg; ctx.lineWidth = 4; rr(ctx, 24, 24, W - 48, H - 48, 40); ctx.stroke();
  const D = '"Inter Tight", Inter, system-ui, sans-serif', B = 'Inter, system-ui, sans-serif';
  const header = (x, y) => { if (logo.complete && logo.naturalWidth) { ctx.save(); rr(ctx, x, y, 64, 64, 18); ctx.clip(); ctx.drawImage(logo, x, y, 64, 64); ctx.restore(); } ctx.fillStyle = '#f6f1ff'; ctx.font = `700 28px ${D}`; ctx.textAlign = 'left'; ctx.fillText('Jumper XP', x + 82, y + 30); ctx.fillStyle = '#b6a7d8'; ctx.font = `500 17px ${B}`; ctx.fillText('unofficial calculator', x + 82, y + 56); };
  const foot = (y) => { ctx.fillStyle = '#7c6aa4'; ctx.font = `500 16px ${B}`; ctx.textAlign = 'right'; ctx.fillText('not affiliated · not financial advice', W - 70, y); ctx.textAlign = 'left'; ctx.fillText(location.host || 'jumper-xp', 70, y); };
  const pill = (x, y, text, color) => { ctx.font = `600 18px ${B}`; const w = ctx.measureText(text).width + 36; ctx.fillStyle = 'rgba(255,255,255,.08)'; rr(ctx, x, y, w, 40, 20); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.fillText(text, x + 18, y + 27); return w; };
  const topTxt = c.best ? 'Top ' + fmtTop(c.best.position / SNAPSHOT.wallets * 100) : 'Unranked', rankTxt = c.best ? `Rank #${fmtInt(c.best.position)}` : '', valTxt = c.eligible ? fmtMoney(c.value) : 'Not eligible';
  const sub = `AT ${fmtMoney(state.fdv)} FDV · ${pctText(state.pct)} AIRDROP · ${eligSummary().toUpperCase()}`;
  const lv = JXP.levelFor(Math.max(...state.results.map((r) => r.points || 0)));
  const walletLine = state.results.map((r) => (r.chain === 'solana' ? 'SOL ' : 'EVM ') + (state.mask ? maskAddr(r.address) : short(r.address))).join('   ·   ');
  const markImg = await svgImage(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 400' width='400' height='400'><g fill='#fff'><path d='${JXP.LOGO.pink}'/><path d='${JXP.LOGO.lav}'/></g></svg>`);
  // stat tile: label + big value, tier-tinted left rule
  const tile = (x, y, w, h, label, val, color = '#fff', big = 34) => {
    ctx.fillStyle = 'rgba(255,255,255,.045)'; rr(ctx, x, y, w, h, 18); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.1)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = t.c2; rr(ctx, x + 14, y + 16, 3, h - 32, 2); ctx.fill();
    ctx.textAlign = 'left'; ctx.fillStyle = '#9d8fc4'; ctx.font = `600 13px ${B}`; ctx.fillText(label.toUpperCase(), x + 30, y + 30);
    ctx.fillStyle = color; ctx.font = `800 ${big}px ${D}`; ctx.fillText(val, x + 28, y + h - 22);
  };
  const accent = (x1, x2, y) => { const lg = ctx.createLinearGradient(x1, 0, x2, 0); lg.addColorStop(0, t.c2); lg.addColorStop(.6, 'rgba(255,255,255,.15)'); lg.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = lg; ctx.fillRect(x1, y, x2 - x1, 2); };
  if (!vertical) {
    header(70, 60);
    // top-right: snapshot tag
    ctx.textAlign = 'right'; ctx.fillStyle = '#7c6aa4'; ctx.font = `600 14px ${B}`; ctx.fillText(`SNAPSHOT ${SNAPSHOT.date.toUpperCase()}`, W - 70, 95); ctx.textAlign = 'left';
    accent(70, W - 70, 148);
    // watermark mark behind the tiles
    ctx.save(); ctx.globalAlpha = .05; ctx.translate(W - 60, 300); ctx.rotate(-.18); ctx.drawImage(markImg, -230, -160, 460, 460); ctx.restore();
    // left: emblem + tier
    ctx.drawImage(em, 67, 166, 300, 300);
    ctx.fillStyle = '#9d8fc4'; ctx.font = `600 15px ${B}`; ctx.textAlign = 'center'; ctx.fillText(`TIER ${t.id} / 10 · ${topTxt.toUpperCase()}`, 217, 494);
    const tg = ctx.createLinearGradient(100, 0, 340, 0); tg.addColorStop(0, '#fff'); tg.addColorStop(1, t.c2); ctx.fillStyle = tg; ctx.font = `800 48px ${D}`; ctx.fillText(t.name, 217, 542);
    ctx.strokeStyle = 'rgba(255,255,255,.1)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(408, 180); ctx.lineTo(408, 548); ctx.stroke();
    // middle: the two numbers
    ctx.textAlign = 'left'; ctx.fillStyle = '#9d8fc4'; ctx.font = `600 15px ${B}`; ctx.fillText((state.results.length > 1 ? `COMBINED · ${state.results.length} WALLETS` : 'MY JUMPER XP'), 452, 200);
    ctx.fillStyle = '#fff'; ctx.font = `800 112px ${D}`; ctx.fillText(fmtInt(c.xp), 446, 305);
    { ctx.font = `800 112px ${D}`; const xw = ctx.measureText(fmtInt(c.xp)).width; ctx.fillStyle = '#9d8fc4'; ctx.font = `700 22px ${D}`; ctx.fillText('XP', 446 + xw + 14, 300); }
    ctx.fillStyle = '#9d8fc4'; ctx.font = `600 14px ${B}`; ctx.fillText(sub, 452, 350);
    const vg = ctx.createLinearGradient(450, 0, 850, 0); vg.addColorStop(0, '#fff'); vg.addColorStop(1, t.c2); ctx.fillStyle = c.eligible ? vg : '#ffb3c6'; ctx.font = `800 ${c.eligible ? 82 : 52}px ${D}`; ctx.fillText(valTxt, 446, 440);
    ctx.fillStyle = '#7c6aa4'; ctx.font = `500 14px "JetBrains Mono", Menlo, monospace`; ctx.fillText(walletLine, 452, 486);
    // right: stat tiles
    const tx = 878, tw = 252;
    tile(tx, 176, tw, 96, 'Leaderboard rank', c.best ? '#' + fmtInt(c.best.position) : 'Unranked', '#fff', 34);
    tile(tx, 284, tw, 96, 'Percentile', c.best ? 'Top ' + fmtTop(c.best.position / SNAPSHOT.wallets * 100) : '—', t.c2, 34);
    tile(tx, 392, tw, 96, 'Jumper Pass', 'Level ' + lv.level, '#fff', 34);
    foot(585);
  } else {
    header(70, 64);
    ctx.textAlign = 'right'; ctx.fillStyle = '#7c6aa4'; ctx.font = `600 13px ${B}`; ctx.fillText(`SNAPSHOT ${SNAPSHOT.date.toUpperCase()}`, W - 70, 100); ctx.textAlign = 'left';
    accent(70, W - 70, 152);
    ctx.save(); ctx.globalAlpha = .05; ctx.translate(W - 40, 520); ctx.rotate(-.18); ctx.drawImage(markImg, -260, -200, 520, 520); ctx.restore();
    ctx.drawImage(em, W / 2 - 190, 178, 380, 380);
    ctx.fillStyle = '#9d8fc4'; ctx.font = `600 18px ${B}`; ctx.textAlign = 'center'; ctx.fillText(`TIER ${t.id} / 10 · ${topTxt.toUpperCase()}`, W / 2, 596);
    const tg = ctx.createLinearGradient(W / 2 - 150, 0, W / 2 + 150, 0); tg.addColorStop(0, '#fff'); tg.addColorStop(1, t.c2); ctx.fillStyle = tg; ctx.font = `800 62px ${D}`; ctx.fillText(t.name, W / 2, 662);
    ctx.strokeStyle = 'rgba(255,255,255,.1)'; ctx.beginPath(); ctx.moveTo(110, 712); ctx.lineTo(W - 110, 712); ctx.stroke();
    ctx.fillStyle = '#9d8fc4'; ctx.font = `600 18px ${B}`; ctx.fillText((state.results.length > 1 ? `COMBINED · ${state.results.length} WALLETS` : 'MY JUMPER XP'), W / 2, 768);
    ctx.fillStyle = '#fff'; ctx.font = `800 140px ${D}`; ctx.fillText(fmtInt(c.xp), W / 2, 898);
    ctx.fillStyle = '#9d8fc4'; ctx.font = `600 16px ${B}`; ctx.fillText(sub, W / 2, 946);
    const vg = ctx.createLinearGradient(W / 2 - 250, 0, W / 2 + 250, 0); vg.addColorStop(0, '#fff'); vg.addColorStop(1, t.c2); ctx.fillStyle = c.eligible ? vg : '#ffb3c6'; ctx.font = `800 ${c.eligible ? 100 : 60}px ${D}`; ctx.fillText(valTxt, W / 2, 1052);
    const tw3 = (W - 140 - 24) / 3;
    tile(70, 1096, tw3, 92, 'Rank', c.best ? '#' + fmtInt(c.best.position) : '—', '#fff', 30);
    tile(70 + tw3 + 12, 1096, tw3, 92, 'Percentile', c.best ? 'Top ' + fmtTop(c.best.position / SNAPSHOT.wallets * 100) : '—', t.c2, 30);
    tile(70 + (tw3 + 12) * 2, 1096, tw3, 92, 'Pass', 'Level ' + lv.level, '#fff', 30);
    ctx.fillStyle = '#7c6aa4'; ctx.font = `500 15px "JetBrains Mono", Menlo, monospace`; ctx.textAlign = 'center'; ctx.fillText(walletLine, W / 2, 1240);
    foot(1295);
  }
  return cv;
}
const toBlob = (cv) => new Promise((r) => cv.toBlob(r, 'image/png'));
$('dlCard').addEventListener('click', async () => { const b = await toBlob(await drawCard()); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'jumper-xp-card.png'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); });
$('copyCard').addEventListener('click', async () => { const b = $('copyCard'); try { const cv = await drawCard(); await navigator.clipboard.write([new ClipboardItem({ 'image/png': await toBlob(cv) })]); b.textContent = 'Copied!'; } catch { b.textContent = 'Copy not supported'; } setTimeout(() => (b.textContent = 'Copy image'), 1800); });
$('shareX').addEventListener('click', () => { const c = calc(); const text = `I'm a ${c.tier.name} on Jumper — ${fmtInt(c.xp)} XP${c.best ? `, rank #${fmtInt(c.best.position)}` : ''}. Worth ~${fmtMoney(c.value)} at ${fmtMoney(state.fdv)} FDV with a ${pctText(state.pct)} airdrop.\n\nWhat tier are you? 👇\n${location.origin}`; open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(text), '_blank', 'noopener'); });

/* ---------- fidget spinner: physics + 3D grab + synthesized sound ---------- */
(function spinner() {
  const el = $('spinner'), box = $('logo3d'), ring = $('spinRing'); if (!el) return;
  const cntEl = $('spinCount'), rpmEl = $('spinRpm'), keEl = $('keBar'), sndBtn = $('sndBtn'), sndTxt = $('sndTxt');
  // --- state (angles in deg, ω in deg/s)
  let ang = 0, w = 0, dragging = false, lastA = 0, lastT = 0, samples = [], spins = 0, acc = 0, tickAcc = 0, prevT = performance.now();
  let grabX = 0, grabY = 0; // -1..1 relative grab point for the 3D tilt
  const VISC = 0.22, BEAR = 28, MAX = 4300; // viscous drag /s, bearing drag deg/s², max ω
  const center = () => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, r: r.width / 2 }; };
  const angleOf = (e, c) => Math.atan2(e.clientY - c.y, e.clientX - c.x) * 180 / Math.PI;

  // --- sound (Web Audio, synthesized; nothing to download)
  const S = { on: false, ctx: null, whir: null, whirGain: null, whirFilter: null, master: null };
  S.on = true; try { S.on = localStorage.getItem('jxp_snd') !== '0'; } catch {}
  function ensureAudio() {
    if (S.ctx) { if (S.ctx.state === 'suspended') S.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; const ctx = S.ctx = new AC();
    S.master = ctx.createGain(); S.master.gain.value = 0; S.master.connect(ctx.destination);
    // looping pink-ish noise → bandpass → gain = bearing whir
    const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0); let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) { const wn = Math.random() * 2 - 1; b0 = .997 * b0 + .029 * wn; b1 = .985 * b1 + .032 * wn; b2 = .95 * b2 + .048 * wn; d[i] = (b0 + b1 + b2 + wn * .05) * .6; }
    S.whir = ctx.createBufferSource(); S.whir.buffer = buf; S.whir.loop = true;
    S.whirFilter = ctx.createBiquadFilter(); S.whirFilter.type = 'bandpass'; S.whirFilter.Q.value = 1.2; S.whirFilter.frequency.value = 300;
    S.whirGain = ctx.createGain(); S.whirGain.gain.value = 0;
    S.whir.connect(S.whirFilter); S.whirFilter.connect(S.whirGain); S.whirGain.connect(S.master); S.whir.start();
    // unlock on iOS
    const o = ctx.createOscillator(), g = ctx.createGain(); g.gain.value = 0; o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + .01);
  }
  function setSound(on) {
    S.on = on; sndBtn.setAttribute('aria-pressed', on); sndTxt.textContent = on ? 'Sound on' : 'Sound off';
    try { localStorage.setItem('jxp_snd', on ? '1' : '0'); } catch {}
    if (on) { ensureAudio(); if (S.master) S.master.gain.setTargetAtTime(.9, S.ctx.currentTime, .05); }
    else if (S.master) S.master.gain.setTargetAtTime(0, S.ctx.currentTime, .05);
  }
  sndBtn.addEventListener('click', () => setSound(!S.on));
  sndBtn.setAttribute('aria-pressed', S.on); sndTxt.textContent = S.on ? 'Sound on' : 'Sound off';
  const now = () => S.ctx.currentTime;
  function click(vol, pitch = 1) { // ratchet tick: tiny filtered noise burst + short sine ping
    if (!S.on || !S.ctx) return; const ctx = S.ctx, t = now();
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(1800 * pitch, t); o.frequency.exponentialRampToValueAtTime(600 * pitch, t + .03);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol * .35, t + .002); g.gain.exponentialRampToValueAtTime(.0001, t + .045);
    o.connect(g); g.connect(S.master); o.start(t); o.stop(t + .05);
    const n = ctx.createBufferSource(); n.buffer = S.whir.buffer; const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2500; const ng = ctx.createGain();
    ng.gain.setValueAtTime(vol * .5, t); ng.gain.exponentialRampToValueAtTime(.0001, t + .02); n.connect(f); f.connect(ng); ng.connect(S.master); n.start(t, Math.random()); n.stop(t + .03);
  }
  function whoosh(strength) { // flick: filtered noise with a sweep
    if (!S.on || !S.ctx) return; const ctx = S.ctx, t = now(), n = ctx.createBufferSource(); n.buffer = S.whir.buffer; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = .8;
    f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(2200 + 2000 * strength, t + .12); f.frequency.exponentialRampToValueAtTime(500, t + .5);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.5 * strength, t + .06); g.gain.exponentialRampToValueAtTime(.0001, t + .55);
    n.connect(f); f.connect(g); g.connect(S.master); n.start(t, Math.random()); n.stop(t + .6);
  }
  function thud() { // grab: low soft knock
    if (!S.on || !S.ctx) return; const ctx = S.ctx, t = now(), o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(60, t + .12);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.35, t + .006); g.gain.exponentialRampToValueAtTime(.0001, t + .16); o.connect(g); g.connect(S.master); o.start(t); o.stop(t + .18);
  }

  // --- input
  box.addEventListener('pointerdown', (e) => {
    dragging = true; box.setPointerCapture(e.pointerId); el.classList.add('grabbing'); box.classList.add('grab');
    const c = center(); lastA = angleOf(e, c); lastT = performance.now(); samples = []; grabX = (e.clientX - c.x) / c.r; grabY = (e.clientY - c.y) / c.r;
    if (S.on) { ensureAudio(); if (S.master) S.master.gain.setTargetAtTime(.9, S.ctx.currentTime, .05); thud(); } if (navigator.vibrate) navigator.vibrate(8);
  });
  box.addEventListener('pointermove', (e) => {
    if (!dragging) return; const c = center(), a = angleOf(e, c), t = performance.now(); let d = a - lastA; if (d > 180) d -= 360; if (d < -180) d += 360;
    ang += d; samples.push({ d, t }); while (samples.length && t - samples[0].t > 90) samples.shift(); lastA = a; lastT = t;
    grabX = (e.clientX - c.x) / c.r; grabY = (e.clientY - c.y) / c.r;
    // while held, ω follows the finger (for sound + ring), estimated over the last ~90ms
    const sum = samples.reduce((s, x) => s + x.d, 0), span = Math.max(16, t - samples[0].t); w = sum / span * 1000;
  });
  const release = (e) => {
    if (!dragging) return; dragging = false; el.classList.remove('grabbing'); box.classList.remove('grab');
    const t = performance.now(); const recent = samples.filter((x) => t - x.t <= 90); const sum = recent.reduce((s, x) => s + x.d, 0);
    const span = recent.length ? Math.max(16, t - recent[0].t) : 16; let v = sum / span * 1000; // deg/s
    if (t - lastT > 120) v = 0; // held still → no flick
    if (Math.abs(v) < 60 && recent.length < 2) v = (v < 0 || (e && e.clientX < center().x) ? -1 : 1) * 420; // a tap gives a nudge
    w = Math.max(-MAX, Math.min(MAX, v)); const strength = Math.min(1, Math.abs(w) / 2500);
    whoosh(strength); if (navigator.vibrate && strength > .25) navigator.vibrate(Math.round(10 + 25 * strength));
    grabX = grabY = 0;
  };
  box.addEventListener('pointerup', release); box.addEventListener('pointercancel', release);
  box.addEventListener('click', (e) => e.preventDefault()); box.addEventListener('dragstart', (e) => e.preventDefault());

  // --- loop
  (function tick(t) {
    const dt = Math.min(.05, (t - prevT) / 1000); prevT = t;
    if (!dragging && w !== 0) {
      const sign = Math.sign(w); const mag = Math.abs(w);
      let next = mag - (VISC * mag + BEAR) * dt; if (next < 0) next = 0; w = sign * next; ang += w * dt;
      // low-speed wobble: a real spinner rocks slightly before it stops
    }
    const speed = Math.abs(w), rpm = speed / 6, e = Math.min(1, (speed / MAX) ** 2);
    // counters
    const dAng = dragging ? (samples.length ? samples[samples.length - 1].d : 0) : w * dt; acc += Math.abs(dAng); tickAcc += Math.abs(dAng);
    if (acc >= 360) { spins += Math.floor(acc / 360); acc %= 360; cntEl.textContent = spins; if (navigator.vibrate && speed > 400) navigator.vibrate(4); }
    // ratchet ticks: one per 45°, louder + higher with speed; at very high speed they merge into a buzz
    const tickStep = speed > 2600 ? 90 : 45; if (tickAcc >= tickStep) { tickAcc %= tickStep; if (speed > 30) click(Math.min(1, .15 + speed / 1500), .8 + Math.min(1.2, speed / 2000)); }
    // whir follows speed
    if (S.ctx && S.whirGain) { const tt = S.ctx.currentTime; S.whirGain.gain.setTargetAtTime(Math.min(.55, speed / 2200), tt, .04); S.whirFilter.frequency.setTargetAtTime(220 + speed * .55, tt, .05); }
    // HUD
    rpmEl.textContent = Math.round(rpm); keEl.style.width = (Math.min(1, speed / MAX) * 100) + '%';
    // visuals: spin angle on the img (parallax loop composes it), ring + 3D press on the wrapper
    el.dataset.spin = ang.toFixed(2);
    ring.style.transform = `rotate(${ang}deg)`; ring.style.opacity = Math.min(.9, speed / 1200);
    el.style.filter = speed > 900 ? `blur(${Math.min(1.6, (speed - 900) / 1800)}px) saturate(${1 + e * .4})` : '';
    el.style.boxShadow = dragging ? `0 ${34 + 10 * grabY}px 70px rgba(0,0,0,.65), 0 0 ${90 + 60 * e}px rgba(225,95,245,${.25 + .3 * e})` : `0 ${40 + 30 * e}px ${110 + 40 * e}px rgba(0,0,0,.55), 0 0 ${110 + 80 * e}px rgba(225,95,245,${.16 + .3 * e})`;
    box.style.transform = dragging ? `translateZ(24px) scale(1.04) rotateX(${-grabY * 14}deg) rotateY(${grabX * 14}deg)` : `translateZ(0) rotateX(${(Math.sin(ang * Math.PI / 180) * 2.2 * (1 - e)).toFixed(2)}deg) rotateY(${(Math.cos(ang * Math.PI / 180) * 2.2 * (1 - e)).toFixed(2)}deg)`;
    requestAnimationFrame(tick);
  })(prevT);
})();

})();
