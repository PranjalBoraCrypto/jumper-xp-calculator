/* Tier system + emblem generator (shared by page and share-card renderer). */
window.JXP = (() => {
  // percentile = rank / wallets. Ordered from lowest to highest tier.
  const TIERS = [
    { id: 1,  name: 'Tourist',    pct: 1,      c1: '#6b7280', c2: '#9ca3af', glow: 'rgba(156,163,175,.35)', line: 'Just passing through. Every whale started here.' },
    { id: 2,  name: 'Hopper',     pct: .5,     c1: '#8b5cf6', c2: '#a78bfa', glow: 'rgba(167,139,250,.4)',  line: 'Top half. You’ve made a few jumps.' },
    { id: 3,  name: 'Bridger',    pct: .25,    c1: '#7c3aed', c2: '#c4b5fd', glow: 'rgba(196,181,253,.4)',  line: 'Top quarter. Chains fear your gas budget.' },
    { id: 4,  name: 'Router',     pct: .10,    c1: '#0ea5e9', c2: '#67e8f9', glow: 'rgba(103,232,249,.4)',  line: 'Top 10%. You know the cheap paths.' },
    { id: 5,  name: 'Voyager',    pct: .05,    c1: '#10b981', c2: '#6ee7b7', glow: 'rgba(110,231,183,.4)',  line: 'Top 5%. Multi-chain is your home chain.' },
    { id: 6,  name: 'Pathfinder', pct: .02,    c1: '#f59e0b', c2: '#fde68a', glow: 'rgba(253,230,138,.45)', line: 'Top 2%. Others follow your routes.' },
    { id: 7,  name: 'Vanguard',   pct: .01,    c1: '#ef4444', c2: '#fca5a5', glow: 'rgba(252,165,165,.45)', line: 'Top 1%. First through every new bridge.' },
    { id: 8,  name: 'Titan',      pct: .005,   c1: '#e15ff5', c2: '#ff8ff9', glow: 'rgba(255,143,249,.5)',  line: 'Top 0.5%. Liquidity moves when you do.' },
    { id: 9,  name: 'Legend',     pct: .001,   c1: '#facc15', c2: '#fff7ae', glow: 'rgba(255,247,174,.55)', line: 'Top 0.1%. They’ll tell stories about your wallet.' },
    { id: 10, name: 'Apex',       pct: .0001,  c1: '#22d3ee', c2: '#ffffff', glow: 'rgba(255,255,255,.6)',  line: 'Top 0.01%. There is nothing above you.' },
  ];

  function tierFor(position, wallets) {
    if (!position) return TIERS[0];
    const p = position / wallets; let t = TIERS[0];
    for (const x of TIERS) if (p <= x.pct) t = x;
    return t;
  }

  // Emblem: gem badge with 10-segment progress ring, chevron core, and flourishes that grow with tier.
  function emblemSVG(tier, size = 160) {
    const t = typeof tier === 'number' ? TIERS[tier - 1] : tier, id = 'g' + t.id + Math.random().toString(36).slice(2, 6);
    const segs = [];
    for (let i = 0; i < 10; i++) {
      const a0 = -90 + i * 36 + 3, a1 = -90 + (i + 1) * 36 - 3, r = 74;
      const p = (a) => [80 + r * Math.cos(a * Math.PI / 180), 80 + r * Math.sin(a * Math.PI / 180)];
      const [x0, y0] = p(a0), [x1, y1] = p(a1);
      segs.push(`<path d="M${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}" stroke="${i < t.id ? `url(#${id}r)` : 'rgba(255,255,255,.12)'}" stroke-width="4" stroke-linecap="round" fill="none"/>`);
    }
    const rays = t.id >= 7 ? Array.from({ length: t.id >= 9 ? 12 : 8 }, (_, i) => { const a = i * (360 / (t.id >= 9 ? 12 : 8)) * Math.PI / 180; return `<line x1="${(80 + 58 * Math.cos(a)).toFixed(1)}" y1="${(80 + 58 * Math.sin(a)).toFixed(1)}" x2="${(80 + 66 * Math.cos(a)).toFixed(1)}" y2="${(80 + 66 * Math.sin(a)).toFixed(1)}" stroke="${t.c2}" stroke-width="2" stroke-linecap="round" opacity=".8"/>`; }).join('') : '';
    const sparks = t.id >= 9 ? `<g fill="#fff"><circle cx="30" cy="34" r="2.2"/><circle cx="132" cy="28" r="1.6"/><circle cx="140" cy="118" r="2"/><circle cx="24" cy="120" r="1.4"/></g>` : '';
    const facets = t.id >= 4 ? `<path d="M80 34 L110 52 L80 62 Z" fill="rgba(255,255,255,.18)"/><path d="M80 34 L50 52 L80 62 Z" fill="rgba(255,255,255,.08)"/>` : '';
    const shape = t.id <= 3 ? `<circle cx="80" cy="80" r="50"/>` : t.id <= 6 ? `<path d="M80 30 L123 55 L123 105 L80 130 L37 105 L37 55 Z"/>` : `<path d="M80 26 L118 46 L134 80 L118 114 L80 134 L42 114 L26 80 L42 46 Z"/>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="${size}" height="${size}">
<defs>
  <linearGradient id="${id}a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${t.c2}"/><stop offset=".55" stop-color="${t.c1}"/><stop offset="1" stop-color="#1a0c33"/></linearGradient>
  <linearGradient id="${id}r" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${t.c2}"/><stop offset="1" stop-color="${t.c1}"/></linearGradient>
  <radialGradient id="${id}g" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${t.glow}"/><stop offset="1" stop-color="rgba(0,0,0,0)"/></radialGradient>
  <filter id="${id}s" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3"/></filter>
</defs>
<circle cx="80" cy="80" r="78" fill="url(#${id}g)"/>
<g>${segs.join('')}</g>
${rays}
<g fill="url(#${id}a)" stroke="rgba(255,255,255,.35)" stroke-width="1.5">${shape}</g>
${facets}
<g transform="translate(80 80) scale(0.2414) translate(-200.0 -200.0)" fill="#fff">
  <path d="M166.25 84.00 L154.50 84.00 L153.25 85.00 L150.50 85.00 L149.75 85.75 L148.50 86.00 L147.25 87.00 L145.50 87.00 L144.75 87.75 L143.00 88.25 L141.75 89.75 L140.00 90.25 L137.75 92.75 L136.00 93.25 L133.75 95.75 L132.50 96.00 L132.00 96.50 L131.75 97.75 L129.75 99.75 L128.00 100.25 L127.25 101.00 L127.00 102.25 L126.25 103.00 L125.00 103.25 L124.25 104.00 L124.00 105.25 L123.25 106.00 L122.50 106.00 L122.00 106.50 L121.75 107.75 L120.25 109.00 L120.25 109.75 L136.00 125.50 L137.25 125.75 L138.00 126.50 L138.25 127.75 L159.50 148.75 L160.75 148.50 L199.75 109.25 L199.50 108.00 L184.75 93.25 L183.00 92.75 L181.75 91.25 L180.00 90.75 L178.75 89.25 L177.00 88.75 L175.75 87.25 L173.50 87.00 L172.25 86.00 L170.50 86.00 L169.25 85.00 L167.50 85.00Z" opacity=".95"/>
  <path d="M222.25 130.00 L221.00 130.25 L181.00 170.50 L181.25 171.75 L202.75 193.00 L203.00 194.25 L204.00 195.50 L204.00 197.25 L205.00 198.50 L205.00 204.25 L204.00 205.50 L203.75 208.75 L202.25 210.00 L201.75 211.75 L119.25 294.00 L119.25 294.75 L120.75 296.00 L121.25 297.75 L126.00 302.50 L127.25 302.75 L128.00 303.50 L128.00 304.25 L129.00 305.50 L130.75 306.00 L133.00 308.50 L134.75 309.00 L136.00 310.50 L137.25 310.75 L138.00 311.50 L139.25 311.75 L140.50 312.75 L142.25 312.75 L143.50 313.75 L145.25 313.75 L146.50 314.75 L148.25 314.75 L149.50 315.75 L153.25 315.75 L154.50 316.75 L168.25 316.75 L169.50 315.75 L173.25 315.75 L174.50 314.75 L176.25 314.75 L177.00 314.00 L178.25 313.75 L179.00 313.00 L180.25 312.75 L181.00 312.00 L182.25 311.75 L183.00 311.00 L184.75 310.50 L186.00 309.00 L187.75 308.50 L275.50 220.75 L276.00 219.00 L277.50 217.75 L277.75 216.50 L278.50 215.75 L278.75 214.50 L279.75 213.25 L279.75 211.50 L280.75 210.25 L280.75 205.50 L281.75 204.25 L281.75 198.50 L280.75 197.25 L280.75 193.50 L279.75 192.25 L279.75 190.50 L279.00 189.75 L278.75 188.50 L278.00 187.75 L277.75 186.50 L277.00 185.75 L276.50 184.00 L263.00 170.75 L262.75 169.50 L262.25 169.00 L261.00 168.75 L247.00 154.75 L246.75 153.50 L246.25 153.00 L245.00 152.75 L239.00 146.75 L238.75 145.50 L238.25 145.00 L237.00 144.75 L231.00 138.75 L230.75 137.50 L230.25 137.00 L229.00 136.75Z" opacity=".9"/>
</g>
${sparks}
</svg>`;
  }

  const LOGO = { viewBox: '0 0 400 400', pink: 'M166.25 84.00 L154.50 84.00 L153.25 85.00 L150.50 85.00 L149.75 85.75 L148.50 86.00 L147.25 87.00 L145.50 87.00 L144.75 87.75 L143.00 88.25 L141.75 89.75 L140.00 90.25 L137.75 92.75 L136.00 93.25 L133.75 95.75 L132.50 96.00 L132.00 96.50 L131.75 97.75 L129.75 99.75 L128.00 100.25 L127.25 101.00 L127.00 102.25 L126.25 103.00 L125.00 103.25 L124.25 104.00 L124.00 105.25 L123.25 106.00 L122.50 106.00 L122.00 106.50 L121.75 107.75 L120.25 109.00 L120.25 109.75 L136.00 125.50 L137.25 125.75 L138.00 126.50 L138.25 127.75 L159.50 148.75 L160.75 148.50 L199.75 109.25 L199.50 108.00 L184.75 93.25 L183.00 92.75 L181.75 91.25 L180.00 90.75 L178.75 89.25 L177.00 88.75 L175.75 87.25 L173.50 87.00 L172.25 86.00 L170.50 86.00 L169.25 85.00 L167.50 85.00Z', lav: 'M222.25 130.00 L221.00 130.25 L181.00 170.50 L181.25 171.75 L202.75 193.00 L203.00 194.25 L204.00 195.50 L204.00 197.25 L205.00 198.50 L205.00 204.25 L204.00 205.50 L203.75 208.75 L202.25 210.00 L201.75 211.75 L119.25 294.00 L119.25 294.75 L120.75 296.00 L121.25 297.75 L126.00 302.50 L127.25 302.75 L128.00 303.50 L128.00 304.25 L129.00 305.50 L130.75 306.00 L133.00 308.50 L134.75 309.00 L136.00 310.50 L137.25 310.75 L138.00 311.50 L139.25 311.75 L140.50 312.75 L142.25 312.75 L143.50 313.75 L145.25 313.75 L146.50 314.75 L148.25 314.75 L149.50 315.75 L153.25 315.75 L154.50 316.75 L168.25 316.75 L169.50 315.75 L173.25 315.75 L174.50 314.75 L176.25 314.75 L177.00 314.00 L178.25 313.75 L179.00 313.00 L180.25 312.75 L181.00 312.00 L182.25 311.75 L183.00 311.00 L184.75 310.50 L186.00 309.00 L187.75 308.50 L275.50 220.75 L276.00 219.00 L277.50 217.75 L277.75 216.50 L278.50 215.75 L278.75 214.50 L279.75 213.25 L279.75 211.50 L280.75 210.25 L280.75 205.50 L281.75 204.25 L281.75 198.50 L280.75 197.25 L280.75 193.50 L279.75 192.25 L279.75 190.50 L279.00 189.75 L278.75 188.50 L278.00 187.75 L277.75 186.50 L277.00 185.75 L276.50 184.00 L263.00 170.75 L262.75 169.50 L262.25 169.00 L261.00 168.75 L247.00 154.75 L246.75 153.50 L246.25 153.00 L245.00 152.75 L239.00 146.75 L238.75 145.50 L238.25 145.00 L237.00 144.75 L231.00 138.75 L230.75 137.50 L230.25 137.00 L229.00 136.75Z' };
  return { TIERS, tierFor, emblemSVG, LOGO };
})();
