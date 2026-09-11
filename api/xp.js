// Vercel serverless function: GET /api/xp?address=0x...[,0x...]
// Proxies Jumper's public leaderboard API (no CORS headers upstream).

const HOSTS = ['https://api.jumper.xyz', 'https://api.jumper.exchange'];
const MAX_ADDRESSES = 10;
const EVM_RE = /^0x[a-fA-F0-9]{40}$/;
const SOL_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const isValid = (a) => EVM_RE.test(a) || SOL_RE.test(a);
const chainOf = (a) => (EVM_RE.test(a) ? 'evm' : 'solana');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const HEADERS = {
  accept: 'application/json, text/plain, */*',
  'accept-language': 'en-US,en;q=0.9',
  origin: 'https://jumper.xyz',
  referer: 'https://jumper.xyz/leaderboard',
  'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
};

async function fetchOne(address) {
  let last = null;
  for (const host of HOSTS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await fetch(`${host}/v1/leaderboard/${address}`, { headers: HEADERS });
      if (res.status === 404) return { status: 404 };
      if (res.ok) return { status: 200, json: await res.json() };
      last = { status: res.status, text: await res.text().catch(() => '') };
      if (res.status !== 429 && res.status < 500) break; // hard error: try next host
      await sleep(700);
    }
  }
  return last;
}

async function lookup(address) {
  const chain = chainOf(address);
  const r = await fetchOne(address);
  if (r.status === 404) return { address, chain, found: false, points: 0, position: null };
  if (r.status !== 200) {
    const limited = r.status === 429 || /rate limit/i.test(r.text || '');
    return { address, chain, found: false, error: limited ? 'rate_limited' : `upstream_${r.status}`, detail: (r.text || '').slice(0, 200) };
  }
  const d = r.json && r.json.data ? r.json.data : r.json;
  const points = Number(d.points ?? d.xp ?? 0);
  const position = d.position != null ? Number(d.position) : d.rank != null ? Number(d.rank) : null;
  return { address, chain, found: true, points, position };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  const raw = String(req.query.address || req.query.addresses || '');
  const addresses = [...new Set(raw.split(/[\s,;]+/).map((a) => a.trim()).filter(Boolean))];
  if (!addresses.length) return res.status(400).json({ error: 'Pass ?address=0x... (comma-separated for several)' });
  if (addresses.length > MAX_ADDRESSES) return res.status(400).json({ error: `Max ${MAX_ADDRESSES} addresses per request` });
  const bad = addresses.filter((a) => !isValid(a));
  if (bad.length) return res.status(400).json({ error: 'Invalid wallet address (expected EVM 0x… or Solana base58)', invalid: bad });

  try {
    const results = [];
    for (const a of addresses) results.push(await lookup(a)); // sequential: gentler on the upstream rate limit
    const anyError = results.some((r) => r.error);
    res.setHeader('Cache-Control', anyError ? 'no-store' : 's-maxage=300, stale-while-revalidate=600');
    res.status(200).json({ results });
  } catch (err) {
    res.status(502).json({ error: 'Upstream request failed', detail: String((err && err.message) || err) });
  }
}
