/* Jumper XP — app script (unofficial community calculator). */
(() => {
'use strict';

/* ---------- leaderboard snapshot (refresh with scripts/estimate-total.mjs) ---------- */
const SNAPSHOT = { totalXp: 246668625, wallets: 2774656, date: '11 Sep 2026' };

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
      el.style.transform = `${base}translate3d(0, ${-rel * vh * py}px, 0) ${rot ? `rotate(${rel * rot * 180}deg)` : ''} ${mouse}`;
    }
    if (heroCopy) { const k = Math.min(1, sy / (vh * .7)); heroCopy.style.opacity = 1 - k * .9; }
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
const state = { fdv: 1e8, pct: 10, results: null };
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
const addr = $('addr');
const parseAddrs = () => [...new Set(addr.value.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean))];
addr.addEventListener('input', () => { const n = parseAddrs().length; $('addrCount').textContent = n + (n === 1 ? ' wallet' : ' wallets'); });
addr.addEventListener('keydown', (e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') lookup(false); });
$('demo').addEventListener('click', () => { addr.value = '0x1234567890abcdef1234567890abcdef12345678'; addr.dispatchEvent(new Event('input')); lookup(true); });
$('go').addEventListener('click', () => lookup(false));
function notice(id, msg) { const el = $(id); el.textContent = msg || ''; el.style.display = msg ? 'block' : 'none'; }

async function lookup(demo) {
  const addrs = parseAddrs(); notice('err', ''); notice('warn', '');
  if (!addrs.length) return notice('err', 'Paste at least one wallet address.');
  if (addrs.length > 10) return notice('err', 'Up to 10 wallets at a time.');
  const bad = addrs.filter((a) => !(EVM_RE.test(a) || SOL_RE.test(a)));
  if (bad.length) return notice('err', 'That doesn’t look like an EVM or Solana address: ' + short(bad[0]));
  const go = $('go'); go.disabled = true; $('goTxt').innerHTML = '<span class="spinner"></span> Asking Jumper';
  try {
    let results;
    if (demo) { await new Promise((r) => setTimeout(r, 500)); results = [{ address: addrs[0], chain: 'evm', found: true, points: 1337, position: 14210, demo: true }]; }
    else {
      const r = await fetch('/api/xp?address=' + encodeURIComponent(addrs.join(',')));
      const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Lookup failed');
      results = j.results;
      const limited = results.filter((x) => x.error === 'rate_limited'), other = results.filter((x) => x.error && x.error !== 'rate_limited');
      if (limited.length === results.length) throw new Error('Jumper’s API is rate-limiting requests right now. Wait a minute and try again.');
      if (limited.length) notice('warn', `Jumper rate-limited ${limited.length} of ${results.length} lookups — those show as 0. Try again in a minute.`);
      if (other.length) notice('warn', `Jumper’s API returned an error for ${other.length} wallet(s) (${other[0].error}).`);
    }
    state.results = results; render(true);
    if (!desktop()) $('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) { notice('err', e.message === 'Failed to fetch' ? 'Could not reach the API. Deploy on Vercel so /api/xp exists.' : e.message); }
  finally { go.disabled = false; $('goTxt').textContent = 'Check my XP'; }
}

/* ---------- render ---------- */
function calc() {
  const rs = state.results || [], xp = rs.reduce((a, r) => a + (r.points || 0), 0), share = xp / SNAPSHOT.totalXp;
  const best = rs.filter((r) => r.position).sort((a, b) => a.position - b.position)[0];
  return { xp, share, value: share * (state.pct / 100) * state.fdv, perPct: share * .01 * state.fdv, best };
}
let lastXp = -1;
function render(animate) {
  if (!state.results) return;
  const c = calc(), multi = state.results.length > 1;
  $('resultEmpty').style.display = 'none'; $('resultBody').style.display = 'block';
  $('resTag').textContent = (multi ? 'Combined Jumper XP' : 'Your Jumper XP') + (state.results[0].demo ? ' · example' : '');
  if (animate && c.xp !== lastXp) { countUp($('resXp'), c.xp, fmtInt); countUp($('resVal'), c.value, fmtMoney); countUp($('eqVal'), c.value, fmtMoney); lastXp = c.xp; }
  else { $('resXp').textContent = fmtInt(c.xp); $('resVal').textContent = fmtMoney(c.value); $('eqVal').textContent = fmtMoney(c.value); }
  $('eqXp').textContent = fmtInt(c.xp);
  $('valFdv').textContent = fmtMoney(state.fdv); $('valPct').textContent = pctText(state.pct);
  $('resShare').textContent = (c.share * 100).toFixed(5) + '% of all XP · ' + fmtMoney(c.value / Math.max(1, c.xp)) + ' per XP';
  $('resPerPct').textContent = fmtMoney(c.perPct); $('resWallets').textContent = state.results.length;
  if (c.best) { const top = c.best.position / SNAPSHOT.wallets * 100; $('resRank').textContent = (multi ? 'best rank #' : 'rank #') + fmtInt(c.best.position); $('resTop').textContent = 'top ' + (top < .01 ? '0.01' : top < 1 ? top.toFixed(2) : top.toFixed(1)) + '%'; }
  else { $('resRank').textContent = c.xp ? 'unranked' : 'no XP on this wallet'; $('resTop').textContent = '—'; }
  $('walletTable').innerHTML = multi ? '<table><tr><th>Wallet</th><th>Chain</th><th style="text-align:right">Rank</th><th style="text-align:right">XP</th></tr>' + state.results.map((r) => `<tr><td>${short(r.address)}</td><td class="d">${r.chain === 'solana' ? 'Solana' : 'EVM'}</td><td class="r d">${r.position ? '#' + fmtInt(r.position) : r.error ? 'error' : '—'}</td><td class="r">${fmtInt(r.points || 0)}</td></tr>`).join('') + '</table>' : '';
}

/* ---------- 3D tilt ---------- */
const card = $('result');
if (desktop() && !reduced) {
  card.addEventListener('mousemove', (e) => { const r = card.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height; card.style.transform = `rotateX(${(.5 - y) * 12}deg) rotateY(${(x - .5) * 14}deg)`; card.style.setProperty('--gx', x * 100 + '%'); card.style.setProperty('--gy', y * 100 + '%'); card.style.boxShadow = `${(.5 - x) * 40}px ${(.5 - y) * 40}px 90px rgba(0,0,0,.5), 0 0 80px rgba(225,95,245,.14)`; });
  card.addEventListener('mouseleave', () => { card.style.transition = 'transform .7s cubic-bezier(.16,1,.3,1), box-shadow .7s'; card.style.transform = ''; card.style.boxShadow = ''; setTimeout(() => (card.style.transition = ''), 700); });
}

/* ---------- share card ---------- */
const logo = new Image(); logo.src = '/logo.jpg';
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function drawCard() {
  const c = calc(), cv = $('shareCanvas'), ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
  const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#1a0c33'); g.addColorStop(1, '#0b0518'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const o1 = ctx.createRadialGradient(1020, 80, 0, 1020, 80, 520); o1.addColorStop(0, 'rgba(225,95,245,.45)'); o1.addColorStop(1, 'rgba(225,95,245,0)'); ctx.fillStyle = o1; ctx.fillRect(0, 0, W, H);
  const o2 = ctx.createRadialGradient(120, 620, 0, 120, 620, 480); o2.addColorStop(0, 'rgba(124,58,237,.45)'); o2.addColorStop(1, 'rgba(124,58,237,0)'); ctx.fillStyle = o2; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(196,169,245,.25)'; ctx.lineWidth = 2; rr(ctx, 40, 40, W - 80, H - 80, 30); ctx.stroke();
  if (logo.complete && logo.naturalWidth) { ctx.save(); rr(ctx, 80, 80, 76, 76, 20); ctx.clip(); ctx.drawImage(logo, 80, 80, 76, 76); ctx.restore(); }
  ctx.fillStyle = '#f6f1ff'; ctx.font = '700 30px "Inter Tight", Inter, sans-serif'; ctx.fillText('Jumper XP', 176, 112);
  ctx.fillStyle = '#b6a7d8'; ctx.font = '500 19px Inter, sans-serif'; ctx.fillText('unofficial calculator', 176, 142);
  ctx.fillStyle = '#b6a7d8'; ctx.font = '600 21px Inter, sans-serif'; ctx.fillText((state.results.length > 1 ? `COMBINED XP · ${state.results.length} WALLETS` : 'MY JUMPER XP'), 80, 232);
  ctx.fillStyle = '#fff'; ctx.font = '800 122px "Inter Tight", Inter, sans-serif'; ctx.fillText(fmtInt(c.xp), 74, 342);
  ctx.fillStyle = '#b6a7d8'; ctx.font = '600 21px Inter, sans-serif'; ctx.fillText(`WORTH AT ${fmtMoney(state.fdv)} FDV · ${pctText(state.pct)} AIRDROP`, 80, 412);
  const tg = ctx.createLinearGradient(80, 0, 700, 0); tg.addColorStop(0, '#fff'); tg.addColorStop(1, '#ff8ff9'); ctx.fillStyle = tg; ctx.font = '800 82px "Inter Tight", Inter, sans-serif'; ctx.fillText(fmtMoney(c.value), 74, 498);
  if (c.best) { ctx.fillStyle = 'rgba(196,169,245,.15)'; rr(ctx, 80, 530, 330, 46, 23); ctx.fill(); ctx.fillStyle = '#c4a9f5'; ctx.font = '600 21px Inter, sans-serif'; ctx.fillText($('resRank').textContent + ' · ' + $('resTop').textContent, 100, 561); }
  ctx.fillStyle = '#7c6aa4'; ctx.font = '500 18px Inter, sans-serif'; ctx.textAlign = 'right'; ctx.fillText('not affiliated · not financial advice', W - 80, 545); ctx.fillText(location.host || 'jumper-xp', W - 80, 570); ctx.textAlign = 'left';
  return cv;
}
const toBlob = (cv) => new Promise((r) => cv.toBlob(r, 'image/png'));
$('dlCard').addEventListener('click', async () => { const b = await toBlob(drawCard()); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'jumper-xp-card.png'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); });
$('copyCard').addEventListener('click', async () => { const b = $('copyCard'); try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': await toBlob(drawCard()) })]); b.textContent = 'Copied!'; } catch { b.textContent = 'Copy not supported'; } setTimeout(() => (b.textContent = 'Copy image'), 1800); });
$('shareX').addEventListener('click', () => { const c = calc(); const text = `I have ${fmtInt(c.xp)} Jumper XP${c.best ? ` (rank #${fmtInt(c.best.position)})` : ''} — worth ~${fmtMoney(c.value)} at ${fmtMoney(state.fdv)} FDV with a ${pctText(state.pct)} airdrop.\n\nCheck yours 👇\n${location.origin}`; open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(text), '_blank', 'noopener'); });

})();
