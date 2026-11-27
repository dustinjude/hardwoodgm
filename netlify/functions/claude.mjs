// Every Claude feature in Hardwood GM goes through this one function, served at /api/claude. The game sends a kind
// (recap, news, scout, agent, trade or ask) and that kind's facts from the league; this turns the facts into a short
// prompt, asks Claude and sends the text back.
// The API key lives only in Netlify's environment (ANTHROPIC_API_KEY), never in the game or the repo.
// Each kind takes its own structured facts and nothing else. The one piece of free text is the question for the
// assistant GM, cut to 300 characters; the site is behind the Netlify team login, so only Dustin can reach it.

const MODEL = 'claude-haiku-5-5';      // fast and cheap, so replies come back well inside the function's time limit
const MAX_BODY = 16000;                // bytes: the assistant's league facts are the largest, well under this
const PER_MIN = 12;                    // calls per minute from one address
const hits = new Map();                // address -> recent call times, kept per function instance

// Only the game's own pages may call this: the live site, its deploy previews and branch deploys, and local testing.
const ORIGIN_OK = /^https:\/\/([a-z0-9-]+--)?hardwoodgm-ug2o\.netlify\.app$|^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

// Text from the game is cut short and kept to letters, digits and simple punctuation before it goes into a prompt.
const txt = (v, n = 40) => String(v ?? '').replace(/[^\p{L}\p{N} .,'()\-–:;$%#/+]/gu, '').slice(0, n).trim();
const num = (v, lo = -999, hi = 999, dp = 0) => { const x = Number(v); if (!Number.isFinite(x)) return 0; const k = 10 ** dp; return Math.round(Math.min(hi, Math.max(lo, x)) * k) / k; };
const made = (v) => (/^\d{1,3}-\d{1,3}$/.test(String(v)) ? String(v) : '0-0');
const list = (v, n) => (Array.isArray(v) ? v.slice(0, n) : []);
const money = (v) => '$' + num(v, -500, 500, 1) + 'M';

const NO_REAL = 'Some players share names with real NBA players, but this league has its own history: use only the facts given, never anything from real life.';
const PLAIN = 'Plain text only: no markdown, no bullet symbols, no emoji, no hashtags.';
const player = (p) => `${txt(p.n)} (${txt(p.pos, 5)}, age ${num(p.age, 15, 50)}, overall ${num(p.ovr, 0, 100)}, potential ${num(p.pot, 0, 100)}${p.sal != null ? `, ${money(p.sal)} a year through ${num(p.exp, 1990, 2200)}` : ''}${p.ppg != null ? `, ${num(p.ppg, 0, 60, 1)} pts ${num(p.rpg, 0, 30, 1)} reb ${num(p.apg, 0, 20, 1)} ast a game` : ''})`;

const KINDS = {
  // A newspaper story from one of the user's box scores.
  recap: {
    max: 400,
    system: `You are a sportswriter covering a simulated pro basketball game from a basketball GM game. Write a short game recap: a headline on its own line, then two short paragraphs, about 120 words in all.
Use only the facts you are given: the score, the quarter-by-quarter line and the players' box-score numbers. Do not invent plays, quotes, injuries, records, streaks or standings. ${NO_REAL}
The player's own team is marked (your team). Write it like a newspaper game story, mostly from their side. ${PLAIN}`,
    facts(b) {
      const side = (s, label) => {
        const q = list(s?.q, 8).map((v) => num(v, 0, 99));
        return [`${txt(s?.team)}${label}: ${num(s?.pts, 0, 300)} points${q.length ? ` (by quarter: ${q.join(', ')})` : ''}`,
          ...list(s?.players, 8).map((p) => `  ${txt(p.n)}: ${num(p.min, 0, 70)} min, ${num(p.pts, 0, 99)} pts, ${num(p.reb, 0, 50)} reb, ${num(p.ast, 0, 40)} ast, ${num(p.stl, 0, 20)} stl, ${num(p.blk, 0, 20)} blk, FG ${made(p.fg)}, 3P ${made(p.tp)}, FT ${made(p.ft)}`)];
      };
      return [`Season: ${txt(b.season, 10)}${b.playoffs ? ', playoffs' : ''}. Your team was ${b.home ? 'at home' : 'on the road'}.`, ...side(b.you, ' (your team)'), ...side(b.opp, '')].join('\n');
    },
  },
  // A weekly league newsletter from the standings, the leaders and the week's news.
  news: {
    max: 700,
    system: `You write "Around the League", a weekly newsletter for a simulated pro basketball league in a basketball GM game. Write a title line, then four or five short sections, each a short heading on its own line followed by a short paragraph: the top of the standings, the bottom, the stat leaders, the week's moves and news, and a closing word on the reader's own team. About 250 words in all.
Use only the facts you are given. Do not invent results, injuries, quotes or rumours. ${NO_REAL}
The reader runs the team marked (your team). ${PLAIN}`,
    facts(b) {
      const conf = (c, l) => [`${l} standings:`, ...list(c, 18).map((t, i) => `  ${i + 1}. ${txt(t.n)} ${num(t.w, 0, 82)}-${num(t.l, 0, 82)}${t.me ? ' (your team)' : ''}`)];
      return [`Season ${txt(b.season, 10)}, ${txt(b.when, 40)}.`, ...conf(b.east, 'East'), ...conf(b.west, 'West'),
        'League leaders (per game):', ...list(b.leaders, 6).map((c) => `  ${txt(c.cat, 12)}: ${list(c.rows, 3).map((r) => `${txt(r.n)} (${txt(r.t, 4)}) ${num(r.v, 0, 60, 1)}`).join('; ')}`),
        'Recent news:', ...list(b.news, 14).map((n) => `  ${txt(n, 160)}`)].join('\n');
    },
  },
  // A scouting report on a draft prospect from his ratings.
  scout: {
    max: 300,
    system: `You are a basketball scout writing a short report on a draft prospect in a basketball GM game. Write two short paragraphs, about 100 words: what he does well and how he would fit, then what he needs to improve and his ceiling. Ratings run 0 to 100, where 50 is about average for the league.
Base everything on the ratings and draft position you are given. Do not mention colleges, real-life careers or anything not in the facts. ${NO_REAL} ${PLAIN}`,
    facts(b) {
      return [`${txt(b.n)}: ${txt(b.pos, 5)}, age ${num(b.age, 15, 30)}, height ${txt(b.hgt, 6)}. Overall ${num(b.ovr, 0, 100)}, potential ${num(b.pot, 0, 100)}.`,
        `Scouts rank him ${num(b.rank, 1, 200)} of ${num(b.of, 1, 200)} in this class, ${txt(b.proj, 40)}.${list(b.str, 3).length ? ` Standouts: ${list(b.str, 3).map((x) => txt(x, 20)).join(', ')}.` : ''}`,
        'Ratings:', ...list(b.r, 16).map((x) => `  ${txt(x.l, 24)}: ${num(x.v, 0, 100)}`)].join('\n');
    },
  },
  // The player's agent, explaining what his client wants and why.
  agent: {
    max: 300,
    system: `You are the agent of a pro basketball player in a basketball GM game, talking to the general manager who wants to sign him. Speak in the first person as the agent, in three to five sentences: what your client wants, the reasons behind his price, and what would or would not move him. Be a tough but fair negotiator with a bit of personality.
The price and the reasons are already decided by the game: explain them, never change them or promise anything different. ${NO_REAL} ${PLAIN}`,
    facts(b) {
      return [`Client: ${player(b.p || {})}.`,
        `${b.resign ? "His contract with the GM's team is up; this is a re-signing." : 'He is a free agent.'} The GM's team: ${txt(b.team)} ${num(b.w, 0, 82)}-${num(b.l, 0, 82)}.`,
        `Market value (what other teams would pay): ${money(b.market)} a year. His price to this GM: ${money(b.price)} a year for ${num(b.yrs, 1, 5)} years.`,
        ...list(b.why, 6).map((x) => `  He ${txt(x.t, 60)}: ${num(x.d, -50, 50) > 0 ? '+' : ''}${num(x.d, -50, 50)}% on his price.`),
        b.no ? 'He has decided not to re-sign: he wants to play for a winner.' : '',
        b.others != null ? `${num(b.others, 0, 40)} other teams have cap room for him now.` : ''].filter(Boolean).join('\n');
    },
  },
  // The other team's general manager, reacting to a trade proposal the game has already judged.
  trade: {
    max: 300,
    system: `You are the general manager of a pro basketball team in a basketball GM game, answering a trade proposal from another GM. Speak in the first person, in three to five sentences, with some personality. The verdict is already decided by the game: explain it in your own words from your team's point of view (your record, what you would give up, what you would get, ages, contracts), and if it is not a yes, say what kind of thing would get you closer. Never change the verdict.
${NO_REAL} ${PLAIN}`,
    facts(b) {
      const side = (ps, pk) => [...list(ps, 6).map((p) => '  ' + player(p)), ...list(pk, 6).map((k) => '  ' + txt(k, 50))];
      return [`Your team: ${txt(b.them)} ${num(b.w, 0, 82)}-${num(b.l, 0, 82)}, ${txt(b.rank, 30)}.`, 'You would receive:', ...side(b.get, b.getPk), 'You would give up:', ...side(b.give, b.givePk),
        `The game's verdict: ${txt(b.verdict, 120)}`].join('\n');
    },
  },
  // The assistant GM: answers the user's own question from his league's facts.
  ask: {
    max: 600,
    system: `You are the assistant general manager of a pro basketball team in a basketball GM game. Answer the general manager's question in a short, practical reply: a direct answer first, then the few reasons or options that matter, about 150 words. Use names and numbers from the facts.
Use only the facts you are given about this league. If they do not cover something, say so rather than guessing. Only discuss running this team in this game; politely decline anything else. ${NO_REAL} ${PLAIN}`,
    facts(b) {
      const ps = (l, n) => list(l, n).map((p) => '  ' + player(p));
      return [`Question: ${String(b.q ?? '').replace(/[\u0000-\u001f]/g, ' ').slice(0, 300)}`, '',
        `Season ${txt(b.season, 10)}, ${txt(b.when, 40)}. Your team: ${txt(b.team)} ${num(b.w, 0, 82)}-${num(b.l, 0, 82)}, ${txt(b.rank, 30)}, team rating ${num(b.rating, 0, 100)}.`,
        `Payroll ${money(b.pay)}, salary cap ${money(b.cap)}${b.tax ? `, luxury tax line ${money(b.tax)}` : ''}. ${txt(b.rules, 240)}`,
        `Strategy: ${txt(b.plan, 160)}`, 'Your roster:', ...ps(b.roster, 17),
        'Best free agents:', ...ps(b.fa, 10), 'Best players on other teams:', ...ps(b.targets, 15),
        'Standings:', ...list(b.standings, 32).map((t) => `  ${txt(t.n)} ${num(t.w, 0, 82)}-${num(t.l, 0, 82)}`)].join('\n');
    },
  },
};

export default async (req, context) => {
  const origin = req.headers.get('origin') || '';
  const cors = ORIGIN_OK.test(origin) ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {};
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...cors, 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type' } });
  if (req.method !== 'POST') return new Response('POST only', { status: 405, headers: cors });
  if (!ORIGIN_OK.test(origin)) return new Response('Not allowed', { status: 403 });

  // a simple per-address limit; each function instance keeps its own count
  const ip = context?.ip || req.headers.get('x-nf-client-connection-ip') || 'unknown', now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 60000);
  if (recent.length >= PER_MIN) return new Response('Slow down', { status: 429, headers: cors });
  recent.push(now); hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return new Response('Not set up', { status: 503, headers: cors });

  const raw = await req.text();
  if (raw.length > MAX_BODY) return new Response('Too big', { status: 413, headers: cors });
  let body;
  try { body = JSON.parse(raw); } catch { return new Response('Bad request', { status: 400, headers: cors }); }
  const K = Object.hasOwn(KINDS, body?.kind) ? KINDS[body.kind] : null;
  if (!K || typeof body.facts !== 'object' || !body.facts) return new Response('Unknown kind', { status: 400, headers: cors });

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: K.max, system: K.system, messages: [{ role: 'user', content: K.facts(body.facts) }] }),
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) { console.error('Claude API', r.status, (await r.text()).slice(0, 300)); return new Response('Upstream error', { status: 502, headers: cors }); }
    const data = await r.json();
    const text = (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n').trim().slice(0, 3000);
    return Response.json({ text }, { headers: { ...cors, 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('claude', body.kind, e?.name, e?.message);
    return new Response('Upstream error', { status: 502, headers: cors });
  }
};

export const config = { path: '/api/claude' };
