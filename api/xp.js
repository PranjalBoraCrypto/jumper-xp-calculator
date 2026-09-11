// Vercel serverless function: GET /api/xp?address=0x...[,0x...]
// Proxies Jumper's public leaderboard API (which has no CORS headers)
// so the browser can query it from this domain.

const UPSTREAM = 'https://api.jumper.xyz/v1/leaderboard/';
const MAX_ADDRESSES = 10;
const EVM_RE = /^0x[a-fA-F0-9]{40}$/;
const SOL_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/; // base58, 32-byte pubkey
const isValid = (a) => EVM_RE.test(a) || SOL_RE.test(a);
const chainOf = (a) => (EVM_RE.test(a) ? 'evm' : 'solana');

async function lookup(address) {
  const res = await fetch(UPSTREAM + address, {
    headers: { accept: 'application/json', 'user-agent': 'jumper-xp-calculator (unofficial)' },
  });

  const chain = chainOf(address);
  if (res.status === 404) {
    return { address, chain, found: false, points: 0, position: null };
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return { address, chain, found: false, error: `upstream ${res.status}`, detail: text.slice(0, 200) };
  }

  const json = await res.json();
  const d = json && json.data ? json.data : json;
  const points = Number(d.points ?? d.xp ?? 0);
  const position = d.position != null ? Number(d.position) : d.rank != null ? Number(d.rank) : null;
  return { address, chain, found: true, points, position };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'GET only' });
    return;
  }

  const raw = String(req.query.address || req.query.addresses || '');
  const addresses = [...new Set(
    raw.split(/[\s,;]+/).map((a) => a.trim()).filter(Boolean)
  )];

  if (addresses.length === 0) {
    res.status(400).json({ error: 'Pass ?address=0x... (comma-separated for several)' });
    return;
  }
  if (addresses.length > MAX_ADDRESSES) {
    res.status(400).json({ error: `Max ${MAX_ADDRESSES} addresses per request` });
    return;
  }
  const bad = addresses.filter((a) => !isValid(a));
  if (bad.length) {
    res.status(400).json({ error: 'Invalid wallet address (expected EVM 0x… or Solana base58)', invalid: bad });
    return;
  }

  try {
    const results = await Promise.all(addresses.map(lookup));
    res.status(200).json({ results });
  } catch (err) {
    res.status(502).json({ error: 'Upstream request failed', detail: String(err && err.message || err) });
  }
}
