# Jumper XP Calculator (unofficial)

Paste an EVM or Solana wallet → see Jumper XP, rank, and a what-if value at any FDV.
Static site + one serverless function. Free on Vercel's Hobby plan.

## Deploy (2 minutes)

1. Push this folder to a GitHub repo.
2. Go to [vercel.com/new](https://vercel.com/new), import the repo, keep every setting default, click **Deploy**.
3. Done. Vercel serves `index.html`, `app.js`, `logo.jpg`, and turns `api/xp.js` into `/api/xp`.

Or from a terminal: `npx vercel` in this folder and follow the prompts.

## Files

| File | What it does |
| --- | --- |
| `index.html` | Layout + styles (desktop and mobile views) |
| `app.js` | Calculator, 3D card, share card, physics chevrons, Bridge Dash game |
| `api/xp.js` | Proxies `api.jumper.xyz/v1/leaderboard/{address}` (that API has no CORS headers) |
| `logo.jpg` | Logo image (favicon, nav, hero, share card) |
| `logo-mark.svg` | Exact vector trace of the logo mark, used inside tier emblems (paths embedded in `tiers.js`) |
| `tiers.js` | The 10 rank tiers + emblem generator |
| `pranjal.jpg` | Footer avatar |
| `scripts/estimate-total.mjs` | Recomputes the total-XP snapshot |

## Updating the total-XP snapshot

The "total XP on the leaderboard" number is a snapshot (see `SNAPSHOT` at the top of `app.js`).
To refresh it: `node scripts/estimate-total.mjs`, then paste the printed values into `SNAPSHOT`.

## Notes

- `/api/xp?address=0x…,0x…` accepts up to 10 addresses per call (EVM or Solana).
- Physics layer and Bridge Dash only load on desktop with a mouse; phones get the stacked view.
- Not affiliated with Jumper Exchange or LI.FI. Not financial advice.
