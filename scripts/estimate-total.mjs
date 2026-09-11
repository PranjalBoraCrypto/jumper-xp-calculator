// Re-estimates total XP on the Jumper leaderboard by sampling pages.
// Run: node scripts/estimate-total.mjs   (takes ~3-5 min; the API rate-limits)
// Then paste the printed numbers into SNAPSHOT at the top of app.js.

const API = 'https://api.jumper.xyz/v1/leaderboard';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function page(p) {
  for (let a = 0; a < 6; a++) {
    try {
      const r = await fetch(`${API}?page=${p}&limit=100`);
      if (r.status !== 200) { await sleep(1500); continue; }
      const j = await r.json();
      return { n: j.data.length, sum: j.data.reduce((s, d) => s + Number(d.points), 0), meta: j.meta };
    } catch { await sleep(1000); }
  }
  throw new Error('page ' + p + ' failed');
}

const first = await page(1);
const pages = first.meta.pagesLength, wallets = first.meta.total;
const targets = new Set([1]);
for (let p = 2; p <= 50; p++) targets.add(p);            // dense at the top, where the curve is steep
for (let p = 51; p <= pages; p += 50) targets.add(p);
targets.add(pages);
const sorted = [...targets].sort((a, b) => a - b);
const res = { 1: first };
let i = 0;
async function worker() { while (i < sorted.length) { const p = sorted[i++]; if (!res[p]) { res[p] = await page(p); process.stdout.write(`\r${Object.keys(res).length}/${sorted.length} pages`); } } }
await Promise.all([worker(), worker(), worker()]);

const avg = (p) => res[p].sum / res[p].n;
let total = 0;
for (let k = 0; k < sorted.length - 1; k++) {
  const a = sorted[k], b = sorted[k + 1];
  total += res[a].sum + (b - a - 1) * 100 * (avg(a) + avg(b)) / 2;
}
total += res[sorted.at(-1)].sum;
console.log(`\n\ntotalXp: ${Math.round(total)}\nwallets: ${wallets}\ndate: ${new Date().toUTCString()}`);
