// Game recaps. When you tap "Write a game recap" on one of your box scores, the game sends that game's facts here; this
// asks Claude for a short game story and sends the text back.
// The API key lives only in Netlify's environment (ANTHROPIC_API_KEY), never in the game or the repo.
// The function takes box-score facts only, not free text, so it can't be used as a general chatbot on your credits.

const MODEL = 'claude-haiku-5-5';
const MAX_BODY = 8000;                 // bytes: one game's facts are well under this
const PER_MIN = 6;                     // recaps per minute from one address
const hits = new Map();                // address -> recent call times, kept per function instance

// Only the game's own pages may call this: the live site, its deploy previews and branch deploys, and local testing.
const ORIGIN_OK = /^https:\/\/([a-z0-9-]+--)?hardwoodgm-ug2o\.netlify\.app$|^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

// Text from the game is cut short and kept to letters, digits and simple punctuation before it goes into the prompt.
const txt = (v, n = 40) => String(v ?? '').replace(/[^\p{L}\p{N} .,'()\-–]/gu, '').slice(0, n).trim();
const num = (v, lo = 0, hi = 300) => { const x = Number(v); return Number.isFinite(x) ? Math.round(Math.min(hi, Math.max(lo, x))) : 0; };
const made = v => (/^\d{1,3}-\d{1,3}$/.test(String(v)) ? String(v) : '0-0');

const SYSTEM = `You are a sportswriter covering a simulated pro basketball game from a basketball GM game. Write a short game recap: a headline on its own line, then two short paragraphs, about 120 words in all.
Use only the facts you are given: the score, the quarter-by-quarter line and the players' box-score numbers. Do not invent plays, quotes, injuries, records, streaks, standings or anything about the players' real lives or careers.
The player's own team is marked (your team). Write it like a newspaper game story, mostly from their side.
Plain text only: no markdown, no emoji, no hashtags.`;

function side(s, label) {
  const q = Array.isArray(s?.q) ? s.q.slice(0, 8).map(v => num(v, 0, 99)) : [];
  const players = Array.isArray(s?.players) ? s.players.slice(0, 8) : [];
  return [
    `${txt(s?.team)}${label}: ${num(s?.pts)} points${q.length ? ` (by quarter: ${q.join(', ')})` : ''}`,
    ...players.map(p => `  ${txt(p.n, 40)}: ${num(p.min, 0, 70)} min, ${num(p.pts)} pts, ${num(p.reb)} reb, ${num(p.ast)} ast, ${num(p.stl)} stl, ${num(p.blk)} blk, FG ${made(p.fg)}, 3P ${made(p.tp)}, FT ${made(p.ft)}`),
  ];
}

function facts(b) {
  return [
    `Season: ${txt(b.season, 10)}${b.playoffs ? ', playoffs' : ''}. Your team was ${b.home ? 'at home' : 'on the road'}.`,
    ...side(b.you, ' (your team)'),
    ...side(b.opp, ''),
  ].join('\n');
}

export default async (req, context) => {
  const origin = req.headers.get('origin') || '';
  const cors = ORIGIN_OK.test(origin) ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {};
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...cors, 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type' } });
  if (req.method !== 'POST') return new Response('POST only', { status: 405, headers: cors });
  if (!ORIGIN_OK.test(origin)) return new Response('Not allowed', { status: 403 });

  // a simple per-address limit; each function instance keeps its own count
  const ip = context?.ip || req.headers.get('x-nf-client-connection-ip') || 'unknown', now = Date.now();
  const recent = (hits.get(ip) || []).filter(t => now - t < 60000);
  if (recent.length >= PER_MIN) return new Response('Slow down', { status: 429, headers: cors });
  recent.push(now); hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return new Response('Not set up', { status: 503, headers: cors });

  const raw = await req.text();
  if (raw.length > MAX_BODY) return new Response('Too big', { status: 413, headers: cors });
  let body;
  try { body = JSON.parse(raw); } catch { return new Response('Bad request', { status: 400, headers: cors }); }

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 400, system: SYSTEM, messages: [{ role: 'user', content: facts(body) }] }),
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) { console.error('Claude API', r.status, (await r.text()).slice(0, 300)); return new Response('Upstream error', { status: 502, headers: cors }); }
    const data = await r.json();
    const text = (data.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n').trim().slice(0, 1500);
    return Response.json({ text }, { headers: { ...cors, 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('recap', e?.name, e?.message);
    return new Response('Upstream error', { status: 502, headers: cors });
  }
};

export const config = { path: '/api/recap' };
