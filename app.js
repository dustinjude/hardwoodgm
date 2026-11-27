"use strict";
const MINSAL = 1, MAXSAL = 26, RMAX = 15, RMIN = 12, KEY = "hardwoodgm1", K_MARGIN = 1.5, NOISE = 11.5;
// League rules the player can change in Office. Anything not set falls back to these.
const SDEF = { games: 82, pot: 8, po1: 7, po: 7, playin: "auto", cap: 80, capType: "soft", taxOver: 20, inj: 1, lot: "top3", deadline: 1, hca: 3, timeline: 1 };
const opt = (k) => (G && G.set && G.set[k] != null ? G.set[k] : SDEF[k]);
const NG = () => (G && G.ng) || 82, TAXL = () => (opt("taxOver") >= 999 ? 1e9 : opt("cap") + opt("taxOver")), AIMAX = () => opt("cap") + Math.min(20, opt("taxOver")), hardCap = () => opt("capType") === "hard", capFree = () => G.noCap || opt("capType") === "none", NEED = (round) => ((round === 1 ? opt("po1") : opt("po")) + 1) / 2;
let HIST = null, PIDX = null, DATA = {}, G = null, cloud = null, toastT = 0;
const UI = { tab: "home", league: "standings", moves: "fa", sheet: null, lead: 2, viewTid: null, tradeTid: null, tradeA: [], tradeB: [], tradePA: [], tradePB: [], psort: 2, mode: "real", diff: 1, delId: null, season: 1996, team: null, toast: "" };
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => "&#" + c.charCodeAt(0) + ";");
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const pois = (l) => Math.max(0, Math.round(l + Math.sqrt(l) * gauss()));
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(0, i); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const f1 = (x) => (Math.round(x * 10) / 10).toFixed(1);
const money = (x) => (x < 0 ? "−$" : "$") + (Math.round(Math.abs(x) * 10) / 10) + "M";
const seasonName = (s) => (s - 1) + "–" + String(s).slice(2);
const age = (p) => G.season - p.born;
const DEADLINE = () => Math.floor(G.sched.length * .7), tradeShut = () => !G.god && (G.phase === "playoffs" || (!!opt("deadline") && G.phase === "regular" && G.day >= DEADLINE())), DL = () => (opt("deadline") ? DEADLINE() : G.sched.length - 3);
const ORD = (n) => n + (["th", "st", "nd", "rd"][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] || "th");
const off = () => (G.phase === "draft" && !(G.draft && G.draft.fantasy)) || G.phase === "resign" || G.phase === "fa";
const team = (tid) => G.teams[tid];
const roster = (tid) => G.players.filter((p) => p.tid === tid);
const payroll = (tid) => roster(tid).reduce((s, p) => s + p.sal, 0);
const byId = (id) => G.players.find((p) => p.id === id);
const imp = (o) => (o <= 50 ? 0 : Math.pow((o - 50) / 10, 1.6));
const lg = () => DATA.lg[Math.min(G.season, 2026)];
const fair = (ovr, a) => { let s = Math.pow(Math.max(0, ovr - 60) / 38, 2.1) * 38; if (a >= 33) s *= 0.75; return Math.min(MAXSAL, Math.max(MINSAL, Math.round(s * 10) / 10)); };
const news = (t) => { G.news.unshift({ s: G.season, t }); G.news.length = Math.min(G.news.length, 150); };

/* ---------- colors ---------- */
const lum = (hex) => { const n = parseInt(hex.slice(1), 16); const f = (v) => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(n >> 16 & 255) + .7152 * f(n >> 8 & 255) + .0722 * f(n & 255); };
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
const mix = (hex, to, t) => { const n = parseInt(hex.slice(1), 16), m = parseInt(to.slice(1), 16); const c = (s) => Math.round((n >> s & 255) * (1 - t) + (m >> s & 255) * t); return "#" + [16, 8, 0].map((s) => c(s).toString(16).padStart(2, "0")).join(""); };
const isDark = () => { const t = document.documentElement.getAttribute("data-theme"); return t ? t === "dark" : matchMedia("(prefers-color-scheme: dark)").matches; };
function setAccent(hex) {
	if (!/^#[0-9a-f]{6}$/i.test(hex)) hex = "#ce1141";
	const bg = isDark() ? "#101317" : "#f2f3ef", toward = isDark() ? "#ffffff" : "#000000";
	let txt = hex; for (let i = 0; i < 12 && contrast(txt, bg) < 4.5; i++) txt = mix(txt, toward, .15);
	const st = document.documentElement.style;
	st.setProperty("--accent", hex); st.setProperty("--on-accent", lum(hex) > .4 ? "#000000" : "#ffffff"); st.setProperty("--accent-text", txt);
}
function badge(t, size) {
	const c1 = /^#[0-9a-f]{6}$/i.test(t.c1) ? t.c1 : "#333333", c2 = /^#[0-9a-f]{6}$/i.test(t.c2) ? t.c2 : "#ffffff";
	const ring = contrast(c1, c2) >= 1.3 ? c2 : (lum(c1) > .4 ? "#000000" : "#ffffff"), tx = contrast(c1, c2) >= 4.5 ? c2 : (lum(c1) > .4 ? "#000000" : "#ffffff");
	return `<svg class="bdg" width="${size}" height="${size}" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="54" fill="${c1}" stroke="${ring}" stroke-width="7"/><text x="60" y="62" text-anchor="middle" dominant-baseline="central" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="${t.ab.length > 2 ? 38 : 48}" fill="${tx}">${esc(t.ab)}</text></svg>`;
}

/* ---------- league setup ---------- */
const Z = () => [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
// League totals and the constants the advanced stats need. `lines` is one stat line per player.
function advCtx(lines) {
	const L = Z(); for (const x of lines) if (x && x[0]) for (let i = 0; i < 17; i++) L[i] += x[i] || 0;
	const A = { L, ok: L[1] > 0 && L[8] > 0 && L[11] > 0 && L[15] > 0 && L[3] > 0 }; if (!A.ok) return A;
	A.astfg = L[4] / L[8]; A.factor = 2 / 3 - (.5 * A.astfg) / (2 * (L[8] / L[11])); A.vop = L[2] / (L[9] - L[13] + L[14] + .44 * L[12]); A.drbp = (L[3] - L[13]) / L[3]; A.ftpf = L[11] / L[15] - .44 * (L[12] / L[15]) * A.vop;
	A.poss = L[9] + .44 * L[12] + L[14]; A.lgU = 1; let sum = 0; for (const x of lines) if (x && x[1] > 0) sum += uper(x, A) * x[1]; A.lgU = sum / L[1];
	return A;
}
// Unadjusted player efficiency: the box score turned into one per-minute number, using league-wide rates.
function uper(x, A) {
	const fg = x[8], miss = x[9] - x[8], ftMiss = x[12] - x[11];
	return (x[7] + (2 / 3) * x[4] + (2 - A.factor * A.astfg) * fg + x[11] * .5 * (1 + (1 - A.astfg) + (2 / 3) * A.astfg) - A.vop * x[14] - A.vop * A.drbp * miss - A.vop * .44 * (.44 + .56 * A.drbp) * ftMiss + A.vop * (1 - A.drbp) * (x[3] - x[13]) + A.vop * A.drbp * x[13] + A.vop * x[5] + A.vop * A.drbp * x[6] - x[15] * A.ftpf) / x[1];
}
const ADV = {
	per: (x, A) => (A.ok && x[1] > 0 ? 15 * uper(x, A) / A.lgU : 0),
	ewa: (x, A) => (A.ok && x[1] > 0 ? x[1] * (15 * uper(x, A) / A.lgU - 11) / 67 / 30 : 0),
	ts: (x) => (x[9] + x[12] > 0 ? 100 * x[2] / (2 * (x[9] + .44 * x[12])) : -1),
	efg: (x) => (x[9] > 0 ? 100 * (x[8] + .5 * x[7]) / x[9] : -1),
	usg: (x, A) => (A.ok && x[1] > 0 ? 20 * ((x[9] + .44 * x[12] + x[14]) / x[1]) / (A.poss / A.L[1]) : 0),
	ast: (x, A) => { const d = A.ok ? x[1] * 5 * A.L[8] / A.L[1] - x[8] : 0; return d > 0 ? 100 * x[4] / d : 0; },
	reb: (x, A) => (A.ok && x[1] > 0 ? 100 * x[3] / (x[1] * 10 * A.L[3] / A.L[1]) : 0),
	stl: (x, A) => (A.ok && x[1] > 0 ? 100 * x[5] / (x[1] * 5 * (A.poss - A.L[13]) / A.L[1]) : 0),
	blk: (x, A) => (A.ok && x[1] > 0 ? 100 * x[6] / (x[1] * 5 * (A.L[9] - A.L[10]) / A.L[1]) : 0),
	tov: (x) => (x[9] + .44 * x[12] + x[14] > 0 ? 100 * x[14] / (x[9] + .44 * x[12] + x[14]) : -1) };
function mkP(pi, tid, ovr, pot, r, slot, c) { const b = DATA.players[pi]; return { id: G.nextId++, n: b[0], born: b[1], pos: b[2], hgt: b[3], dy: b[4], tid, ovr, pot, r: r.slice(), sal: 0, exp: 0, inj: 0, s: Z(), ls: null, c: c && c.length === 4 ? c.slice() : [0, 0, 0, 0], aw: 0, aws: [], h: [], slot: slot || 0 }; }
function newGame(season, userTid, opts) {
	const snap = DATA["s" + season];
	G = { v: 1, season, start: season, phase: "regular", day: 0, userTid, auto: true, order: [], nextId: 1, news: [], history: [], log: [], po: null, draft: null, resign: [], ures: "", teams: [], players: [], sched: [], hof: [], picks: [], rec: { g: [], s: [] }, ach: {}, drafts: [], fake: !!(opts && opts.fake), diff: opts && opts.diff != null ? opts.diff : 1, id: leagues().some((x) => x.id === "1") ? String(Date.now()) : "1" };
	G.teams = snap.teams.map((t, i) => ({ tid: i, ab: t[0], region: t[1], name: t[2], c1: t[3], c2: t[4], cid: t[5], w: 0, l: 0, pf: 0, pa: 0, titles: 0, pop: t[7] || 3, prev: .5, fr: t[8] || t[0], pv: paceV(t[9]) }));
	G.fin = newFin(); G.owner = { w: 0, p: 0, m: 0, yrs: 0 }; G.offers = [];
	G.players = G.fake ? fakePlayers() : snap.rows.map((r) => mkP(r[0], r[1], r[2], r[3], r.slice(4, 11).concat(r.slice(15, 23), r.slice(23, 25)), 0, r.slice(11, 15)));
	for (const t of G.teams) { const ps = roster(t.tid).sort((a, b) => b.ovr - a.ovr); ps.slice(RMAX).forEach((p) => { p.tid = -1; }); }
	for (const p of G.players) {
		const a = age(p);
		if (p.tid < 0) { setAsk(p); continue; }
		if (a <= 23 && season - p.dy <= 3) { p.sal = Math.min(fair(p.ovr, a), 5); p.exp = season + rnd(0, 2); }
		else { p.sal = Math.max(MINSAL, Math.round(fair(p.ovr, a) * (.85 + Math.random() * .25) * 10) / 10); p.exp = season + (a >= 33 ? rnd(0, 1) : rnd(0, 3)); }
	}
	fillRosters(true); makeSchedule();
	// The league's starting spread of each skill, kept so later seasons can be held to the same shape.
	G.dist = mkDist(G, []); G.sc = {}; G.h2h = {}; G.devV = 2; BX.prune(G.id, null);
	G.picks = [...mkPicks(season), ...mkPicks(season + 1), ...mkPicks(season + 2)]; if (opts && opts.fantasy) startFantasy(); else addClass();
	news(`You take over the ${team(userTid).region} ${team(userTid).name} for the ${seasonName(season)} season.`);
	UI.tab = G.draft ? "moves" : "home"; save(true);
}
function setAsk(p) { const a = age(p) + (off() ? 1 : 0); p.ask = fair(p.ovr, a); p.askY = a >= 32 ? rnd(1, 2) : rnd(1, 4); }
function makeSchedule() {
	const n = G.teams.length; let arr = shuffle([...Array(n).keys()]); if (n % 2) arr.push(-1);
	const m = arr.length, days = [], ng = opt("games"); let R = ng; if (n % 2) while (R - Math.ceil(R / n) < ng) R++; G.ng = ng;
	for (let r = 0; r < R; r++) { const d = []; for (let i = 0; i < m / 2; i++) { const a = arr[i], b = arr[m - 1 - i]; if (a < 0 || b < 0) continue; d.push((r + i) % 2 ? [a, b] : [b, a]); } days.push(d); arr.splice(1, 0, arr.pop()); }
	// With an odd number of teams some clubs come out a game over; drop meetings between them until everyone plays 82.
	if (n % 2) { const c = Array(n).fill(0); for (const d of days) for (const g of d) { c[g[0]]++; c[g[1]]++; } for (let pass = 0; pass < 4; pass++) for (const d of shuffle(days.slice())) { const k = d.findIndex((g) => c[g[0]] > ng && c[g[1]] > ng); if (k >= 0) { c[d[k][0]]--; c[d[k][1]]--; d.splice(k, 1); } } }
	G.sched = shuffle(days); G.day = 0;
}
const FIRST = "Marcus Devin Jalen Tyrese Andre Malik Darius Isaiah Trey Cole Jordan Elijah Xavier Nolan Caleb Dante Miles Amir Keon Luca Mateo Niko Omar Julian Theo Reggie Corey Desmond Silas Kofi Emeka Tomas Rafael Bryce Quentin Landon Zaire Hakim Felix Jonas".split(" ");
const LAST = "Hollis Okafor Brandt Whitfield Marlowe Castellano Reyes Dunmore Ashby Kovac Lindqvist Mbeki Thornhill Vasquez Abernathy Calloway Draper Ellison Fontaine Grady Hargrove Iverness Jarrett Kingsley Lachance Montrose Nakamura Oyelaran Prescott Quarles Rutledge Sandoval Tolliver Underhill Varga Westbrooke Yancey Zubac Delacroix Petrov".split(" ");
// Fill in the detailed ratings (inside, three-point accuracy, free throws, ball security, offensive and defensive rebounding, rim protection, steals) for a player who only has the six broad ones.
function ext(p) {
	const r = p.r, cc = (x) => clamp(Math.round(x), 25, 99);
	if (r.length < 15) { const big = p.pos.includes("C"), fwd = p.pos.includes("F"), reb = (r[3] - 25) / 4.7, os = big ? .33 : fwd ? .26 : .16, act = Math.max(5, r[4] - 20), c = (x) => clamp(Math.round(x), 25, 99);
	r[7] = c(52 + (p.ovr - 65) * .5 + (big ? 10 : 0) + gauss() * 4); r[8] = c(40 + (r[1] - 25) * .7 + gauss() * 4); r[9] = c(60 + (r[1] - 25) * .45 - (big ? 8 : 0) + gauss() * 6); r[10] = c(64 + (big ? -5 : fwd ? 0 : 6) + gauss() * 8);
	r[11] = c(25 + 14 * reb * os); r[12] = c(25 + 6.2 * reb * (1 - os)); r[13] = c(25 + 20 * act * r[6] / 100 / 22); r[14] = c(25 + 30 * (act * (100 - r[6]) / 100 / 45 + .4));
	}
	// Tendencies for players without real stats: getting to the line and plays used, from scoring, inside play and passing.
	if (r.length < 17) { const big = p.pos.includes("C"), g = p.pos.includes("G"); r[15] = cc(44 + (r[0] - 55) * .38 + (r[7] - 55) * .15 + (big ? 3 : g ? 0 : 2) + gauss() * 5); r[16] = cc(54 + (r[0] - 55) * .8 + (r[2] - 50) * .1 + gauss() * 3); }
	return p;
}

function mkDist(g, old) { return Array.from({ length: 17 }, (_, k) => { if (k === 6) return null; if (old[k]) return old[k]; const v = g.players.filter((p) => p.tid >= 0 && p.r[k] != null).map((p) => p.r[k]).sort((a, b) => b - a); return v.length ? Array.from({ length: 51 }, (_, i) => v[Math.round(i / 50 * (v.length - 1))]) : null; }); }
function fakePlayers() {
	const n = G.teams.length * 14, ranks = shuffle([...Array(n).keys()]), out = [];
	G.teams.forEach((t, ti) => { for (let j = 0; j < 14; j++) { const a = clamp(Math.round(27 + gauss() * 4), 19, 37), o = Math.round(rankOvr((ranks[ti * 14 + j] + 1) * 30 / G.teams.length)), p = genPlayer(o, a < 26 ? clamp(o + rnd(0, (26 - a) * 2), o, 99) : o, a, t.tid); p.dy = G.season - Math.max(2, a - 20); out.push(p); } });
	for (let i = 0; i < 25; i++) out.push(genPlayer(rnd(58, 67), 68, rnd(24, 33), -1));
	return out;
}
function genPlayer(ovr, pot, a, tid, slot, rookie) {
	const pos = ["G", "G", "GF", "F", "FC", "C"][rnd(0, 5)], big = pos === "C" || pos === "FC", guard = pos === "G";
	const base = (k, sd) => clamp(Math.round(35 + (ovr - 50) * k + gauss() * sd), 25, 99);
	const r = [base(1.15, 6), clamp(Math.round((big ? 38 : 58) + gauss() * 14), 25, 99), clamp(base(.6, 6) + (guard ? 18 : big ? -6 : 4), 25, 99), clamp(base(.5, 5) + (big ? 26 : guard ? -4 : 10), 25, 99), clamp(Math.round(55 + (ovr - 65) * .5 + gauss() * 9), 25, 99), clamp(Math.round(40 + (ovr - 50) * 1.2 + gauss() * 5), 25, 97), big ? rnd(45, 80) : guard ? rnd(8, 25) : rnd(20, 45)];
	return ext({ id: G.nextId++, n: FIRST[rnd(0, FIRST.length - 1)] + " " + LAST[rnd(0, LAST.length - 1)], born: G.season + (rookie || off() ? 1 : 0) - a, pos, hgt: big ? rnd(81, 86) : guard ? rnd(73, 78) : rnd(77, 82), dy: rookie ? G.season : G.season - 3, tid, ovr, pot, r, sal: 0, exp: 0, inj: 0, s: Z(), ls: null, c: [0, 0, 0, 0], aw: 0, aws: [], h: [], slot: slot || 0, gen: 1 });
}
const mkPicks = (y) => G.teams.flatMap((t) => [1, 2].map((r) => ({ y, r, o: t.tid, t: t.tid })));
const pkKey = (k) => k.y + "-" + k.r + "-" + k.o, pkFind = (key) => G.picks.find((k) => pkKey(k) === key);
const pkLabel = (k) => `${k.y} ${k.r === 1 ? "1st" : "2nd"}-round pick${k.o !== k.t ? " (from " + team(k.o).ab + ")" : ""}`;
const tradablePicks = (tid) => G.picks.filter((k) => k.t === tid && (k.y > G.season || !off())).sort((a, b) => a.y - b.y || a.r - b.r);
let PV = { key: "", order: [] };
function pickVal(k) {
	if (k.r === 2) return 1; if (k.y !== G.season) return k.y > G.season + 1 ? 8 : 10;
	const key = G.season + "|" + G.day + "|" + G.phase;
	if (PV.key !== key) PV = { key, order: G.day >= 15 ? standings().reverse().map((t) => t.tid) : allRatings().map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]).map((x) => x[1]) };
	const o = PV.order.indexOf(k.o); return o < 3 ? 45 : o < 8 ? 24 : o < 14 ? 12 : o < 22 ? 7 : 4;
}
function addClass() {
	if (G.players.some((p) => p.tid === -2)) return; const cls = G.fake ? null : DATA["c" + G.season];
	if (cls) for (const c of cls) G.players.push(mkP(c[0], -2, c[2], c[3], c.slice(4), c[1]));
	else for (let i = 0; i < 75; i++) { const a = clamp(19 + Math.floor(Math.abs(gauss()) * 1.3 + i / 40), 19, 23), o = clamp(Math.round(74 - i * .3 + gauss() * 3.5), 48, 84); G.players.push(genPlayer(o, clamp(o + rnd(4, 20) - (a - 19) * 2, o, 97), a, -2, i + 1, true)); }
}
function sign(p, tid, sal, years) { p.tid = tid; p.sal = sal; p.exp = G.season + (off() ? 1 : 0) + years - 1; p.inj = p.inj || 0; delete p.ask; delete p.askY; }
function fillRosters(includeUser) {
	for (const t of G.teams) {
		if (t.tid === G.userTid && !includeUser) continue;
		let ps = roster(t.tid);
		while (ps.length > RMAX) { const w = ps.sort((a, b) => a.ovr - b.ovr).shift(); w.tid = -1; setAsk(w); }
		while (ps.length < 13) {
			let p = G.players.filter((x) => x.tid === -1).sort((a, b) => b.ovr - a.ovr)[0];
			if (!p) { p = genPlayer(rnd(52, 58), 60, rnd(23, 27), -1); G.players.push(p); }
			sign(p, t.tid, MINSAL, 1); ps.push(p);
		}
	}
}

/* ---------- game simulation ---------- */
const INJ = ["sprained ankle", "sore knee", "strained hamstring", "back spasms", "bruised hip", "sprained wrist", "strained calf", "broken finger", "concussion", "groin strain", "sore shoulder", "sore foot"];
const BASE = [36, 34, 32, 30, 28, 23, 19, 15, 12, 11];
function rotation(ps, tid) {
	let h = ps.filter((p) => !p.inj); if (h.length < 8) h = ps.slice();
	if (tid === G.userTid && !G.auto) { const o = G.order, ix = (p) => { const i = o.indexOf(p.id); return i < 0 ? 99 : i; }; h.sort((a, b) => ix(a) - ix(b)); } else h.sort((a, b) => b.ovr - a.ovr);
	h = h.slice(0, 10);
	let m = h.map((p, i) => BASE[i] * (.8 + .4 * (p.r[5] - 25) / 74) * (tid === G.userTid ? 1 + .22 * (p.pt || 0) : 1));
	for (let k = 0; k < 3; k++) { const s = m.reduce((a, b) => a + b, 0); m = m.map((x) => Math.min(42, x * 240 / s)); }
	const s = m.reduce((a, b) => a + b, 0), mn = m.map((x) => x * 240 / s), ro = G.teams[tid] ? rotOf(G.teams[tid]) : "norm";
	if (ro === "norm" || h.length < 7) return h.map((p, i) => ({ p, m: mn[i], mn: mn[i] }));
	// Tight: starters play about 3 more minutes. Deep: about 3 fewer, and the bench plays more.
	let m2 = mn.map((x, i) => x * (i < 5 ? (ro === "tight" ? 1.09 : .915) : ro === "tight" ? .8 : 1.2));
	for (let k = 0; k < 3; k++) { const s2 = m2.reduce((a, b) => a + b, 0); m2 = m2.map((x) => Math.min(42, x * 240 / s2)); }
	const s2 = m2.reduce((a, b) => a + b, 0);
	return h.map((p, i) => ({ p, m: m2[i] * 240 / s2, mn: mn[i] }));
}
const net = (rt) => rt.reduce((s, x) => s + x.m / 48 * imp(x.p.ovr + (x.mn == null ? 0 : x.m > x.mn ? -.35 * (x.m - x.mn) : .15 * (x.mn - x.m))), 0);
const wT = (p) => Math.max(.3, p.r[1] - 25);
const wsum = (rt, f) => rt.reduce((s, x) => s + x.m * f(x.p), 0);
/* ---------- possession engine ----------
   Every game is played one possession at a time: who is on the floor, who shoots, makes and misses, rebounds, assists,
   steals, blocks, turnovers, fouls and free throws. Player ratings decide who does what and how well. Each team's
   overall efficiency is then scaled so that stronger rosters win by the right amount and league scoring matches the era. */
const PACE = { 1990: 98.3, 1991: 97.8, 1992: 96.6, 1993: 96.8, 1994: 95.1, 1995: 92.9, 1996: 91.8, 1997: 90.1, 1998: 90.3, 1999: 88.9, 2000: 93.1, 2001: 91.3, 2002: 90.7, 2003: 91, 2004: 90.1, 2005: 90.9, 2006: 90.5, 2007: 91.9, 2008: 92.4, 2009: 91.7, 2010: 92.7, 2011: 92.1, 2012: 91.3, 2013: 92, 2014: 93.9, 2015: 93.9, 2016: 95.8, 2017: 96.4, 2018: 97.3, 2019: 100, 2020: 100.3, 2021: 99.2, 2022: 98.2, 2023: 99.2, 2024: 98.5, 2025: 98.8, 2026: 99.2 };
const DRIFT = 1.3, BAND = .0054, PF = .04;
// A real team's possessions per game against the league average (1000), as a pace setting from -1 (slow) to 1 (fast).
const paceV = (x) => (x ? clamp((x - 1000) / 60, -1, 1) : 0);
const eraOf = () => { const y = Math.min(G.season, 2026), d = y - 1990; return { pace: (PACE[y] || 98) * 1.025, tov: clamp(.17 - .001 * d, .13, .17), orb: clamp(.305 - .0022 * d, .245, .32), foul: clamp(.137 - .0009 * d, .1, .14), blk: .16 + .0012 * d }; };
function prof(p) {
	const r = p.r, pts = Math.max(2, (r[0] - 25) / 2.45), t36 = Math.max(.02, (r[1] - 25) / 19), ast = Math.max(.3, (r[2] - 25) / 6.3), p2 = clamp(.36 + (r[7] - 25) / 330, .34, .68), p3 = clamp(.2 + (r[8] - 25) / 330, .18, .48);
	return { p, p2, p3, pf: clamp(.45 + (r[9] - 25) / 160, .4, .95), w3: Math.pow(t36 / p3, 1.1), w2: Math.pow(Math.max(.6, pts - 3 * t36 - (r.length >= 17 ? Math.max(0, (r[15] - 25) / 6) * clamp(.45 + (r[9] - 25) / 160, .4, .95) : 0)) / (2 * p2), 1.12), wfd: Math.pow(Math.max(.4, r.length >= 17 ? (r[15] - 25) / 6 : pts / 5), 1.1), wa: Math.pow(ast, 1.4), wo: Math.pow(Math.max(.2, (r[11] - 25) / 14), 1.15), wd: Math.pow(Math.max(.5, (r[12] - 25) / 6.2), 1.2), ws: Math.pow(Math.max(.2, (r[14] - 25) / 30), 1.1), wb: Math.pow(Math.max(.05, (r[13] - 25) / 20), 1.35), wt: (pts / 2 + ast * 1.5 + 2) * clamp(.22 - (r[10] - 25) / 500, .05, .25), wf: p.pos.includes("C") ? 1.4 : 1, uf: r.length >= 17 ? clamp(1 + (r[16] - 54) / 22, .45, 2.2) : 1 };
}
function dayCtx() {
	const m = rosterMap(), rots = G.teams.map((t) => rotation(m[t.tid], t.tid)); for (const rt of rots) for (const x of rt) x.f = prof(x.p);
	const avg = (f) => rots.reduce((s, rt) => s + rt.reduce((a, x) => a + x.m * f(x), 0), 0) / rots.length || 1;
	const ctx = { m, rots, tp: avg((x) => wT(x.p)), wo: avg((x) => x.f.wo), wd: avg((x) => x.f.wd), ws: avg((x) => x.f.ws), wb: avg((x) => x.f.wb), wt: avg((x) => x.f.wt), wfd: avg((x) => x.f.wfd) };
	let s2 = 0, a2 = 0, s3 = 0, a3 = 0; for (const rt of rots) for (const x of rt) { s2 += x.m * x.f.w2; a2 += x.m * x.f.w2 * x.f.p2; s3 += x.m * x.f.w3; a3 += x.m * x.f.w3 * x.f.p3; } ctx.LG = { p2: a2 / s2, p3: a3 / s3 };
	const R = scoutRanks(ctx), memo = {}; ctx.rk = (tid) => memo[tid] || (memo[tid] = R(tid)); return ctx;
}
const pickW = (arr, fn) => { let s = 0; for (const x of arr) s += fn(x); let r = Math.random() * s; for (const x of arr) { r -= fn(x); if (r <= 0) return x; } return arr[0]; };
const pickBy = (arr, k, not) => { let s = 0; for (const x of arr) if (x !== not) s += x[k]; let r = Math.random() * s; for (const x of arr) { if (x === not) continue; r -= x[k]; if (r <= 0) return x; } return arr[0] === not ? arr[1] : arr[0]; };
// One game as a step-by-step object. Simulated games run it straight through; a coached game runs it a minute at a
// time so the user's decisions (opts.coach) can change what happens. Without opts.coach it plays exactly as before.
function makeGame(h, a, ctx, userSide, opts) {
	const CO = !!(opts && opts.coach), E = eraOf(), L = lg(), rec = opts && opts.rec ? [] : null, gp = E.pace + gauss() * 2.5, PL = [planFor(h, a, ctx), planFor(a, h, ctx)];
	// The player a team runs its offense through: the user's pick, or the best scorer who looks for his shot.
	const starIx = (tid, id) => { const rt = ctx.rots[tid]; let k = id != null ? rt.findIndex((x) => x.p.id === id) : -1; if (k < 0) k = rt.slice(0, 8).reduce((b, x, j) => (x.p.ovr + 6 * x.f.uf > rt[b].p.ovr + 6 * rt[b].f.uf ? j : b), 0); return k; };
	const mk = (tid, i) => ({ tid, i, ab: team(tid).ab, pts: 0, q: [0, 0, 0, 0], on: [], run: 0, to: 6, dl: 0, lock: null, lateFoul: false, wantTO: false, c: { pace: PL[i].pace, off: PL[i].off, star: starIx(tid, PL[i].star), def: PL[i].def, auto: true }, pl: ctx.rots[tid].map((x, k) => ({ ...x.f, k, tgt: x.m, min: 0, isOn: false, en: 1, L: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] })) });
	const T = [mk(h, 0), mk(a, 1)], sum = (t, k) => t.pl.reduce((s, x) => s + x.tgt * x[k], 0);
	const M = (K_MARGIN * (net(ctx.rots[h]) - net(ctx.rots[a])) + opt("hca")) * DRIFT, base = L[0] / E.pace * (G.cal || 1);
	T.forEach((t, i) => {
		// Teams full of players who attack the basket get to the line more often.
		t.ff = clamp(Math.pow(sum(t, "wfd") / ctx.wfd, .6), .8, 1.25);
		const d = T[1 - i], f = E.foul * t.ff;
		t.tov = clamp(E.tov * Math.sqrt(sum(t, "wt") / ctx.wt) * Math.pow(sum(d, "ws") / ctx.ws, .3), .08, .21); t.orbP = clamp(E.orb * (sum(t, "wo") / ctx.wo) / (sum(d, "wd") / ctx.wd), .12, .45);
		t.stlP = clamp(.55 * sum(d, "ws") / ctx.ws, .3, .8); t.blkP = clamp(E.blk * sum(d, "wb") / ctx.wb, .03, .32);
		// solve the team's efficiency so its points per possession hit the target, and its share of threes so made threes fit the era and the roster
		let s2 = 0, s3 = 0, a2 = 0, a3 = 0, af = 0, sf = 0; for (const x of t.pl) { s2 += x.tgt * x.w2; s3 += x.tgt * x.w3; a2 += x.tgt * x.w2 * x.p2; a3 += x.tgt * x.w3 * x.p3; af += x.tgt * x.wfd * x.pf; sf += x.tgt * x.wfd; }
		const p2 = a2 / s2, p3 = a3 / s3, pf = af / sf, ppp = base + (i ? -M : M) / (2 * gp), three = L[1] * wsum(ctx.rots[t.tid], wT) / ctx.tp; let q = .2, lam = 1;
		for (let it = 0; it < 4; it++) {
			let lo = .6, hi = 1.5;
			for (let k = 0; k < 12; k++) { lam = (lo + hi) / 2; const e = f * 2 * pf + (1 - f) * (q * 3 * lam * p3 + (1 - q) * lam * p2 * (2 + .065 * pf)), m = (1 - f) * (q * (1 - lam * p3) + (1 - q) * (1 - lam * p2)); if ((1 - t.tov) * e / (1 - m * t.orbP) < ppp) lo = lam; else hi = lam; }
			const m = (1 - f) * (q * (1 - lam * p3) + (1 - q) * (1 - lam * p2)); q = clamp(three / (gp * (1 - t.tov) / (1 - m * t.orbP) * (1 - f) * lam * p3), .01, .65);
		}
		t.lam = lam; t.q3 = q; t.p2a = p2; t.p3a = p3; t.nAvg = net(ctx.rots[t.tid]);
	});
	// League shooting levels, for judging how well a team can take extra threes or extra shots at the rim.
	const LG = ctx.LG, gpp = gp * (1 + PF * (T[0].c.pace + T[1].c.pace));
	const short = (x) => x.p.n.split(" ").slice(1).join(" ") || x.p.n, one = (arr) => arr[rnd(0, arr.length - 1)];
	let slice = 0, clock = 0, acc = 0, fin = null;
	const snap = () => (userSide === 0 ? T : [T[1], T[0]]).map((t) => t.pl.map((x) => [x.isOn ? 1 : 0, x.min, x.L[0], x.L[1], x.L[2], x.L[13]]));
	const say = (t, pts, txt) => { if (rec) rec.push({ side: t.i === userSide ? 0 : 1, ab: t.ab, pts, txt, t: clock, s: userSide === 0 ? [T[0].pts, T[1].pts] : [T[1].pts, T[0].pts], bx: snap() }); };
	const mark = (txt) => { if (rec) rec.push({ side: 0, ab: "", pts: 0, txt, t: clock, s: userSide === 0 ? [T[0].pts, T[1].pts] : [T[1].pts, T[0].pts], bx: snap() }); };
	const score = (t, d, x, pts) => {
		t.pts += pts; x.L[0] += pts; const qi = Math.min(slice < 48 ? Math.floor(slice / 12) : 4 + Math.floor((slice - 48) / 5), 9); while (t.q.length <= qi) { t.q.push(0); d.q.push(0); } t.q[qi] += pts; for (const y of t.on) y.L[14] += pts; for (const y of d.on) y.L[14] -= pts;
		if (CO) { t.run += pts; d.run = 0; if (t.run >= 9 && d.i !== userSide && d.to > 2) d.wantTO = true; }
	};
	// Coached games only: tired players play like lesser players, and the five on the floor decide how well a team plays.
	const ovrE = (x) => x.p.ovr - 32 * Math.pow(1 - x.en, 1.4), netNow = (t) => t.on.reduce((s, x) => s + imp(ovrE(x)), 0);
	const lateLeft = () => (slice < 48 ? 48 - slice : 5 - ((slice - 48) % 5));
	const timeout = (t) => { if (t.to <= 0) return false; t.to--; for (const x of t.on) x.en = Math.min(1, x.en + .06); T[1 - t.i].run = 0; mark(`Timeout, ${team(t.tid).name}. ${t.to} left`); return true; };
	const pickStar = (arr, k, s) => { let tot = 0; for (const x of arr) tot += x[k] * (x === s ? 2.2 : 1); let r = Math.random() * tot; for (const x of arr) { r -= x[k] * (x === s ? 2.2 : 1); if (r <= 0) return x; } return arr[0]; };
	const lineup = (t, lead) => {
		const prev = t.on;
		if (CO && !t.c.auto) {
			for (const x of t.pl) x.isOn = false;
			const five = (t.lock || prev).filter((x) => x.L[13] < 6).slice(0, 5), bench = t.pl.filter((x) => !five.includes(x) && x.L[13] < 6).sort((x, y) => ovrE(y) - ovrE(x));
			while (five.length < 5 && bench.length) five.push(bench.shift());
			t.lock = five; t.on = five;
		} else {
			const left = Math.max(1, 48 - slice), ot = slice >= 48, garbage = !ot && slice >= 42 && Math.abs(lead) >= 22, close = slice >= 42 && Math.abs(lead) <= 12, benchWin = (slice >= 9 && slice < 17) || (slice >= 32 && slice < 40), startWin = slice < 7 || (slice >= 24 && slice < 31) || close;
			for (const x of t.pl) { const fl = x.L[13], st = x.k < 5; x.sc = fl >= 6 ? -99 : ot ? x.tgt : garbage ? -x.tgt : (x.tgt - x.min) / left + (x.isOn ? .05 : 0) + (st && startWin ? .35 : 0) + (!st && benchWin ? .3 : 0) - ((fl >= 5 && slice < 40) || (fl >= 3 && slice > 3 && slice < 24) ? 1 : 0); if (CO && fl < 6 && x.hkN >= 2 && slice - x.hk <= 2) x.sc -= .8; x.isOn = false; }
			t.on = t.pl.slice().sort((x, y) => y.sc - x.sc).slice(0, 5);
		}
		for (const x of t.on) { x.isOn = true; x.min++; }
		if (rec && prev.length) { const inn = t.on.filter((x) => !prev.includes(x)), out = prev.filter((x) => !t.on.includes(x)); if (inn.length) say(t, 0, `Substitution: ${inn.map(short).join(", ")} in for ${out.map(short).join(", ")}`); }
	};
	// Fouling on purpose: late and behind, to stop the clock; otherwise to send a poor free-throw shooter to the line.
	const foulOn = (o, d) => {
		const late = lateLeft() <= 2 && d.pts < o.pts, x = late ? pickBy(o.on, "wt") : o.on.reduce((m, y) => (y.pf < m.pf ? y : m), o.on[0]), z = pickBy(d.on, "wf");
		if (!late) { x.hk = slice; x.hkN = (x.hkN || 0) + 1; }
		z.L[13]++; let m = 0; for (let k = 0; k < 2; k++) if (Math.random() < x.pf) m++; x.L[10] += 2; x.L[9] += m; if (m) score(o, d, x, m);
		say(o, m, `${short(z)} fouls ${short(x)} on purpose. ${short(x)} makes ${m} of 2`);
		if (m < 2 && Math.random() < .5) { const y = Math.random() < .13 ? pickBy(o.on, "wo") : pickBy(d.on, "wd"); y.L[1]++; if (o.on.includes(y)) y.L[11]++; }
	};
	const possession = (o, d) => {
		let tov = o.tov, q3 = o.q3, f2 = 1, f3 = 1, foulP = E.foul * o.ff, nsf = .092, stlP = o.stlP, blkP = o.blkP, lamX = 1, star = null;
		if (CO) { for (const t of [d, o]) if (t.wantTO) { t.wantTO = false; timeout(t); } if (d.c.def === "foul" || d.lateFoul) return foulOn(o, d); }
		// Each team's game plan (pace, offensive and defensive focus) applies in every game, coached or simulated.
		{
			const oc = o.c, dc = d.c;
			tov = clamp(tov + .004 * oc.pace, .05, .3); lamX *= 1 + .01 * oc.pace;
			if (oc.off === "three") { const q = Math.min(.7, q3 * 1.35 + .03), ql = clamp(.95 + 2.5 * (o.p3a / LG.p3 - 1), .82, 1.06); f3 = (q3 + (q - q3) * ql) / q; q3 = q; foulP *= .92; }
			else if (oc.off === "in") { const q = q3 * .6, ql = clamp(.96 + (o.p2a / LG.p2 - 1) - .5 * (o.blkP / E.blk - 1), .86, 1.04); f2 = 1 + (q3 - q) / (1 - q) * (ql - 1); q3 = q; foulP *= 1.2; blkP *= 1.1; }
			else if (oc.off === "star") { const s = o.pl[oc.star]; if (s && s.isOn) star = s; }
			if (dc.def === "press") { tov = clamp(tov + clamp(.024 + 1.1 * (o.tov - E.tov), .006, .06), .05, .36); stlP = Math.min(.85, stlP * 1.15); nsf += .05; foulP *= 1.08; lamX *= 1.012; }
			else if (dc.def === "pack") { q3 = Math.min(.72, q3 * 1.25 + .02); f2 *= .97; f3 *= clamp(1.02 + 2 * (o.p3a / LG.p3 - 1), .97, 1.1); }
			if (CO) lamX *= 1 + K_MARGIN * DRIFT * (o.dl - d.dl) / (2 * gp) / (.85 * base) + (o.run >= 8 ? .025 : 0);
		}
		// Late in a close game the ball goes to the players who look for their own shot.
		const clutch = slice >= 45 && lateLeft() <= 3 && Math.abs(o.pts - d.pts) <= 6;
		if (Math.random() < tov) { const x = star && Math.random() < .3 ? star : pickBy(o.on, "wt"); x.L[12]++; if (Math.random() < stlP) { const z = pickBy(d.on, "ws"); z.L[3]++; say(d, 0, `${short(z)} steals it from ${short(x)}`); } else say(o, 0, `${short(x)} ${one(["throws it away", "is called for traveling", "loses it out of bounds", "is whistled for an offensive foul"])}`); return; }
		if (Math.random() < nsf) { const z = pickBy(d.on, "wf"); z.L[13]++; say(d, 0, `Foul on ${short(z)}`); }
		const lam = o.lam * lamX * clamp(1 - BAND * (o.pts - d.pts), .8, 1.2);
		for (let c = 0; c < 5; c++) {
			if (Math.random() < foulP) { const x = star && Math.random() < .45 ? star : pickBy(o.on, "wfd"), z = pickBy(d.on, "wf"); let m = 0; z.L[13]++; for (let k = 0; k < 2; k++) if (Math.random() < x.pf) m++; x.L[10] += 2; x.L[9] += m; if (m) score(o, d, x, m); say(o, m, `${short(x)} ${one(["drives and is fouled by", "is fouled by", "draws a foul on"])} ${short(z)} and makes ${m} of 2`); if (m < 2 && Math.random() < .5) { const y = Math.random() < .13 ? pickBy(o.on, "wo") : pickBy(d.on, "wd"); y.L[1]++; if (o.on.includes(y)) y.L[11]++; } return; }
			const three = Math.random() < q3, x = star ? pickStar(o.on, three ? "w3" : "w2", star) : clutch ? pickW(o.on, (y) => (three ? y.w3 : y.w2) * y.uf * y.uf) : pickBy(o.on, three ? "w3" : "w2"); x.L[7]++; if (three) x.L[8]++;
			if (Math.random() < clamp((three ? x.p3 * f3 : x.p2 * f2) * (x === star ? .975 : 1) * lam, .05, .95)) {
				x.L[6]++; if (three) x.L[5]++; score(o, d, x, three ? 3 : 2); const y = Math.random() < (three ? .74 : .57) ? pickBy(o.on, "wa", x) : null; if (y) y.L[2]++; let and1 = ""; if (!three && Math.random() < .065) { const z = pickBy(d.on, "wf"); z.L[13]++; x.L[10]++; and1 = " and is fouled. He misses the free throw"; if (Math.random() < x.pf) { x.L[9]++; score(o, d, x, 1); and1 = " and is fouled. He makes the free throw"; } }
				say(o, three ? 3 : 2, `${short(x)} ${three ? one(["buries a three", "hits from deep", "knocks down a three"]) : one(["hits a jumper", "scores inside", "lays it in", "finishes at the rim", "drops in a floater"])}${y ? ` (assist ${short(y)})` : ""}${and1}`); return;
			}
			const b = !three && Math.random() < blkP ? pickBy(d.on, "wb") : null; if (b) b.L[4]++;
			if (Math.random() < o.orbP) { const y = pickBy(o.on, "wo"); y.L[1]++; y.L[11]++; say(o, 0, `${short(x)} ${b ? "is blocked by " + short(b) : three ? "misses from three" : "misses"}. Offensive rebound ${short(y)}`); continue; }
			const y = Math.random() < .91 ? pickBy(d.on, "wd") : null; if (y) y.L[1]++; say(o, 0, `${short(x)} ${b ? "is blocked by " + short(b) : three ? "misses from three" : one(["misses a jumper", "cannot finish inside", "misses in the lane"])}. ${y ? "Rebound " + short(y) : "Out of bounds, " + d.ab + " ball"}`); return;
		}
	};
	// Play one minute.
	const step = () => {
		const lead = T[0].pts - T[1].pts; clock = slice * 60;
		if (slice === 12 || slice === 24 || slice === 36) mark(["End of the first quarter", "Halftime", "End of the third quarter"][slice / 12 - 1]); else if (slice >= 48 && (slice - 48) % 5 === 0) mark("Tied after " + (slice === 48 ? "regulation" : "overtime") + ". Five more minutes");
		if (CO) {
			const rest = slice === 24 ? .15 : slice === 12 || slice === 36 || (slice >= 48 && (slice - 48) % 5 === 0) ? .05 : 0; if (rest) for (const t of T) for (const x of t.pl) x.en = Math.min(1, x.en + rest);
			for (const t of T) if (t.i !== userSide) { const behind = T[1 - t.i].pts - t.pts; t.lateFoul = lateLeft() === 1 && behind >= 3 && behind <= 9; }
		}
		lineup(T[0], lead); lineup(T[1], -lead);
		if (CO) {
			for (const t of T) for (const x of t.pl) x.en = x.isOn ? Math.max(0, x.en - .018 * (1.3 - .6 * clamp((x.p.r[5] - 25) / 74, 0, 1)) * (1 + .075 * (T[0].c.pace + T[1].c.pace)) * (t.c.def === "press" ? 1.25 : 1) * (t.c.off === "star" && t.pl[t.c.star] === x ? 1.15 : 1)) : Math.min(1, x.en + .045);
			for (const t of T) t.dl = netNow(t) - t.nAvg;
		}
		let k; if (CO) { const g2 = gp * (1 + PF * (T[0].c.pace + T[1].c.pace)) / 48; k = Math.floor(acc + g2) - Math.floor(acc); acc += g2; if (T.some((t) => (t.c.def === "foul" || t.lateFoul) && lateLeft() <= 2 && t.pts < T[1 - t.i].pts)) k = Math.round(k * 1.5); } else k = Math.floor((slice + 1) * gpp / 48) - Math.floor(slice * gpp / 48);
		for (let j = 0; j < k; j++) for (const o of (slice + j) % 2 ? [1, 0] : [0, 1]) { clock = Math.floor((slice + (j * 2 + (o ? 1.5 : .5)) / (k * 2)) * 60); possession(T[o], T[1 - o]); }
		slice++;
	};
	const done = () => slice >= 48 && (slice - 48) % 5 === 0 && T[0].pts !== T[1].pts;
	// Write the players' stats and return the result. Safe to call once the game is done; later calls return the same result.
	const finish = () => {
		if (fin) return fin;
		const lines = T.map((t) => t.pl.map((x) => { const p = x.p, s = p.s; if (x.min > 0) { s[0]++; s[1] += x.min; for (let k = 0; k < 15; k++) s[k + 2] += x.L[k]; if (G.rec) for (let k = 0; k < 6; k++) { const r = G.rec.g[k]; if (!r || x.L[k] > r[0]) G.rec.g[k] = [x.L[k], p.n, t.ab, G.season]; } } return [p.n, x.min, ...x.L, p.id]; }));
		fin = { hs: T[0].pts, as: T[1].pts, bh: lines[0], ba: lines[1], qh: T[0].q, qa: T[1].q, ev: rec, coached: CO, pl: T.map((t) => ({ pace: t.c.pace, off: t.c.off, sn: t.c.off === "star" && t.pl[t.c.star] ? t.pl[t.c.star].p.n : null, def: t.c.def === "foul" ? "norm" : t.c.def })) }; return fin;
	};
	return { T, ev: rec, step, done, finish, timeout: (i) => timeout(T[i]), lateLeft, get slice() { return slice; } };
}
function playPoss(h, a, ctx, userSide) { const g = makeGame(h, a, ctx, userSide, { rec: userSide >= 0 && UI.record }); while (!g.done()) g.step(); return g.finish(); }
/* ---------- coaching a game ----------
   The user's game for the day is played one minute at a time while the user changes lineups and tactics. When it ends,
   the result waits in COACH and the normal day (or playoff day) is played; simGame picks up the finished game from there. */
let COACH = null;
function coachMatch(po) {
	if (po) {
		const s = G.po && G.po.series.find((x) => (x.a === G.userTid || x.b === G.userTid) && x.wa < (x.n || 4) && x.wb < (x.n || 4)); if (!s) return null;
		const g = s.wa + s.wb, need = s.n || 4, hi = pct(team(s.a)) >= pct(team(s.b)) ? s.a : s.b, lo = hi === s.a ? s.b : s.a, h = (need === 2 ? [0, 2] : [0, 1, 4, 6]).includes(g) ? hi : lo;
		return [h, h === hi ? lo : hi];
	}
	return G.phase === "regular" ? (G.sched[G.day] || []).find((x) => x.includes(G.userTid)) || null : null;
}
// Where each team ranks in the league on the things the tactics play on.
function scoutRanks(ctx) {
	const rows = ctx.rots.map((rt) => { let s3 = 0, a3 = 0, s2 = 0, a2 = 0, rim = 0, sec = 0, dr = 0, stl = 0; for (const x of rt) { s3 += x.m * x.f.w3; a3 += x.m * x.f.w3 * x.f.p3; s2 += x.m * x.f.w2; a2 += x.m * x.f.w2 * x.f.p2; rim += x.m * x.f.wb; sec += x.m * x.f.wt; dr += x.m * (x.f.wfd || 0); stl += x.m * x.f.ws; } return { three: a3 / s3, ins: a2 / s2, rim, sec: -sec, drive: dr, stl }; });
	return (tid) => Object.fromEntries(["three", "ins", "rim", "sec", "drive", "stl"].map((k) => [k, 1 + rows.filter((r) => r[k] > rows[tid][k]).length]));
}
/* ---------- team strategy ----------
   Every team has a plan for each game: pace, offensive focus, defensive focus and how deep the rotation goes.
   Other teams' coaches play at their team's usual pace (taken from the real team's pace) and adjust offense and
   defense to the opponent. The user can leave any setting to the coach ("auto") or fix it. */
const STRAT0 = { pace: "auto", off: "auto", star: null, def: "auto", rot: "auto" };
const stratOf = (t) => Object.assign({}, STRAT0, t.tid === G.userTid ? t.st || {} : {});
const PACEL = { "-1": "slow", 0: "normal", 1: "fast" }, OFFL = { bal: "balanced", in: "attack the rim", three: "shoot threes", star: "feature one player" }, DEFL = { norm: "normal", press: "pressure the ball", pack: "pack the paint" }, ROTL = { tight: "tight", norm: "normal", deep: "deep" };
// What the coach would choose against this opponent, with the reason.
function autoPlan(tid, opp, ctx) {
	const n = G.teams.length, me = ctx.rk(tid), them = ctx.rk(opp), top = (r) => r <= Math.ceil(n / 3), half = (r) => r <= n / 2, low = (r) => r > n * .75;
	// Coaches only change their plan for a clear edge: a weak spot in the opponent that their own players can attack.
	const off = (top(me.ins) || top(me.drive)) && low(them.rim) ? ["in", `their rim protection ranks ${ORD(them.rim)}`] : me.three <= n / 4 && top(them.rim) ? ["three", `their shot blockers rank ${ORD(them.rim)} and your shooters ${ORD(me.three)}`] : ["bal", "no clear edge to exploit"];
	const def = low(them.sec) && half(me.stl) ? ["press", `their ball security ranks ${ORD(them.sec)} and your steals ${ORD(me.stl)}`] : low(them.three) ? ["pack", `their three-point shooting ranks ${ORD(them.three)}`] : ["norm", "no clear weakness to target"];
	return { off, def };
}
function planFor(tid, opp, ctx) {
	const t = team(tid), st = stratOf(t), a = autoPlan(tid, opp, ctx);
	return { pace: st.pace === "auto" ? (tid === G.userTid ? paceStep(t.pv || 0) : t.pv || 0) : +st.pace, off: st.off === "auto" ? a.off[0] : st.off, star: st.star, def: st.def === "auto" ? a.def[0] : st.def };
}
const rotOf = (t) => { const st = stratOf(t); return st.rot === "auto" ? (G.phase === "playoffs" ? "tight" : "norm") : st.rot; };
const paceStep = (v) => (v >= .4 ? 1 : v <= -.4 ? -1 : 0);
const andJoin = (a) => (a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1]);
// A game plan in words: "push the pace and pack the paint" (past: "pushed the pace and packed the paint").
const planText = (c, past) => { const P = (now, was) => (past ? was : now), out = [];
	if (c.pace >= .4) out.push(P("push the pace", "pushed the pace")); else if (c.pace <= -.4) out.push(P("slow it down", "slowed it down"));
	if (c.off === "in") out.push(P("attack the rim", "attacked the rim")); else if (c.off === "three") out.push(P("shoot more threes", "shot more threes")); else if (c.off === "star") out.push(P("run the offense through ", "ran the offense through ") + (c.sn || "one player"));
	if (c.def === "press") out.push(P("pressure the ball", "pressured the ball")); else if (c.def === "pack") out.push(P("pack the paint", "packed the paint"));
	return out.length ? andJoin(out) : P("play their usual game", "played their usual game"); };
// Words for a team's identity, used on team pages.
function identity(tid, ctx) {
	const t = team(tid), r = ctx.rk(tid), n = G.teams.length, bits = [], hi = (x) => x <= Math.ceil(n / 4), lo = (x) => x > n * 3 / 4;
	if (hi(r.three)) bits.push(`shoots threes well (${ORD(r.three)})`); else if (lo(r.three)) bits.push(`struggles from three (${ORD(r.three)})`);
	if (hi(r.drive)) bits.push(`gets to the line a lot (${ORD(r.drive)})`);
	if (hi(r.rim)) bits.push(`protects the rim (${ORD(r.rim)})`); else if (lo(r.rim)) bits.push(`weak at the rim (${ORD(r.rim)})`);
	if (lo(r.sec)) bits.push(`turns it over a lot (${ORD(r.sec)})`);
	const pace = paceStep(t.pv || 0);
	return `Plays at a ${PACEL[pace]} pace${bits.length ? "; " + bits.join(", ") : ""}.`;
}
function stratHtml() {
	const t = team(G.userTid), st = stratOf(t), ctx = dayCtx(), opp = nextOpp(), ap = opp != null ? autoPlan(G.userTid, opp, ctx) : null, me = ctx.rk(G.userTid), n = G.teams.length;
	const ch = (k, v, l) => `<button class="chip" aria-pressed="${String(st[k]) === String(v)}" data-a="stset" data-k="${k}" data-v="${v}">${l}</button>`;
	const ros = ctx.rots[G.userTid].map((x) => x.p);
	return `<h2 class="d">Team strategy</h2>
	<p class="note">This is how your team plays in every game you simulate, and where coached games start. "Coach decides" lets your coach set it for each opponent.</p>
	<p class="note"><b>Your team:</b> ${esc(identity(G.userTid, ctx).replace(/^Plays/, "plays"))} Ranks: three-point shooting ${ORD(me.three)}, inside scoring ${ORD(me.ins)}, getting to the line ${ORD(me.drive)}, rim protection ${ORD(me.rim)}, ball security ${ORD(me.sec)} (of ${n}).</p>
	<h2 class="d" style="font-size:22px">Pace</h2><div class="chips">${ch("pace", "auto", `Coach decides (${PACEL[paceStep(t.pv || 0)]})`)}${ch("pace", -1, "Slow")}${ch("pace", 0, "Normal")}${ch("pace", 1, "Fast")}</div><p class="note">Slower games mean fewer possessions, which helps a weaker team stay close. Faster games help a better team pull away.</p>
	<h2 class="d" style="font-size:22px">Offensive focus</h2><div class="chips">${ch("off", "auto", "Coach decides")}${ch("off", "bal", "Balanced")}${ch("off", "in", "Attack the rim")}${ch("off", "three", "Shoot threes")}${ch("off", "star", "Feature one player")}</div>${st.off === "star" ? `<select id="ststar" data-a="ststar" aria-label="Player to feature">${ros.map((p) => `<option value="${p.id}" ${p.id === st.star ? "selected" : ""}>${esc(p.n)} (${p.ovr})</option>`).join("")}</select>` : ""}<p class="note">${st.off === "auto" ? (ap ? `Next game the coach would go with ${OFFL[ap.off[0]]}: ${esc(ap.off[1])}.` : "The coach picks for each opponent.") : st.off === "in" ? "More shots at the rim and more free throws; harder against good shot blockers." : st.off === "three" ? "More threes: pays off with good shooters; forced threes from poor shooters miss." : st.off === "star" ? "More shots for one player. Pays off when he is clearly your best scorer." : "Everyone takes the shots they usually take."}</p>
	<h2 class="d" style="font-size:22px">Defensive focus</h2><div class="chips">${ch("def", "auto", "Coach decides")}${ch("def", "norm", "Normal")}${ch("def", "press", "Pressure the ball")}${ch("def", "pack", "Pack the paint")}</div><p class="note">${st.def === "auto" ? (ap ? `Next game the coach would ${ap.def[0] === "norm" ? "play normal defense" : DEFL[ap.def[0]]}: ${esc(ap.def[1])}.` : "The coach picks for each opponent.") : st.def === "press" ? "Forces turnovers, more against careless teams, but gives up some easy baskets and fouls." : st.def === "pack" ? "Protects the rim but leaves more open threes, which good shooting teams punish." : "No special scheme."}</p>
	<h2 class="d" style="font-size:22px">Rotation</h2><div class="chips">${ch("rot", "auto", "Coach decides (tight in the playoffs)")}${ch("rot", "tight", "Tight")}${ch("rot", "norm", "Normal")}${ch("rot", "deep", "Deep")}</div><p class="note">${rotOf(t) === "tight" ? "Starters play about 3 more minutes a game. Your best players are on the floor more, but they tire and get hurt more often." : rotOf(t) === "deep" ? "Starters rest about 3 more minutes a game. Fresher legs and fewer injuries, but more time for your bench." : "The usual split between starters and bench."}</p>
	<button class="btn alt" data-a="stset" data-k="reset" data-v="1">Let the coach decide everything</button>`;
}
// One line for the roster page: what the user's team will do.
function stratSummary() {
	const st = stratOf(team(G.userTid)), bits = [];
	bits.push(st.pace === "auto" ? "coach sets the pace" : PACEL[st.pace] + " pace");
	bits.push(st.off === "auto" ? "coach picks the offense" : st.off === "star" ? `feature ${(byId(st.star) || { n: "one player" }).n}` : OFFL[st.off]);
	bits.push(st.def === "auto" ? "coach picks the defense" : st.def === "norm" ? "normal defense" : DEFL[st.def]);
	if (st.rot !== "auto") bits.push(ROTL[st.rot] + " rotation");
	return bits.join(", ");
}
// The user's next opponent, if there is a game coming.
function nextOpp() {
	if (G.phase === "regular") for (let d = G.day; d < G.sched.length; d++) { const g = G.sched[d].find((x) => x.includes(G.userTid)); if (g) return g[0] === G.userTid ? g[1] : g[0]; }
	if (G.phase === "playoffs" && G.po) { const s = G.po.series.find((x) => (x.a === G.userTid || x.b === G.userTid) && x.wa < (x.n || 4) && x.wb < (x.n || 4)); if (s) return s.a === G.userTid ? s.b : s.a; }
	return null;
}
/* ---------- player styles ----------
   Words for how a player plays, from his tendencies compared with the rest of the league this season. */
let STY = null;
function styleRanks() {
	const key = G.season + ":" + G.phase + ":" + G.day; if (STY && STY.key === key) return STY;
	const ps = G.players.filter((p) => p.tid >= 0), ks = [0, 1, 2, 3, 4, 13, 14, 15, 16], q = {};
	for (const k of ks) { const v = ps.map((p) => p.r[k] || 0).sort((a, b) => a - b); q[k] = (x) => { let lo = 0, hi = v.length; while (lo < hi) { const m = (lo + hi) >> 1; if (v[m] < x) lo = m + 1; else hi = m; } return lo / Math.max(1, v.length); }; }
	return (STY = { key, q });
}
function styleOf(p) {
	if (!p.r || p.r.length < 17) return [];
	const q = styleRanks().q, P = (k) => q[k](p.r[k]), r = p.r, big = p.pos.includes("C") || (p.pos === "PF" && P(1) < .5), guard = p.pos.includes("G"), out = [];
	const fta = Math.max(0, (r[15] - 25) / 6), plays = (r[16] - 25) / 2.96 + 5, t3 = Math.max(0, (r[1] - 25) / 19), ast = Math.max(0, (r[2] - 25) / 6.3), reb = Math.max(0, (r[3] - 25) / 4.7), blk = Math.max(0, (r[13] - 25) / 20), stl = Math.max(0, (r[14] - 25) / 30), per = (x, w) => `${f1(x)} ${w} per 36 minutes`;
	const add = (s, l, why) => out.push([s, l, why]);
	const pl36 = `about ${f1(plays)} plays per 36 minutes (shots, trips to the line and turnovers)`;
	if (P(16) >= .86 && P(0) >= .88) add(P(16) + .05, p.ovr >= 80 ? "Go-to scorer" : "Volume scorer", `the offense runs through him, ${pl36}`);
	else if (P(16) >= .7 && P(16) - P(0) >= .2) add(P(16) - .1, "Volume shooter", `shoots more than his scoring would suggest, ${pl36}`);
	if (P(15) >= .85) add(P(15), big ? "Post scorer" : "Slasher", `${big ? "scores close to the basket and draws fouls" : "attacks the rim and draws fouls"}, ${per(fta, "free throws")}`);
	if (P(1) >= .85) add(P(1), big ? "Stretch big" : P(16) >= .8 ? "Shooter" : "Three-point specialist", per(t3, "made threes"));
	if (P(16) >= .55 && P(1) <= .35 && P(15) <= .5 && !big) add(.8, "Mid-range shooter", "takes plenty of shots, few of them threes or at the line");
	if (P(2) >= .85) add(P(2), guard ? "Playmaker" : big ? "Passing big" : "Point forward", per(ast, "assists"));
	if (P(3) >= .88) add(P(3), "Glass cleaner", per(reb, "rebounds"));
	if (P(13) >= .88) add(P(13), "Rim protector", per(blk, "blocks"));
	if (P(4) >= .93 && !big) add(P(4), "Perimeter stopper", "one of the better defenders at his position");
	else if (P(14) >= .88) add(P(14), "Ball hawk", per(stl, "steals"));
	if (P(16) <= .3 && (P(4) >= .6 || P(3) >= .7 || P(13) >= .7)) add(.75, "Defense first", "rarely shoots and does the dirty work");
	return out.sort((a, b) => b[0] - a[0]).slice(0, 3).map((x) => [x[1], x[2]]);
}
function scoutNotes(C) {
	const n = G.teams.length, us = C.rk.us, th = C.rk.them, weak = (r) => r > n * 2 / 3, strong = (r) => r <= n / 3, out = [], they = team(C.side ? C.h : C.a).name;
	out.push(`Three-point shooting: you rank ${ORD(us.three)}, the ${they} ${ORD(th.three)}.${weak(th.three) ? " Packing the paint dares them to shoot from outside." : strong(th.three) ? " Packing the paint against them is risky." : ""}${strong(us.three) ? " Your shooters can take more threes." : weak(us.three) ? " Forcing threes will not suit your shooters." : ""}`);
	out.push(`Rim protection: they rank ${ORD(th.rim)}.${weak(th.rim) ? " Attacking inside should work." : strong(th.rim) ? " Their shot blockers make inside shots harder." : ""} Inside scoring: you rank ${ORD(us.ins)}.`);
	out.push(`Ball security: they rank ${ORD(th.sec)}.${weak(th.sec) ? " Pressure should force turnovers." : strong(th.sec) ? " Pressure is unlikely to rattle them." : ""}`);
	const opp = C.game.T[1 - C.side], w = opp.pl.slice(0, 8).reduce((m, y) => (y.pf < m.pf ? y : m), opp.pl[0]);
	if (w && w.pf < .6) out.push(`${w.p.n} makes about ${Math.round(w.pf * 100)}% of his free throws. Fouling him on purpose can pay off for short stretches while he is on the floor.`);
	return out;
}
function startCoach(po) {
	const bad = rosterProblem(); if (bad) return toast(bad);
	const m = coachMatch(po); if (!m) return toast("You have no game to coach right now.");
	stopLive(); stopCoach();
	const [h, a] = m, ctx = dayCtx(), side = h === G.userTid ? 0 : 1, game = makeGame(h, a, ctx, side, { rec: true, coach: true }), us = game.T[side], rk = scoutRanks(ctx);
	us.c.pace = paceStep(us.c.pace);
	UI.coach = { game, h, a, po: !!po, side, shown: 0, paused: true, started: false, fast: false, tab: "tac", sel: null, p: {}, runP: false, done: false, timer: 0, rk: { us: rk(G.userTid), them: rk(side ? h : a) }, msg: "Set your tactics, then tap Start. You can change anything during the game; changes take effect from the next minute." };
	UI.coach.notes = scoutNotes(UI.coach); { const th = game.T[1 - side]; UI.coach.notes.unshift(`Your starting plan comes from Team strategy: ${planText({ ...us.c, sn: us.pl[us.c.star] && us.pl[us.c.star].p.n }).replace("play their", "play your")}. The ${team(th.tid).name} plan to ${planText({ ...th.c, sn: th.pl[th.c.star] && th.pl[th.c.star].p.n })}.`); }
	UI.sheet = { k: "coach" }; UI.toast = ""; UI.keepScroll = false; render();
}
function stopCoach() { const C = UI.coach; if (C && C.timer) { clearInterval(C.timer); C.timer = 0; } }
function coachRun() { const C = UI.coach; stopCoach(); if (C && !C.done && !C.paused) C.timer = setInterval(coachTick, C.fast ? 110 : 650); }
function coachFlush() { const C = UI.coach; if (C) C.shown = C.game.ev.length; }
// Checked between minutes, once the plays on screen have caught up: a reason to stop and let the user think, or "".
function coachCheck() {
	const C = UI.coach, g = C.game, sl = g.slice, us = g.T[C.side], th = g.T[1 - C.side];
	if (g.done()) return "end";
	if (th.run < 8) C.runP = false;
	if (sl > 0 && !C.p[sl] && (sl === 12 || sl === 24 || sl === 36 || (sl >= 48 && (sl - 48) % 5 === 0))) { C.p[sl] = 1; return sl === 12 ? "End of the first quarter." : sl === 24 ? "Halftime." : sl === 36 ? "End of the third quarter." : "Overtime: five more minutes."; }
	if (!C.p.two && sl === 46 && Math.abs(us.pts - th.pts) <= 8) { C.p.two = 1; return `Two minutes left, ${us.pts > th.pts ? "up" : us.pts < th.pts ? "down" : "tied"}${us.pts !== th.pts ? " " + Math.abs(us.pts - th.pts) : ""}.${us.pts < th.pts ? " Fouling on purpose stops the clock when you are behind." : ""}`; }
	if (th.run >= 8 && !C.runP) { C.runP = true; return `The ${team(th.tid).name} are on a ${th.run}–0 run.${us.to ? " A timeout would stop it and rest your players a little." : ""}`; }
	if (!us.c.auto) { const x = us.on.find((y) => y.L[13] === 5 && !C.p["f" + y.k]); if (x) { C.p["f" + x.k] = 1; return `${x.p.n} has five fouls. One more and he is out.`; } }
	return "";
}
function coachTick() {
	const C = UI.coach; if (!C || !UI.sheet || UI.sheet.k !== "coach") return stopCoach();
	if (C.paused || C.done) return stopCoach();
	const g = C.game;
	if (C.shown >= g.ev.length) {
		const why = coachCheck(); if (why === "end") return endCoach();
		if (why) { C.paused = true; C.msg = why + " Make any changes, then tap Resume."; stopCoach(); UI.keepScroll = true; return render(); }
		g.step(); if (C.shown >= g.ev.length) return;
	}
	coachPaint(g.ev[C.shown++]);
}
function coachPaint(e) {
	const C = UI.coach, sc = $("#cscore"); if (sc) sc.innerHTML = coachScore();
	if (C.tab === "plays") { const f = $("#cfeed"); if (f) { if (C.shown === 1) f.innerHTML = ""; f.insertAdjacentHTML("afterbegin", liveRow(e)); while (f.children.length > 40) f.lastChild.remove(); } }
	else if (C.tab !== "tac") { const p = $("#cpanel"); if (p) p.innerHTML = coachPanel(); }
}
// The game is over: hand it to the normal day so it is recorded like any other game.
function endCoach() {
	const C = UI.coach; stopCoach(); if (!C || C.done) return;
	C.done = true; coachFlush(); COACH = { h: C.h, a: C.a, game: C.game }; const n = G.log.length;
	if (C.po) playPlayoffs("day"); else playDays(1, true);
	COACH = null; C.final = G.log.length > n ? G.log.length - 1 : null; C.msg = "";
	UI.sheet = { k: "coach" }; UI.keepScroll = true; render();
}
function coachSim() { const C = UI.coach; if (!C || C.done) return; const g = C.game, us = g.T[C.side]; if (!us.c.auto) us.c.auto = true; if (us.c.def === "foul") us.c.def = "norm"; while (!g.done()) g.step(); endCoach(); }
function coachScore() {
	const C = UI.coach, g = C.game, e = C.shown ? g.ev[C.shown - 1] : null, s = e ? e.s : [0, 0], t = e ? e.t : 0, us = g.T[C.side], th = g.T[1 - C.side];
	const ot = t >= 2880, q = Math.min(4, 1 + Math.floor(t / 720)), left = ot ? 300 - ((t - 2880) % 300) : 720 - (t % 720), run = th.run >= 6 ? `${esc(th.ab)} on a ${th.run}–0 run` : us.run >= 6 ? `You are on a ${us.run}–0 run` : "";
	return `<div class="kv"><div><b>${s[0]}</b><span>${esc(us.ab)}${C.side === 0 ? " · home" : ""}</span></div><div><b>${s[1]}</b><span>${esc(th.ab)}${C.side === 1 ? " · home" : ""}</span></div><div><b>${C.done ? "Final" : ot ? "OT" : "Q" + q}</b><span>${C.done ? (s[0] > s[1] ? "You win" : "You lose") : Math.floor(left / 60) + ":" + String(left % 60).padStart(2, "0") + " left"}</span></div></div>${C.done ? "" : `<p class="note">Timeouts: you ${us.to}, them ${th.to}${run ? " · " + run : ""}</p>`}`;
}
function tacticNote(c, worst, late) {
	const out = [];
	if (c.pace < 0) out.push("Slowing down means fewer possessions, which helps the weaker team keep it close."); else if (c.pace > 0) out.push("Pushing the pace means more possessions, which helps the better team pull away, and tires everyone faster.");
	if (c.off === "three") out.push("More threes: pays off with good shooters; poor shooters miss more of the extra ones."); else if (c.off === "in") out.push("More shots at the rim and more free throws; harder against good shot blockers."); else if (c.off === "star") out.push("More shots for one player. He tires faster and is a little less efficient on the extra shots, so it pays off when he is clearly your best scorer.");
	if (c.def === "press") out.push("Pressure forces turnovers, more so against careless teams, but gives up some easy baskets and fouls and tires your players."); else if (c.def === "pack") out.push("Packing the paint protects the rim but leaves more open threes, which good shooting teams punish."); else if (c.def === "foul") out.push(late ? "Fouling right away stops the clock: they shoot free throws and you get the ball back sooner." : worst ? `Fouling ${worst.p.n} (about ${Math.round(worst.pf * 100)}% at the line) whenever his team has the ball. Every foul counts against your players; leave it on for long and they will foul out.` : "Fouling their worst free-throw shooter on the floor whenever they have the ball.");
	return out.length ? out.join(" ") : "Balanced play. Change anything at any time.";
}
function coachPanel() {
	const C = UI.coach, g = C.game, us = g.T[C.side], th = g.T[1 - C.side], c = us.c;
	if (C.tab === "plays") return `<div class="list" id="cfeed">${g.ev.slice(Math.max(0, C.shown - 40), C.shown).reverse().map(liveRow).join("") || '<div class="mute">No plays yet.</div>'}</div>`;
	if (C.tab === "box") {
		const e = C.shown ? g.ev[C.shown - 1] : null; if (!e) return '<p class="mute">No plays yet.</p>';
		return [us, th].map((t, i) => `<h2 class="d">${esc(team(t.tid).name)} ${e.s[i]}</h2><div class="scroll"><table><tr><th>Player</th><th>Min</th><th>Pts</th><th>Reb</th><th>Ast</th><th>PF</th></tr>${e.bx[i].map((r, k) => `<tr><td><span class="nm">${r[0] ? "● " : ""}${esc(t.pl[k].p.n)}</span></td><td>${r[1]}</td><td><b>${r[2]}</b></td><td>${r[3]}</td><td>${r[4]}</td><td class="${r[5] >= 5 ? "bad" : ""}">${r[5]}</td></tr>`).join("")}</table></div>`).join("") + '<p class="note">● on the floor.</p>';
	}
	if (C.tab === "line") {
		const on = !c.auto && us.lock ? us.lock : us.on, sel = C.sel != null ? us.pl[C.sel] : null;
		return `<div class="chips"><button class="chip" aria-pressed="${c.auto}" data-a="cauto">Coach handles subs</button></div><p class="note">${sel ? `<b>${esc(sel.p.n)} selected.</b> Now tap ${on.includes(sel) ? "a bench player to bring in for him" : "the player he replaces"}.` : `Tap a player on the floor, then one on the bench, to swap them.${c.auto ? " Doing so takes over subs from the coach." : " You are making the subs; fouled-out players are replaced for you."} Tired players play worse.`}</p><div class="scroll"><table><tr><th>Player</th><th>Ovr</th><th>Min</th><th>Pts</th><th>PF</th><th>Energy</th></tr>${us.pl.map((x) => `<tr data-a="csel" data-k="${x.k}" class="${sel === x ? "me" : ""}" style="cursor:pointer"><td><span class="nm">${on.includes(x) ? "● " : ""}${esc(x.p.n)}</span><span class="sub">${esc(x.p.pos)}${x.L[13] >= 6 ? " · fouled out" : ""}</span></td><td>${x.p.ovr}</td><td>${x.min}</td><td>${x.L[0]}</td><td class="${x.L[13] >= 5 ? "bad" : ""}">${x.L[13]}</td><td><div class="bar" style="min-width:64px"><i style="width:${Math.round(x.en * 100)}%${x.en < .55 ? ";background:var(--bad)" : ""}"></i></div></td></tr>`).join("")}</table></div><p class="note">● on the floor. Their five: ${th.on.map((x) => esc(x.p.n)).join(", ") || "not set yet"}.</p>`;
	}
	const chip = (k, v, l) => `<button class="chip" aria-pressed="${c[k] === v}" data-a="cset" data-k="${k}" data-v="${v}">${l}</button>`, worst = th.on.length ? th.on.reduce((m, y) => (y.pf < m.pf ? y : m), th.on[0]) : null, late = g.slice >= 46 && g.lateLeft() <= 2 && us.pts < th.pts;
	return `<p class="note"><b>Pace</b></p><div class="chips">${chip("pace", -1, "Slow it down")}${chip("pace", 0, "Normal")}${chip("pace", 1, "Push the pace")}</div>
	<p class="note"><b>Offense</b></p><div class="chips">${chip("off", "bal", "Balanced")}${chip("off", "in", "Attack inside")}${chip("off", "three", "Shoot threes")}${chip("off", "star", "Run plays for one player")}</div>${c.off === "star" ? `<select id="cstar" data-a="cstar" aria-label="Player to run plays for">${us.pl.map((x) => `<option value="${x.k}" ${x.k === c.star ? "selected" : ""}>${esc(x.p.n)} (${x.p.ovr})</option>`).join("")}</select>` : ""}
	<p class="note"><b>Defense</b></p><div class="chips">${chip("def", "norm", "Normal")}${chip("def", "press", "Pressure")}${chip("def", "pack", "Pack the paint")}${chip("def", "foul", "Foul on purpose")}</div>
	<p class="note">${esc(tacticNote(c, worst, late))}</p>
	<h2 class="d" style="font-size:22px">Scouting</h2>${C.notes.map((t) => `<p class="note">${esc(t)}</p>`).join("")}`;
}
function coachHtml() {
	const C = UI.coach, g = C.game, us = g.T[C.side];
	if (C.done) return `<div id="cscore">${coachScore()}</div>${C.final != null ? `<div class="row"><button class="btn go" style="flex:1" data-a="box" data-i="${C.final}">See the box score</button></div>` : ""}`;
	return `<div id="cscore">${coachScore()}</div>${C.msg ? `<p class="note"><b>${esc(C.msg)}</b></p>` : ""}
	<div class="row"><button class="btn ${C.paused ? "go" : "alt"}" style="flex:1" data-a="cgo">${C.paused ? (C.started ? "Resume" : "Start") : "Pause"}</button><button class="btn alt" style="flex:1" data-a="cfast">${C.fast ? "Normal speed" : "Faster"}</button><button class="btn alt" style="flex:1" data-a="cto" ${us.to && C.started ? "" : "disabled"}>Timeout</button></div>
	<div class="chips">${[["tac", "Tactics"], ["line", "Lineup"], ["plays", "Plays"], ["box", "Box"]].map(([k, l]) => `<button class="chip" aria-pressed="${C.tab === k}" data-a="ctab" data-k="${k}">${l}</button>`).join("")}</div>
	<div id="cpanel">${coachPanel()}</div>`;
}
function simGame(h, a, ctx, playoff) {
	const rh = ctx.rots[h], ra = ctx.rots[a], rosters = ctx.m, mine = h === G.userTid || a === G.userTid, home = h === G.userTid, both = [...rh, ...ra];
	const swap = () => both.forEach((x) => { const p = x.p; p.ps = p.ps || Z(); [p.s, p.ps] = [p.ps, p.s]; });
	if (playoff) swap();
	const pre = COACH && COACH.h === h && COACH.a === a ? COACH.game : null; if (pre) COACH = null;
	const g = pre ? pre.finish() : playPoss(h, a, ctx, mine ? (home ? 0 : 1) : -1), hs = g.hs, as = g.as, bh = g.bh, ba = g.ba, mins = g.coached ? new Map([...bh, ...ba].map((r) => [r[17], r[1]])) : null;
	if (playoff) swap();
	const dk = playoff ? (G.po ? 1000 + (G.po.pd || 0) : 999) : G.day, gi = ((G.sc = G.sc || {})[dk] = G.sc[dk] || []).push([h, a, hs, as]) - 1;
	BX.add(dk, { h, a, hs, as, q: [g.qh, g.qa], b: [bh, ba] });
	if (mine) {
		G.log.push({ o: home ? a : h, home, us: home ? hs : as, them: home ? as : hs, pl: g.pl ? (home ? g.pl : [g.pl[1], g.pl[0]]) : null, b: home ? [bh, ba] : [ba, bh], q: home ? [g.qh, g.qa] : [g.qa, g.qh], d: dk, gi, ...(playoff ? { po: 1 } : {}) });
		const old = G.log[G.log.length - 13]; if (old) { delete old.b; delete old.q; }
		finGame(home, playoff); UI.lastEv = g.ev ? { i: G.log.length - 1, ev: g.ev, names: (home ? [bh, ba] : [ba, bh]).map((ln) => ln.map((r) => r[0])) } : null;
	}
	if (playoff) return [hs, as];
	for (const [ln, tid] of [[bh, h], [ba, a]]) for (const r of ln) { if (r[2] >= 50) news(`${r[0]} scores ${r[2]} for the ${team(tid).name}.`); else if (tid === G.userTid && r[2] >= 10 && r[3] >= 10 && r[4] >= 10) news(`${r[0]} has a triple-double: ${r[2]} points, ${r[3]} rebounds, ${r[4]} assists.`); }
	const th = team(h), ta = team(a); th.pf += hs; th.pa += as; ta.pf += as; ta.pa += hs; if (hs > as) { th.w++; ta.l++; } else { ta.w++; th.l++; }
	{ const lo = Math.min(h, a), hk = lo + "_" + Math.max(h, a), hh = (G.h2h = G.h2h || {})[hk] = G.h2h[hk] || [0, 0]; hh[(hs > as ? h : a) === lo ? 0 : 1]++; }
	for (const [tid, rt] of [[h, rh], [a, ra]]) {
		for (const p of rosters[tid]) if (p.inj > 0) p.inj--;
		for (const x of rt) if (!G.noInj && Math.random() < .0045 * opt("inj") * (mins ? 1 + Math.max(0, (mins.get(x.p.id) || 0) - 38) / 5 : clamp(1 + (x.m - (x.mn == null ? x.m : x.mn)) / 8, .7, 1.6))) { x.p.inj = Math.min(60, Math.ceil(-Math.log(Math.random()) * 9 * (tid === G.userTid ? 1.3 - .1 * G.fin.lv[1] : 1))); x.p.injN = x.p.inj > 35 ? ["broken foot", "torn knee ligament", "broken hand"][rnd(0, 2)] : INJ[rnd(0, INJ.length - 1)]; if (tid === G.userTid || x.p.ovr >= 90) news(`${x.p.n} (${team(tid).ab}) has a ${x.p.injN} and will miss about ${x.p.inj} game${x.p.inj === 1 ? "" : "s"}.`); }
	}
	return [hs, as];
}
function rosterMap() { const m = G.teams.map(() => []); for (const p of G.players) if (p.tid >= 0) m[p.tid].push(p); return m; }
function rosterProblem() { const n = roster(G.userTid).length; return n > RMAX ? `You have ${n} players. Release ${n - RMAX} to get down to ${RMAX}.` : n < RMIN ? `You have ${n} players. Sign ${RMIN - n} more to reach ${RMIN}.` : ""; }
function playDays(n, quiet) {
	const bad = rosterProblem(); if (bad) return toast(bad);
	const t = team(G.userTid), w0 = t.w, l0 = t.l, say = quiet ? () => render() : toast;
	for (let i = 0; i < n && G.day < G.sched.length; i++) { const m = dayCtx(); let pts = 0, n = 0; for (const [h, a] of G.sched[G.day]) { const r = simGame(h, a, m, false); pts += r[0] + r[1]; n += 2; } if (n) G.cal = clamp((G.cal || 1) * (1 + .1 * (lg()[0] / (pts / n) - 1)), .9, 1.1); G.day++; if (G.day % 7 === 3 && G.day < DL() && Math.random() < .3) aiTrade(); if (G.day % 7 === 5 && G.day < DL() - 2 && Math.random() < .25) aiOffer(); if (opt("deadline") && G.day === DEADLINE() - 7) news("The trade deadline is a week away."); if (opt("deadline") && G.day === DEADLINE()) { G.offers = []; news("The trade deadline has passed. Trading reopens after the playoffs."); } if (G.day === Math.floor(G.sched.length * .55)) allStar(); }
	if (G.day >= G.sched.length) { startPlayoffs(); say(`Regular season over. You finished ${t.w}–${t.l}.`); } else { const g = t.w - w0 + t.l - l0; say(g ? `${t.w - w0}–${t.l - l0} over the last ${g} game${g === 1 ? "" : "s"}.` : "No game for you today."); }
	save();
}
const pct = (t) => (t.w + t.l ? t.w / (t.w + t.l) : 0);
const standings = (cid) => G.teams.filter((t) => cid == null || t.cid === cid).sort((a, b) => pct(b) - pct(a) || (b.pf - b.pa) - (a.pf - a.pa));

/* ---------- playoffs ---------- */
function startPlayoffs() {
	const series = [], r0 = opt("pot") === 8 ? 1 : opt("pot") === 4 ? 2 : 3;
	for (const cid of [0, 1]) {
		const st = standings(cid), nT = opt("pot"); let s = st.slice(0, nT).map((t) => t.tid);
		if (nT === 8 && (opt("playin") === "on" || (opt("playin") === "auto" && (G.season >= 2021 || G.fake))) && st.length >= 10) { // play-in: 7 v 8 for the seventh seed, then the loser meets the 9 v 10 winner for the eighth
			const m = dayCtx(), game = (x, y) => { const r = simGame(x, y, m, true); return r[0] > r[1] ? [x, y] : [y, x]; }, a78 = game(st[6].tid, st[7].tid), a910 = game(st[8].tid, st[9].tid), last = game(a78[1], a910[0]);
			s = [...s.slice(0, 6), a78[0], last[0]]; news(`Play-in, ${cid ? "West" : "East"}: the ${team(a78[0]).name} take the seventh seed and the ${team(last[0]).name} the eighth.`);
		}
		if (s.length === nT) for (const [x, y] of nT === 8 ? [[0, 7], [3, 4], [2, 5], [1, 6]] : nT === 4 ? [[0, 3], [1, 2]] : [[0, 1]]) series.push({ a: s[x], b: s[y], wa: 0, wb: 0, n: NEED(r0) }); }
	G.po = { round: r0, series, seeds: series.flatMap((s) => [s.a, s.b]) }; G.phase = "playoffs";
	G.ures = G.po.seeds.includes(G.userTid) ? "" : "Missed the playoffs";
	if (!G.ures) news(`The ${team(G.userTid).name} are in the playoffs.`);
}
const ROUND = ["", "First round", "Conference semifinals", "Conference finals", "Finals"];
function playoffDay() {
	const m = dayCtx(), po = G.po; po.pd = (po.pd || 0) + 1;
	for (const s of po.series) {
		const need = s.n || 4; if (s.wa === need || s.wb === need) continue;
		const g = s.wa + s.wb, hi = pct(team(s.a)) >= pct(team(s.b)) ? s.a : s.b, lo = hi === s.a ? s.b : s.a, home = (need === 2 ? [0, 2] : [0, 1, 4, 6]).includes(g) ? hi : lo, away = home === hi ? lo : hi;
		const [hs, as] = simGame(home, away, m, true), win = hs > as ? home : away; if (win === s.a) s.wa++; else s.wb++;
		if (s.wa === need || s.wb === need) {
			const W = s.wa === need ? s.a : s.b, Lo = W === s.a ? s.b : s.a; (po.out = po.out || {})[Lo] = po.round;
			if (Lo === G.userTid) { G.ures = po.round === 4 ? "Lost in the Finals" : "Lost in the " + ROUND[po.round].toLowerCase(); news(`Season over: the ${team(W).name} beat you ${Math.max(s.wa, s.wb)}–${Math.min(s.wa, s.wb)}.`); }
			else if (W === G.userTid) news(`You beat the ${team(Lo).name} ${Math.max(s.wa, s.wb)}–${Math.min(s.wa, s.wb)} in the ${ROUND[po.round].toLowerCase()}.`);
		}
	}
	if (po.series.every((s) => s.wa === (s.n || 4) || s.wb === (s.n || 4))) {
		const w = po.series.map((s) => (s.wa === (s.n || 4) ? s.a : s.b));
		(po.done = po.done || []).push(...po.series.map((x) => ({ ...x, r: po.round })));
		if (w.length === 1) { po.series = []; return endSeason(w[0]); }
		po.round++; po.series = []; for (let i = 0; i < w.length; i += 2) po.series.push({ a: w[i], b: w[i + 1], wa: 0, wb: 0, n: NEED(po.round) });
	}
}
function playPlayoffs(mode) { const r = G.po.round; let n = 0; while (G.phase === "playoffs" && n++ < 200) { playoffDay(); if (mode === "day" || (mode === "round" && G.phase === "playoffs" && G.po.round !== r)) break; } save(); render(); }

/* ---------- offseason ---------- */
function endSeason(champ) {
	const S = G.season, ct = team(champ); if (champ === G.userTid) G.ures = "Champions";
	const el = (f) => G.players.filter((p) => p.tid >= 0 && p.s[0] > 0 && p.s[0] >= f * (team(p.tid).w + team(p.tid).l));
	const val = (p) => (p.s[2] + .7 * p.s[3] + 1.1 * p.s[4] + 1.5 * (p.s[5] + p.s[6])) / p.s[0], mv = (p) => val(p) * (.6 + pct(team(p.tid))) * (p.ovr / 90);
	const top = (ps, f) => ps.slice().sort((a, b) => f(b) - f(a)), give = (p, l) => { if (p) (p.aws = p.aws || []).push([S, l]); return p ? p.n : ""; };
	const rank = top(el(.6), mv), mvp = rank[0], dpoy = top(el(.6), (p) => (p.s[5] + 1.3 * p.s[6]) / p.s[0] * (p.r[4] / 70) * (.8 + .4 * pct(team(p.tid))))[0], roy = top(el(.4).filter((p) => p.dy === S - 1), val)[0], fmvp = top(G.players.filter((p) => p.tid === champ && p.ps && p.ps[0] > 3), (p) => (p.ps[2] + .7 * p.ps[3] + 1.1 * p.ps[4] + 1.5 * (p.ps[5] + p.ps[6])) / p.ps[0])[0] || top(G.players.filter((p) => p.tid === champ && p.s[0] > 20), (p) => val(p) * p.ovr)[0];
	const dS = (p) => (p.s[5] + 1.3 * p.s[6]) / p.s[0] * (p.r[4] / 70) * (.8 + .4 * pct(team(p.tid))), bench = new Set(G.teams.flatMap((t) => roster(t.tid).sort((a, b) => b.s[1] / (b.s[0] || 1) - a.s[1] / (a.s[0] || 1)).slice(5).map((p) => p.id))), six = top(el(.5).filter((p) => bench.has(p.id)), val)[0];
	const lastRow = (p) => p.h && p.h.length ? p.h[p.h.length - 1] : null, mip = top(el(.6).filter((p) => { const x = lastRow(p); return age(p) <= 27 && x && x[3] >= 30 && p !== mvp; }), (p) => { const x = lastRow(p); return p.s[2] / p.s[0] - x[5] / x[3] + (p.ovr - x[2]) * .5; })[0];
	if (mvp) mvp.aw++; ct.titles = (ct.titles || 0) + 1;
	const u = team(G.userTid); closeBooks();
	for (const t of G.teams) { (t.hist = t.hist || []).push([S, t.w, t.l, t.tid === champ ? 5 : ((G.po && G.po.out) || {})[t.tid] || 0]); if (t.hist.length > 60) t.hist.shift(); }
	if (G.rec) [2, 3, 4].forEach((ix, k) => { const b = top(el(.6), (p) => p.s[ix] / p.s[0])[0], r = G.rec.s[k]; if (b && (!r || b.s[ix] / b.s[0] > r[0])) G.rec.s[k] = [Math.round(b.s[ix] / b.s[0] * 10) / 10, b.n, team(b.tid).ab, S]; });
	G.history.unshift({ s: S, champ: ct.ab, mvp: give(mvp, "MVP"), line: mvp ? `${f1(mvp.s[2] / mvp.s[0])} pts, ${f1(mvp.s[3] / mvp.s[0])} reb, ${f1(mvp.s[4] / mvp.s[0])} ast` : "", rec: `${u.w}–${u.l}`, res: G.ures, dpoy: give(dpoy, "Defensive Player of the Year"), roy: give(roy, "Rookie of the Year"), fmvp: give(fmvp, "Finals MVP"), all: rank.slice(0, 5).map((p) => give(p, "All-League")), all2: rank.slice(5, 10).map((p) => give(p, "All-League 2nd team")), all3: rank.slice(10, 15).map((p) => give(p, "All-League 3rd team")), alld: top(el(.6), dS).slice(0, 5).map((p) => give(p, "All-Defensive")), allr: top(el(.4).filter((p) => p.dy === S - 1), val).slice(0, 5).map((p) => give(p, "All-Rookie")), six: give(six, "Sixth Man"), mip: give(mip, "Most Improved"), as: G.as || null });
	G.as = null; ownerReview();
	news(`${ct.region} ${ct.name} win the ${seasonName(S)} title.` + (mvp ? ` MVP: ${mvp.n} (${team(mvp.tid).ab}).` : ""));
	const gone = new Set();
	for (const p of G.players) {
		if (p.tid === -2) continue;
		if (p.ps && p.ps[0] && p.tid >= 0) { (p.hp = p.hp || []).push([S, team(p.tid).ab, ...p.ps.map(Math.round)]); if (p.hp.length > 22) p.hp.shift(); }
		p.ps = null;
		if (p.s[0] && p.tid >= 0) { (p.h = p.h || []).push([S, team(p.tid).ab, p.ovr, ...p.s.map(Math.round)]); if (p.h.length > 22) p.h.shift(); }
		p.c[0] += p.s[0]; p.c[1] += p.s[2]; p.c[2] += p.s[3]; p.c[3] += p.s[4]; p.ls = p.s; p.s = Z(); p.inj = 0;
		const a = age(p);
		const fa = p.tid === -1;
		if ((a >= 34 && (p.ovr < 60 || Math.random() < (a - 33) * .12 + (p.ovr < 66 ? .2 : 0))) || (fa && (a >= 31 || p.ovr < 60))) { gone.add(p.id); if (p.c[1] >= 17000 || p.aw || (p.aws || []).filter((x) => x[1] === "All-League").length >= 4) { G.hof.unshift({ n: p.n, y: S, gp: p.c[0], pts: p.c[1], mvp: p.aw }); if (p.mine) UI.hallFlag = true; } if (p.c[1] > 12000 || p.aw) news(`${p.n} retires at ${a} with ${p.c[1].toLocaleString()} career points${p.aw ? " and " + p.aw + " MVP award" + (p.aw > 1 ? "s" : "") : ""}.`); }
	}
	G.players = G.players.filter((p) => !gone.has(p.id)); G.order = G.order.filter((id) => !gone.has(id));
	checkAch(); if (opt("timeline")) applyTimeline(S + 1);
	startDraft();
}
// The real league's moves, renames and expansion teams arrive on schedule (through 2026).
function applyTimeline(y) {
	const snap = DATA["s" + y]; if (!snap || G.fake) return; const fresh = [];
	for (const d of snap.teams) {
		const t = G.teams.find((x) => x.fr === d[8]); if (t && t.custom) continue;
		if (!t) { const n = { tid: G.teams.length, ab: d[0], region: d[1], name: d[2], c1: d[3], c2: d[4], cid: d[5], w: 0, l: 0, pf: 0, pa: 0, titles: 0, pop: d[7] || 3, prev: .3, fr: d[8], pv: paceV(d[9]) }; G.teams.push(n); fresh.push(n); continue; }
		if (t.region !== d[1] || t.name !== d[2]) news(t.region !== d[1] ? `The ${t.region} ${t.name} are moving. From ${seasonName(y)} they are the ${d[1]} ${d[2]}.` : `The ${t.region} ${t.name} will be called the ${d[2]} from ${seasonName(y)}.`);
		t.ab = d[0]; t.region = d[1]; t.name = d[2]; t.c1 = d[3]; t.c2 = d[4]; t.cid = d[5]; t.pop = d[7] || t.pop;
	}
	if (!fresh.length) return;
	// Expansion draft: every existing team keeps its eight most valuable players. The new teams then take turns, each choice coming from a different team.
	const open = G.teams.filter((t) => !fresh.includes(t)).map((t) => roster(t.tid).sort((a, b) => asset(b) - asset(a)).slice(8)).filter((ps) => ps.length), lost = [];
	for (let r = 0; r < 13; r++) for (const n of fresh) { if (!open.length) break; open.sort((a, b) => b[0].ovr - a[0].ovr); const p = open.shift()[0]; if (p.tid === G.userTid) { lost.push(p.n); G.order = G.order.filter((id) => id !== p.id); } p.tid = n.tid; }
	for (const n of fresh) { for (let k = 0; k < 3; k++) for (const r of [1, 2]) G.picks.push({ y: G.season + k, r, o: n.tid, t: n.tid }); news(`Expansion: the ${n.region} ${n.name} join the league for ${seasonName(y)} and stock their roster from the other teams.`); }
	if (lost.length) news(`You lost ${lost.join(" and ")} in the expansion draft.`);
}
// Fantasy draft: every player goes into one pool and the teams pick thirteen rounds in snake order.
function startFantasy() {
	for (const p of G.players) if (p.tid >= -1) { p.tid = -2; p.slot = 0; delete p.ask; delete p.askY; }
	const base = shuffle(G.teams.map((t) => t.tid)), order = []; for (let r = 0; r < 13; r++) order.push(...(r % 2 ? base.slice().reverse() : base));
	G.draft = { order, orig: order, i: 0, n: 0, log: [], fantasy: true }; G.phase = "draft"; UI.moves = "draft";
	news("Fantasy draft: every player is available. Thirteen rounds, and the order reverses each round.");
}
function endFantasy() {
	for (const p of G.players) if (p.tid === -2) p.tid = -1;
	G.players = G.players.filter((p) => p.tid >= 0 || p.ovr >= 58); G.draft = null; G.phase = "regular";
	for (const p of G.players) if (p.tid === -1) setAsk(p);
	fillRosters(true); addClass(); UI.tab = "home"; news("The fantasy draft is done. The season begins.");
}
function startDraft() {
	const S = G.season; G.phase = "draft"; UI.tab = "moves"; UI.moves = "draft"; addClass();
	const seeds = new Set(G.po ? G.po.seeds : []), dp = (t) => (t.w + t.l ? pct(t) : .33), all = G.teams.slice().sort((a, b) => dp(a) - dp(b) || (a.pf - a.pa) - (b.pf - b.pa)), lot = all.filter((t) => !seeds.has(t.tid)), rest = all.filter((t) => seeds.has(t.tid));
	const top = [], pool = lot.slice();
	for (let k = 0; k < (opt("lot") === "none" ? 0 : 3) && pool.length; k++) { const w = pool.map((t) => (opt("lot") === "flat" ? 1 : Math.pow(lot.length - lot.indexOf(t), 2))); let x = Math.random() * w.reduce((a, b) => a + b, 0), i = 0; while ((x -= w[i]) > 0) i++; top.push(pool.splice(i, 1)[0]); }
	const r1 = [...top, ...pool, ...rest].map((t) => t.tid), orig = [...r1, ...all.map((t) => t.tid)], own = (o, i) => { const k = G.picks.find((x) => x.y === S && x.r === (i < r1.length ? 1 : 2) && x.o === o); return k ? k.t : o; };
	G.draft = { order: orig.map(own), orig, i: 0, n: r1.length, log: [], lot: lot.map((t, i) => [t.tid, i, r1.indexOf(t.tid), t.w, t.l]).sort((a, b) => a[2] - b[2]) };
	{ const up = G.draft.lot.filter((x) => x[2] < 3 && x[1] > x[2]).sort((a, b) => (b[1] - b[2]) - (a[1] - a[2]))[0]; if (up) news(`Draft lottery: the ${team(up[0]).name} jump from ${ORD(up[1] + 1)} to the ${ORD(up[2] + 1)} pick.`); }
	const mine = G.draft.order.indexOf(G.userTid);
	news(`Draft order set. The ${team(G.draft.order[0]).name} pick first; ${mine < 0 ? "you have no picks" : "your first pick is number " + (mine + 1)}.`);
}
const RANKS = [[1, 98], [3, 95.5], [8, 92], [15, 89.5], [30, 86], [50, 83], [80, 80], [120, 76.5], [170, 73], [230, 69.5], [300, 65.5], [380, 61], [450, 56.5], [520, 52], [700, 46]];
function rankOvr(r) { const x = Math.log(Math.max(1, r)); for (let i = 1; i < RANKS.length; i++) { const a = Math.log(RANKS[i - 1][0]), b = Math.log(RANKS[i][0]); if (x <= b) return RANKS[i - 1][1] + (RANKS[i][1] - RANKS[i - 1][1]) * (x - a) / (b - a); } return 46; }
const ord = (n) => (n % 100 > 10 && n % 100 < 14 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th");
const prospects = () => G.players.filter((p) => p.tid === -2);
function draftPick(p) {
	const d = G.draft, tid = d.order[d.i], n = d.i + 1, first = n <= d.n;
	if (d.fantasy) sign(p, tid, fair(p.ovr, age(p)), rnd(1, 4)); else { sign(p, tid, first ? Math.round((6 - 4.5 * (n - 1) / Math.max(1, d.n - 1)) * 10) / 10 : MINSAL, first ? 4 : 2); p.dy = G.season; p.fresh = G.season; }
	d.log.unshift({ n, tid, name: p.n, ovr: p.ovr, pot: p.pot }); d.i++;
	if (tid === G.userTid) { if (!d.fantasy) p.mine = 1; news(`You draft ${p.n} with pick ${n}.`); }
	if (d.i >= d.order.length || !prospects().length) endDraft();
}
function aiPick() { const ps = prospects(); let best = ps[0], bs = -1; for (const p of ps) { const v = .45 * p.ovr + .55 * p.pot + gauss() * 1.5; if (v > bs) { bs = v; best = p; } } draftPick(best); }
function simDraft(toUser) { let n = 0; while (G.phase === "draft" && n++ < 2000) { if (toUser && G.draft.order[G.draft.i] === G.userTid) break; aiPick(); } save(); render(); }
function endDraft() {
	if (G.draft && G.draft.fantasy) return endFantasy();
	G.picks = G.picks.filter((k) => k.y !== G.season);
	if (G.draft) { (G.drafts = G.drafts || []).unshift({ s: G.season, p: G.draft.log.slice().reverse().slice(0, 14).map((x) => [x.n, team(x.tid).ab, x.name]) }); G.drafts.length = Math.min(G.drafts.length, 40); }
	for (const p of prospects()) { if (p.ovr >= 58) { p.tid = -1; p.fresh = G.season; } else p.tid = -9; }
	G.players = G.players.filter((p) => p.tid !== -9); G.resign = [];
	for (const p of G.players) {
		if (p.tid === -1) { setAsk(p); continue; }
		if (p.tid < 0 || p.exp > G.season) continue;
		setAsk(p); const a = age(p) + 1;
		if (p.tid === G.userTid) G.resign.push(p.id);
		else if ((p.ovr >= 70 || (a <= 25 && p.pot >= 74)) && a < 37 && Math.random() < .85 && payroll(p.tid) - p.sal + p.ask <= (hardCap() ? opt("cap") : AIMAX() + (p.ovr >= 88 ? 15 : 0))) sign(p, p.tid, p.ask, p.askY);
		else p.tid = -1;
	}
	for (let i = 0; i < 3; i++) if (Math.random() < .5) aiTrade();
	G.phase = G.resign.length ? "resign" : "fa"; G.faDay = 0; UI.tab = "moves"; UI.moves = G.phase === "resign" ? "resign" : "fa";
}
function finishResign() { const gone = []; for (const id of G.resign) { const p = byId(id); if (p && p.tid === G.userTid && p.ask != null) { p.tid = -1; p.prevTid = G.userTid; gone.push(p.n); } } if (gone.length) news(`${gone.join(", ")} ${gone.length === 1 ? "becomes a free agent" : "become free agents"}.`); G.resign = []; G.phase = "fa"; G.faDay = 0; UI.moves = "fa"; save(); render(); }
const broke = () => G.fin && G.fin.cash < -DEBT;
// How a player feels about signing with you changes his price; a star on a losing team may refuse to stay.
function mood(p) {
	const t = team(G.userTid), prev = t.w + t.l >= 20 ? pct(t) : (t.prev == null ? .5 : t.prev), why = [], f = []; let k = 1;
	const add = (d, txt) => { k += d; why.push(txt); f.push([txt, d]); };
	if (prev >= .6) add(-.08, "likes that you win"); else if (prev < .4) add(.1, "worries that you lose");
	if (G.fin.lv[2] >= 4) add(-.03, "likes your arena"); else if (G.fin.lv[2] <= 2) add(.03, "dislikes your arena");
	if (market() >= 1.3) add(-.03, "likes the big market");
	if (p.tid === G.userTid) { const s = p.ls && p.ls[0] ? p.ls : p.s; if (p.ovr >= 75 && s[0] > 20 && s[1] / s[0] < 20) add(.08, "wanted more minutes"); else add(-.04, "is settled here"); }
	return { k, why, f, no: !G.god && p.tid === G.userTid && p.ovr >= 86 && prev < .35 && p.id % 3 !== 0 };
}
const userAsk = (p) => clamp(Math.round(p.ask * mood(p).k * 10) / 10, MINSAL, MAXSAL);
const canSign = (tid, p) => { const ask = tid === G.userTid ? userAsk(p) : p.ask; const n = roster(tid).length; return n < RMAX && ((ask <= 1.5 && (!hardCap() || n < 13)) || (capFree() && tid === G.userTid) || (payroll(tid) + ask <= opt("cap") + 1e-9 && !(tid === G.userTid && broke()))); };
// What a player asks of the user's team for a contract of y years: his price to you for the length he wants,
// and 5% more for each year away from it.
const askFor = (p, y) => clamp(Math.round(userAsk(p) * (1 + .05 * Math.abs((y || p.askY) - p.askY)) * 10) / 10, MINSAL, MAXSAL);
const capYear = () => (off() ? G.season + 1 : G.season);
// Salary the user's team owes in season y: everyone whose contract runs through y.
const committed = (y, tid = G.userTid) => roster(tid).filter((p) => (p.exp || 0) >= y).reduce((s, p) => s + p.sal, 0);
const canSignAt = (p, y) => { const a = askFor(p, y), n = roster(G.userTid).length; return G.phase !== "resign" && n < RMAX && ((a <= 1.5 && (!hardCap() || n < 13)) || capFree() || (payroll(G.userTid) + a <= opt("cap") + 1e-9 && !broke())); };
const canResignAt = (p, y) => !(hardCap() && !G.noCap && committed(capYear()) + askFor(p, y) > opt("cap") + 1e-9);
// The contract box on a player's page: what he wants, why, what it does to your cap, and the lengths you can offer.
function dealBox(p, re) {
	const m = mood(p), ask = userAsk(p), y0 = p.askY, cap = opt("cap"), cy = capYear(), pay = committed(cy), room = cap - pay, after = pay + ask, yMax = age(p) + (off() ? 1 : 0) >= 32 ? 2 : 4, tax = TAXL();
	if (re && m.no) return `<section><h2 class="d">His contract is up</h2><p class="bad"><b>He will not re-sign: he wants to play for a winner.</b></p><p class="note">He becomes a free agent when you finish re-signing.</p>${agentHtml(p, true)}</section>`;
	const pctx = (d) => (d > 0 ? "+" : "−") + Math.round(Math.abs(d) * 100) + "%", others = re ? 0 : G.teams.filter((t) => t.tid !== G.userTid && canSign(t.tid, p)).length;
	let fit;
	if (re) fit = `You may go over the cap to re-sign your own players${hardCap() && !G.noCap ? ", except under this league's hard cap" : ""}. With him, your payroll next season would be ${money(after)}: ${after <= cap ? `${money(cap - after)} under the cap, so that much room is left for free agents` : `${money(after - cap)} over the cap, so only minimum deals for free agents`}.${tax < 1e8 && after > tax ? ` That is above the luxury tax line of ${money(tax)}; you would owe about ${money(1.5 * (after - tax))} in tax.` : ""}`;
	else if (G.phase === "resign") fit = "Free agency opens once you finish re-signing your own players.";
	else if (roster(G.userTid).length >= RMAX) fit = `Your roster is full (${RMAX} players). Release or trade someone first.`;
	else if (capFree()) fit = "There is no salary cap for you in this league, so you can sign him.";
	else if (ask <= 1.5) fit = `He asks ${money(1.5)} or less, so you can sign him even over the cap.`;
	else if (broke()) fit = "You are too deep in debt, so the owner will only approve minimum deals.";
	else if (ask <= room + 1e-9) fit = `You have ${money(room)} of cap room. Signing him at ${money(ask)} leaves ${money(room - ask)}.`;
	else fit = `You have ${room > .05 ? money(room) + " of" : "no"} cap room and he wants ${money(ask)}, so you are ${money(ask - Math.max(0, room))} short. Make room by trading or releasing players with salary, or wait for his price to drop.`;
	const btn = (y) => { const a = askFor(p, y), ok = re ? canResignAt(p, y) : canSignAt(p, y); return `<button class="btn ${y === y0 ? "go" : "alt"}" style="flex:1 1 40%" data-a="${re ? "resign" : "sign"}" data-id="${p.id}" data-y="${y}" ${ok ? "" : "disabled"}>${y} yr${y > 1 ? "s" : ""} · ${money(a)}</button>`; };
	return `<section><h2 class="d">${re ? "His contract is up" : "What he wants"}</h2>
	<div class="kv"><div><b>${money(ask)}</b><span>a year</span></div><div><b>${y0} yr${y0 > 1 ? "s" : ""}</b><span>wanted</span></div><div><b>${money(ask * y0)}</b><span>in total</span></div></div>
	<div class="list"><div><span>Market value <span class="sub">what other teams would pay</span></span><b>${money(p.ask)}</b></div>${m.f.map(([t, d]) => `<div><span>He ${esc(t)}</span><b class="${d > 0 ? "bad" : "good"}">${pctx(d)}</b></div>`).join("")}<div><span><b>His price to you</b></span><b>${money(ask)}</b></div></div>
	<p class="note">${esc(fit)}${re ? "" : ` ${others ? `${others} other team${others === 1 ? " has" : "s have"} room for him right now.` : "No other team has room for him right now."}${G.phase === "fa" && p.ask > MINSAL ? " His price drops about 1.5% a day while he is unsigned." : ""}`}</p>
	<p class="note"><b>Offer a contract.</b> He wants ${y0} year${y0 > 1 ? "s" : ""}, through ${seasonName(cy + y0 - 1)}; other lengths cost 5% more for each year of difference.</p>
	<div class="row" style="flex-wrap:wrap">${[1, 2, 3, 4].slice(0, yMax).map(btn).join("")}</div>
	${agentHtml(p, re)}
	<div class="row"><button class="btn alt" style="flex:1" data-a="cap">Your cap and contracts</button></div></section>`;
}
// The user's cap sheet: payroll against the cap and tax line, the rules, every contract and future commitments.
function capHtml() {
	const cap = opt("cap"), cy = capYear(), ps = roster(G.userTid), cur = ps.filter((p) => (p.exp || 0) >= cy).sort((a, b) => b.sal - a.sal), up = ps.filter((p) => (p.exp || 0) < cy).sort((a, b) => b.ovr - a.ovr), pay = cur.reduce((s, p) => s + p.sal, 0), room = cap - pay, tax = TAXL(), hasTax = tax < 1e8;
	const scale = Math.max(hasTax ? tax * 1.08 : cap * 1.25, pay * 1.05), at = (x) => (x / scale * 100).toFixed(1) + "%";
	const rules = capFree() && !G.noCap ? "There is no salary cap in this league: you can sign anyone. Other teams still keep to a budget." : hardCap() ? `Hard cap: no team may go over ${money(cap)}, even to re-sign its own players. Minimum deals (${money(1.5)} or less) are allowed only to fill a roster to 13, and trades over the cap may not add salary.` : `You can sign any free agent whose yearly price fits in your cap room, and anyone asking ${money(1.5)} or less at any time. You may go over the cap to re-sign your own players. In a trade while over the cap, you can take back up to 125% of the salary you send out.`;
	return `<h2 class="d">Cap and payroll <small>${seasonName(cy)}</small></h2>
	<div class="kv"><div><b>${money(pay)}</b><span>payroll</span></div><div><b>${money(cap)}</b><span>salary cap</span></div><div><b class="${room < 0 ? "bad" : "good"}">${money(Math.abs(room))}</b><span>${room < 0 ? "over the cap" : "cap room"}</span></div></div>
	<div class="capbar" role="img" aria-label="Payroll ${money(pay)} against a ${money(cap)} cap${hasTax ? ` and a ${money(tax)} tax line` : ""}"><i style="width:${at(pay)}"></i><b style="left:${at(cap)}"><span>cap</span></b>${hasTax ? `<b style="left:${at(tax)}"><span>tax</span></b>` : ""}</div>
	<p class="note">${esc(rules)} ${hasTax ? `Luxury tax: payroll above ${money(tax)} costs $1.50 for every dollar over, paid after the season${pay > tax ? `; you are ${money(pay - tax)} over, about ${money(1.5 * (pay - tax))} in tax` : `; you are ${money(tax - pay)} below it`}.` : "There is no luxury tax in this league."} Roster: ${cur.length} player${cur.length === 1 ? "" : "s"} under contract, ${RMIN} to ${RMAX} allowed.</p>
	<h2 class="d" style="font-size:22px">Contracts for ${seasonName(cy)}</h2>
	<div class="list">${cur.map((p) => `<div data-a="player" data-id="${p.id}" style="cursor:pointer"><span><b>${esc(p.n)}</b><span class="sub">${esc(p.pos)} · ${p.ovr} overall · through ${seasonName(p.exp)}</span></span><b>${money(p.sal)}</b></div>`).join("") || '<div class="mute">Nobody is under contract.</div>'}</div>
	${up.length ? `<h2 class="d" style="font-size:22px">Contracts up</h2><div class="list">${up.map((p) => `<div data-a="player" data-id="${p.id}" style="cursor:pointer"><span><b>${esc(p.n)}</b><span class="sub">${p.ask != null ? (mood(p).no ? "will not re-sign" : `wants ${money(userAsk(p))} a year for ${p.askY} yr${p.askY > 1 ? "s" : ""}`) : "contract ending"}</span></span><b class="mute">${money(p.sal)}</b></div>`).join("")}</div>` : ""}
	<h2 class="d" style="font-size:22px">Future seasons</h2>
	<div class="list">${[cy + 1, cy + 2, cy + 3].map((y) => { const c = committed(y), k = ps.filter((p) => (p.exp || 0) >= y).length; return `<div><span>${seasonName(y)} <span class="sub">${k} player${k === 1 ? "" : "s"} signed</span></span><span style="text-align:right"><b>${money(c)}</b><span class="sub">${money(Math.max(0, cap - c))} room</span></span></div>`; }).join("")}</div>`;
}
// The development report: what changed for every player when ratings were updated after the last playoffs.
const progRow = (p) => (G.prog && p.dvS === G.prog.s ? G.prog.rows.find((r) => r[0] === p.id) : null);
const progBits = (r) => (r[5] || []).map(([k, d]) => `${(RLAB.find((x) => x[1] === k) || ["rating"])[0].toLowerCase()} ${d > 0 ? "+" : "−"}${Math.abs(d)}`).join(", ");
const sgn = (d) => (d > 0 ? "+" : d < 0 ? "−" : "") + Math.abs(d), progSplit = (r) => (r[7] != null && r[2] !== r[7] ? `growth ${sgn(r[7] - r[1])}, league rebalance ${sgn(r[2] - r[7])}` : "");
const dvTag = (d) => (d ? `<span class="dv ${d > 0 ? "up" : "dn"}">${d > 0 ? "+" : "−"}${Math.abs(d)}</span>` : "");
function progSummary() {
	const rs = G.prog.rows.map((r) => [r, byId(r[0])]).filter(([, p]) => p && p.tid === G.userTid); if (!rs.length) return null;
	const b = rs.reduce((a, [r]) => a + r[1], 0) / rs.length, n = rs.reduce((a, [r]) => a + r[2], 0) / rs.length, up = rs.filter(([r]) => r[2] > r[1]).length, dn = rs.filter(([r]) => r[2] < r[1]).length, srt = rs.slice().sort((x, y) => (y[0][2] - y[0][1]) - (x[0][2] - x[0][1]));
	return { b, n, up, dn, best: srt[0], worst: srt[srt.length - 1], rs };
}
function progHtml() {
	if (!G.prog) return '<h2 class="d">Player development</h2><p class="mute">Ratings change once a year, when a new season starts, after the draft and free agency. The first report comes at the start of your second season.</p>';
	const f = UI.progF || "mine", all = G.prog.rows.map((r) => [r, byId(r[0])]).filter(([, p]) => p && p.tid >= -1), d = ([r]) => r[2] - r[1], sm = progSummary();
	const list = f === "mine" ? all.filter(([, p]) => p.tid === G.userTid).sort((x, y) => y[0][2] - x[0][2]) : f === "up" ? all.filter((x) => d(x) > 0).sort((x, y) => d(y) - d(x) || y[0][2] - x[0][2]).slice(0, 40) : f === "down" ? all.filter((x) => d(x) < 0).sort((x, y) => d(x) - d(y) || y[0][2] - x[0][2]).slice(0, 40) : all.filter(([r]) => r[6] <= 23).sort((x, y) => d(y) - d(x) || y[0][2] - x[0][2]).slice(0, 40);
	const why = (r) => (r[8] || []).join(", "), reb = (r) => (r[7] != null && Math.abs(r[2] - r[7]) >= 2 ? progSplit(r) : "");
	return `<h2 class="d">Player development <small>before ${seasonName(G.prog.s)}</small></h2>
	<p class="note">Ratings change once a year, when a new season starts, after the draft and free agency. Young players usually improve and players past 30 decline, some of them by a lot. <button class="linkbtn" data-a="progwhy">${UI.progWhy ? "Less" : "More about how it works"}</button></p>
	${UI.progWhy ? '<p class="note">Each year some players have unusual seasons: breakouts and setbacks for players 25 and under, late bloomers and rough years for those 26 to 30, and sudden declines after that. Your coaching budget can also nudge your own players up or down a point. Players who just entered the league start developing a year later. After that the league is rebalanced so the number of stars stays about the same; that can pull the very best players down a point or two even if they did not age. Where it moved someone by 2 or more, the report says so.</p>' : ""}
	${sm ? `<div class="kv"><div><b>${f1(sm.n)}</b><span>your average (was ${f1(sm.b)})</span></div><div><b class="good">${sm.up}</b><span>improved</span></div><div><b class="bad">${sm.dn}</b><span>declined</span></div></div>` : ""}
	<div class="chips">${[["mine", "Your team"], ["up", "Biggest risers"], ["down", "Biggest drops"], ["young", "23 and under"]].map(([k, l]) => `<button class="chip" aria-pressed="${f === k}" data-a="progf" data-k="${k}">${l}</button>`).join("")}</div>
	<div class="list">${list.map(([r, p]) => `<div data-a="player" data-id="${p.id}" class="${p.tid === G.userTid && f !== "mine" ? "me" : ""}" style="cursor:pointer"><span><b>${esc(p.n)}</b><span class="sub">${p.tid >= 0 ? esc(team(p.tid).ab) : "Free agent"} · age ${r[6]} · potential ${r[4]}${r[4] !== r[3] ? ` (${sgn(r[4] - r[3])})` : ""}</span>${why(r) || reb(r) ? `<span class="sub"><b>${esc([why(r), reb(r)].filter(Boolean).join("; "))}</b></span>` : ""}${progBits(r) ? `<span class="sub">${esc(progBits(r))}</span>` : ""}</span><span style="text-align:right;white-space:nowrap;padding-left:10px"><b style="font-size:17px">${r[1]} → ${r[2]}</b><br>${dvTag(r[2] - r[1]) || '<span class="mute">no change</span>'}</span></div>`).join("") || '<div class="mute">Nobody here.</div>'}</div>
	<p class="note">Age is for the new season. The last line under each name is his three biggest rating changes. Tap a player for his full page.</p>`;
}
/* ---------- sorting and filtering player lists ----------
   Each list keeps its own choice in UI.ls[list]: sort key, position filter, and whether the order is reversed. */
const statOf = (p, k) => { const s = off() && p.ls ? p.ls : p.s; return s[0] ? s[k] / s[0] : -1; };
const scoutVal = (p) => .45 * p.ovr + .55 * p.pot;
const SORTS = {
	lineup: ["Lineup", null], rank: ["Scouts' rank", scoutVal], ovr: ["Overall", (p) => p.ovr], pot: ["Potential", (p) => p.pot], young: ["Youngest", (p) => p.born],
	cheap: ["Cheapest", (p) => -(p.tid === -1 ? askFor(p, p.askY) : p.sal)], sal: ["Salary", (p) => p.sal],
	min: ["Minutes", (p) => statOf(p, 1)], pts: ["Points", (p) => statOf(p, 2)], reb: ["Rebounds", (p) => statOf(p, 3)], ast: ["Assists", (p) => statOf(p, 4)] };
const POSF = [["", "All"], ["G", "Guards"], ["F", "Forwards"], ["C", "Centers"]];
function listOpts(l, keys, def) { const all = (UI.ls = UI.ls || {}); const st = (all[l] = all[l] || { k: def, pos: "", rev: false }); if (!keys.includes(st.k)) { st.k = def; st.rev = false; } return st; }
function listSort(l, ps, keys, def) {
	const st = listOpts(l, keys, def), f = SORTS[st.k][1], out = ps.filter((p) => !st.pos || p.pos.includes(st.pos));
	if (!f) return st.rev ? out.reverse() : out;
	return out.sort((a, b) => (st.rev ? -1 : 1) * (f(b) - f(a)) || b.ovr - a.ovr);
}
// Two rows of chips: what to show (positions, plus any extra chips) and how to sort. Tapping the current sort again reverses it.
function listBar(l, keys, def, extra) {
	const st = listOpts(l, keys, def);
	return `<div class="sortbar"><span>Show</span>${extra || ""}${POSF.map(([k, t]) => `<button class="chip" aria-pressed="${st.pos === k}" data-a="lpos" data-l="${l}" data-k="${k}">${t}</button>`).join("")}</div><div class="sortbar"><span>Sort</span>${keys.map((k) => `<button class="chip" aria-pressed="${st.k === k}" data-a="lsort" data-l="${l}" data-k="${k}">${SORTS[k][0]}${st.k === k && st.rev ? " (reversed)" : ""}</button>`).join("")}</div>`;
}
// A table header whose columns sort the list when tapped.
function sortHdr(l, cols) { const st = (UI.ls || {})[l] || {}; return `<tr>${cols.map(([t, k]) => `<th>${k ? `<button class="thb" data-a="lsort" data-l="${l}" data-k="${k}" aria-pressed="${st.k === k}">${t}${st.k === k ? (st.rev ? " ▲" : " ▼") : ""}</button>` : t}</th>`).join("")}</tr>`; }
/* ---------- draft helpers ---------- */
const ht = (p) => `${Math.floor(p.hgt / 12)}'${p.hgt % 12}"`;
// The scouts' view of the pool: rank by value, and each prospect's standout skills compared with the rest of the class.
function poolInfo() {
	const ps = prospects(), ks = [[0, "scorer"], [8, "shooter"], [2, "passer"], [10, "ball handler"], [3, "rebounder"], [4, "defender"], [13, "shot blocker"]];
	const m = ks.map(([k]) => { const v = ps.map((p) => p.r[k] || 0), mu = v.reduce((a, b) => a + b, 0) / (v.length || 1); return [mu, Math.sqrt(v.reduce((a, b) => a + (b - mu) ** 2, 0) / (v.length || 1)) || 1]; });
	return { n: ps.length, rank: new Map(ps.slice().sort((a, b) => scoutVal(b) - scoutVal(a)).map((p, i) => [p.id, i + 1])), str: (p) => ks.map(([k, w], i) => [w, ((p.r[k] || 0) - m[i][0]) / m[i][1]]).filter((x) => x[1] >= .9).sort((a, b) => b[1] - a[1]).slice(0, 2).map((x) => x[0]) };
}
// Where a prospect of this rank would likely go.
function projLabel(rk) {
	const d = G.phase === "draft" ? G.draft : null; if (d && d.fantasy) return `about pick ${d.i + rk}`;
	const n1 = d ? d.n : G.teams.length, at = (d ? d.i : 0) + rk;
	return at <= 3 ? "projected top 3" : at <= 10 ? "projected top 10" : at <= n1 ? "projected first round" : at <= 2 * n1 ? "projected second round" : "may go undrafted";
}
function prospectTable(l, ps) {
	const P = poolInfo(), keys = ["rank", "ovr", "pot", "young"], rows = listSort(l, ps, keys, "rank");
	return `${listBar(l, keys, "rank")}<div class="scroll"><table>${sortHdr(l, [["#", "rank"], ["Prospect", null], ["Age", "young"], ["Ovr", "ovr"], ["Pot", "pot"]])}${rows.map((p) => { const rk = P.rank.get(p.id), s = P.str(p); return `<tr data-a="player" data-id="${p.id}"><td class="mute">${rk}</td><td><span class="nm">${esc(p.n)}</span><span class="sub">${esc(p.pos)} · ${ht(p)}${s.length ? " · " + esc(s.join(", ")) : ""}</span><span class="sub">${projLabel(rk)}${p.slot && p.slot < 61 && !p.gen ? ` · really went #${p.slot}` : ""}</span></td><td>${age(p) + (off() ? 1 : 0)}</td><td class="ovr">${p.ovr}</td><td>${p.pot}</td></tr>`; }).join("") || '<tr><td class="mute" colspan="5">Nobody here.</td></tr>'}</table></div><p class="note">Ovr is how good he is now; Pot is how good he could become. # is your scouts' rank, which mixes the two.</p>`;
}
function draftView() {
	const d = G.draft, tid = d.order[d.i], mine = tid === G.userTid, n = d.i + 1, rd = d.fantasy ? Math.floor(d.i / G.teams.length) + 1 : n <= d.n ? 1 : 2, P = poolInfo(), best = prospects().sort((a, b) => scoutVal(b) - scoutVal(a))[0];
	const myIdx = d.order.map((t, i) => (t === G.userTid && i >= d.i ? i : -1)).filter((i) => i >= 0), next = myIdx.length ? myIdx[0] : null, last = d.log[0], made = new Map(d.log.map((x) => [x.n, x]));
	const via = (i) => (d.orig && d.orig[i] != null && d.orig[i] !== d.order[i] ? ` <span class="sub" style="display:inline">via ${esc(team(d.orig[i]).ab)}</span>` : "");
	const help = d.fantasy ? "Fantasy draft: every player in the league is in one pool, and teams take turns until every roster is full. The order reverses each round." : `There are two rounds of ${d.n} picks. Teams that missed the playoffs go first: ${opt("lot") === "none" ? "worst record first" : "the top three picks are drawn in a lottery, then the rest go worst record first"}. Playoff teams follow, worst record first. Picks can be traded, so some teams pick for others ("via"). First-round picks sign four-year deals, from ${money(6)} for the first pick down to ${money(1.5)}; second-rounders sign two-year minimum deals. Prospects nobody drafts become free agents if they are good enough.`;
	const status = `<section class="clock${mine ? " mine" : ""}"><h2 class="d">${mine ? "You are on the clock" : `${esc(team(tid).name)} on the clock`} <small>pick ${n} of ${d.order.length}${d.fantasy ? ` · round ${rd}` : ` · round ${rd}`}</small></h2>
	<div class="kv"><div><b>#${n}</b><span>picking now</span></div><div><b>${next != null ? "#" + (next + 1) : "–"}</b><span>${mine ? "your pick" : next != null ? `your next, ${next - d.i} away` : "no picks left"}</span></div><div><b>${myIdx.length}</b><span>pick${myIdx.length === 1 ? "" : "s"} left for you</span></div></div>
	${last ? `<p class="note">Last pick: #${last.n} ${esc(team(last.tid).name)} took <b>${esc(last.name)}</b> (${last.ovr} now, ${last.pot} potential).</p>` : ""}
	<p class="note"><b>${mine ? `Tap any prospect below to see him and draft him, or take your scouts' top choice, ${esc(best ? best.n : "")}.` : next != null ? "Watch one pick at a time, jump straight to your pick, or let the draft finish." : "You have no picks left. Finish the draft to move on."}</b></p>
	<div class="row">${mine ? `<button class="btn go" style="flex:1" data-a="autopick">Draft ${esc(best ? best.n : "the best player")}</button>` : `<button class="btn alt" style="flex:1" data-a="draftnext">Next pick</button>${next != null ? '<button class="btn go" style="flex:1" data-a="simdraft" data-k="1">Go to my pick</button>' : ""}`}</div>
	<button class="btn alt" data-a="simdraft" data-k="">${myIdx.length ? "Finish the draft (scouts pick for you)" : "Finish the draft"}</button>
	<p class="note"><button class="linkbtn" data-a="drhelp">${UI.drHelp ? "Hide how the draft works" : "How the draft works"}</button></p>${UI.drHelp ? `<p class="note">${esc(help)}</p>` : ""}</section>`;
	const bf = UI.dBoard || "next", items = d.order.map((t, i) => ({ i, t })), shown = bf === "mine" ? items.filter((x) => x.t === G.userTid) : bf === "done" ? items.filter((x) => made.has(x.i + 1)).reverse() : items.slice(d.i, d.i + 12);
	const board = `<section><h2 class="d">Draft board</h2><div class="chips">${[["next", "Coming up"], ["mine", "Your picks"], ["done", "Picks made"]].map(([k, l]) => `<button class="chip" aria-pressed="${bf === k}" data-a="dboard" data-k="${k}">${l}</button>`).join("")}</div><div class="list">${shown.map((x) => { const m = made.get(x.i + 1); return `<div class="${x.t === G.userTid ? "me" : ""}"><span><b>#${x.i + 1}</b> ${tname(team(x.t))}${via(x.i)}<span class="sub">${m ? `took ${esc(m.name)} (${m.ovr}/${m.pot})` : x.i === d.i ? "on the clock" : "still to come"}</span></span><span class="mute">${d.fantasy ? "round " + (Math.floor(x.i / G.teams.length) + 1) : x.i < d.n ? "round 1" : "round 2"}</span></div>`; }).join("") || '<div class="mute">Nothing here.</div>'}</div></section>`;
	return `${d.fantasy ? "" : offSteps()}${status}<section><h2 class="d">Prospects <small>${P.n} left</small></h2>${prospectTable("draft", prospects())}</section>${board}`;
}
// The top of a prospect's page: scouts' rank, projection, standout skills and the draft button.
function prospectBox(p) {
	const P = poolInfo(), rk = P.rank.get(p.id), s = P.str(p), d = G.phase === "draft" ? G.draft : null, onClock = d && d.order[d.i] === G.userTid, nx = d ? d.order.findIndex((t, i) => t === G.userTid && i >= d.i) : -1;
	return `<section><h2 class="d">Draft prospect</h2><p class="note"><b>Scouts' rank #${rk} of ${P.n}, ${projLabel(rk)}.</b>${s.length ? ` Stands out as a ${esc(s.join(" and "))}.` : ""} He is ${p.ovr} now and could reach ${p.pot}.</p>${scoutHtml(p)}${onClock ? `<button class="btn go" data-a="draft" data-id="${p.id}">Draft him with pick #${d.i + 1}</button>` : d ? `<p class="note">${nx >= 0 ? `Your next pick is #${nx + 1}; he may be gone by then.` : "You have no picks left in this draft."}</p>` : ""}</section>`;
}
const LV = [[1, 2, 3.5, 5.5, 8], [.5, 1, 1.5, 2.5, 4], [1, 2, 3, 5, 8]], TV = 40, DEBT = 25;
const newFin = () => ({ cash: 40, price: 60, lv: [3, 3, 3], cur: { gate: 0, merch: 0, tv: 0, sal: 0, bud: 0, att: 0, hg: 0 }, hist: [] });
const budget = () => G.fin.lv.reduce((s, l, i) => s + LV[i][l - 1], 0);
const market = () => clamp((team(G.userTid).pop || 3) / 5, .3, 1.6);
function hype() { const t = team(G.userTid), prev = t.prev == null ? .5 : t.prev, cur = t.w + t.l >= 10 ? pct(t) : prev; return clamp(.15 + 1.06 * (.5 * cur + .5 * prev), 0, 1); }
const fairPrice = () => Math.round(45 + 40 * hype());
function crowd(playoff, noisy) { const f = G.fin, ref = fairPrice(), k = f.price <= ref ? Math.min(1.08, Math.pow(ref / f.price, .35)) : Math.pow(ref / f.price, 1.6); return Math.round(clamp((9500 + 3500 * market() + 7000 * hype()) * (1 + .02 * (f.lv[2] - 3)) * k * (playoff ? 1.25 : 1) * (noisy ? 1 + gauss() * .03 : 1), 2500, 20500)); }
function finGame(home, playoff) {
	const f = G.fin, c = f.cur;
	if (home) { const gs = 82 / NG(), att = crowd(playoff, true), gate = gs * att * f.price * (playoff ? 1.25 : 1) / 1e6, merch = gs * (.12 + .2 * hype()) * market(); c.gate += gate; c.merch += merch; c.att += att; c.hg++; f.cash += gate + merch; }
	if (!playoff) { const sal = payroll(G.userTid) / NG(), bud = budget() / NG(); c.tv += TV / NG(); c.sal += sal; c.bud += bud; f.cash += TV / NG() - sal - bud; }
}
function closeBooks() {
	const f = G.fin, c = f.cur, tax = 1.5 * Math.max(0, payroll(G.userTid) - TAXL()), rev = c.gate + c.merch + c.tv, exp = c.sal + c.bud + tax; f.cash -= tax;
	f.hist.unshift({ s: G.season, rev, exp, tax, cash: f.cash }); f.hist.length = Math.min(f.hist.length, 30); f.cur = newFin().cur;
	news(`The books for ${seasonName(G.season)}: ${money(rev)} in, ${money(exp)} out${tax ? ", including " + money(tax) + " in luxury tax" : ""}. Cash on hand: ${money(f.cash)}.`);
	for (const t of G.teams) t.prev = pct(t);
}
/* Free agency runs for FA_DAYS days before the season. Other teams sign players as the days pass, better players first,
   and anyone still unsigned gets a little cheaper each day. */
const FA_DAYS = 30;
function aiFreeAgencyDay() {
	for (const p of G.players.filter((x) => x.tid === -1).sort((a, b) => b.ovr - a.ovr)) {
		if (Math.random() > (p.ovr >= 85 ? .35 : p.ovr >= 78 ? .22 : p.ovr >= 70 ? .12 : .05)) continue;
		const c = G.teams.filter((t) => { if (t.tid === G.userTid || !canSign(t.tid, p)) return false; const ps = roster(t.tid); return ps.length < 13 || p.ovr >= Math.min(...ps.map((x) => x.ovr)) + 3; });
		if (!c.length) continue;
		let t; if (p.ovr >= 75) { const w = c.map((x) => Math.pow(.25 + pct(x), 1.5)); let r = Math.random() * w.reduce((a, b) => a + b, 0), i = 0; while ((r -= w[i]) > 0 && i < c.length - 1) i++; t = c[i]; } else t = c.sort((a, b) => roster(a.tid).length - roster(b.tid).length || Math.random() - .5)[0];
		const was = p.prevTid === G.userTid;
		if (p.ovr >= 76 || was) news(`${was ? "Your former player " : ""}${p.n} signs with the ${t.name} (${money(p.ask)} a year for ${p.askY} year${p.askY > 1 ? "s" : ""}).`);
		sign(p, t.tid, Math.round(p.ask * 10) / 10, p.askY);
	}
	for (const p of G.players) if (p.tid === -1 && p.ask > MINSAL) p.ask = Math.max(MINSAL, Math.round(p.ask * .985 * 100) / 100);
}
function faAdvance(n) {
	if (G.phase !== "fa") return;
	if (n >= FA_DAYS) { const bad = rosterProblem(); if (bad) return toast(bad + " Then free agency can finish."); }
	const before = G.players.filter((p) => p.tid === -1).length;
	for (let i = 0; i < n && (G.faDay || 0) < FA_DAYS; i++) { G.faDay = (G.faDay || 0) + 1; aiFreeAgencyDay(); }
	if (G.faDay >= FA_DAYS && !rosterProblem()) return startSeason();
	const signed = before - G.players.filter((p) => p.tid === -1).length; save();
	toast(G.faDay >= FA_DAYS ? rosterProblem() + " Then the season can start." : `Day ${G.faDay} of free agency. ${signed ? `${signed} player${signed === 1 ? "" : "s"} signed elsewhere.` : "Nobody else signed."}`);
}
// Fill the user's roster up to 13 with the best players willing to take the minimum.
function fillMine() {
	let n = roster(G.userTid).length; const pool = G.players.filter((p) => p.tid === -1 && userAsk(p) <= 1.5).sort((a, b) => b.ovr - a.ovr), got = [];
	while (n < 13 && pool.length) { const p = pool.shift(); if (!canSign(G.userTid, p)) continue; sign(p, G.userTid, userAsk(p), 1); if (!G.auto) G.order.push(p.id); got.push(p.n); n++; }
	while (n < RMIN) { const p = genPlayer(rnd(55, 60), 62, rnd(24, 29), -1); G.players.push(p); sign(p, G.userTid, MINSAL, 1); if (!G.auto) G.order.push(p.id); got.push(p.n); n++; }
	if (got.length) news(`You sign ${got.join(", ")} to minimum deals.`); save(); toast(got.length ? `Signed ${got.length}: ${got.join(", ")}.` : "Nobody suitable is asking the minimum.");
}
// Where the user is in the offseason, and what to do now.
function offSteps() {
	const ph = G.phase, at = ph === "draft" ? 0 : ph === "resign" ? 1 : ph === "fa" ? 2 : -1; if (at < 0) return "";
	const steps = ["Draft", "Re-sign", "Free agency", "Season"], now = ph === "draft" ? "" : ph === "resign" ? "Decide which of your players to keep, then tap Done." : rosterProblem() ? rosterProblem() : `Sign free agents, or tap Next to let the days pass. The season starts after day ${FA_DAYS}.`;
	return `<section><div class="steps">${steps.map((l, i) => `<span class="${i < at ? "done" : i === at ? "now" : ""}">${i < at ? "✓ " : ""}${l}${i === 2 && ph === "fa" ? ` · day ${G.faDay || 0}/${FA_DAYS}` : ""}</span>`).join("")}</div>${now ? `<p class="note"><b>${esc(now)}</b></p>` : ""}</section>`;
}
function aiFreeAgency() {
	for (let round = 0; round < 5; round++) {
		const fas = G.players.filter((p) => p.tid === -1).sort((a, b) => b.ovr - a.ovr);
		for (const p of fas) {
			const c = G.teams.filter((t) => { if (t.tid === G.userTid || !canSign(t.tid, p)) return false; const ps = roster(t.tid); return ps.length < 13 || p.ovr >= Math.min(...ps.map((x) => x.ovr)) + 3; });
			if (!c.length) continue;
			// Good free agents lean toward winning teams that can afford them; everyone else goes where there is a roster spot.
			let t; if (p.ovr >= 75) { const w = c.map((x) => Math.pow(.25 + pct(x), 1.5)); let r = Math.random() * w.reduce((a, b) => a + b, 0), i = 0; while ((r -= w[i]) > 0 && i < c.length - 1) i++; t = c[i]; } else t = c.sort((a, b) => roster(a.tid).length - roster(b.tid).length || Math.random() - .5)[0];
			if (p.ovr >= 80) news(`${p.n} signs with the ${t.name} (${money(p.ask)} a year).`);
			sign(p, t.tid, p.ask, p.askY);
		}
		for (const p of G.players) if (p.tid === -1) p.ask = Math.max(MINSAL, Math.round(p.ask * 7.5) / 10);
	}
}
/* Yearly development. It runs when a new season starts, after the draft and free agency, so the offseason is played on last
   season's ratings and the changes show up as the new season begins. Young players usually improve and veterans decline, with
   real swings: breakouts and setbacks for young players, late bloomers and rough years in the prime, sudden declines for veterans.
   Rookies who just entered the league start developing a year later. Afterwards the league is rebalanced so the spread of talent
   stays where real seasons have it. */
function develop() {
	const S = G.season, fresh = (p) => p.fresh === S;
	const before = new Map(G.players.filter((p) => p.tid >= -1 && !fresh(p)).map((p) => [p.id, [p.ovr, p.pot, p.r.slice(), age(p) + 1]]));
	for (const p of G.players) {
		if (p.tid < -1 || fresh(p)) continue;
		const a = age(p), below = p.ovr < p.pot; let d;
		if (a <= 21) d = below ? rnd(2, 9) : rnd(0, 4); else if (a <= 24) d = below ? rnd(0, 7) : rnd(-2, 3); else if (a <= 27) d = below ? rnd(-2, 5) : rnd(-3, 2); else if (a <= 30) d = rnd(-4, 2); else if (a <= 33) d = rnd(-6, 1); else if (a <= 36) d = rnd(-8, -1); else d = rnd(-10, -3);
		let ev = 0, cb = 0, why = ""; const x = Math.random();
		if (a <= 25) { if (x < .09) { ev = rnd(4, 10); why = "breakout year"; } else if (x < .15) { ev = -rnd(3, 7); why = "setback year"; } }
		else if (a <= 30) { if (x < .05) { ev = rnd(3, 6); why = "late bloomer"; } else if (x < .10) { ev = -rnd(3, 7); why = "rough year"; } }
		else if (x < .09) { ev = -rnd(4, 8); why = "sudden decline"; }
		d += ev;
		if (p.tid === G.userTid && Math.random() < Math.abs(G.fin.lv[0] - 3) * .15) { cb = Math.sign(G.fin.lv[0] - 3); d += cb; }
		p.dvWhy = [why, cb > 0 ? "your coaching staff helped" : cb < 0 ? "your coaching budget held him back" : ""].filter(Boolean);
		p.o0 = p.ovr; p.ovr = clamp(p.ovr + d, 40, 99); p.oMid = p.ovr;
		p.pot = a >= 27 ? p.ovr : clamp(Math.max(p.ovr, p.pot + (ev > 0 ? rnd(1, 4) : ev < 0 ? -rnd(1, 4) : Math.random() < .3 ? rnd(-3, 2) : 0)), p.ovr, 99);
	}
	// Keep the league's spread of talent where real seasons have it: pull each rostered player toward the rating
	// that his rank in the league normally carries, so the top never fills up with 99s and the bottom never sinks.
	const f = 30 / G.teams.length; G.players.filter((p) => p.tid >= 0 && !fresh(p)).sort((a, b) => b.ovr - a.ovr).forEach((p, i) => { p.ovr = clamp(Math.round(.5 * p.ovr + .5 * rankOvr((i + 1) * f)), 40, 99); });
	for (const p of G.players) {
		if (p.o0 == null) continue;
		const a = age(p), k = clamp((p.ovr - 40) / Math.max(5, p.o0 - 40), .7, 1.4), r = p.r, up = (x, w) => clamp(Math.round(25 + (x - 25) * (1 + (k - 1) * w)), 25, 99);
		p.pot = a >= 27 ? p.ovr : Math.max(p.pot, p.ovr);
		r[0] = up(r[0], 1); r[1] = clamp(up(r[1], .5) + (a < 27 && Math.random() < .4 ? 1 : 0), 25, 99); r[2] = up(r[2], 1); r[3] = up(r[3], 1); r[4] = clamp(r[4] + Math.round((p.ovr - p.o0) * .6), 25, 99); r[5] = clamp(r[5] + (a <= 23 ? rnd(0, 3) : a >= 32 ? rnd(-4, -1) : rnd(-1, 1)), 25, 97);
		if (r.length >= 15) { const d2 = Math.round((p.ovr - p.o0) * .5), c2 = (x) => clamp(x, 25, 99); r[7] = up(r[7], .3); r[8] = c2(r[8] + (a < 27 ? rnd(0, 2) : a > 32 ? rnd(-2, 0) : rnd(-1, 1))); r[9] = c2(r[9] + rnd(-1, 1) + (a < 25 ? 1 : 0)); r[10] = c2(r[10] + (a < 26 ? rnd(0, 2) : rnd(-1, 1))); r[11] = up(r[11], 1); r[12] = up(r[12], 1); r[13] = c2(r[13] + d2); r[14] = c2(r[14] + d2 - (a > 31 ? 1 : 0)); }
		if (r.length >= 17) { r[15] = up(r[15], .5); r[16] = up(r[16], .8); }
		delete p.o0;
	}
	if (G.dist) for (let k = 0; k < 17; k++) { const d = G.dist[k]; if (!d) continue; const v = G.players.filter((p) => p.tid >= 0 && !fresh(p) && p.r[k] != null).sort((a, b) => b.r[k] - a.r[k]); v.forEach((p, i) => { const x = i / Math.max(1, v.length - 1) * 50, lo = Math.floor(x), t = d[lo] + (d[Math.min(50, lo + 1)] - d[lo]) * (x - lo); p.r[k] = clamp(Math.round(.5 * p.r[k] + .5 * t), 25, 99); }); }
	// Remember what changed, for the development report.
	G.prog = { s: S + 1, rows: [] };
	for (const p of G.players) { const b = before.get(p.id); if (!b) continue; const ch = RLAB.map(([, k]) => [k, (p.r[k] || 0) - (b[2][k] || 0)]).filter((x) => x[1]).sort((x, y) => Math.abs(y[1]) - Math.abs(x[1])).slice(0, 3); G.prog.rows.push([p.id, b[0], p.ovr, b[1], p.pot, ch, b[3], p.oMid != null ? p.oMid : p.ovr, p.dvWhy || []]); p.dv = p.ovr - b[0]; p.dvS = S + 1; delete p.oMid; delete p.dvWhy; }
	for (const p of G.players) delete p.fresh;
	{ const sm = progSummary(); if (sm) news(`Player development before the ${seasonName(S + 1)} season: your team's average rating went from ${f1(sm.b)} to ${f1(sm.n)}. ${sm.best[1].n} ${sm.best[0][2] >= sm.best[0][1] ? "gained" : "lost"} ${Math.abs(sm.best[0][2] - sm.best[0][1])}${sm.worst !== sm.best && sm.worst[0][2] < sm.worst[0][1] ? `; ${sm.worst[1].n} lost ${sm.worst[0][1] - sm.worst[0][2]}` : ""}.`); }
	if (!UI.autoN) UI.progPending = true;
}
function startSeason() {
	const bad = rosterProblem(); if (bad) return toast(bad);
	aiFreeAgency(); fillRosters(false); if (G.devSkip) delete G.devSkip; else develop(); G.season++; delete G.faDay; for (const p of G.players) delete p.prevTid;
	const fa = G.players.filter((p) => p.tid === -1).sort((a, b) => b.ovr - a.ovr); const keep = new Set(fa.slice(0, 60).map((p) => p.id));
	G.players = G.players.filter((p) => p.tid >= 0 || keep.has(p.id));
	G.phase = "regular";
	for (const p of G.players) if (p.tid === -1) setAsk(p);
	for (const t of G.teams) { t.w = t.l = t.pf = t.pa = 0; }
	G.log = []; G.sc = {}; BX.prune(G.id, G.season); G.po = null; G.draft = null; G.ures = ""; makeSchedule(); G.picks.push(...mkPicks(G.season + 2)); addClass();
	news(`The ${seasonName(G.season)} season begins.`); UI.tab = "home"; save(true); cloudSave(); render();
}

/* ---------- trades ---------- */
// What a player is worth in a trade. Value climbs steeply at the top: one 95 is worth far more than three 80s.
function asset(p) { const a = age(p) + (off() ? 1 : 0), e = p.ovr + (a <= 24 ? .6 * (p.pot - p.ovr) : a <= 26 ? .3 * (p.pot - p.ovr) : 0) - Math.max(0, a - 29) * 1.6, yrs = Math.max(1, p.exp - G.season + (off() ? 0 : 1)); return Math.pow(Math.max(0, e - 58), 3) / 350 - Math.max(0, p.sal - fair(Math.round(e), a)) * yrs * .35; }
// A team only has so many minutes to give: the best piece coming back counts in full, each extra piece for less.
const packageVal = (vals) => vals.sort((x, y) => y - x).reduce((s, v, i) => s + v * [1, .85, .55, .3, .15][Math.min(i, 4)], 0);
function tradeCheck() {
	const A = UI.tradeA.map(byId).filter(Boolean), B = UI.tradeB.map(byId).filter(Boolean), PA = UI.tradePA.map(pkFind).filter(Boolean), PB = UI.tradePB.map(pkFind).filter(Boolean), sum = (x, f) => x.reduce((s, p) => s + f(p), 0);
	if (tradeShut()) return { ok: false, msg: "The trade deadline has passed." };
	if (!(A.length + PA.length) || !(B.length + PB.length)) return { ok: false, msg: "Pick something from each side." };
	const sa = sum(A, (p) => p.sal), sb = sum(B, (p) => p.sal);
	for (const [tid, inS, outS, d] of [[G.userTid, sb, sa, B.length - A.length], [UI.tradeTid, sa, sb, A.length - B.length]]) {
		const n = roster(tid).length + d, who = tid === G.userTid ? "You" : "They";
		if (n > RMAX) return { ok: false, msg: `${who} would have ${n} players. The limit is ${RMAX}.` };
		if (!capFree() && payroll(tid) - outS + inS > opt("cap") && inS > (hardCap() ? outS + .05 : outS * 1.25 + .1)) return { ok: false, msg: `${who} would be over the cap and taking back too much salary (${money(inS)} for ${money(outS)}).` };
	}
	const get = packageVal([...A.map(asset), ...PA.map(pickVal)]), give = sum(B, (p) => asset(p) * (p.ovr >= 92 ? 1.25 : 1)) + sum(PB, pickVal);
	return get >= give * [.98, 1.08, 1.22][G.diff == null ? 1 : G.diff] + .5 ? { ok: true, msg: "They would accept this." } : { ok: false, msg: get < give * .6 ? "They are not interested." : "They want more for that." };
}
function doTrade(force) {
	const c = tradeCheck(); if (!c.ok && !force) return toast(c.msg);
	const A = UI.tradeA.map(byId), B = UI.tradeB.map(byId), PA = UI.tradePA.map(pkFind), PB = UI.tradePB.map(pkFind), t = team(UI.tradeTid), la = [...A.map((p) => p.n), ...PA.map(pkLabel)], lb = [...B.map((p) => p.n), ...PB.map(pkLabel)];
	A.forEach((p) => { p.tid = t.tid; }); B.forEach((p) => { p.tid = G.userTid; if (!G.auto) G.order.push(p.id); }); PA.forEach((k) => { k.t = t.tid; }); PB.forEach((k) => { k.t = G.userTid; });
	G.order = G.order.filter((id) => !UI.tradeA.includes(id));
	news(`Trade: you send ${la.join(", ")} to the ${t.name} for ${lb.join(", ")}.`); UI.tradeA = []; UI.tradeB = []; UI.tradePA = []; UI.tradePB = []; fillRosters(false); save(); toast("Trade completed.");
}
function whatWould() {
	if (!(UI.tradeB.length + UI.tradePB.length)) return toast("First pick what you want from them.");
	const a0 = UI.tradeA.slice(), p0 = UI.tradePA.slice();
	for (let n = 0; n < 4 && !tradeCheck().ok; n++) {
		const c = [...roster(G.userTid).filter((p) => !UI.tradeA.includes(p.id)).map((p) => ({ v: asset(p), l: UI.tradeA, x: p.id })), ...tradablePicks(G.userTid).filter((k) => !UI.tradePA.includes(pkKey(k))).map((k) => ({ v: pickVal(k), l: UI.tradePA, x: pkKey(k) }))].filter((x) => x.v > .5).sort((a, b) => a.v - b.v);
		if (!c.length) break; let done = false;
		for (const x of c) { x.l.push(x.x); if (tradeCheck().ok) { done = true; break; } x.l.pop(); }
		if (!done) { const x = c[c.length - 1]; x.l.push(x.x); }
	}
	if (tradeCheck().ok) return toast("Found an offer they would accept. Check what you are sending.");
	UI.tradeA = a0; UI.tradePA = p0; toast("Nothing you have gets this done.");
}
// Computer teams deal with each other: a winning team takes a veteran from a losing one for youth and a first-round pick.
function aiTrade() { for (let i = 0; i < 8; i++) if (aiTradeOnce()) return; }
function aiTradeOnce() {
	const st = standings().filter((t) => t.tid !== G.userTid), n = Math.floor(st.length / 3), A = st[rnd(0, n - 1)], B = st[st.length - 1 - rnd(0, n - 1)];
	const target = roster(B.tid).filter((p) => age(p) >= 28 && p.ovr >= 76).sort((a, b) => b.ovr - a.ovr)[0]; if (!target) return;
	const tv = asset(target); if (tv < 3) return;
	const pool = roster(A.tid).sort((a, b) => b.ovr - a.ovr).slice(3), pick = G.picks.find((k) => k.t === A.tid && k.r === 1 && k.y === G.season + (off() ? 1 : 0));
	const give = []; let gv = pick ? pickVal(pick) : 0;
	for (const p of pool.filter((x) => age(x) <= 25).sort((a, b) => asset(b) - asset(a))) { if (gv >= tv * .9) break; give.push(p); gv += asset(p); }
	if (gv < tv * .85 || gv > tv * 1.8) return;
	let out = give.reduce((s, p) => s + p.sal, 0); const fill = pool.filter((p) => !give.includes(p)).sort((a, b) => asset(a) - asset(b));
	const over = () => payroll(A.tid) - out + target.sal > opt("cap") && target.sal > out * 1.25 + .1;
	while (over() && fill.length) { const f = fill.shift(); give.push(f); out += f.sal; }
	if (over() || (payroll(B.tid) - target.sal + out > opt("cap") && out > target.sal * 1.25 + .1) || roster(B.tid).length - 1 + give.length > RMAX) return;
	const label = [...give.map((p) => p.n), pick ? pkLabel(pick) : ""].filter(Boolean).join(", ");
	target.tid = A.tid; give.forEach((p) => { p.tid = B.tid; }); if (pick) pick.t = B.tid;
	news(`Trade: the ${A.name} get ${target.n} from the ${B.name} for ${label}.`); fillRosters(false); return true;
}

/* ---------- owner, offers, All-Star, auto-play ---------- */
const ACH = [["title", "First banner", "Win a championship."], ["repeat", "Back to back", "Win titles in consecutive seasons."], ["dynasty", "Dynasty", "Win three titles in five seasons."], ["seventy", "Seventy", "Win 70 games in a season."], ["bottom", "From the bottom", "Win a title within four seasons of winning 25 games or fewer."], ["thrift", "Under the cap", "Win a title with a payroll at or under the cap."], ["small", "Small market, big banner", "Win a title in one of the smaller markets."], ["builder", "Homegrown", "Win a title with three of your top eight players drafted by you."], ["mvp", "MVP maker", "Have one of your players win MVP."], ["rich", "In the black", "Hold $250M in cash."], ["decade", "Ten years in", "Spend ten seasons with one team."], ["hall", "Hall pass", "See a player you drafted enter the Hall of Fame."]];
function checkAch() {
	const hall = UI.hallFlag; UI.hallFlag = false; if (G.godUsed) return; G.ach = G.ach || {};
	const h = G.history, t = team(G.userTid), champ = (i) => h[i] && h[i].res === "Champions", got = (id) => { if (!G.ach[id]) { G.ach[id] = G.season; news(`Achievement earned: ${ACH.find((a) => a[0] === id)[1]}.`); } };
	if (champ(0)) { got("title"); if (champ(1)) got("repeat"); if (h.slice(0, 5).filter((x) => x.res === "Champions").length >= 3) got("dynasty"); if ((t.hist || []).slice(-5, -1).some((x) => x[1] <= 25)) got("bottom"); if (payroll(t.tid) <= opt("cap")) got("thrift"); if (market() < .65) got("small"); if (roster(t.tid).sort((a, b) => ((b.ls || [])[1] || 0) - ((a.ls || [])[1] || 0)).slice(0, 8).filter((p) => p.mine).length >= 3) got("builder"); }
	if (t.w >= 70) got("seventy"); if (h[0] && h[0].mvp && roster(t.tid).some((p) => p.n === h[0].mvp)) got("mvp"); if (G.fin.cash >= 250) got("rich"); if (G.owner.yrs >= 10) got("decade"); if (hall) got("hall");
}
function ownerReview() {
	const o = G.owner, t = team(G.userTid), f = G.fin.hist[0], r = G.ures;
	o.w = .6 * o.w + clamp((pct(t) - .5) * 5, -1.5, 1.5); o.m = .6 * o.m + clamp((f.rev - f.exp) / 20, -1.5, .8); o.yrs++;
	o.p = .6 * o.p + (r === "Champions" ? 2 : /the Finals/.test(r) ? 1.2 : /conference finals/.test(r) ? .8 : /semifinals/.test(r) ? .4 : /first round/.test(r) ? .1 : -.4);
	const tot = o.w + o.p + o.m;
	if (!G.god && o.yrs >= 3 && tot < -2.5) { G.fired = true; news(`The owner has fired you after ${o.yrs} seasons with the ${t.name}.`); }
	else if (tot < -1.5) news("The owner is losing patience. Win, go deeper in the playoffs or make money, or your job is at risk.");
	else if (tot > 2.5) news("The owner is thrilled with the job you are doing.");
}
function takeJob(tid) { G.userTid = tid; G.fired = false; G.owner = { w: 0, p: 0, m: 0, yrs: 0 }; G.fin = newFin(); G.order = []; G.auto = true; G.offers = []; G.resign = G.resign.filter(() => false); UI.sheet = null; UI.viewTid = null; news(`You are the new general manager of the ${team(tid).region} ${team(tid).name}.`); if (G.phase === "resign" || G.phase === "fa") { for (const p of roster(tid)) if (p.ask != null) { delete p.ask; delete p.askY; } } save(true); }
// What would a team give for what you are shopping? They add their best pieces for as long as they would still say yes.
function buildOffer(tid, cap) {
	const keep = [UI.tradeTid, UI.tradeB, UI.tradePB]; UI.tradeTid = tid; UI.tradeB = []; UI.tradePB = []; let v = 0;
	const c = [...roster(tid).map((p) => ({ v: asset(p), l: UI.tradeB, x: p.id })), ...tradablePicks(tid).map((k) => ({ v: pickVal(k), l: UI.tradePB, x: pkKey(k) }))].filter((x) => x.v > 1).sort((a, b) => b.v - a.v);
	for (const x of c) { if (UI.tradeB.length + UI.tradePB.length >= 3) break; if (cap && v + x.v > cap) continue; x.l.push(x.x); if (tradeCheck().ok) v += x.v; else x.l.pop(); }
	const out = { tid, A: UI.tradeA.slice(), PA: UI.tradePA.slice(), B: UI.tradeB, PB: UI.tradePB, v }; [UI.tradeTid, UI.tradeB, UI.tradePB] = keep; return v > 0 ? out : null;
}
const offerText = (o, side) => [...(side ? o.A : o.B).map((id) => { const p = byId(id); return p ? `${p.n} (${p.ovr})` : ""; }), ...(side ? o.PA : o.PB).map((k) => { const x = pkFind(k); return x ? pkLabel(x) : ""; })].filter(Boolean).join(", ");
const offerLive = (o) => o.s === G.season && G.day - o.day <= 12 && o.A.every((id) => (byId(id) || {}).tid === G.userTid) && o.B.every((id) => (byId(id) || {}).tid === o.tid);
function aiOffer() {
	if (G.phase === "playoffs") return; const mine = roster(G.userTid).filter((p) => p.ovr >= 72 && !p.inj); if (!mine.length) return;
	const p = mine[rnd(0, mine.length - 1)], ts = G.teams.filter((t) => t.tid !== G.userTid), t = ts[rnd(0, ts.length - 1)], keep = [UI.tradeA, UI.tradePA];
	UI.tradeA = [p.id]; UI.tradePA = []; const o = buildOffer(t.tid, asset(p) * .95); [UI.tradeA, UI.tradePA] = keep;
	if (!o || o.v < asset(p) * .75) return; o.s = G.season; o.day = G.day; G.offers.unshift(o); G.offers.length = Math.min(G.offers.length, 3);
	news(`The ${t.name} have made you an offer for ${p.n}. It is on your Home screen.`);
}
function allStar() {
	const el = G.players.filter((p) => p.tid >= 0 && p.s[0] > 0 && p.s[0] >= .5 * (team(p.tid).w + team(p.tid).l)), sides = [0, 1].map((c) => el.filter((p) => team(p.tid).cid === c).sort((a, b) => MVS(b) - MVS(a)).slice(0, 12));
	if (sides[0].length < 8 || sides[1].length < 8) return;
	const str = sides.map((x) => x.reduce((a, p) => a + p.ovr, 0) / x.length), m = (str[0] - str[1]) * 1.2 + gauss() * 9, base = lg()[0] * 1.25, sc = [Math.round(base + m / 2 + gauss() * 6), Math.round(base - m / 2 + gauss() * 6)]; if (sc[0] === sc[1]) sc[0]++;
	const win = sc[0] > sc[1] ? 0 : 1, mvp = sides[win][rnd(0, 4)], mine = sides.flat().filter((p) => p.tid === G.userTid).map((p) => p.n);
	for (const p of sides.flat()) (p.aws = p.aws || []).push([G.season, "All-Star"]); mvp.aws.push([G.season, "All-Star MVP"]);
	const pool = G.players.filter((p) => p.tid >= 0 && !p.inj && p.s[0] > 0), shoot = pool.filter((p) => p.r[1] >= 45 && p.s[10] >= 2 * p.s[0]).sort((a, b) => b.r[8] - a.r[8]).slice(0, 8).map((p) => [p, Math.round(clamp(15 + (p.r[8] - 60) / 5 + gauss() * 3.2, 8, 30))]).sort((a, b) => b[1] - a[1]), dunk = shuffle(pool.filter((p) => age(p) <= 27 && p.hgt <= 80 && !p.pos.includes("C") && p.r[7] >= 60 && p.r[0] >= 55).sort((a, b) => (b.r[7] + b.r[0] - 2 * age(b)) - (a.r[7] + a.r[0] - 2 * age(a))).slice(0, 12)).slice(0, 4).map((p) => [p, rnd(43, 50)]).sort((a, b) => b[1] - a[1]);
	const extra = [];
	if (shoot.length >= 4) { (shoot[0][0].aws = shoot[0][0].aws || []).push([G.season, "Three-Point Contest winner"]); extra.push(`Three-point contest: ${shoot[0][0].n} (${team(shoot[0][0].tid).ab}) wins with ${shoot[0][1]}`); }
	if (dunk.length >= 3) { (dunk[0][0].aws = dunk[0][0].aws || []).push([G.season, "Slam Dunk Contest winner"]); extra.push(`dunk contest: ${dunk[0][0].n} (${team(dunk[0][0].tid).ab}) wins with a ${dunk[0][1]} on his last dunk`); }
	if (extra.length) news("All-Star weekend. " + extra.join("; ") + ".");
	G.as = { sc, mvp: mvp.n, east: sides[0].map((p) => p.n), west: sides[1].map((p) => p.n), three: shoot.length >= 4 ? shoot[0][0].n : "", dunk: dunk.length >= 3 ? dunk[0][0].n : "" };
	news(`All-Star Game: ${win ? "West" : "East"} ${Math.max(...sc)}, ${win ? "East" : "West"} ${Math.min(...sc)}. MVP: ${mvp.n}.${mine.length ? " From your team: " + mine.join(", ") + "." : ""}`);
}
const VAL = (p) => (p.s[2] + .7 * p.s[3] + 1.1 * p.s[4] + 1.5 * (p.s[5] + p.s[6])) / p.s[0], MVS = (p) => VAL(p) * (.6 + pct(team(p.tid))) * (p.ovr / 90), DPS = (p) => (p.s[5] + 1.3 * p.s[6]) / p.s[0] * (p.r[4] / 70) * (.8 + .4 * pct(team(p.tid)));
// Auto-play: the coach and front office make every decision for you.
function autoSeason() {
	fillRosters(true);
	if (G.phase === "regular") playDays(999, true);
	if (G.phase === "playoffs") playPlayoffs("all");
	if (G.fired) return;
	if (G.phase === "draft") simDraft(false);
	if (G.phase === "resign") { for (const id of G.resign.slice()) { const p = byId(id); if (p && p.tid === G.userTid && p.ask != null && !mood(p).no && (p.ovr >= 70 || (age(p) + 1 <= 25 && p.pot >= 74)) && age(p) + 1 < 37) sign(p, G.userTid, userAsk(p), p.askY); } finishResign(); }
	if (G.phase === "fa") { fillRosters(true); for (let i = G.faDay || 0; i < FA_DAYS; i++) aiFreeAgencyDay(); startSeason(); }
}
function autoPlay(n) { UI.autoN = { n, i: 0 }; const step = () => { const a = UI.autoN; if (!a) return; if (G.fired || a.i >= a.n) { UI.autoN = null; return render(); } autoSeason(); a.i++; UI.tab = "more"; toast(G.fired ? "Stopped: you were fired." : `Simulated ${a.i} of ${a.n} season${a.n > 1 ? "s" : ""}.`); setTimeout(step, 40); }; step(); }

/* ---------- play-by-play ---------- */
// Your game is simulated first; the feed is then written from its box score, so the two always agree.
function buildFeed(g) {
	const short = (n) => n.split(" ").slice(1).join(" ") || n, one = (a) => a[rnd(0, a.length - 1)], abs = [team(G.userTid).ab, team(g.o).ab], ev = [];
	const left = g.b.map((rows) => rows.map((r) => ({ n: short(r[0]), reb: r[3], ast: r[4], blk: r[6], tov: r[14] || 0, pf: r[15] || 0 })));
	const take = (side, k, not) => { const c = left[side].filter((x) => x[k] > 0 && x.n !== not); if (!c.length) return ""; let x = Math.random() * c.reduce((a, y) => a + y[k], 0), i = 0; while ((x -= c[i][k]) > 0 && i < c.length - 1) i++; c[i][k]--; return c[i].n; };
	g.b.forEach((rows, side) => {
		const add = (pts, txt) => ev.push({ side, ab: abs[side], pts, txt });
		for (const r of rows) {
			const n = short(r[0]), tp = r[7], m2 = r[8] - r[7], x3 = r[10] - r[7], x2 = r[9] - r[10] - m2;
			for (let i = 0; i < m2; i++) { const a = Math.random() < .55 ? take(side, "ast", n) : ""; add(2, `${n} ${one(["hits a jumper", "scores inside", "lays it in", "finishes at the rim", "drops in a floater"])}${a ? ` (assist ${a})` : ""}`); }
			for (let i = 0; i < tp; i++) { const a = Math.random() < .8 ? take(side, "ast", n) : ""; add(3, `${n} ${one(["buries a three", "hits from deep", "knocks down a three"])}${a ? ` (assist ${a})` : ""}`); }
			for (let i = 0; i < x2 + x3; i++) { const three = i >= x2, b = !three && Math.random() < .12 ? take(1 - side, "blk") : "", o = Math.random() < .27, rb = take(o ? side : 1 - side, "reb", o ? n : ""); add(0, `${n} ${b ? "is blocked by " + b : three ? "misses from three" : one(["misses a jumper", "cannot finish inside", "misses in the lane"])}${rb ? `. ${o ? "Offensive rebound" : "Rebound"} ${rb}` : ""}`); }
			for (let made = r[11], att = r[12]; att > 0;) { const a = Math.min(2, att), m = clamp(rnd(0, a), Math.max(0, made - (att - a)), Math.min(a, made)); const f = take(1 - side, "pf"); add(m, `${n} makes ${m} of ${a} at the line${f ? ` (foul on ${f})` : ""}`); made -= m; att -= a; }
			for (let i = 0; i < r[5]; i++) { const v = take(1 - side, "tov"); add(0, v ? `${n} steals it from ${v}` : `${n} comes up with a steal`); }
		}
	});
	left.forEach((rows, side) => rows.forEach((x) => { for (; x.tov > 0; x.tov--) ev.push({ side, ab: abs[side], pts: 0, txt: `${x.n} ${one(["throws it away", "is called for traveling", "loses it out of bounds", "is whistled for an offensive foul"])}` }); }));
	shuffle(ev); const sc = [0, 0];
	ev.forEach((e, i) => { e.t = Math.floor((i + Math.random()) / ev.length * 2880); sc[e.side] += e.pts; e.s = sc.slice(); });
	return ev;
}
function stopLive() { if (UI.live && UI.live.timer) { clearInterval(UI.live.timer); UI.live.timer = 0; } }
function startLive(i) { const g = G.log[i]; if (!g || !g.b) return; stopLive(); UI.live = { i, ev: UI.lastEv && UI.lastEv.i === i ? UI.lastEv.ev : buildFeed(g), names: UI.lastEv && UI.lastEv.i === i ? UI.lastEv.names : null, box: false, pos: 0, fast: false, done: false, timer: 0 }; UI.sheet = { k: "live" }; UI.toast = ""; render(); UI.live.timer = setInterval(liveTick, 550); }
function liveTick() {
	const L = UI.live; if (!L || !UI.sheet || UI.sheet.k !== "live") return stopLive();
	if (L.pos >= L.ev.length) { stopLive(); L.done = true; UI.keepScroll = true; return render(); }
	const e = L.ev[L.pos++], feed = $("#lvfeed"), sc = $("#lvscore"); if (!feed || !sc) return;
	if (L.box) { const b = $("#lvbox"); if (b) b.innerHTML = liveBox(); } else { feed.insertAdjacentHTML("afterbegin", liveRow(e)); while (feed.children.length > 40) feed.lastChild.remove(); }
	sc.innerHTML = liveScore();
}
function liveBox() {
	const L = UI.live, e = L.pos ? L.ev[L.pos - 1] : L.ev[0], g = G.log[L.i]; if (!e || !e.bx || !L.names) return "";
	return [team(G.userTid), team(g.o)].map((t, i) => `<h2 class="d">${esc(t.name)} ${e.s[i]}</h2><div class="scroll"><table><tr><th>Player</th><th>Min</th><th>Pts</th><th>Reb</th><th>Ast</th><th>PF</th></tr>${e.bx[i].map((r, k) => `<tr><td><span class="nm">${r[0] ? "● " : ""}${esc(L.names[i][k])}</span></td><td>${r[1]}</td><td><b>${r[2]}</b></td><td>${r[3]}</td><td>${r[4]}</td><td class="${r[5] >= 5 ? "bad" : ""}">${r[5]}</td></tr>`).join("")}</table></div>`).join("") + '<p class="note">● on the floor now.</p>';
}
function liveScore() {
	const L = UI.live, g = G.log[L.i], e = L.pos ? L.ev[L.pos - 1] : { s: [0, 0], t: 0 }, ot = e.t >= 2880, q = Math.min(4, 1 + Math.floor(e.t / 720)), left = ot ? 300 - ((e.t - 2880) % 300) : 720 - (e.t % 720);
	return `<div class="kv"><div><b>${e.s[0]}</b><span>${esc(team(G.userTid).ab)}${g.home ? " · home" : ""}</span></div><div><b>${e.s[1]}</b><span>${esc(team(g.o).ab)}${g.home ? "" : " · home"}</span></div><div><b>${L.done ? "Final" : ot ? "OT" : "Q" + q}</b><span>${L.done ? (g.us > g.them ? "You win" : "You lose") : Math.floor(left / 60) + ":" + String(left % 60).padStart(2, "0") + " left"}</span></div></div>`;
}
const liveRow = (e) => `<div><span>${e.pts ? "<b>" : ""}${esc(e.txt)}${e.pts ? "</b>" : ""}</span><span class="mute" style="white-space:nowrap">${e.ab ? esc(e.ab) + " · " : ""}${e.s[0]}–${e.s[1]}</span></div>`;
function watchNext(po) { const n = G.log.length; UI.record = true; if (po) playPlayoffs("day"); else playDays(1, true); UI.record = false; if (G.log.length > n) startLive(G.log.length - 1); }

/* ---------- Claude features ----------
   Game recaps, the weekly newsletter, scouting reports, the agent, the other GM in a trade and the assistant GM are all
   written by Claude, and only when you tap for one. The game sends that feature's facts to this site's own /api/claude
   function (netlify/functions/claude.mjs), which holds the API key and asks Claude. Replies are kept in memory for this
   visit only, never in the save, so the save shape doesn't change.
   Each reply has a key: its kind, then what it is about (recap:season:game, scout:season:id, ...). aiBox(key) draws
   the button, the waiting line or the reply; tapping the button calls AIF[kind](key) for the facts. */
const AI = {};
const pInfo = (p, price) => { const st = off() && p.ls ? p.ls : p.s, gp = st && st[0]; return { n: p.n, pos: p.pos, age: age(p) + (off() ? 1 : 0), ovr: p.ovr, pot: p.pot, ...(price != null ? { sal: price, exp: capYear() + (p.askY || 1) - 1 } : p.tid >= 0 ? { sal: p.sal, exp: p.exp } : {}), ...(gp ? { ppg: st[2] / gp, rpg: st[3] / gp, apg: st[4] / gp } : {}) }; };
const tFull = (t) => t.region + " " + t.name;
const confRank = (t) => { const c = standings(t.cid); return ORD(c.indexOf(t) + 1) + " in the " + (t.cid ? "West" : "East"); };
const nowText = () => G.phase === "regular" ? `week ${Math.floor(G.day / 7) + 1} of the regular season` : G.phase === "playoffs" ? `the playoffs, ${ROUND[G.po.round]}` : G.phase === "draft" ? "the draft" : G.phase === "resign" ? "the offseason, re-signing" : `free agency, day ${G.faDay || 0}`;
const AIF = {
	recap(key) {
		const g = G.log[+key.split(":")[2]]; if (!g || !g.b) return null;
		const side = (t, rows, pts, q) => ({ team: tFull(t), pts, q: q || [], players: rows.filter((r) => r[1] > 0).sort((a, b) => b[2] - a[2]).slice(0, 6).map((r) => ({ n: r[0], min: r[1], pts: r[2], reb: r[3], ast: r[4], stl: r[5], blk: r[6], fg: r[8] + "-" + r[9], tp: r[7] + "-" + r[10], ft: r[11] + "-" + r[12] })) });
		return { season: seasonName(G.season), playoffs: !!g.po, home: !!g.home, you: side(team(G.userTid), g.b[0], g.us, g.q && g.q[0]), opp: side(team(g.o), g.b[1], g.them, g.q && g.q[1]) };
	},
	news() {
		const conf = (cid) => standings(cid).map((t) => ({ n: tFull(t), w: t.w, l: t.l, me: t.tid === G.userTid })), ps = G.players.filter((p) => p.tid >= 0 && p.s && p.s[0]), most = Math.max(1, ...ps.map((p) => p.s[0]));
		const q = ps.filter((p) => p.s[0] >= .6 * most);
		return { season: seasonName(G.season), when: nowText(), east: conf(0), west: conf(1), news: G.news.filter((n) => n.s === G.season).slice(0, 14).map((n) => n.t),
			leaders: q.length ? LEAD.map(([k, l]) => ({ cat: l, rows: q.slice().sort((a, b) => b.s[k] / b.s[0] - a.s[k] / a.s[0]).slice(0, 3).map((p) => ({ n: p.n, t: team(p.tid).ab, v: p.s[k] / p.s[0] })) })) : [] };
	},
	scout(key) {
		const p = byId(+key.split(":")[2]); if (!p || p.tid !== -2) return null; const P = poolInfo(), rk = P.rank.get(p.id);
		return { n: p.n, pos: p.pos, age: age(p) + (off() ? 1 : 0), hgt: ht(p), ovr: p.ovr, pot: p.pot, rank: rk, of: P.n, proj: projLabel(rk), str: P.str(p), r: RLAB.filter(([, k]) => p.r[k] != null).map(([l, k]) => ({ l, v: p.r[k] })) };
	},
	agent(key) {
		const [, id, , re] = key.split(":"), p = byId(+id); if (!p || p.ask == null) return null; const m = mood(p), t = team(G.userTid), resign = re === "1";
		return { p: pInfo(p), resign, team: tFull(t), w: t.w, l: t.l, market: p.ask, price: userAsk(p), yrs: p.askY, why: m.f.map(([w, d]) => ({ t: w, d: Math.round(d * 100) })), no: resign && m.no, others: resign ? null : G.teams.filter((x) => x.tid !== G.userTid && canSign(x.tid, p)).length };
	},
	trade() {
		const o = team(UI.tradeTid), c = tradeCheck(), pk = (l) => l.map(pkFind).filter(Boolean).map(pkLabel), ps = (l) => l.map(byId).filter(Boolean).map((p) => pInfo(p));
		return { them: tFull(o), w: o.w, l: o.l, rank: confRank(o), get: ps(UI.tradeA), getPk: pk(UI.tradePA), give: ps(UI.tradeB), givePk: pk(UI.tradePB), verdict: c.msg };
	},
	ask(key) {
		const a = (UI.asks || []).find((x) => x.key === key), t = team(G.userTid), tax = TAXL(); if (!a) return null;
		const rules = capFree() ? "There is no salary cap for you in this league." : hardCap() ? "Hard cap: no team may go over the cap, even to re-sign its own players." : "Soft cap: you may go over it to re-sign your own players, sign anyone at $1.5M or less, and take back up to 125% of outgoing salary in trades when over it.";
		let plan = ""; try { plan = stratSummary(); } catch (e) { plan = ""; }
		return { q: a.q, season: seasonName(G.season), when: nowText(), team: tFull(t), w: t.w, l: t.l, rank: confRank(t), rating: teamRating(t.tid), pay: payroll(t.tid), cap: opt("cap"), tax: tax < 1e8 ? tax : 0, rules, plan,
			roster: sortRoster(t.tid).map((p) => pInfo(p)), fa: G.players.filter((p) => p.tid === -1).sort((x, y) => y.ovr - x.ovr).slice(0, 10).map((p) => pInfo(p, p.ask != null ? userAsk(p) : null)),
			targets: G.players.filter((p) => p.tid >= 0 && p.tid !== t.tid).sort((x, y) => y.ovr - x.ovr).slice(0, 15).map((p) => ({ ...pInfo(p), n: p.n + ", " + team(p.tid).ab })),
			standings: standings().map((x) => ({ n: tFull(x), w: x.w, l: x.l })) };
	},
};
function aiFetch(key) {
	const kind = key.split(":")[0]; if (!AIF[kind] || (AI[key] && (AI[key].wait || AI[key].text))) return;
	let facts = null; try { facts = AIF[kind](key); } catch (e) { facts = null; }
	if (!facts) { AI[key] = { err: 1 }; return; }
	AI[key] = { wait: true };
	fetch("/api/claude", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, facts }) })
		.then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
		.then((d) => { AI[key] = d && d.text ? { text: d.text } : { err: 1 }; })
		.catch(() => { AI[key] = { err: 1 }; })
		.then(() => { if (document.querySelector(`[data-aikey="${CSS.escape(key)}"]`)) { UI.keepScroll = true; render(); } });
}
// A reply as paragraphs. With head, the first line is a headline; short lines without an ending stop are section headings.
function aiText(text, head) {
	return text.split(/\n+/).map((x) => x.trim()).filter(Boolean).map((x, i) => (head && i === 0) || (head && x.length < 48 && !/[.!?:,]$/.test(x)) ? `<b>${esc(x)}</b>` : `<p>${esc(x)}</p>`).join("");
}
// The button, the waiting line or the reply for one key. o: { btn, about, wait, by, head }.
function aiBox(key, o) {
	const r = AI[key];
	const inner = r && r.text ? `<div class="recap">${aiText(r.text, o.head)}<p class="note">${esc(o.by || "Written by Claude.")}</p></div>`
		: r && r.wait ? `<p class="note">${esc(o.wait || "Writing…")}</p>`
		: `<button class="btn alt" data-a="ai" data-k="${esc(key)}">${esc(o.btn)}</button><p class="note">${r && r.err ? "That couldn't be written. These work on the online version, with a connection." : esc(o.about)}</p>`;
	return `<div data-aikey="${esc(key)}">${inner}</div>`;
}
const recapHtml = (i) => aiBox(`recap:${G.season}:${i}`, { btn: "Write a game recap", about: "Sends this box score to Claude, which writes a short story of the game.", wait: "Writing the recap…", by: "Written by Claude from this box score.", head: true });
const newsHtml = () => `<section><h2 class="d">Around the League</h2>${aiBox(`news:${G.season}:${G.phase}:${G.phase === "regular" ? Math.floor(G.day / 7) : G.phase === "playoffs" ? G.po.round : G.faDay || 0}`, { btn: "Read this week's newsletter", about: "Sends the standings, the league leaders and this season's news to Claude, which writes a newsletter about the week.", wait: "Writing the newsletter…", by: "Written by Claude from this league's standings, leaders and news.", head: true })}</section>`;
const scoutHtml = (p) => aiBox(`scout:${G.season}:${p.id}`, { btn: "Read the scouting report", about: "Sends his ratings and draft position to Claude, which writes a scout's report.", wait: "Writing the report…", by: "Written by Claude from his ratings." });
const agentHtml = (p, re) => aiBox(`agent:${p.id}:${userAsk(p)}:${re ? 1 : 0}`, { btn: "Hear from his agent", about: "Sends his price and the reasons behind it to Claude, which answers as his agent. The price itself does not change.", wait: "Calling his agent…", by: "Claude speaking as his agent. The price and reasons are the game's." });
function tradeTalkHtml() {
	// Only when their side has judged the value: a deal stopped by a rule (cap, roster size) is not theirs to explain.
	const c = tradeCheck(); if (!c.ok && !/want more|not interested/.test(c.msg)) return "";
	const sig = [UI.tradeTid, UI.tradeA.slice().sort().join(","), UI.tradeB.slice().sort().join(","), UI.tradePA.slice().sort().join(","), UI.tradePB.slice().sort().join(",")].join("|");
	return aiBox(`trade:${sig}`, { btn: `Ask the ${team(UI.tradeTid).name} GM`, about: "Sends this offer and the game's answer to Claude, which explains it as their general manager. Their answer does not change.", wait: "Waiting on their GM…", by: "Claude speaking as their GM. The decision is the game's." });
}
function askHtml() {
	return `<section><h2 class="d">Ask your assistant GM</h2><p class="note">Ask about your roster, the cap, free agents or trade targets. Your question and your team's facts go to Claude.</p>
	<div class="row"><input type="text" id="askq" maxlength="300" placeholder="Who could fix our defense under $10M?" value="${esc(UI.askQ || "")}" aria-label="Your question"><button class="btn go" style="width:auto" data-a="askgm">Ask</button></div>
	${(UI.asks || []).slice().reverse().map((a) => `<p class="note" style="margin-top:12px"><b>You asked:</b> ${esc(a.q)}</p>${aiBox(a.key, { btn: "Try again", about: "", wait: "Thinking it over…", by: "Claude, from your league's facts." })}`).join("")}</section>`;
}

/* ---------- saving ---------- */
const IDX = "hardwoodgm:index", CUR = "hardwoodgm:cur", keyOf = (id) => (id === "1" ? KEY : KEY + ":" + id);
const store = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }, del: (k) => { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } } };
// Box scores for every game of the current season. They are too big for the save itself, so they live in memory
// and, where the browser allows it, in IndexedDB. The save keeps only the scores (G.sc).
const BX = {
	db: null, opening: null, mem: new Map(), pend: new Map(), full: "", busy: null, busyPre: "",
	pre: (id, season) => `${id}|${season}|`,
	key: (dk) => `${G.id}|${G.season}|${String(dk).padStart(4, "0")}`,
	open() { if (!BX.opening) BX.opening = new Promise((res) => { setTimeout(() => res(false), 2000); try { const rq = indexedDB.open("hardwoodgm", 1); rq.onupgradeneeded = () => rq.result.createObjectStore("box"); rq.onsuccess = () => { BX.db = rq.result; res(true); }; rq.onerror = () => res(false); rq.onblocked = () => res(false); } catch (e) { res(false); } }); return BX.opening; },
	add(dk, g) { const k = BX.key(dk), a = BX.mem.get(k) || []; a.push(g); BX.mem.set(k, a); BX.pend.set(k, a); },
	day: (dk) => BX.mem.get(BX.key(dk)),
	flush() { if (!BX.pend.size) return; const items = [...BX.pend]; BX.pend.clear(); BX.open().then((ok) => { if (!ok) return; try { const st = BX.db.transaction("box", "readwrite").objectStore("box"); for (const [k, v] of items) st.put(v, k); } catch (e) { /* box scores stay in memory only */ } }); },
	loadSeason() {
		const pre = BX.pre(G.id, G.season); if (BX.full === pre) return Promise.resolve(); if (BX.busy && BX.busyPre === pre) return BX.busy;
		BX.busyPre = pre; BX.busy = BX.open().then((ok) => new Promise((res) => { const done = () => { BX.full = pre; BX.busy = null; res(); }; if (!ok) return done(); try { const st = BX.db.transaction("box").objectStore("box"), rg = IDBKeyRange.bound(pre, pre + "\uffff"), ks = st.getAllKeys(rg), vs = st.getAll(rg); vs.onsuccess = () => { (ks.result || []).forEach((k, i) => { if (!BX.mem.has(k)) BX.mem.set(k, vs.result[i]); }); done(); }; vs.onerror = done; } catch (e) { done(); } }));
		return BX.busy;
	},
	// Forget a league's box scores, except (optionally) one season's.
	prune(id, keepSeason) {
		const pre = `${id}|`, keep = keepSeason == null ? null : BX.pre(id, keepSeason), gone = (k) => String(k).startsWith(pre) && !(keep && String(k).startsWith(keep));
		for (const m of [BX.mem, BX.pend]) for (const k of [...m.keys()]) if (gone(k)) m.delete(k);
		if (!keep || BX.full !== keep) BX.full = "";
		BX.open().then((ok) => { if (!ok) return; try { const st = BX.db.transaction("box", "readwrite").objectStore("box"), rq = st.openKeyCursor(IDBKeyRange.bound(pre, pre + "\uffff")); rq.onsuccess = () => { const c = rq.result; if (!c) return; if (gone(c.key)) st.delete(c.key); c.continue(); }; } catch (e) { /* ignore */ } });
	} };
// True once this season's box scores are in memory; otherwise starts loading them and redraws when they arrive.
function bxNeed() { const pre = BX.pre(G.id, G.season); if (BX.full === pre) return true; BX.loadSeason().then(() => { if (G && !(UI.sheet && UI.sheet.k === "live")) { UI.keepScroll = true; render(); } }); return false; }
const dayName = (dk) => (dk >= 1000 ? `Playoffs, day ${dk - 1000}` : dk === 999 ? "Play-in" : `Day ${dk + 1}`);
// Every game a player appeared in this season, newest first.
function gameLog(pid) {
	const pre = BX.pre(G.id, G.season), out = [];
	for (const [k, games] of BX.mem) if (k.startsWith(pre)) { const dk = +k.slice(pre.length); games.forEach((gm, i) => { const sc = ((G.sc || {})[dk] || [])[i]; if (!sc || sc[0] !== gm.h || sc[1] !== gm.a || sc[2] !== gm.hs || sc[3] !== gm.as) return; for (const side of [0, 1]) { const r = gm.b[side].find((x) => x[17] === pid); if (r && r[1] > 0) out.push({ dk, i, gm, side, r }); } }); }
	return out.sort((a, b) => b.dk - a.dk);
}
function leagues() {
	let a = []; try { a = JSON.parse(store.get(IDX) || "[]"); } catch (e) { a = []; }
	if (!a.some((x) => x.id === "1") && store.get(KEY)) { try { const g = JSON.parse(store.get(KEY)); a.push({ id: "1", name: g.teams[g.userTid].region + " " + g.teams[g.userTid].name, season: g.season, t: 0 }); } catch (e) { /* ignore */ } }
	return a;
}
function save(now) {
	if (!G) return; G.id = G.id || "1"; BX.flush();
	if (!store.set(keyOf(G.id), JSON.stringify(G)) && !UI.warned) { UI.warned = true; setTimeout(() => toast("This browser would not save the game. It may be out of storage; deleting a league you no longer play can free some."), 50); }
	const t = team(G.userTid), a = leagues().filter((x) => x.id !== G.id); a.unshift({ id: G.id, name: t.region + " " + t.name, season: G.season, t: Date.now() }); store.set(IDX, JSON.stringify(a)); store.set(CUR, G.id);
	if (now) cloudSave();
}
function cloudSave() { if (!cloud || !G) return; try { const s = JSON.stringify(G); if (s.length < 900000) Promise.resolve(cloud.set({ t: Date.now(), season: G.season, s })).catch(() => {}); } catch (e) { /* ignore */ } }
function migrate(g) {
	const ts = (DATA["s" + g.start] || {}).teams || [], offs = ["draft", "resign", "fa"].includes(g.phase), mk = (y) => g.teams.flatMap((t) => [1, 2].map((r) => ({ y, r, o: t.tid, t: t.tid })));
	if (!g.rec) g.rec = { g: [], s: [] }; if (!g.ach) g.ach = {}; if (!g.drafts) g.drafts = []; if (g.diff == null) g.diff = 1;
	if (!g.fin) g.fin = newFin(); if (!g.owner) g.owner = { w: 0, p: 0, m: 0, yrs: 0 }; if (!g.offers) g.offers = [];
	for (const t of g.teams) { const d = ts[t.tid] || []; if (t.pop == null) t.pop = d[7] || 3; if (t.prev == null) t.prev = .5; if (!t.fr) t.fr = d[8] || t.ab; if (t.pv == null) t.pv = paceV(d[9]); if (t.titles == null) t.titles = g.history.filter((h) => h.champ === t.ab).length; }
	const first = !g.hof, prior = {}, pad = (a) => { if (a) while (a.length < 17) a.push(0); };
	if (first) for (const r of (DATA["s" + g.start] || { rows: [] }).rows) { const b = DATA.players[r[0]]; prior[b[0] + "|" + b[1]] = r.slice(11, 15); }
	const real = {}; if (g.players.some((p) => p.r.length < 15)) for (const r of (DATA["s" + g.start] || { rows: [] }).rows) { const b = DATA.players[r[0]]; real[b[0] + "|" + b[1]] = r.slice(15, 23); }
	for (const p of g.players) { if (p.r.length < 15) { const x = !p.gen && real[p.n + "|" + p.born]; if (x && x.length === 8) p.r = p.r.slice(0, 7).concat(x); else ext(p); }
		pad(p.s); pad(p.ls); p.h = p.h || []; p.aws = p.aws || []; const pr = first && !p.gen && prior[p.n + "|" + p.born]; if (pr) for (let i = 0; i < 4; i++) p.c[i] += pr[i]; }
	// Saves from before tendencies: real players get theirs from their real stats (the league's first season, else their
	// first real season, else their draft class); everyone else gets them from their ratings.
	if (g.players.some((p) => p.r.length < 17)) {
		const tn = {}; for (const k of [g.start, ...Object.keys(DATA).filter((k) => /^s\d{4}$/.test(k)).map((k) => +k.slice(1)).sort((a, b) => a - b)]) for (const r of (DATA["s" + k] || { rows: [] }).rows) { const b = DATA.players[r[0]], key = b[0] + "|" + b[1]; if (!tn[key] && r.length >= 25) tn[key] = r.slice(23, 25); }
		for (const k of Object.keys(DATA).filter((k) => /^c\d{4}$/.test(k))) for (const c of DATA[k] || []) { const b = DATA.players[c[0]]; if (b && c.length >= 21 && !tn[b[0] + "|" + b[1]]) tn[b[0] + "|" + b[1]] = c.slice(19, 21); }
		for (const p of g.players) if (p.r.length < 17) { const x = !p.gen && tn[p.n + "|" + p.born]; if (x) { p.r[15] = x[0]; p.r[16] = x[1]; } else ext(p); }
	}
	g.hof = g.hof || []; if (g.dist && g.dist.length < 17) g.dist = mkDist(g, g.dist);
	// Development used to run right after the playoffs. A save caught in the offseason has already had this year's.
	if (g.devV !== 2) { if (offs) g.devSkip = 1; if (g.prog) { g.prog.s += 1; for (const p of g.players) if (p.dvS != null) p.dvS += 1; } g.devV = 2; } if (!g.sc) g.sc = {}; if (!g.h2h) g.h2h = {};
	if (!g.picks || !g.picks.length) g.picks = offs ? [] : mk(g.season);
	for (let y = g.season + (offs ? 1 : 0); y <= g.season + 2; y++) if (!g.picks.some((k) => k.y === y)) g.picks.push(...mk(y));
	if (!offs && !g.players.some((p) => p.tid === -2)) { const keep = G; G = g; addClass(); G = keep; }
	return g;
}
function load(id) { id = id || store.get(CUR) || "1"; try { const s = store.get(keyOf(id)); if (s) { const g = JSON.parse(s); if (g && g.v === 1 && g.teams) { g.id = id; return migrate(g); } } } catch (e) { /* ignore */ } return null; }
function connectCloud() {
	const c = window.claude; if (!c || !c.use) return;
	Promise.all([c.use("db"), c.use("user")]).then(async ([db, user]) => {
		if (!db || !user) return; const id = await user.id(); if (!id) return;
		cloud = db.collection("data/users/" + id).doc("save");
		const snap = await cloud.get(), d = snap && (typeof snap.data === "function" ? snap.data() : snap.data || snap);
		if (!G && !leagues().length && d && d.s) { const g = JSON.parse(d.s); if (g && g.v === 1) { G = migrate(g); setAccent(team(G.userTid).c1); toast("Restored your league from your Claude account."); render(); } }
	}).catch(() => {});
}

/* ---------- views ---------- */
function toast(t) { UI.toast = t; clearTimeout(toastT); toastT = setTimeout(() => { UI.toast = ""; const e = $(".toast"); if (e) e.remove(); }, 3200); render(); }
const tname = (t, s) => `<span class="team">${badge(t, s || 22)}<span>${esc(t.ab)}</span></span>`;
const pc = (m, a) => (a ? (100 * m / a).toFixed(1) + "%" : "–");
const pg = (p, k) => { const s = off() && p.ls ? p.ls : p.s; return s[0] ? f1(s[k] / s[0]) : "–"; };
function playerRows(ps, opts) {
	opts = opts || {};
	return ps.map((p, i) => `<tr data-a="player" data-id="${p.id}" class="${opts.cut && i === 4 ? "cut" : ""}"><td><span class="nm">${esc(p.n)}${p.inj ? `<span class="tag">OUT ${p.inj}</span>` : ""}${p.aw ? ' <span class="mute">★</span>' : ""}</span><span class="sub">${esc(p.pos)} · ${age(p) + (off() ? 1 : 0)}${tags(p) ? " · " + tags(p) : ""}${opts.ask ? ` · <b style="color:var(--ink)">${money(userAsk(p))}</b> a year, ${p.askY} yr${p.askY > 1 ? "s" : ""}` : opts.slot ? (p.slot && p.slot < 61 && !p.gen ? ` · really went #${p.slot}` : "") : ` · ${money(p.sal)} to ${p.exp}`}</span>${opts.can ? (opts.can(p) ? '<span class="sub good">✓ You can sign him</span>' : opts.shortBy && opts.shortBy(p) > .05 ? `<span class="sub">Needs ${money(opts.shortBy(p))} more cap room</span>` : "") : ""}</td><td class="ovr">${p.ovr}${opts.dv && G.prog && p.dvS === G.prog.s ? dvTag(p.dv) : ""}</td><td>${p.pot}</td>${opts.slot ? `<td>${p.r[0]}</td><td>${p.r[8]}</td><td>${p.r[2]}</td><td>${p.r[3]}</td><td>${p.r[4]}</td>` : `<td>${pg(p, 1)}</td><td>${pg(p, 2)}</td><td>${pg(p, 3)}</td><td>${pg(p, 4)}</td>`}</tr>`).join("");
}
const tags = (p) => { const sy = styleOf(p); return sy.length ? esc(sy.slice(0, 2).map((x) => x[0]).join(", ")) : ""; };
const PH = `<tr><th>Player</th><th>Ovr</th><th>Pot</th><th>Min</th><th>Pts</th><th>Reb</th><th>Ast</th></tr>`;
const sortRoster = (tid) => { const ps = roster(tid); if (tid === G.userTid && !G.auto) { const ix = (p) => { const i = G.order.indexOf(p.id); return i < 0 ? 99 : i; }; return ps.sort((a, b) => ix(a) - ix(b)); } return ps.sort((a, b) => (a.inj ? 1 : 0) - (b.inj ? 1 : 0) || b.ovr - a.ovr); };
function allRatings() { const m = rosterMap(), all = G.teams.map((t) => net(rotation(m[t.tid], t.tid))), avg = all.reduce((a, b) => a + b, 0) / all.length; return all.map((v) => Math.round(clamp(50 + (v - avg) * K_MARGIN * 4, 1, 99))); }
function teamRating(tid) { return allRatings()[tid]; }
function vHome() {
	const t = team(G.userTid), conf = standings(t.cid), rank = conf.indexOf(t) + 1, ps = roster(t.tid), top = (k) => ps.filter((p) => p.s[0]).sort((a, b) => b.s[k] / b.s[0] - a.s[k] / a.s[0])[0];
	let next = "";
	if (G.phase === "regular") { const g = (G.sched[G.day] || []).find((x) => x.includes(t.tid)); next = g ? `Next: ${g[0] === t.tid ? "vs" : "at"} ${esc(team(g[0] === t.tid ? g[1] : g[0]).region)}` : "Day off"; }
	else if (G.phase === "playoffs") { const s = G.po.series.find((x) => x.a === t.tid || x.b === t.tid); next = s ? `${ROUND[G.po.round]}: ${esc(team(s.a).ab)} ${s.wa}–${s.wb} ${esc(team(s.b).ab)}` : esc(G.ures || ROUND[G.po.round]); }
	else next = G.phase === "draft" ? "The draft is under way" : G.phase === "resign" ? "Re-sign your players" : `Free agency, day ${G.faDay || 0} of ${FA_DAYS}`;
	const last = G.log.slice(-6).reverse(), up = [];
	for (let d = G.day; G.phase === "regular" && d < G.sched.length && up.length < 5; d++) { const g = G.sched[d].find((x) => x.includes(t.tid)); if (g) up.push(g); }
	return `<section><h1 class="d">${esc(t.region)}<br>${esc(t.name)}</h1><p class="mute">${next}</p>
	<div class="kv"><div><b>${t.w}–${t.l}</b><span>Record</span></div><div><b>${rank}${ord(rank)}</b><span>${t.cid ? "West" : "East"}</span></div><div><b>${teamRating(t.tid)}</b><span>Team rating</span></div></div></section>
	${G.phase === "regular" || G.phase === "playoffs" ? `<section><h2 class="d">Team leaders</h2><div class="list">${[[2, "Points"], [3, "Rebounds"], [4, "Assists"]].map(([k, l]) => { const p = top(k); return p ? `<button class="chip" style="border-radius:0;border-width:0 0 1px;padding:0" data-a="player" data-id="${p.id}"><span>${l}</span><b>${esc(p.n)} · ${f1(p.s[k] / p.s[0])}</b></button>` : ""; }).join("") || '<div class="mute">No games played yet.</div>'}</div></section>` : ""}
	${last.length ? `<section><h2 class="d">Last games</h2><div class="list">${last.map((g, j) => `<div ${g.b ? `data-a="box" data-i="${G.log.length - 1 - j}" style="cursor:pointer"` : ""}><span><b class="${g.us > g.them ? "good" : "bad"}">${g.us > g.them ? "W" : "L"}</b> ${g.home ? "vs" : "at"} ${tname(team(g.o))}</span><b>${g.us}–${g.them}${g.b || g.d != null ? " ›" : ""}</b></div>`).join("")}</div></section>` : ""}
	${(G.offers = (G.offers || []).filter(offerLive)).length ? `<section><h2 class="d">Trade offers</h2><div class="list">${G.offers.map((o, i) => `<div><span><b>${esc(team(o.tid).name)}</b> offer ${esc(offerText(o, 0))} <span class="sub">for ${esc(offerText(o, 1))}</span></span><button class="btn" data-a="offer" data-i="${i}">Review</button></div>`).join("")}</div></section>` : ""}
	${up.length ? `<section><h2 class="d">Coming up</h2><div class="list">${up.map((g) => { const o = team(g[0] === t.tid ? g[1] : g[0]); return `<div data-a="viewteam" data-tid="${o.tid}" style="cursor:pointer"><span>${g[0] === t.tid ? "vs" : "at"} ${tname(o)}</span><span class="mute">${o.w}–${o.l}</span></div>`; }).join("")}</div></section>` : ""}
	${G.log.length || up.length ? '<button class="btn alt" data-a="sched">Full schedule and results</button>' : ""}
	${G.prog && G.phase === "regular" && G.season === G.prog.s && G.day < 14 ? (() => { const sm = progSummary(); if (!sm) return ""; const top = sm.rs.slice().sort((x, y) => Math.abs(y[0][2] - y[0][1]) - Math.abs(x[0][2] - x[0][1])).slice(0, 4); return `<section><h2 class="d">Player development <small>before ${seasonName(G.prog.s)}</small></h2><p class="note">Your team: average rating ${f1(sm.b)} → ${f1(sm.n)}, ${sm.up} improved, ${sm.dn} declined.</p><div class="list">${top.map(([r, p]) => `<div data-a="player" data-id="${p.id}" style="cursor:pointer"><span><b>${esc(p.n)}</b><span class="sub">age ${r[6]}${progBits(r) ? " · " + esc(progBits(r)) : ""}</span></span><b>${r[1]} → ${r[2]} ${dvTag(r[2] - r[1])}</b></div>`).join("")}</div><button class="btn alt" data-a="prog">See the full report</button></section>`; })() : ""}
	${newsHtml()}
	${askHtml()}
	<section><h2 class="d">News</h2><div class="chips">${[["", "All"], ["trade", "Trades"], ["sign", "Signings"], ["inj", "Injuries"], ["big", "Big games"]].map(([k, l]) => `<button class="chip" aria-pressed="${(UI.nf || "") === k}" data-a="nfilter" data-k="${k}">${l}</button>`).join("")}</div><div class="list">${G.news.filter((n) => !UI.nf || { trade: /^Trade|offer for/, sign: /sign|draft|Expansion/i, inj: /will miss about/, big: /scores \d|triple-double|All-Star|Achievement|title|retires|lottery|deadline/ }[UI.nf].test(n.t)).slice(0, UI.nf ? 30 : 10).map((n) => `<div><span>${esc(n.t)}</span><span class="mute" style="white-space:nowrap">${n.s !== G.season ? seasonName(n.s) : ""}</span></div>`).join("") || '<div class="mute">Nothing yet.</div>'}</div></section>
	${leaguesBox()}`;
}
function vRoster() {
	const tid = UI.viewTid == null ? G.userTid : UI.viewTid, t = team(tid), RK = ["lineup", "ovr", "pot", "young", "sal", "pts", "reb", "ast"], rl = tid === G.userTid ? "rmine" : "rteam", ps = listSort(rl, sortRoster(tid), RK, "lineup"), mine = tid === G.userTid, pay = payroll(tid), lineupView = UI.ls[rl].k === "lineup" && !UI.ls[rl].pos && !UI.ls[rl].rev;
	return `<section><h2 class="d">${esc(t.region)} ${esc(t.name)} <small>${ps.length}/${RMAX} players${t.titles ? " · " + t.titles + " title" + (t.titles > 1 ? "s" : "") : ""}</small></h2>
	<p class="note">Payroll ${money(pay)} of a ${money(opt("cap"))} cap${pay <= opt("cap") ? ` · ${money(opt("cap") - pay)} room` : " · over the cap"}. Top five start; the next five come off the bench.</p>${mine ? `<div class="row"><button class="btn alt" style="flex:1" data-a="cap">Cap and contracts</button>${G.prog ? '<button class="btn alt" style="flex:1" data-a="prog">Player development</button>' : ""}</div>${G.prog ? `<p class="note">The small numbers next to Ovr are each player's change before ${seasonName(G.prog.s)}.</p>` : ""}` : ""}
	${(() => { let id = ""; try { id = identity(tid, dayCtx()); } catch (e) { id = ""; } return id ? `<p class="note"><b>Style:</b> ${esc(id.replace(/^Plays/, "plays"))}${mine ? ` <b>Plan:</b> ${esc(stratSummary())}.` : ""}</p>` : ""; })()}${mine ? '<div class="row"><button class="btn alt" style="flex:1" data-a="strat">Team strategy</button></div>' : ""}
	${mine ? `<div class="row"><button class="chip" aria-pressed="${G.auto}" data-a="auto">Coach sets the lineup</button>${G.auto ? "" : '<span class="note">Tap a player to move him up or down.</span>'}</div>` : `<div class="row"><button class="btn alt" data-a="viewteam" data-tid="">Back to my team</button><button class="btn" data-a="tradewith" data-tid="${tid}">Trade with them</button></div>`}
	${listBar(rl, RK, "lineup")}${lineupView ? "" : `<p class="note">Sorted view.${mine ? " Your lineup order has not changed; choose Lineup to see it." : ""}</p>`}
	<div class="scroll"><table>${sortHdr(rl, [["Player", null], ["Ovr", "ovr"], ["Pot", "pot"], ["Min", "min"], ["Pts", "pts"], ["Reb", "reb"], ["Ast", "ast"]])}${playerRows(ps, { cut: lineupView, dv: true })}</table></div><div class="row"><button class="btn alt" style="flex:1" data-a="tlog" data-tid="${tid}">Results and head-to-head</button></div></section>
	${t.hist && t.hist.length ? `<section><h2 class="d">Franchise history <small>${t.titles || 0} title${t.titles === 1 ? "" : "s"}</small></h2><div class="scroll"><table><tr><th>Season</th><th>W</th><th>L</th><th>Playoffs</th></tr>${t.hist.slice().reverse().map((x) => `<tr><td>${seasonName(x[0])}</td><td>${x[1]}</td><td>${x[2]}</td><td>${["–", "First round", "Semifinals", "Conference finals", "Lost the Finals", "Champions"][x[3]]}</td></tr>`).join("")}</table></div></section>` : ""}`;
}
const LEAD = [[2, "Points"], [3, "Rebounds"], [4, "Assists"], [5, "Steals"], [6, "Blocks"], [7, "Threes"]];
function vLeague() {
	const tabs = [["standings", "Standings"], ["scores", "Scores"], ["teams", "Teams"], ["leaders", "Stats"], ["awards", "Awards"], ["playoffs", "Playoffs"], ["history", "History"]];
	let body = "";
	if (UI.league === "standings") body = [0, 1].map((cid) => { const st = standings(cid); if (!st.length) return ""; const lead = st[0]; return `<section><h2 class="d">${cid ? "Western" : "Eastern"} conference</h2><div class="scroll"><table><tr><th>Team</th><th>W</th><th>L</th><th>Pct</th><th>GB</th><th>Diff</th></tr>${st.map((t, i) => `<tr data-a="viewteam" data-tid="${t.tid}" class="${t.tid === G.userTid ? "me" : ""} ${i === 7 ? "cut" : ""}"><td>${tname(t)}</td><td>${t.w}</td><td>${t.l}</td><td>${pct(t).toFixed(3).slice(1)}</td><td>${i ? f1(((lead.w - t.w) + (t.l - lead.l)) / 2) : "–"}</td><td>${t.w + t.l ? ((t.pf - t.pa) / (t.w + t.l) >= 0 ? "+" : "") + f1((t.pf - t.pa) / (t.w + t.l)) : "–"}</td></tr>`).join("")}</table></div></section>`; }).join("");
	else if (UI.league === "leaders") {
		const modeChips = `<div class="chips">${[["stat", "Stats"], ["p36", "Per 36"], ["adv", "Advanced"], ["rat", "Ratings"]].map(([x, l]) => `<button class="chip" aria-pressed="${(UI.pmode || "stat") === x}" data-a="pmode" data-k="${x}">${l}</button>`).join("")}</div>`;
		if (UI.pmode === "rat") {
			const rc = [["Ovr", (p) => p.ovr], ["Pot", (p) => p.pot], ["Age", (p) => age(p) + (off() ? 1 : 0)], ...[["Cre", 0], ["Ins", 7], ["3pt", 8], ["FT", 9], ["Pas", 2], ["Hnd", 10], ["OReb", 11], ["DReb", 12], ["Def", 4], ["Rim", 13], ["Stl", 14], ["Sta", 5]].map(([l, x]) => [l, (p) => p.r[x]])], k = Math.min(UI.rsort || 0, rc.length - 1), pf = UI.pf === "po" ? "all" : UI.pf || "all";
			const nq = (x) => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(), q = nq(UI.pq || "").trim();
			const ps = G.players.filter((p) => (q ? nq(p.n).includes(q) : pf === "mine" ? p.tid === G.userTid : pf === "watch" ? p.w : pf === "rook" ? p.tid >= 0 && p.dy === G.season - 1 : pf === "fa" ? p.tid === -1 : p.tid >= 0)).sort((a, b) => rc[k][1](b) - rc[k][1](a)).slice(0, 60);
			body = `<section>${modeChips}<div class="chips">${[["all", "Everyone"], ["mine", "My team"], ["watch", "Watch list"], ["rook", "Rookies"], ["fa", "Free agents"]].map(([x, l]) => `<button class="chip" aria-pressed="${pf === x}" data-a="pfilter" data-k="${x}">${l}</button>`).join("")}</div><div class="row"><input type="text" id="psearch" data-a="psearch" value="${esc(UI.pq || "")}" placeholder="Find a player by name" aria-label="Find a player by name" autocomplete="off" enterkeyhint="search">${UI.pq ? '<button class="btn alt" data-a="psearchclear" style="flex:0 0 auto">Clear</button>' : ""}</div><p class="note">${q ? "Everyone whose name matches, free agents and prospects included. " : ""}Tap a column to sort. Creation, inside, three-point shot, free throws, passing, handling, offensive and defensive rebounding, defense, rim protection, steals, stamina.</p><div class="scroll"><table><tr><th>Player</th>${rc.map((c, i) => `<th><button class="thb" data-a="rsort" data-k="${i}" aria-pressed="${i === k}">${c[0]}</button></th>`).join("")}</tr>${ps.map((p, i) => `<tr data-a="player" data-id="${p.id}" class="${p.tid === G.userTid ? "me" : ""}"><td><span class="nm">${i + 1}. ${esc(p.n)}</span><span class="sub">${p.tid >= 0 ? esc(team(p.tid).ab) : p.tid === -1 ? "FA" : "prospect"} · ${esc(p.pos)}</span></td>${rc.map((c, j) => `<td>${j === k ? "<b>" : ""}${c[1](p)}${j === k ? "</b>" : ""}</td>`).join("")}</tr>`).join("") || '<tr><td class="mute">Nobody here yet.</td></tr>'}</table></div></section>`;
		} else {
		const po = UI.pf === "po" && G.phase === "playoffs", st = (p) => (po ? p.ps || Z() : off() && p.ls ? p.ls : p.s), mode = UI.pmode === "adv" || UI.pmode === "p36" ? UI.pmode : "stat", A = mode === "adv" ? advCtx(G.players.map(st)) : null, q = (s, v) => (s[1] >= 8 * s[0] ? v : -1);
		const cols = mode === "adv" ? [["GP", (s) => s[0], 0], ["Min", (s) => s[1] / s[0], 1], ["PER", (s) => q(s, ADV.per(s, A)), 1], ["EWA", (s) => ADV.ewa(s, A), 1, 1], ["TS%", (s) => q(s, ADV.ts(s)), 1], ["eFG%", (s) => q(s, ADV.efg(s)), 1], ["USG%", (s) => q(s, ADV.usg(s, A)), 1], ["AST%", (s) => q(s, ADV.ast(s, A)), 1], ["REB%", (s) => q(s, ADV.reb(s, A)), 1], ["STL%", (s) => q(s, ADV.stl(s, A)), 1], ["BLK%", (s) => q(s, ADV.blk(s, A)), 1], ["TOV%", (s) => q(s, ADV.tov(s)), 1]]
			: mode === "p36" ? [["GP", (s) => s[0], 0], ["Min", (s) => s[1] / s[0], 1], ...[["Pts", 2], ["Reb", 3], ["Ast", 4], ["Stl", 5], ["Blk", 6], ["3PM", 7], ["TO", 14], ["PF", 15]].map(([l, i]) => [l, (s) => q(s, 36 * s[i] / s[1]), 1])]
			: [["GP", (s) => s[0], 0], ["Min", (s) => s[1] / s[0], 1], ["Pts", (s) => s[2] / s[0], 1], ["Reb", (s) => s[3] / s[0], 1], ["Ast", (s) => s[4] / s[0], 1], ["Stl", (s) => s[5] / s[0], 1], ["Blk", (s) => s[6] / s[0], 1], ["3PM", (s) => s[7] / s[0], 1], ["TO", (s) => s[14] / s[0], 1], ["+/−", (s) => s[16] / s[0], 1], ["FG%", (s) => (s[9] >= 3 * s[0] ? 100 * s[8] / s[9] : -1), 1], ["3P%", (s) => (s[10] >= s[0] ? 100 * s[7] / s[10] : -1), 1], ["FT%", (s) => (s[12] >= 1.5 * s[0] ? 100 * s[11] / s[12] : -1), 1], ["TS%", (s) => (s[9] >= 3 * s[0] ? 100 * s[2] / (2 * (s[9] + .44 * s[12])) : -1), 1], ["Eff", (s) => (s[2] + s[3] + s[4] + s[5] + s[6] - (s[9] - s[8]) - (s[12] - s[11]) - s[14]) / s[0], 1]];

		const k = Math.min(mode === "stat" ? UI.psort : UI["ps" + mode] != null ? UI["ps" + mode] : 2, cols.length - 1), f = cols[k][1], pf = UI.pf || "all", ps = G.players.filter((p) => p.tid >= 0 && st(p)[0] >= (pf === "all" ? Math.max(1, .6 * (off() ? NG() : team(p.tid).w + team(p.tid).l)) : 1) && (pf === "mine" ? p.tid === G.userTid : pf === "watch" ? p.w : pf === "rook" ? p.dy === G.season - 1 : true)).sort((a, b) => f(st(b)) - f(st(a))).slice(0, 40);
		body = `<section>${modeChips}<div class="chips">${[["all", "Everyone"], ["mine", "My team"], ["watch", "Watch list"], ["rook", "Rookies"], ...(G.phase === "playoffs" ? [["po", "Playoffs"]] : [])].map(([x, l]) => `<button class="chip" aria-pressed="${pf === x}" data-a="pfilter" data-k="${x}">${l}</button>`).join("")}</div><p class="note">Tap a column to sort.${pf === "all" ? " Players need 60% of their team's games to qualify." : ""} ${mode === "adv" ? "PER rates all-round production per minute, with 15 as league average. EWA estimates wins added over a bench-level player. USG% is the share of team plays a player uses; the others are shares of what was available while he played. Rates need 8 minutes a game." : mode === "p36" ? "What each player produces per 36 minutes on the floor. Needs 8 minutes a game." : "TS% is true shooting; Eff adds up the box score, minus misses and turnovers."}</p><div class="scroll"><table><tr><th>Player</th>${cols.map((c, i) => `<th><button class="thb" data-a="psort" data-k="${i}" aria-pressed="${i === k}">${c[0]}</button></th>`).join("")}</tr>${ps.map((p, i) => `<tr data-a="player" data-id="${p.id}" class="${p.tid === G.userTid ? "me" : ""}"><td><span class="nm">${i + 1}. ${esc(p.n)}</span><span class="sub">${esc(team(p.tid).ab)} · ${esc(p.pos)}</span></td>${cols.map((c, j) => { const v = c[1](st(p)); return `<td>${j === k ? "<b>" : ""}${v < 0 && !c[3] ? "–" : c[2] ? f1(v) : v}${j === k ? "</b>" : ""}</td>`; }).join("")}</tr>`).join("") || '<tr><td class="mute">No games played yet.</td></tr>'}</table></div></section>`;
		}
	}
	else if (UI.league === "teams") {
		const rt = allRatings(), rows = G.teams.map((t) => { const g = t.w + t.l, ps = roster(t.tid), d = g ? (t.pf - t.pa) / g : 0; return { t, g, d, r: rt[t.tid], pay: ps.reduce((a, p) => a + p.sal, 0), age: ps.reduce((a, p) => a + age(p), 0) / (ps.length || 1), pw: (g >= 10 ? d * 2.5 : 0) + rt[t.tid] * .3 }; }).sort((a, b) => b.pw - a.pw);
		body = `<section><h2 class="d">Power rankings</h2><p class="note">Ranked on point difference and roster strength.</p><div class="scroll"><table><tr><th>Team</th><th>W</th><th>L</th><th>Rating</th><th>Pts</th><th>Opp</th><th>Diff</th><th>Payroll</th><th>Age</th></tr>${rows.map((x, i) => `<tr data-a="viewteam" data-tid="${x.t.tid}" class="${x.t.tid === G.userTid ? "me" : ""}"><td>${i + 1}. ${tname(x.t)}</td><td>${x.t.w}</td><td>${x.t.l}</td><td><b>${x.r}</b></td><td>${x.g ? f1(x.t.pf / x.g) : "–"}</td><td>${x.g ? f1(x.t.pa / x.g) : "–"}</td><td>${x.g ? (x.d >= 0 ? "+" : "") + f1(x.d) : "–"}</td><td>${money(x.pay)}</td><td>${f1(x.age)}</td></tr>`).join("")}</table></div></section>
		<section><h2 class="d">Team stats <small>per game, from current rosters</small></h2><div class="scroll"><table><tr><th>Team</th><th>Pts</th><th>FG%</th><th>3P%</th><th>FT%</th><th>Reb</th><th>Ast</th><th>Stl</th><th>Blk</th><th>TO</th></tr>${G.teams.map((t) => { const g = off() ? NG() : t.w + t.l, z = Z(); for (const p of roster(t.tid)) { const st = off() && p.ls ? p.ls : p.s; for (let i = 0; i < 17; i++) z[i] += st[i] || 0; } return { t, g, z }; }).filter((x) => x.g && x.z[9]).sort((a, b) => b.z[2] - a.z[2]).map((x) => `<tr data-a="viewteam" data-tid="${x.t.tid}" class="${x.t.tid === G.userTid ? "me" : ""}"><td>${tname(x.t)}</td><td><b>${f1(x.z[2] / x.g)}</b></td><td>${pc(x.z[8], x.z[9])}</td><td>${pc(x.z[7], x.z[10])}</td><td>${pc(x.z[11], x.z[12])}</td><td>${f1(x.z[3] / x.g)}</td><td>${f1(x.z[4] / x.g)}</td><td>${f1(x.z[5] / x.g)}</td><td>${f1(x.z[6] / x.g)}</td><td>${f1(x.z[14] / x.g)}</td></tr>`).join("") || '<tr><td class="mute">No games played yet.</td></tr>'}</table></div></section>
		${(() => { const out = G.players.filter((p) => p.tid >= 0 && p.inj > 0).sort((x, y) => y.ovr - x.ovr).slice(0, 15); return out.length ? `<section><h2 class="d">Injury report</h2><div class="list">${out.map((p) => `<div data-a="player" data-id="${p.id}" class="${p.tid === G.userTid ? "me" : ""}"><span><b>${esc(p.n)}</b> <span class="sub">${esc(team(p.tid).ab)} · ${p.ovr} · ${esc(p.injN || "injury")}</span></span><span class="mute" style="white-space:nowrap">${p.inj} game${p.inj === 1 ? "" : "s"}</span></div>`).join("")}</div></section>` : ""; })()}`;
	}
	else if (UI.league === "awards") {
		const el = (f) => (off() ? [] : G.players.filter((p) => p.tid >= 0 && p.s[0] > 0 && p.s[0] >= f * (team(p.tid).w + team(p.tid).l))), race = (t, ps, f, n) => `<section><h2 class="d">${t}</h2><div class="list">${ps.sort((a, b) => f(b) - f(a)).slice(0, n).map((p, i) => `<div data-a="player" data-id="${p.id}" style="cursor:pointer"><span>${i + 1}. <b>${esc(p.n)}</b> <span class="sub">${esc(team(p.tid).ab)} · ${pg(p, 2)} pts, ${pg(p, 3)} reb, ${pg(p, 4)} ast</span></span><span class="ovr">${p.ovr}</span></div>`).join("") || '<div class="mute">Too early to say.</div>'}</div></section>`;
		body = off() ? '<p class="mute">Last season\'s winners are in History. The races start again with the new season.</p>' : race("MVP race", el(.6), MVS, 8) + race("Defensive Player", el(.6), DPS, 5) + race("Rookie of the Year", el(.4).filter((p) => p.dy === G.season - 1), VAL, 5) + (G.as ? `<section><h2 class="d">All-Stars</h2><p class="note">East ${G.as.sc[0]}, West ${G.as.sc[1]}. MVP: ${esc(G.as.mvp)}.</p><p><b>East:</b> ${esc(G.as.east.join(", "))}</p><p><b>West:</b> ${esc(G.as.west.join(", "))}</p>${G.as.three || G.as.dunk ? `<p class="note">${[G.as.three ? "Three-point contest: " + esc(G.as.three) : "", G.as.dunk ? "Dunk contest: " + esc(G.as.dunk) : ""].filter(Boolean).join(" · ")}</p>` : ""}</section>` : "");
	}
	else if (UI.league === "scores") {
		const keys = Object.keys(G.sc || {}).map(Number).sort((a, b) => a - b);
		if (!keys.length) body = '<section><h2 class="d">Scores</h2><p class="mute">No games have been played yet this season.</p></section>';
		else {
			bxNeed(); const dk = keys.includes(UI.scDay) ? UI.scDay : keys[keys.length - 1], ix = keys.indexOf(dk), full = BX.day(dk) || [];
			const lead = (lines) => lines.map((ln) => ln.reduce((m, r) => (r[2] > m[2] ? r : m), ln[0])).map((r) => `${esc(r[0])} ${r[2]}`).join(" · ");
			body = `<section><h2 class="d">${dayName(dk)} <small>${G.sc[dk].length} game${G.sc[dk].length === 1 ? "" : "s"}</small></h2><div class="row"><button class="btn alt" style="flex:1" data-a="scday" data-k="${ix ? keys[ix - 1] : ""}" ${ix ? "" : "disabled"}>‹ Earlier</button><button class="btn alt" style="flex:1" data-a="scday" data-k="${ix < keys.length - 1 ? keys[ix + 1] : ""}" ${ix < keys.length - 1 ? "" : "disabled"}>Later ›</button></div><div class="list">${G.sc[dk].map((g, i) => { const b = full[i] && full[i].h === g[0] && full[i].a === g[1] ? full[i] : null; return `<div data-a="gbox" data-d="${dk}" data-i="${i}" class="${g[0] === G.userTid || g[1] === G.userTid ? "me" : ""}" style="cursor:pointer"><span style="flex:1;display:block"><span class="sg"><span>${tname(team(g[1]))}</span><span class="${g[3] > g[2] ? "w" : ""}">${g[3]}</span><span>${tname(team(g[0]))} <span class="sub" style="display:inline">home</span></span><span class="${g[2] > g[3] ? "w" : ""}">${g[2]}</span></span>${b ? `<span class="sub">${lead([b.b[1], b.b[0]])}</span>` : ""}</span><span class="mute" style="padding-left:14px">›</span></div>`; }).join("")}</div><p class="note">Tap a game for its box score. Box scores are kept on this device for the current season only.</p></section>`;
		}
	}
	else if (UI.league === "playoffs") {
		const po = G.po, row = (x, live) => `<div class="${x.a === G.userTid || x.b === G.userTid ? "me" : ""}"><span>${x.wa >= x.wb ? "<b>" : ""}${tname(team(x.a))}${x.wa >= x.wb ? "</b>" : ""} &nbsp;${x.wa}–${x.wb}&nbsp; ${x.wb > x.wa ? "<b>" : ""}${tname(team(x.b))}${x.wb > x.wa ? "</b>" : ""}</span><span class="mute">${x.wa === (x.n || 4) || x.wb === (x.n || 4) ? "Final" : live ? ((x.n || 4) === 1 ? "One game" : "Best of " + (2 * (x.n || 4) - 1)) : ""}</span></div>`;
		body = !po ? '<section><h2 class="d">Playoffs</h2><p class="mute">The top ${opt("pot")} teams in each conference qualify once the regular season ends.${opt("pot") === 8 && opt("playin") !== "off" ? (opt("playin") === "on" ? " Seeds seven to ten play in first." : " From 2020-21 on, seeds seven to ten play in first.") : ""} You can change the format in Office, under League settings.</p></section>' : [4, 3, 2, 1].map((r) => { const done = (po.done || []).filter((x) => x.r === r), live = G.phase === "playoffs" && po.round === r ? po.series : []; return done.length + live.length ? `<section><h2 class="d">${ROUND[r]}</h2><div class="list">${(live.length ? live : done).map((x) => row(x, live.length)).join("")}</div></section>` : ""; }).join("") || '<section><h2 class="d">Playoffs</h2><p class="mute">The champion for this season is in the History tab.</p></section>';
	}
	else body = `<section><h2 class="d">Season by season</h2>${G.history.length ? `<div class="scroll"><table><tr><th>Season</th><th>Champion</th><th>You</th><th>MVP</th></tr>${G.history.map((h) => `<tr data-a="hist" data-s="${h.s}"><td>${seasonName(h.s)} ›</td><td>${esc(h.champ)}</td><td>${esc(h.rec)} · ${esc(h.res)}</td><td>${esc(h.mvp)}</td></tr>`).join("")}</table></div>` : '<p class="mute">Finish a season and it shows up here.</p>'}</section>${G.hof && G.hof.length ? `<section><h2 class="d">Hall of Fame</h2><div class="list">${G.hof.slice(0, 40).map((x) => `<div><span><b>${esc(x.n)}</b> <span class="sub">retired ${x.y} · ${x.gp} games</span></span><span class="mute">${x.pts.toLocaleString()} pts${x.mvp ? " · " + x.mvp + "× MVP" : ""}</span></div>`).join("")}</div></section>` : ""}${vRecords()}`;
	return `<div class="chips">${tabs.map(([k, l]) => `<button class="chip" aria-pressed="${UI.league === k}" data-a="league" data-k="${k}">${l}</button>`).join("")}</div>${body}`;
}
function vRecords() {
	const r = G.rec || { g: [], s: [] }, row = (l, x, u) => (x ? `<div><span>${l}</span><b style="text-align:right">${x[0]}${u} · ${esc(x[1])} <span class="sub">${esc(x[2])}, ${seasonName(x[3])}</span></b></div>` : "");
	const car = [...G.players.filter((p) => p.tid >= -1).map((p) => [p.c[1] + p.s[2], p.n, "active"]), ...(G.hof || []).map((x) => [x.pts, x.n, "retired " + x.y])].sort((a, b) => b[0] - a[0]).slice(0, 10);
	return `<section><h2 class="d">Records <small>since this league began</small></h2><div class="list">${["Points", "Rebounds", "Assists", "Steals", "Blocks", "Threes"].map((l, k) => row(l + " in a game", r.g[k], "")).join("")}${["Points", "Rebounds", "Assists"].map((l, k) => row(l + " a game, season", r.s[k], "")).join("") || ""}</div></section>
	<section><h2 class="d">Career points <small>real totals included</small></h2><div class="list">${car.map((x, i) => `<div><span>${i + 1}. <b>${esc(x[1])}</b> <span class="sub">${x[2]}</span></span><b>${x[0].toLocaleString()}</b></div>`).join("")}</div></section>`;
}
function vMoves() {
	const tabs = [["fa", "Free agents"], ["trade", "Trade"], ["draft", G.phase === "draft" ? "Draft" : "Scouting"]]; if (G.phase === "draft") tabs.unshift(tabs.pop()); if (G.phase === "resign") tabs.unshift(["resign", "Re-sign"]);
	if (!tabs.some((t) => t[0] === UI.moves)) UI.moves = tabs[0][0];
	const pay = payroll(G.userTid), n = roster(G.userTid).length; let body = "";
	if (UI.moves === "fa") {
		const cap = opt("cap"), open = G.phase !== "resign", can = (p) => open && canSign(G.userTid, p), room = cap - committed(capYear()), shortBy = (p) => (open && n < RMAX && !capFree() && !broke() ? askFor(p, p.askY) - Math.max(0, room) : 0), FAK = ["ovr", "pot", "young", "cheap", "pts", "reb", "ast"], sorted = listSort("fa", G.players.filter((p) => p.tid === -1 && (!UI.faOnly || can(p))), FAK, "ovr"), list = sorted.slice(0, 80), fa = G.phase === "fa", short = RMIN - n;
		body = `${offSteps()}<section><h2 class="d">Free agents <small>${fa ? `day ${G.faDay || 0} of ${FA_DAYS}` : open ? "available now" : "signing opens after re-signing"}</small></h2>
		<div class="kv"><div><b class="${room > 0 ? "good" : ""}">${room > 0 ? money(room) : "$0"}</b><span>cap room</span></div><div><b>${n} / ${RMAX}</b><span>players</span></div><div><b>${money(1.5)}</b><span>min deal</span></div></div><div class="row"><button class="btn alt" style="flex:1" data-a="cap">Your cap and contracts</button></div>
		<p class="note">${open ? `Sign anyone whose yearly price fits in your cap room, or anyone asking ${money(1.5)} or less even over the cap. Players you can sign are marked.` : "You can look now. Signing opens once you finish re-signing your own players."}${fa ? " Each day other teams sign players, best ones first, and the rest get a little cheaper." : ""}</p>
		${open && short > 0 ? `<p class="bad"><b>You need ${short} more player${short === 1 ? "" : "s"} before the season can start.</b></p><button class="btn alt" data-a="fillmine">Sign the best players asking the minimum</button>` : ""}
		${listBar("fa", FAK, "ovr", `<button class="chip" aria-pressed="${!!UI.faOnly}" data-a="faonly" data-k="${UI.faOnly ? "" : "1"}">Only ones I can sign</button>`)}
		<p class="note">${sorted.length} player${sorted.length === 1 ? "" : "s"}${sorted.length > list.length ? `, showing the first ${list.length}` : ""}. Tap a column or a Sort chip to reorder; tap it again to reverse.</p>
		<div class="scroll"><table>${sortHdr("fa", [["Player", null], ["Ovr", "ovr"], ["Pot", "pot"], ["Min", "min"], ["Pts", "pts"], ["Reb", "reb"], ["Ast", "ast"]])}${playerRows(list, { ask: true, can, shortBy }) || `<tr><td class="mute" colspan="7">${UI.faOnly ? "Nobody you can sign right now." : "Nobody here."}</td></tr>`}</table></div></section>`;
	}
	else if (UI.moves === "resign") {
		const rs = G.resign.map(byId).filter((p) => p && p.tid === G.userTid && p.ask != null).sort((a, b) => b.ovr - a.ovr), under = roster(G.userTid).filter((p) => p.ask == null), payU = under.reduce((a, p) => a + p.sal, 0), keepAll = payU + rs.filter((p) => !mood(p).no).reduce((a, p) => a + userAsk(p), 0);
		body = `${offSteps()}<section><h2 class="d">Re-sign your players <small>${rs.length} contract${rs.length === 1 ? "" : "s"} up</small></h2>
		<div class="kv"><div><b>${money(payU)}</b><span>payroll now</span></div><div><b>${money(keepAll)}</b><span>if you keep all</span></div><div><b>${money(opt("cap"))}</b><span>salary cap</span></div></div><div class="row"><button class="btn alt" style="flex:1" data-a="cap">Your cap and contracts</button></div>
		<p class="note">You may go over the cap to keep your own players, and they ask a little less now than they will on the open market. Tap a player to see what goes into his price and to choose the length. Anyone you do not re-sign becomes a free agent that any team can sign.</p>
		<div class="list">${rs.map((p) => { const m = mood(p); return `<div><span data-a="player" data-id="${p.id}" style="cursor:pointer"><b>${esc(p.n)}</b><span class="sub">${esc(p.pos)} · ${p.ovr} overall · age ${age(p) + 1}</span><span class="sub${m.no ? " bad" : ""}">${m.no ? "Will not re-sign: he wants to play for a winner." : `Wants ${money(userAsk(p))} a year for ${p.askY} year${p.askY > 1 ? "s" : ""}. He ${esc(m.why.join(", "))}.`}</span></span><button class="btn" style="flex:none;white-space:nowrap" data-a="resign" data-id="${p.id}" ${m.no ? "disabled" : ""}>Re-sign</button></div>`; }).join("") || '<div class="mute">All decided.</div>'}</div>
		<button class="btn go" data-a="finishresign">${rs.length ? "Done: let the rest go and open free agency" : "Open free agency"}</button></section>`;
	}
	else if (UI.moves === "draft" && G.phase !== "draft") { const y = G.season + (off() ? 1 : 0), ps = prospects(), mine = G.picks.filter((k) => k.t === G.userTid && k.y === y); body = `<section><h2 class="d">${y} draft class</h2><p class="note">You hold: ${esc(mine.map(pkLabel).join(", ") || "no picks in this draft")}.${ps.length ? " Your scouts rank the class below, with where each player would likely go." : " The class arrives when the season starts."}</p>${ps.length ? prospectTable("scout", ps) : ""}</section>`; }
	else if (UI.moves === "draft") { const d = G.draft; body = `${draftView()}${d.lot && d.lot.length ? `<section><h2 class="d">Lottery <small>teams that missed the playoffs</small></h2><div class="scroll"><table><tr><th>Pick</th><th style="text-align:left">Team</th><th>Record</th><th>Move</th></tr>${d.lot.map((x) => `<tr class="${x[0] === G.userTid ? "me" : ""}"><td>${x[2] + 1}</td><td style="text-align:left">${tname(team(x[0]))}${d.order[x[2]] !== x[0] ? ` <span class="sub">to ${esc(team(d.order[x[2]]).ab)}</span>` : ""}</td><td>${x[3]}–${x[4]}</td><td class="${x[1] > x[2] ? "good" : x[1] < x[2] ? "bad" : "mute"}">${x[1] > x[2] ? "▲ " + (x[1] - x[2]) : x[1] < x[2] ? "▼ " + (x[2] - x[1]) : "–"}</td></tr>`).join("")}</table></div><p class="note">${opt("lot") === "none" ? "No lottery in this league: the worst record picks first." : opt("lot") === "flat" ? "The three top picks are drawn with even odds." : "The three top picks are drawn; worse records get better odds."}</p></section>` : ""}`; }
	else { if (UI.tradeTid == null || UI.tradeTid === G.userTid) UI.tradeTid = G.teams.find((t) => t.tid !== G.userTid).tid; const o = team(UI.tradeTid), c = tradeCheck(), pks = (tid, sel, side) => `<div class="list">${tradablePicks(tid).map((k) => `<label><span><input type="checkbox" id="k${side}${pkKey(k)}" data-a="tpick" data-side="${side}" data-k="${pkKey(k)}" ${sel.includes(pkKey(k)) ? "checked" : ""}> <b>${esc(pkLabel(k))}</b></span></label>`).join("")}</div>`, pick = (ps, sel, side) => `<div class="list">${ps.map((p) => `<label><span><input type="checkbox" id="t${side}${p.id}" data-a="tsel" data-side="${side}" data-id="${p.id}" ${sel.includes(p.id) ? "checked" : ""}> <b>${esc(p.n)}</b> <span class="sub">${esc(p.pos)} · ${age(p)} · ${money(p.sal)} to ${p.exp}</span></span><span class="ovr">${p.ovr}</span></label>`).join("")}</div>`; body = tradeShut() ? `<section><h2 class="d">Trade</h2><p class="mute">${G.phase === "playoffs" ? "Trading reopens after the playoffs." : "The trade deadline has passed. Trading reopens after the playoffs."}</p></section>` : `<section><h2 class="d">Trade</h2><div class="row"><label for="tradeteam" class="note">With</label><select id="tradeteam" data-a="tradeteam">${G.teams.filter((t) => t.tid !== G.userTid).map((t) => `<option value="${t.tid}" ${t.tid === o.tid ? "selected" : ""}>${esc(t.region)} ${esc(t.name)}</option>`).join("")}</select></div><p class="${c.ok ? "good" : "note"}"><b>${esc(c.msg)}</b></p>${tradeTalkHtml()}<div class="row"><button class="btn go" data-a="trade" ${c.ok ? "" : "disabled"}>Make this trade</button>${c.ok ? "" : '<button class="btn alt" data-a="whatwould">What would it take?</button>'}<button class="btn alt" data-a="shop" ${UI.tradeA.length + UI.tradePA.length ? "" : "disabled"}>Shop what I send to every team</button>${G.god && !c.ok ? '<button class="btn alt" data-a="forcetrade">Force this trade</button>' : ""}</div>${UI.block ? `<div class="list">${UI.block.map((o, i) => `<div><span><b>${esc(team(o.tid).name)}</b> would give <span class="sub">${esc(offerText(o, 0))}</span></span><button class="btn" data-a="blockpick" data-i="${i}">Review</button></div>`).join("") || '<div class="mute">Nobody is offering anything for that.</div>'}</div>` : ""}<h2 class="d">You send</h2>${pick(sortRoster(G.userTid), UI.tradeA, "A")}${pks(G.userTid, UI.tradePA, "A")}<h2 class="d">${esc(o.name)} send</h2>${pick(sortRoster(o.tid), UI.tradeB, "B")}${pks(o.tid, UI.tradePB, "B")}</section>`; }
	return `<div class="chips">${tabs.map(([k, l]) => `<button class="chip" aria-pressed="${UI.moves === k}" data-a="moves" data-k="${k}">${l}</button>`).join("")}</div>${body}`;
}
function vFin() {
	const f = G.fin, c = f.cur, pay = payroll(G.userTid), rev = c.gate + c.merch + c.tv, exp = c.sal + c.bud, tax = 1.5 * Math.max(0, pay - TAXL()), names = ["Coaching", "Medical staff", "Arena"], what = ["Better coaching helps your players develop.", "Better doctors shorten injuries.", "A better arena draws bigger crowds."];
	const line = (l, v) => `<div><span>${l}</span><b style="white-space:nowrap">${v}</b></div>`;
	return `<section><h2 class="d">Finances <small>${seasonName(G.season)} so far</small></h2>
	<div class="kv"><div><b class="${f.cash < 0 ? "bad" : ""}">${money(f.cash)}</b><span>Cash</span></div><div><b>${money(rev)}</b><span>Revenue</span></div><div><b class="${rev - exp < 0 ? "bad" : "good"}">${money(rev - exp)}</b><span>Profit</span></div></div>
	${f.cash < -DEBT ? `<p class="bad"><b>You are more than ${money(DEBT)} in debt. Until that improves, the owner will only approve minimum contracts for new players.</b></p>` : f.cash < 0 ? `<p class="note">You are in debt. Past ${money(DEBT)} of it, the owner will only approve minimum contracts for new players.</p>` : ""}
	<div class="list">${line("Tickets", money(c.gate))}${line("Merchandise and sponsors", money(c.merch))}${line("League TV share", money(c.tv))}${line("Player salaries", money(-c.sal))}${line("Staff and arena", money(-c.bud))}${line(`${opt("taxOver") >= 999 ? "Luxury tax (switched off in this league)" : `Luxury tax due after the season (payroll over ${money(TAXL())})`}`, tax ? money(-tax) : "none")}</div></section>
	<section><h2 class="d">Tickets <small>${c.hg ? Math.round(c.att / c.hg).toLocaleString() + " a game so far" : "no home games yet"}</small></h2>
	<div class="row"><button class="btn alt" data-a="finprice" data-k="-5" aria-label="Lower the ticket price">−</button><b class="d" style="font-size:30px;min-width:84px;text-align:center">$${f.price}</b><button class="btn alt" data-a="finprice" data-k="5" aria-label="Raise the ticket price">+</button></div>
	<p class="note">At $${f.price} you should draw about ${crowd(false, false).toLocaleString()} of 20,500 seats. Fans think about $${fairPrice()} is fair for this team right now. Winning raises that.</p></section>
	<section><h2 class="d">Staff and arena <small>${money(budget())} a season</small></h2><div class="list">${names.map((n, i) => `<div><span><b>${n}: level ${f.lv[i]} of 5</b><span class="sub">${what[i]} ${money(LV[i][f.lv[i] - 1])} a season.</span></span><span class="row" style="flex-wrap:nowrap"><button class="btn alt" data-a="finlv" data-i="${i}" data-k="-1" ${f.lv[i] <= 1 ? "disabled" : ""} aria-label="Lower ${n}">−</button><button class="btn alt" data-a="finlv" data-i="${i}" data-k="1" ${f.lv[i] >= 5 ? "disabled" : ""} aria-label="Raise ${n}">+</button></span></div>`).join("")}</div></section>
	${f.hist.length ? `<section><h2 class="d">Past seasons</h2><div class="scroll"><table><tr><th>Season</th><th>Revenue</th><th>Costs</th><th>Profit</th><th>Cash</th></tr>${f.hist.map((x) => `<tr><td>${seasonName(x.s)}</td><td>${money(x.rev)}</td><td>${money(x.exp)}</td><td class="${x.rev - x.exp < 0 ? "bad" : "good"}">${money(x.rev - x.exp)}</td><td>${money(x.cash)}</td></tr>`).join("")}</table></div></section>` : ""}`;
}
function vMore() {
	const o = G.owner, tot = o.w + o.p + o.m, bar = (l, v) => `<div class="rt"><span>${l}</span><div class="bar"><i style="width:${Math.round(clamp((v + 3) / 6, 0, 1) * 100)}%"></i></div><b>${v > .5 ? "+" : v < -.5 ? "−" : "="}</b></div>`;
	return `${leaguesBox()}<section><h2 class="d">The owner <small>${o.yrs} season${o.yrs === 1 ? "" : "s"} together</small></h2><p><b class="${tot < -1.5 ? "bad" : tot > 1 ? "good" : ""}">${tot < -2.5 ? "Furious." : tot < -1.5 ? "Losing patience. Your job is at risk." : tot < 0 ? "Wants to see more." : tot < 1.5 ? "Satisfied." : "Thrilled."}</b> The owner judges you on three things, and recent seasons count most. You cannot be fired in your first three seasons.</p>${bar("Winning", o.w)}${bar("Playoffs", o.p)}${bar("Money", o.m)}</section>
	${vFin()}<section><h2 class="d">Auto-play</h2><p class="note">Hand everything to the coach and front office and let seasons run. Your lineup, draft picks, re-signings and free agents are all decided for you.</p><div class="row"><button class="btn alt" data-a="autoplay" data-k="1">1 season</button><button class="btn alt" data-a="autoplay" data-k="5">5 seasons</button><button class="btn alt" data-a="autoplay" data-k="10">10 seasons</button></div></section>
	<section><h2 class="d">How it works</h2><p>Every roster, from ${seasonName(1990)} to ${seasonName(2026)}, is the real one for that season. Ratings come from each player's real production that year. Real draft classes arrive on schedule through 2026; after that the prospects are invented.</p><p>Once you start, the future is yours: players develop and decline on their own, and nothing follows real history.</p><p class="note">This is an original game with its own simulation. Every game is played out possession by possession, so the box score and the play-by-play are the game itself. In real-player leagues, expansion teams, moves and renames happen on their real dates through 2026.</p></section>
	<section><h2 class="d">Your league</h2><p class="note">Started in ${seasonName(G.start)}. The game saves in this browser after every move${cloud ? " and backs up to your Claude account at the start of each season" : ""}.</p><div class="row"><button class="btn alt" style="flex:1" data-a="settings">League settings</button></div><p class="note">Season length, playoff format, salary cap, injuries, lottery and more.</p><p class="note">Trade difficulty</p><div class="chips">${["Easy", "Normal", "Hard"].map((l, i) => `<button class="chip" aria-pressed="${(G.diff == null ? 1 : G.diff) === i}" data-a="setdiff" data-k="${i}">${l}</button>`).join("")}</div><button class="btn alt" data-a="export">Export this league to a file</button></section>
	<section><h2 class="d">Achievements <small>${Object.keys(G.ach || {}).length} of ${ACH.length}</small></h2>${G.godUsed ? '<p class="note">Achievements stopped counting in this league when commissioner mode, or a no-injuries or no-cap rule, was first used.</p>' : ""}<div class="list">${ACH.map((a) => `<div><span><b class="${(G.ach || {})[a[0]] ? "good" : "mute"}">${a[1]}</b><span class="sub">${a[2]}</span></span><span class="mute">${(G.ach || {})[a[0]] ? seasonName(G.ach[a[0]]) : ""}</span></div>`).join("")}</div></section>
	<section><h2 class="d">Commissioner mode</h2><p class="note">Edit any player, force any trade and switch off the rules. The owner cannot fire you while it is on, and achievements stop counting in this league for good.</p><div class="chips"><button class="chip" aria-pressed="${!!G.god}" data-a="godtoggle" data-k="god">Commissioner mode</button>${G.god ? `<button class="chip" aria-pressed="${!!G.noInj}" data-a="godtoggle" data-k="noInj">No injuries</button><button class="chip" aria-pressed="${!!G.noCap}" data-a="godtoggle" data-k="noCap">No salary cap for me</button>` : ""}</div>${G.god ? `<p class="note">Your team's name, short name and colors</p><div class="row"><input type="text" id="te-region" data-a="teamedit" data-k="region" value="${esc(team(G.userTid).region)}" aria-label="City"><input type="text" id="te-name" data-a="teamedit" data-k="name" value="${esc(team(G.userTid).name)}" aria-label="Team name"></div><div class="row"><input type="text" id="te-ab" data-a="teamedit" data-k="ab" value="${esc(team(G.userTid).ab)}" maxlength="4" style="flex:0 0 90px" aria-label="Short name"><input type="color" id="te-c1" data-a="teamedit" data-k="c1" value="${esc(team(G.userTid).c1)}" aria-label="Main color"><input type="color" id="te-c2" data-a="teamedit" data-k="c2" value="${esc(team(G.userTid).c2)}" aria-label="Second color"></div><p class="note">Run a different team</p><select id="switchteam" data-a="switchteam" aria-label="Run a different team">${G.teams.map((t) => `<option value="${t.tid}" ${t.tid === G.userTid ? "selected" : ""}>${esc(t.region)} ${esc(t.name)}</option>`).join("")}</select>` : ""}</section>`;
}
// Start a new league or switch to another saved one. Shown on Home and at the top of Office.
function leaguesBox() {
	const others = leagues().filter((l) => l.id !== G.id);
	return `<section><h2 class="d">Leagues</h2><p class="note">Every league is saved on its own in this browser. Starting a new one keeps this one, and you can switch back any time.</p><button class="btn go" data-a="newleague">Start a new league</button><button class="btn alt" data-a="leagues">All leagues: switch, delete or import</button>${others.length ? `<p class="note"><b>Your other leagues</b></p><div class="list">${others.map((l) => `<div><span><b>${esc(l.name)}</b><span class="sub">${seasonName(l.season)}</span></span><button class="btn alt" style="flex:none" data-a="openleague" data-id="${esc(l.id)}">Play</button></div>`).join("")}</div>` : ""}</section>`;
}
function vStart() {
	const fake = UI.mode === "fake", season = fake ? 2026 : UI.season, snap = DATA["s" + season], ts = snap.teams.map((t, i) => ({ tid: i, ab: t[0], region: t[1], name: t[2], c1: t[3], c2: t[4] }));
	if (UI.team == null || !ts[UI.team]) UI.team = Math.max(0, ts.findIndex((t) => t.ab === "CHI"));
	const t = ts[UI.team], top = snap.rows.filter((r) => r[1] === UI.team).sort((a, b) => b[2] - a[2]).slice(0, 5), mine = leagues(), setup = UI.newLeague || !mine.length; setAccent(t.c1);
	let n = 0; const step = (title) => `<h2 class="d"><span><span class="stepn">${++n}</span>${title}</span></h2>`;
	const head = UI.newLeague
		? `<section><h1 class="d">New league</h1><p>Choose the players, the season, your team and the difficulty, then tap Start at the bottom. Your other leagues stay saved.</p>${UI.back ? `<button class="btn alt" data-a="openleague" data-id="${esc(UI.back.id)}">Back to ${esc(UI.back.name)}</button>` : mine.length ? '<button class="btn alt" data-a="leaguesback">Back to your leagues</button>' : ""}</section>`
		: `<section><h1 class="d">Hardwood GM</h1><p>Run a pro basketball team from any season since 1990. Real rosters, real draft classes, your decisions.</p></section>
	${mine.length ? `<section><h2 class="d">Your leagues</h2><div class="list">${mine.map((l) => `<div><span><b>${esc(l.name)}</b> <span class="sub">${seasonName(l.season)}</span></span><span class="row" style="flex-wrap:nowrap"><button class="btn alt" data-a="delleague" data-id="${esc(l.id)}">${UI.delId === l.id ? "Tap again to delete" : "Delete"}</button><button class="btn go" data-a="openleague" data-id="${esc(l.id)}">Play</button></span></div>`).join("")}</div><button class="btn go" data-a="newleaguestart">Start a new league</button></section>` : `<section><p class="note"><b>Set up your first league below: four quick choices, then Start.</b></p></section>`}`;
	if (!setup) return `<main>${head}<section><h2 class="d">Bring a league back</h2><label class="btn alt" for="imp" style="display:flex;align-items:center;justify-content:center;cursor:pointer">Import a league file</label><input type="file" id="imp" accept=".json,application/json" data-a="import" hidden><p class="note">Use a file made with Export in the Office tab.</p></section></main>${UI.toast ? `<div class="toast" role="status">${esc(UI.toast)}</div>` : ""}`;
	return `<main>${head}
	<section>${step("Players")}<div class="chips"><button class="chip" aria-pressed="${!fake}" data-a="mode" data-k="real">Real players</button><button class="chip" aria-pressed="${fake}" data-a="mode" data-k="fake">Invented players</button></div><p class="note">${fake ? "Today's 30 teams, stocked with invented players. Nothing follows real history." : "Every roster is the real one for the season you pick, and the league changes on its real schedule."}</p><div class="chips"><button class="chip" aria-pressed="${!!UI.fantasy}" data-a="fantasy">Start with a fantasy draft</button></div>${UI.fantasy ? '<p class="note">Every player goes into one pool and all the teams draft thirteen rounds before the season.</p>' : ""}</section>
	${fake ? "" : `<section>${step("Season")}<select id="season" data-a="season" aria-label="Starting season">${Object.keys(DATA).filter((k) => /^s\d/.test(k)).map((k) => +k.slice(1)).sort((a, b) => b - a).map((y) => `<option value="${y}" ${y === UI.season ? "selected" : ""}>${seasonName(y)}</option>`).join("")}</select><p class="note">The league starts on opening day of this season.</p></section>`}
	<section>${step("Your team")}<div class="pick">${ts.map((x) => `<button aria-pressed="${x.tid === UI.team}" data-a="team" data-tid="${x.tid}">${badge(x, 30)}<span>${esc(x.name)}</span></button>`).join("")}</div></section>
	<section>${step("Difficulty")}<div class="chips">${["Easy", "Normal", "Hard"].map((l, i) => `<button class="chip" aria-pressed="${UI.diff === i}" data-a="diff" data-k="${i}">${l}</button>`).join("")}</div><p class="note">Sets how hard other teams bargain in trades. Season length, playoff format, the salary cap and other rules can be changed later in Office, under League settings.</p></section>
	<section><h2 class="d">${esc(t.region)} ${esc(t.name)} <small>${fake ? "invented players" : seasonName(season)}</small></h2>${fake ? "" : `<div class="list">${top.map((r) => `<div><span><b>${esc(DATA.players[r[0]][0])}</b> <span class="sub">${esc(DATA.players[r[0]][2])} · ${season - DATA.players[r[0]][1]}</span></span><span class="ovr">${r[2]}</span></div>`).join("")}</div>`}
	<p class="note"><b>${fake ? "Invented players" : "Real players"} · ${fake ? "today's teams" : seasonName(season) + " season"}${UI.fantasy ? " · fantasy draft" : ""} · ${["Easy", "Normal", "Hard"][UI.diff == null ? 1 : UI.diff]} trades</b></p>
	<button class="btn go" data-a="start">Start: take over the ${esc(t.name)}</button>${UI.newLeague && UI.back ? `<button class="btn alt" data-a="openleague" data-id="${esc(UI.back.id)}">Cancel and go back to ${esc(UI.back.name)}</button>` : ""}</section>
	${`<section><h2 class="d">Bring a league back</h2><label class="btn alt" for="imp" style="display:flex;align-items:center;justify-content:center;cursor:pointer">Import a league file</label><input type="file" id="imp" accept=".json,application/json" data-a="import" hidden><p class="note">${UI.newLeague ? "Or load a league from a file instead: one" : "Use a file"} made with Export in the Office tab.</p></section>`}</main>${UI.toast ? `<div class="toast" role="status">${esc(UI.toast)}</div>` : ""}`;
}

const RLAB = [["Shot creation", 0], ["Inside scoring", 7], ["Three-point shot", 8], ["Three-point volume", 1], ["Free throws", 9], ["Passing", 2], ["Ball security", 10], ["Offensive rebounding", 11], ["Defensive rebounding", 12], ["Defense", 4], ["Rim protection", 13], ["Steals", 14], ["Stamina", 5], ["Shot volume", 16], ["Getting to the line", 15]];
function cmpBlock(p) {
	const o = UI.cmp != null && UI.cmp !== p.id ? byId(UI.cmp) : null; if (!o) return "";
	const st = (x) => (off() && x.ls ? x.ls : x.s), pgv = (x, k) => (st(x)[0] ? st(x)[k] / st(x)[0] : 0), rows = [["Overall", o.ovr, p.ovr], ["Potential", o.pot, p.pot], ["Age", age(o), age(p), 1], ["Points", pgv(o, 2), pgv(p, 2), 0, 1], ["Rebounds", pgv(o, 3), pgv(p, 3), 0, 1], ["Assists", pgv(o, 4), pgv(p, 4), 0, 1], ...RLAB.map(([l, k]) => [l, o.r[k], p.r[k]])];
	return `<h2 class="d">Side by side</h2><div class="scroll"><table><tr><th></th><th>${esc(o.n)}</th><th>${esc(p.n)}</th></tr>${rows.map(([l, a, b, low, dec]) => { const wa = low ? a < b : a > b, wb = low ? b < a : b > a, f = (v) => (dec ? f1(v) : v); return `<tr><td>${l}</td><td>${wa ? "<b>" : ""}${f(a)}${wa ? "</b>" : ""}</td><td>${wb ? "<b>" : ""}${f(b)}${wb ? "</b>" : ""}</td></tr>`; }).join("")}</table></div>`;
}
async function exportLeague() {
	const filename = `hardwood-gm-${team(G.userTid).ab}-${G.season}.json`, data = JSON.stringify(G);
	try { const d = window.claude && window.claude.use ? await window.claude.use("downloads") : null; if (!d) throw new Error("unavailable"); try { await d.save({ filename, data }); } catch (e) { await d.save({ filename, data: new Blob([data], { type: "application/json" }) }); } toast("League exported."); }
	catch (e) { toast("The file could not be saved from this view. Open the game on its own page and try again."); }
}
// Real seasons from before this league began, for players who were already in the league then.
function realRows(p) { if (!HIST || !PIDX || p.gen) return []; const i = PIDX[p.n + "|" + p.born]; return i == null ? [] : (HIST[i] || []).filter((x) => x[0] < G.start && !(p.h || []).some((h) => h[0] === x[0])); }
// A small line of overall rating by season: real seasons first, then seasons played in this league, then today.
function ovrLine(p, real) {
	const pts = [...real.filter((x) => x[2]).map((x) => [x[0], x[2]]), ...(p.h || []).map((x) => [x[0], x[2]]), ...(p.tid >= -1 && !(p.h || []).some((x) => x[0] === G.season) && !off() ? [[G.season, p.ovr]] : [])].sort((a, b) => a[0] - b[0]);
	if (pts.length < 3) return "";
	const W = 320, H = 84, lo = Math.min(...pts.map((x) => x[1])) - 3, hi = Math.max(...pts.map((x) => x[1])) + 3, X = (i) => 12 + i * (W - 24) / (pts.length - 1), Y = (v) => 10 + (hi - v) * (H - 30) / (hi - lo), pk = pts.reduce((a, x) => (x[1] > a[1] ? x : a));
	return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Overall rating by season, from ${pts[0][1]} in ${seasonName(pts[0][0])} to ${pts[pts.length - 1][1]} in ${seasonName(pts[pts.length - 1][0])}, peaking at ${pk[1]}" style="width:100%;height:auto;display:block;margin:6px 0 2px"><polyline fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" points="${pts.map((x, i) => X(i).toFixed(1) + "," + Y(x[1]).toFixed(1)).join(" ")}"/>${pts.map((x, i) => (i === 0 || i === pts.length - 1 || x === pk ? `<circle cx="${X(i).toFixed(1)}" cy="${Y(x[1]).toFixed(1)}" r="3.5" fill="var(--accent)"/><text x="${X(i).toFixed(1)}" y="${(Y(x[1]) - 7).toFixed(1)}" text-anchor="${i === 0 ? "start" : i === pts.length - 1 ? "end" : "middle"}" font-size="12" font-weight="700" fill="var(--ink)">${x[1]}</text>` : "")).join("")}<text x="12" y="${H - 3}" font-size="11" fill="var(--mute)">${seasonName(pts[0][0])}</text><text x="${W - 12}" y="${H - 3}" text-anchor="end" font-size="11" fill="var(--mute)">${seasonName(pts[pts.length - 1][0])}</text></svg>`;
}
const BESTOF = [[7, "Best of 7"], [5, "Best of 5"], [3, "Best of 3"], [1, "One game"]];
const SOPT = [
	["Season", [
		["games", "Games per team", [[82, "82"], [72, "72"], [66, "66"], [58, "58"], [50, "50"], [41, "41"]], "Used the next time a schedule is made. Before the first game of a season, that is right away."],
		["inj", "Injuries", [[0, "Off"], [.5, "Fewer"], [1, "Normal"], [2, "More"]], "Switching injuries off stops achievements in this league."],
		["hca", "Home-court edge", [[0, "None"], [3, "Normal"], [5, "Strong"]]],
		["deadline", "Trade deadline", [[1, "On"], [0, "Off"]], "When on, trading closes about 70% of the way through the season."],
		["timeline", "Follow real league history", [[1, "On"], [0, "Off"]], "Team moves, new names and expansion teams arrive in their real years."]]],
	["Playoffs", [
		["pot", "Teams per conference", [[8, "8"], [4, "4"], [2, "2"]]],
		["po1", "First round", BESTOF, "Only used when eight teams per conference qualify."],
		["po", "Later rounds", BESTOF],
		["playin", "Play-in games", [["auto", "By era"], ["on", "Always"], ["off", "Never"]], "By era means from 2020-21 on, as in the real league."]]],
	["Money", [
		["capType", "Salary cap", [["soft", "Soft"], ["hard", "Hard"], ["none", "None"]], "Soft: over the cap you can still re-sign your own players, add minimum contracts and trade for up to 125% of the salary you send out. Hard: nobody may add salary over the cap, except minimum contracts to fill a short roster. None: you can spend freely (other teams keep to a budget), and achievements stop."],
		["cap", "Cap amount", [[60, "$60M"], [70, "$70M"], [80, "$80M"], [90, "$90M"], [100, "$100M"], [120, "$120M"]], "Salaries stay the same size, so a bigger cap means more room for everyone."],
		["taxOver", "Luxury tax starts", [[10, "$10M over"], [20, "$20M over"], [30, "$30M over"], [999, "No tax"]]]]],
	["Draft", [
		["lot", "Lottery", [["top3", "Weighted"], ["flat", "Even odds"], ["none", "No lottery"]], "Weighted and even odds both draw the top three picks from the teams that missed the playoffs."]]]];
function glHtml(p) {
	if (!G.sc || !Object.keys(G.sc).length || p.tid === -2) return "";
	if (!bxNeed()) return '<h2 class="d">Game log</h2><p class="mute">Loading…</p>';
	const gl = gameLog(p.id); if (!gl.length) return "";
	return `<h2 class="d">Game log <small>${gl.length} game${gl.length === 1 ? "" : "s"}</small></h2><div class="scroll"><table><tr><th>Game</th><th>Min</th><th>Pts</th><th>Reb</th><th>Ast</th><th>Stl</th><th>Blk</th><th>FG</th><th>3P</th><th>FT</th><th>+/−</th></tr>${(UI.glAll === p.id ? gl : gl.slice(0, 8)).map(({ dk, i, gm, side, r }) => { const us = side ? gm.as : gm.hs, them = side ? gm.hs : gm.as; return `<tr data-a="gbox" data-d="${dk}" data-i="${i}"><td><span class="nm"><b class="${us > them ? "good" : "bad"}">${us > them ? "W" : "L"}</b> ${side ? "at" : "vs"} ${esc(team(side ? gm.h : gm.a).ab)}</span><span class="sub">${us}–${them}${dk >= 999 ? " · playoffs" : ""}</span></td><td>${r[1]}</td><td><b>${r[2]}</b></td><td>${r[3]}</td><td>${r[4]}</td><td>${r[5]}</td><td>${r[6]}</td><td>${r[8]}-${r[9]}</td><td>${r[7]}-${r[10]}</td><td>${r[11]}-${r[12]}</td><td>${(r[16] > 0 ? "+" : "") + r[16]}</td></tr>`; }).join("")}</table></div>${gl.length > 8 ? `<button class="btn alt" data-a="glall" data-id="${p.id}">${UI.glAll === p.id ? "Show fewer games" : `Show all ${gl.length} games`}</button>` : ""}`;
}
function vSheet() {
	if (G.fired) { const opts = standings().reverse().filter((t) => t.tid !== G.userTid).slice(0, 5); return `<div class="veil"><div class="sheet" role="dialog" aria-modal="true"><h2 class="d">You have been fired</h2><p>The owner of the ${esc(team(G.userTid).name)} has let you go. These teams want you. Pick your next job.</p>${opts.map((t) => `<button class="btn alt" data-a="takejob" data-tid="${t.tid}">${esc(t.region)} ${esc(t.name)} (${t.w}–${t.l})</button>`).join("")}</div></div>`; }
	const s = UI.sheet; if (!s) return ""; let h = "";
	if (s.k === "play") {
		const o = [];
		if (G.phase === "regular") { const left = G.sched.length - G.day; o.push(["days:1", "Play one day"]); if ((G.sched[G.day] || []).some((x) => x.includes(G.userTid))) o.push(["coach", "Coach your next game"], ["watch", "Watch your next game live"]); o.push(["days:7", "Play a week"], ["days:30", "Play a month"]); const dl = DEADLINE() - 1 - G.day; if (opt("deadline") && dl > 1) o.push(["days:" + dl, `Play to the day before the trade deadline (${dl} days)`]); o.push(["days:999", `Play to the end of the regular season (${left} days)`]); }
		else if (G.phase === "playoffs") o.push(["po:day", "Play the next games"], ...(G.po.series.some((x) => (x.a === G.userTid || x.b === G.userTid) && x.wa < (x.n || 4) && x.wb < (x.n || 4)) ? [["coachpo", "Coach your next game"], ["watchpo", "Watch your next game live"]] : []), ["po:round", "Finish this round"], ["po:all", "Finish the playoffs"]);
		else if (G.phase === "draft") { const mine = G.draft.order[G.draft.i] === G.userTid; if (mine) o.push(["autopick", "Pick for me"]); else if (G.draft.order.indexOf(G.userTid, G.draft.i) >= 0) o.push(["simdraft:1", "Go to my pick"]); o.push(["simdraft:", "Finish the draft"]); }
		else if (G.phase === "resign") o.push(["finishresign", "Done re-signing, open free agency"]);
		else { const left = FA_DAYS - (G.faDay || 0); if (left > 1) o.push(["fa:1", "Next day of free agency"]); if (left > 7) o.push(["fa:7", "Next week of free agency"]); o.push(["fa:" + FA_DAYS, `Finish free agency and start the ${seasonName(G.season + 1)} season`]); }
		h = `<h2 class="d">${G.phase === "regular" ? `Day ${G.day + 1} of ${G.sched.length}` : G.phase === "playoffs" ? ROUND[G.po.round] : G.phase === "fa" ? `Free agency, day ${G.faDay || 0} of ${FA_DAYS}` : "Offseason"}</h2>${G.phase === "fa" ? `<p class="note">Each day other teams sign players and the rest get cheaper.${rosterProblem() ? " " + esc(rosterProblem()) : ""}</p>` : ""}${o.map(([a, l], i) => `<button class="btn ${i ? "alt" : "go"}" data-a="go" data-k="${a}">${l}</button>`).join("")}`;
	} else if (s.k === "player") {
		const p = byId(s.id); if (!p) return ""; const real = realRows(p); const mine = p.tid === G.userTid, st = off() && p.ls ? p.ls : p.s, idx = G.order.indexOf(p.id);
		const acts = [];
		const yrs = (a2) => `<div class="row">${[1, 2, 3, 4].slice(0, age(p) + (off() ? 1 : 0) >= 32 ? 2 : 4).map((y) => `<button class="btn go" style="flex:1" data-a="${a2}" data-id="${p.id}" data-y="${y}" ${a2 === "resign" || canSign(G.userTid, p) ? "" : "disabled"}>${y} year${y > 1 ? "s" : ""}</button>`).join("")}</div>`;
		if (mine) acts.push(`<p class="note">Playing time</p><div class="chips">${[[-1, "Fewer minutes"], [0, "Coach decides"], [1, "More minutes"]].map(([k, l]) => `<button class="chip" aria-pressed="${(p.pt || 0) === k}" data-a="pt" data-id="${p.id}" data-k="${k}">${l}</button>`).join("")}</div>`);
		if (mine && !G.auto) acts.push(`<div class="row"><button class="btn alt" style="flex:1" data-a="move" data-id="${p.id}" data-k="-1" ${idx <= 0 ? "disabled" : ""}>Move up</button><button class="btn alt" style="flex:1" data-a="move" data-id="${p.id}" data-k="1" ${idx < 0 || idx >= G.order.length - 1 ? "disabled" : ""}>Move down</button></div>`);
		acts.push(`<div class="row"><button class="btn alt" style="flex:1" data-a="watch" data-id="${p.id}">${p.w ? "Stop watching" : "Add to watch list"}</button><button class="btn alt" style="flex:1" data-a="cmp" data-id="${p.id}">${UI.cmp === p.id ? "Stop comparing" : "Compare with…"}</button></div>`);
		if (G.god) acts.push(`<p class="note">Commissioner edits</p>${[["Overall", "ovr", p.ovr], ["Potential", "pot", p.pot], ["Age", "age", age(p) + (off() ? 1 : 0)], ["Salary", "sal", money(p.sal)], ["Contract ends", "exp", p.exp || "–"]].map(([l, k, v]) => `<div class="row"><span style="flex:1">${l}: <b>${v}</b></span><button class="btn alt" style="width:auto" data-a="god" data-id="${p.id}" data-k="${k}" data-v="-1" aria-label="Lower ${l}">−</button><button class="btn alt" style="width:auto" data-a="god" data-id="${p.id}" data-k="${k}" data-v="1" aria-label="Raise ${l}">+</button></div>`).join("")}<div class="row">${p.inj ? `<button class="btn alt" style="flex:1" data-a="god" data-id="${p.id}" data-k="heal" data-v="0">Heal him</button>` : ""}${p.tid !== G.userTid ? `<button class="btn alt" style="flex:1" data-a="god" data-id="${p.id}" data-k="take" data-v="0">Move to my team</button>` : ""}</div>`);
		if (mine && G.phase !== "playoffs") acts.push(`<button class="btn alt" data-a="release" data-id="${p.id}">Release (his contract comes off your books)</button>`);
		h = `${cmpBlock(p)}<h2 class="d">${esc(p.n)} <small>${p.tid >= 0 ? esc(team(p.tid).region) : p.tid === -1 ? "Free agent" : "Draft prospect"}</small></h2>
		<p class="note">${esc(p.pos)} · age ${age(p) + (off() ? 1 : 0)} · ${Math.floor(p.hgt / 12)}'${p.hgt % 12}"${p.dy ? ` · entered ${p.dy}` : ""}${p.slot && p.slot < 61 && !p.gen ? ` · pick ${p.slot} in real life` : ""}${p.tid >= 0 ? ` · ${money(p.sal)} a year through ${seasonName(p.exp)}` : ""}${p.aw ? ` · ${p.aw}× MVP` : ""}${p.inj ? ` · out ${p.inj} games${p.injN ? " (" + p.injN + ")" : ""}` : ""}</p>
		${(() => { const r = progRow(p); return r ? `<p class="note"><b>Before ${seasonName(G.prog.s)}:</b> overall ${r[1]} → ${r[2]} (${r[2] >= r[1] ? "+" : "−"}${Math.abs(r[2] - r[1])}${progSplit(r) ? ": " + progSplit(r) : ""}), potential ${r[3]} → ${r[4]}.${(r[8] || []).length ? " " + esc(r[8].join(", ").replace(/^./, (c) => c.toUpperCase())) + "." : ""}${progBits(r) ? " Biggest changes: " + esc(progBits(r)) + "." : ""}</p>` : ""; })()}
		${p.tid === -2 ? prospectBox(p) : ""}
		${p.tid === -1 ? dealBox(p, false) : mine && G.phase === "resign" && p.ask != null ? dealBox(p, true) : ""}
		<div class="kv"><div><b>${p.ovr}</b><span>Overall</span></div><div><b>${p.pot}</b><span>Potential</span></div><div><b>${st[0] ? f1(st[2] / st[0]) : "–"}</b><span>Points</span></div><div><b>${st[0] ? f1(st[3] / st[0]) : "–"}</b><span>Rebounds</span></div><div><b>${st[0] ? f1(st[4] / st[0]) : "–"}</b><span>Assists</span></div><div><b>${st[0] ? f1(st[1] / st[0]) : "–"}</b><span>Minutes</span></div></div>
		${[["Shot creation", 0], ["Inside scoring", 7], ["Three-point shot", 8], ["Three-point volume", 1], ["Free throws", 9], ["Passing", 2], ["Ball security", 10], ["Offensive rebounding", 11], ["Defensive rebounding", 12], ["Defense", 4], ["Rim protection", 13], ["Steals", 14], ["Stamina", 5]].filter((x) => p.r[x[1]] != null).map(([l, k]) => `<div class="rt"><span>${l}</span><div class="bar"><i style="width:${p.r[k]}%"></i></div><b>${p.r[k]}</b></div>`).join("")}
		${p.r.length >= 17 ? `<h2 class="d" style="font-size:22px">How he plays</h2>${(() => { const sy = styleOf(p); return sy.length ? sy.map(([l, w]) => `<p class="note"><b>${esc(l)}:</b> ${esc(w)}.</p>`).join("") : '<p class="note">A role player with no strong tendencies: takes the shots that come to him.</p>'; })()}${[["Shot volume", 16], ["Getting to the line", 15]].map(([l, k]) => `<div class="rt"><span>${l}</span><div class="bar"><i style="width:${p.r[k]}%"></i></div><b>${p.r[k]}</b></div>`).join("")}<p class="note">Shot volume is how many of his team's plays he uses (shots, trips to the line and turnovers); getting to the line is how often he draws fouls. Both come from his real stats and decide what he does in games.</p>` : ""}
		${st[9] ? `<p class="note">Shooting: ${pc(st[8], st[9])} from the field, ${pc(st[7], st[10])} on threes, ${pc(st[11], st[12])} at the line.</p>` : ""}
		${st[1] >= 8 * st[0] && st[0] >= 5 ? (() => { const A = advCtx(G.players.map((x) => (off() && x.ls ? x.ls : x.s))); return A.ok ? `<p class="note">Advanced: PER ${f1(ADV.per(st, A))}, true shooting ${f1(ADV.ts(st))}%, usage ${f1(ADV.usg(st, A))}%, ${f1(ADV.ewa(st, A))} wins added. Per 36 minutes: ${f1(36 * st[2] / st[1])} points, ${f1(36 * st[3] / st[1])} rebounds, ${f1(36 * st[4] / st[1])} assists.</p>` : ""; })() : ""}
		${p.aws && p.aws.length ? `<p class="note">Awards: ${esc(Object.entries(p.aws.reduce((m, x) => { (m[x[1]] = m[x[1]] || []).push(x[0]); return m; }, {})).map(([l, ys]) => `${l} (${ys.join(", ")})`).join("; "))}</p>` : ""}
		${acts.join("")}
		${glHtml(p)}
		${p.c[0] ? `<p class="note">Career: ${p.c[0].toLocaleString()} games, ${p.c[1].toLocaleString()} points (${f1(p.c[1] / p.c[0])} a game), ${f1(p.c[2] / p.c[0])} rebounds, ${f1(p.c[3] / p.c[0])} assists.</p>` : ""}
		${ovrLine(p, real)}
		${(p.h && p.h.length) || real.length ? `<div class="scroll"><table><tr><th>Season</th><th>Tm</th><th>Ovr</th><th>GP</th><th>Min</th><th>Pts</th><th>Reb</th><th>Ast</th><th>FG%</th><th>3P%</th></tr>${(p.h || []).slice().reverse().map((x) => `<tr><td>${seasonName(x[0])}</td><td>${esc(x[1])}</td><td>${x[2]}</td><td>${x[3]}</td><td>${f1(x[4] / x[3])}</td><td><b>${f1(x[5] / x[3])}</b></td><td>${f1(x[6] / x[3])}</td><td>${f1(x[7] / x[3])}</td><td>${pc(x[11], x[12])}</td><td>${pc(x[10], x[13])}</td></tr>`).join("")}${real.slice().reverse().map((x) => `<tr><td class="mute">${seasonName(x[0])}</td><td>${esc(x[1])}</td><td>${x[2] || "–"}</td><td>${x[3]}</td><td>${f1(x[4] / x[3])}</td><td><b>${f1(x[5] / x[3])}</b></td><td>${f1(x[6] / x[3])}</td><td>${f1(x[7] / x[3])}</td><td>${pc(x[9], x[10])}</td><td>${pc(x[8], x[11])}</td></tr>`).join("")}</table></div>${real.length ? `<p class="note">Seasons before ${seasonName(G.start)} are his real ones.</p>` : ""}` : ""}
		${p.hp && p.hp.length ? `<h2 class="d">Playoffs</h2><div class="scroll"><table><tr><th>Season</th><th>Tm</th><th>GP</th><th>Min</th><th>Pts</th><th>Reb</th><th>Ast</th><th>FG%</th><th>3P%</th></tr>${p.hp.slice().reverse().map((x) => `<tr><td>${seasonName(x[0])}</td><td>${esc(x[1])}</td><td>${x[2]}</td><td>${f1(x[3] / x[2])}</td><td><b>${f1(x[4] / x[2])}</b></td><td>${f1(x[5] / x[2])}</td><td>${f1(x[6] / x[2])}</td><td>${pc(x[10], x[11])}</td><td>${pc(x[9], x[12])}</td></tr>`).join("")}</table></div>` : ""}`;
	} else if (s.k === "box") {
		const g = G.log[s.i]; if (!g || !g.b) return "";
		const tb = (rows) => `<div class="scroll"><table><tr><th>Player</th><th>Min</th><th>Pts</th><th>Reb</th><th>Ast</th><th>Stl</th><th>Blk</th><th>FG</th><th>3P</th><th>FT</th><th>OR</th><th>TO</th><th>PF</th><th>+/−</th></tr>${rows.map((r) => `<tr><td><span class="nm">${esc(r[0])}</span></td><td>${r[1]}</td><td><b>${r[2]}</b></td><td>${r[3]}</td><td>${r[4]}</td><td>${r[5]}</td><td>${r[6]}</td><td>${r[8]}-${r[9]}</td><td>${r[7]}-${r[10]}</td><td>${r[11]}-${r[12]}</td><td>${r[13] == null ? "" : r[13]}</td><td>${r[14] == null ? "" : r[14]}</td><td>${r[15] == null ? "" : r[15]}</td><td>${r[16] == null ? "" : (r[16] > 0 ? "+" : "") + r[16]}</td></tr>`).join("")}</table></div>`;
		const qs = g.q ? `<div class="scroll"><table><tr><th>Team</th>${g.q[0].map((_, i) => `<th>${i < 4 ? "Q" + (i + 1) : "OT" + (i > 4 ? i - 3 : "")}</th>`).join("")}<th>Final</th></tr>${[[team(G.userTid), g.q[0], g.us], [team(g.o), g.q[1], g.them]].map(([t, q, f]) => `<tr><td>${tname(t)}</td>${q.map((v) => `<td>${v}</td>`).join("")}<td><b>${f}</b></td></tr>`).join("")}</table></div>` : "";
		h = `${qs}${recapHtml(s.i)}${g.pl ? `<p class="note"><b>Game plans:</b> you ${esc(planText(g.pl[0], 1).replace("played their", "played your"))}; the ${esc(team(g.o).name)} ${esc(planText(g.pl[1], 1))}.</p>` : ""}<h2 class="d">${esc(team(G.userTid).name)} ${g.us} <small>${g.home ? "home" : "away"}</small></h2>${tb(g.b[0])}<h2 class="d">${esc(team(g.o).name)} ${g.them}</h2>${tb(g.b[1])}`;
	} else if (s.k === "season") {
		const x = G.history.find((y) => y.s === s.s); if (!x) return "";
		h = `<h2 class="d">${seasonName(x.s)}</h2><div class="list">${[["Champion", x.champ], ["MVP", x.mvp + (x.line ? " · " + x.line : "")], ["Finals MVP", x.fmvp], ["Defensive Player", x.dpoy], ["Rookie of the Year", x.roy], ["Sixth Man", x.six], ["Most Improved", x.mip], ["All-League first team", (x.all || []).join(", ")], ["Second team", (x.all2 || []).join(", ")], ["Third team", (x.all3 || []).join(", ")], ["All-Defensive", (x.alld || []).join(", ")], ["All-Rookie", (x.allr || []).join(", ")], ["Top of the draft", ((G.drafts || []).find((y) => y.s === x.s) || { p: [] }).p.slice(0, 5).map((y) => `${y[0]}. ${y[2]} (${y[1]})`).join(", ")], ["All-Star Game", x.as ? `East ${x.as.sc[0]}, West ${x.as.sc[1]} · MVP ${x.as.mvp}` : ""], ["Your season", x.rec + " · " + x.res]].filter((r) => r[1]).map((r) => `<div><span class="mute">${r[0]}</span><b style="text-align:right">${esc(r[1])}</b></div>`).join("")}</div>`;
	} else if (s.k === "coach") {
		if (!UI.coach) return ""; h = coachHtml();
	} else if (s.k === "gbox") {
		const sc = ((G.sc || {})[s.d] || [])[s.i]; if (!sc) return "";
		const ready = bxNeed(), x = (BX.day(s.d) || [])[s.i], gm = x && x.h === sc[0] && x.a === sc[1] ? x : null, th = team(sc[0]), ta = team(sc[1]);
		const tb = (rows) => `<div class="scroll"><table><tr><th>Player</th><th>Min</th><th>Pts</th><th>Reb</th><th>Ast</th><th>Stl</th><th>Blk</th><th>FG</th><th>3P</th><th>FT</th><th>OR</th><th>TO</th><th>PF</th><th>+/−</th></tr>${rows.filter((r) => r[1] > 0).map((r) => `<tr ${byId(r[17]) ? `data-a="player" data-id="${r[17]}"` : ""}><td><span class="nm">${esc(r[0])}</span></td><td>${r[1]}</td><td><b>${r[2]}</b></td><td>${r[3]}</td><td>${r[4]}</td><td>${r[5]}</td><td>${r[6]}</td><td>${r[8]}-${r[9]}</td><td>${r[7]}-${r[10]}</td><td>${r[11]}-${r[12]}</td><td>${r[13]}</td><td>${r[14]}</td><td>${r[15]}</td><td>${(r[16] > 0 ? "+" : "") + r[16]}</td></tr>`).join("")}</table></div>`;
		h = `<h2 class="d">${esc(ta.ab)} ${sc[3]}, ${esc(th.ab)} ${sc[2]}</h2><p class="note">${dayName(s.d)} · ${seasonName(G.season)} · at ${esc(th.region)}</p>${gm ? `<div class="scroll"><table><tr><th>Team</th>${gm.q[0].map((_, i) => `<th>${i < 4 ? "Q" + (i + 1) : "OT" + (i > 4 ? i - 3 : "")}</th>`).join("")}<th>Final</th></tr>${[[ta, gm.q[1], sc[3]], [th, gm.q[0], sc[2]]].map(([t, q, f]) => `<tr><td>${tname(t)}</td>${q.map((v) => `<td>${v}</td>`).join("")}<td><b>${f}</b></td></tr>`).join("")}</table></div><h2 class="d">${esc(ta.name)} ${sc[3]}</h2>${tb(gm.b[1])}<h2 class="d">${esc(th.name)} ${sc[2]}</h2>${tb(gm.b[0])}<p class="note">Tap a player to open his page.</p>` : `<p class="mute">${ready ? "The full box score for this game is not stored on this device." : "Loading the box score…"}</p>`}`;
	} else if (s.k === "tlog") {
		const t = team(s.tid), rows = [], opp = {}; if (!t) return "";
		for (const dk of Object.keys(G.sc || {}).map(Number).sort((a, b) => a - b)) G.sc[dk].forEach((g, i) => { if (g[0] !== t.tid && g[1] !== t.tid) return; const home = g[0] === t.tid, us = home ? g[2] : g[3], them = home ? g[3] : g[2], o = home ? g[1] : g[0]; rows.push({ dk, i, home, us, them, o }); if (dk < 999) (opp[o] = opp[o] || [0, 0])[us > them ? 0 : 1]++; });
		const all = (o) => { const lo = Math.min(t.tid, o), r = (G.h2h || {})[lo + "_" + Math.max(t.tid, o)] || [0, 0]; return lo === t.tid ? r : [r[1], r[0]]; };
		h = `<h2 class="d">${esc(t.region)} ${esc(t.name)}</h2><p class="note">${seasonName(G.season)} results, newest first. Tap a game for its box score.</p>${rows.length ? `<div class="list">${rows.slice().reverse().slice(0, UI.tlAll === t.tid ? 999 : 12).map((r) => `<div data-a="gbox" data-d="${r.dk}" data-i="${r.i}" style="cursor:pointer"><span><b class="${r.us > r.them ? "good" : "bad"}">${r.us > r.them ? "W" : "L"}</b> ${r.home ? "vs" : "at"} ${tname(team(r.o))}${r.dk >= 999 ? ' <span class="sub">playoffs</span>' : ""}</span><b>${r.us}–${r.them} ›</b></div>`).join("")}</div>${rows.length > 12 ? `<button class="btn alt" data-a="tlall" data-tid="${t.tid}">${UI.tlAll === t.tid ? "Show fewer" : `Show all ${rows.length} games`}</button>` : ""}` : '<p class="mute">No games yet this season.</p>'}
		<h2 class="d">Head to head</h2><div class="scroll"><table><tr><th>Opponent</th><th>This season</th><th>All seasons</th></tr>${G.teams.filter((o) => o.tid !== t.tid).sort((a, b) => a.cid - b.cid || a.region.localeCompare(b.region)).map((o) => { const a = opp[o.tid] || [0, 0], b = all(o.tid); return `<tr data-a="tlog" data-tid="${o.tid}"><td>${tname(o)}</td><td>${a[0]}–${a[1]}</td><td class="${b[0] > b[1] ? "good" : b[0] < b[1] ? "bad" : ""}">${b[0]}–${b[1]}</td></tr>`; }).join("")}</table></div><p class="note">Regular-season games. All seasons counts from the start of this league, or from when this feature arrived in an older save.</p>`;
	} else if (s.k === "prog") {
		h = progHtml();
	} else if (s.k === "cap") {
		h = capHtml();
	} else if (s.k === "strat") {
		h = stratHtml();
	} else if (s.k === "settings") {
		h = `<h2 class="d">League settings</h2><p class="note">These rules apply to every team in this league. Changes are saved as you tap.</p>${SOPT.map(([g, rows]) => `<h2 class="d" style="font-size:22px">${g}</h2>${rows.map(([k, l, os, hint]) => `<p class="note" style="margin-bottom:4px"><b>${l}</b></p><div class="chips">${os.map(([v, t]) => `<button class="chip" aria-pressed="${opt(k) === v}" data-a="setopt" data-k="${k}" data-v="${v}">${t}</button>`).join("")}</div>${hint ? `<p class="note">${hint}</p>` : ""}`).join("")}`).join("")}<button class="btn alt" data-a="setreset">Back to the standard rules</button>`;
	} else if (s.k === "sched") {
		const t = team(G.userTid), fut = []; for (let d = G.day; G.phase === "regular" && d < G.sched.length; d++) { const g = G.sched[d].find((x) => x.includes(t.tid)); if (g) fut.push(g); }
		h = `<h2 class="d">${seasonName(G.season)} schedule</h2><div class="list">${G.log.map((g, i) => `<div ${g.b ? `data-a="box" data-i="${i}" style="cursor:pointer"` : g.d != null ? `data-a="gbox" data-d="${g.d}" data-i="${g.gi}" style="cursor:pointer"` : ""}><span>${i + 1}. <b class="${g.us > g.them ? "good" : "bad"}">${g.us > g.them ? "W" : "L"}</b> ${g.home ? "vs" : "at"} ${tname(team(g.o))}${g.po ? " · playoffs" : ""}</span><b>${g.us}–${g.them}${g.b || g.d != null ? " ›" : ""}</b></div>`).join("")}${fut.map((g, i) => { const o = team(g[0] === t.tid ? g[1] : g[0]); return `<div><span class="mute">${G.log.length + i + 1}. ${g[0] === t.tid ? "vs" : "at"} ${tname(o)}</span><span class="mute">${o.w}–${o.l}</span></div>`; }).join("")}</div>`;
	} else if (s.k === "live") {
		const L = UI.live; if (!L) return "";
		h = `<div id="lvscore">${liveScore()}</div><div class="row">${L.done ? `<button class="btn go" style="flex:1" data-a="box" data-i="${L.i}">See the box score</button>` : `<button class="btn alt" style="flex:1" data-a="livefast">${L.fast ? "Slow down" : "Speed up"}</button><button class="btn alt" style="flex:1" data-a="liveskip">Skip to the end</button>${L.names ? `<button class="btn alt" style="flex:1" data-a="livebox">${L.box ? "Plays" : "Box"}</button>` : ""}`}</div><div id="lvbox">${L.box && !L.done ? liveBox() : ""}</div><div class="list" id="lvfeed" ${L.box && !L.done ? "hidden" : ""}>${L.ev.slice(Math.max(0, L.pos - 40), L.pos).reverse().map(liveRow).join("")}</div>`;
	} else if (s.k === "new") h = `<h2 class="d">Start over?</h2><p>This erases your current league. It cannot be undone.</p><button class="btn go" data-a="newgame">Erase it and start a new league</button>`;
	const coaching = s.k === "coach" && UI.coach && !UI.coach.done;
	return `<div class="veil" ${s.k === "coach" ? "" : 'data-a="close"'}><div class="sheet${s.k === "live" || s.k === "coach" ? " full" : ""}" role="dialog" aria-modal="true">${h}<button class="btn alt" data-a="close">${coaching ? "Sim to the end" : "Close"}</button></div></div>`;
}
function render() {
	const app = $("#app");
	if (!G) { app.innerHTML = vStart(); return; }
	const t = team(G.userTid); setAccent(t.c1);
	const ph = G.phase === "regular" ? `${seasonName(G.season)} · day ${Math.min(G.day + 1, G.sched.length)} of ${G.sched.length}` : G.phase === "playoffs" ? `${seasonName(G.season)} playoffs · ${ROUND[G.po.round]}` : G.phase === "draft" ? `${G.season} offseason · draft` : `${G.phase === "resign" ? "Re-signing" : `Free agency day ${G.faDay || 0}`} · ${opt("cap") - committed(capYear()) > 0 ? money(opt("cap") - committed(capYear())) + " room" : "over the cap"}`;
	if (UI.progPending && !UI.sheet && !UI.autoN && G && G.prog) { UI.progPending = false; UI.sheet = { k: "prog" }; }
	const osh = $(".sheet"), ost = osh ? osh.scrollTop : 0, shk = UI.sheet ? UI.sheet.k + ":" + (UI.sheet.id != null ? UI.sheet.id : UI.sheet.i != null ? UI.sheet.i : "") : "";
	const y = window.scrollY, v = UI.tab === "home" ? vHome() : UI.tab === "roster" ? vRoster() : UI.tab === "league" ? vLeague() : UI.tab === "moves" ? vMoves() : vMore();
	app.innerHTML = `<header class="top">${badge(t, 44)}<div class="who"><div class="d rec">${t.w}–${t.l}</div><div class="ph">${ph}</div></div><button class="play" data-a="play">${off() ? "Next" : "Play"}</button></header><main>${v}</main>
	<nav class="tabs" aria-label="Sections"><div>${[["home", "Home"], ["roster", "Roster"], ["league", "League"], ["moves", "Moves"], ["more", "Office"]].map(([k, l]) => `<button data-a="tab" data-k="${k}" aria-current="${UI.tab === k}">${l}</button>`).join("")}</div></nav>${UI.toast ? `<div class="toast" role="status">${esc(UI.toast)}</div>` : ""}${vSheet()}`;
	window.scrollTo(0, UI.keepScroll ? y : 0); UI.keepScroll = false;
	const nsh = $(".sheet"); if (nsh && shk && shk === UI.shk && ost) nsh.scrollTop = ost; UI.shk = shk;
}
function act(a, d, el) {
	UI.keepScroll = true;
	if (a === "season") { UI.season = +el.value; UI.team = null; }
	else if (a === "team") UI.team = +d.tid;
	else if (a === "start") { UI.newLeague = false; const fake = UI.mode === "fake"; newGame(fake ? 2026 : UI.season, UI.team, { fake, diff: UI.diff, fantasy: !!UI.fantasy }); UI.keepScroll = false; }
	else if (a === "mode") { UI.mode = d.k; UI.team = null; }
	else if (a === "diff") UI.diff = +d.k;
	else if (a === "leaguesback") { UI.newLeague = false; UI.keepScroll = false; window.scrollTo(0, 0); }
	else if (a === "newleaguestart") { UI.toast = ""; UI.newLeague = true; UI.back = null; UI.keepScroll = false; window.scrollTo(0, 0); }
	else if (a === "newleague") { UI.toast = ""; save(true); stopLive(); stopCoach(); UI.back = { id: G.id, name: team(G.userTid).region + " " + team(G.userTid).name }; G = null; UI.sheet = null; UI.delId = null; UI.newLeague = true; UI.keepScroll = false; window.scrollTo(0, 0); }
	else if (a === "openleague") { if (G) save(true); stopLive(); stopCoach(); UI.newLeague = false; const g = load(d.id); if (g) { G = g; UI.tab = "home"; UI.sheet = null; store.set(CUR, G.id); UI.keepScroll = false; } else toast("That league could not be opened."); }
	else if (a === "delleague") { if (UI.delId !== d.id) UI.delId = d.id; else { store.del(keyOf(d.id)); BX.prune(d.id, null); store.set(IDX, JSON.stringify(leagues().filter((x) => x.id !== d.id))); UI.delId = null; } }
	else if (a === "leagues") { save(true); stopLive(); stopCoach(); G = null; UI.sheet = null; UI.delId = null; UI.newLeague = false; UI.toast = ""; UI.keepScroll = false; window.scrollTo(0, 0); }
	else if (a === "godtoggle") { G[d.k] = !G[d.k]; if (G[d.k]) G.godUsed = true; if (d.k === "god" && !G.god) { G.noInj = false; G.noCap = false; } save(); }
	else if (a === "forcetrade") { if (!(UI.tradeA.length + UI.tradePA.length + UI.tradeB.length + UI.tradePB.length)) return; G.godUsed = true; return doTrade(true); }
	else if (a === "god") { const p = byId(+d.id), v = +d.v; G.godUsed = true; if (d.k === "ovr") { p.ovr = clamp(p.ovr + v, 40, 99); p.pot = Math.max(p.pot, p.ovr); for (const i of [0, 2, 3, 4]) p.r[i] = clamp(p.r[i] + v, 25, 99); } else if (d.k === "pot") p.pot = clamp(p.pot + v, p.ovr, 99); else if (d.k === "age") p.born -= v; else if (d.k === "sal") p.sal = clamp(Math.round(p.sal + v), MINSAL, 60); else if (d.k === "exp") p.exp = Math.max(G.season, (p.exp || G.season) + v); else if (d.k === "heal") p.inj = 0; else if (d.k === "take") { if (p.tid < 0) { p.sal = p.sal || MINSAL; p.exp = Math.max(p.exp || 0, G.season + 1); delete p.ask; delete p.askY; G.resign = G.resign.filter((x) => x !== p.id); } p.tid = G.userTid; } save(); }
	else if (a === "sched") UI.sheet = { k: "sched" };
	else if (a === "settings") UI.sheet = { k: "settings" };
	else if (a === "cap") UI.sheet = { k: "cap" };
	else if (a === "strat") { UI.sheet = { k: "strat" }; UI.keepScroll = true; }
	else if (a === "stset") { const t = team(G.userTid); if (d.k === "reset") t.st = {}; else { t.st = Object.assign({}, t.st || {}, { [d.k]: d.v === "auto" ? "auto" : d.k === "pace" ? +d.v : d.v }); if (d.k === "off" && d.v === "star" && t.st.star == null) { const rt = dayCtx().rots[G.userTid]; t.st.star = rt.slice(0, 8).reduce((b, x) => (x.p.ovr + 6 * x.f.uf > b.p.ovr + 6 * b.f.uf ? x : b), rt[0]).p.id; } } save(); UI.keepScroll = true; }
	else if (a === "ststar") { const t = team(G.userTid); t.st = Object.assign({}, t.st || {}, { star: +el.value }); save(); UI.keepScroll = true; }
	else if (a === "prog") { UI.sheet = { k: "prog" }; UI.progPending = false; }
	else if (a === "progf") { UI.progF = d.k; UI.keepScroll = true; }
	else if (a === "progwhy") { UI.progWhy = !UI.progWhy; UI.keepScroll = true; }
	else if (a === "cgo") { const C = UI.coach; if (!C || C.done) return; if (C.paused) { C.paused = false; C.started = true; C.msg = ""; coachRun(); } else { C.paused = true; stopCoach(); C.msg = "Paused."; } UI.keepScroll = true; }
	else if (a === "cfast") { const C = UI.coach; C.fast = !C.fast; coachRun(); UI.keepScroll = true; }
	else if (a === "cto") { const C = UI.coach; if (!C || C.done) return; coachFlush(); if (C.game.timeout(C.side)) { coachFlush(); C.paused = true; stopCoach(); C.msg = "Timeout. Your players on the floor get a short rest. Make your changes, then tap Resume."; } else toast("You have no timeouts left."); UI.keepScroll = true; }
	else if (a === "ctab") { UI.coach.tab = d.k; UI.coach.sel = null; UI.keepScroll = true; }
	else if (a === "cset") { const C = UI.coach, c = C.game.T[C.side].c; coachFlush(); c[d.k] = d.k === "pace" ? +d.v : d.v; UI.keepScroll = true; }
	else if (a === "cstar") { const C = UI.coach, c = C.game.T[C.side].c; coachFlush(); c.star = +el.value; c.off = "star"; UI.keepScroll = true; }
	else if (a === "cauto") { const C = UI.coach, us = C.game.T[C.side]; coachFlush(); us.c.auto = !us.c.auto; if (!us.c.auto) us.lock = us.on.slice(); C.sel = null; UI.keepScroll = true; }
	else if (a === "csel") {
		const C = UI.coach, us = C.game.T[C.side], x = us.pl[+d.k], on = !us.c.auto && us.lock ? us.lock : us.on; UI.keepScroll = true;
		if (!x) return; if (C.sel == null || C.sel === x.k) { C.sel = C.sel === x.k ? null : x.k; return render(); }
		const y = us.pl[C.sel]; if (on.includes(x) === on.includes(y)) { C.sel = x.k; return render(); }
		const out = on.includes(x) ? x : y, inn = out === x ? y : x; C.sel = null;
		if (inn.L[13] >= 6) { toast(`${inn.p.n} has fouled out.`); return render(); }
		coachFlush(); us.c.auto = false; us.lock = on.map((z) => (z === out ? inn : z)); toast(`${inn.p.n} comes in for ${out.p.n} from the next minute.`);
	}
	else if (a === "scday") { if (d.k !== "") UI.scDay = +d.k; UI.keepScroll = true; }
	else if (a === "ai") aiFetch(d.k);
	else if (a === "askgm") { const q = (($("#askq") || {}).value || "").trim().slice(0, 300); if (!q) return toast("Type a question first."); UI.askQ = ""; const key = "ask:" + Date.now(); UI.asks = [...(UI.asks || []), { q, key }].slice(-4); aiFetch(key); }
	else if (a === "gbox") { stopLive(); UI.sheet = { k: "gbox", d: +d.d, i: +d.i, id: d.d + "-" + d.i }; }
	else if (a === "tlog") { UI.sheet = { k: "tlog", tid: +d.tid, id: +d.tid }; }
	else if (a === "tlall") UI.tlAll = UI.tlAll === +d.tid ? null : +d.tid;
	else if (a === "glall") UI.glAll = UI.glAll === +d.id ? null : +d.id;
	else if (a === "setopt") { const row = SOPT.flatMap((g) => g[1]).find((r) => r[0] === d.k), o = row && row[2].find((x) => String(x[0]) === d.v); if (!o) return; (G.set = G.set || {})[d.k] = o[0]; if (d.k === "games" && G.phase === "regular" && G.day === 0) makeSchedule(); if ((d.k === "capType" && o[0] === "none") || (d.k === "inj" && o[0] === 0)) G.godUsed = true; UI.keepScroll = true; save(); }
	else if (a === "setreset") { G.set = {}; if (G.phase === "regular" && G.day === 0 && G.ng !== 82) makeSchedule(); UI.keepScroll = true; save(); }
	else if (a === "watch") { const p = byId(+d.id); p.w = p.w ? 0 : 1; save(); }
	else if (a === "cmp") { const id = +d.id; if (UI.cmp === id) UI.cmp = null; else { UI.cmp = id; UI.sheet = null; render(); return toast("Now open another player to see them side by side."); } }
	else if (a === "pfilter") UI.pf = d.k;
	else if (a === "nfilter") UI.nf = d.k;
	else if (a === "faonly") UI.faOnly = !!d.k;
	else if (a === "fillmine") fillMine();
	else if (a === "pmode") UI.pmode = d.k;
	else if (a === "psearch") UI.pq = (el.value || "").slice(0, 30);
	else if (a === "psearchclear") UI.pq = "";
	else if (a === "rsort") UI.rsort = +d.k;
	else if (a === "teamedit") { const t = team(G.userTid), v = (el.value || "").trim(); if (d.k === "ab") { if (/^[A-Za-z]{2,4}$/.test(v)) t.ab = v.toUpperCase(); } else if (d.k === "c1" || d.k === "c2") { if (/^#[0-9a-f]{6}$/i.test(v)) t[d.k] = v; } else if (v && v.length <= 24) t[d.k] = v; t.custom = true; G.godUsed = true; save(); }
	else if (a === "switchteam") { const tid = +el.value; if (tid !== G.userTid && team(tid)) { G.godUsed = true; takeJob(tid); } }
	else if (a === "setdiff") { G.diff = +d.k; save(); }
	else if (a === "fantasy") UI.fantasy = !UI.fantasy;
	else if (a === "export") return exportLeague();
	else if (a === "import") { const f = el.files && el.files[0]; if (!f) return; f.text().then((t) => { const g = JSON.parse(t); if (!g || g.v !== 1 || !Array.isArray(g.teams) || !Array.isArray(g.players)) throw new Error("bad"); g.id = String(Date.now()); G = migrate(g); UI.tab = "home"; UI.sheet = null; save(true); render(); }).catch(() => toast("That file is not a Hardwood GM league.")); return; }
	else if (a === "pt") { byId(+d.id).pt = +d.k; save(); }
	else if (a === "tab") { UI.tab = d.k; UI.viewTid = null; UI.keepScroll = false; }
	else if (a === "league") UI.league = d.k;
	else if (a === "moves") UI.moves = d.k;
	else if (a === "lead") UI.lead = +d.k;
	else if (a === "play") UI.sheet = { k: "play" };
	else if (a === "player") UI.sheet = { k: "player", id: +d.id };
	else if (a === "box") { stopLive(); UI.sheet = { k: "box", i: +d.i }; }
	else if (a === "hist") UI.sheet = { k: "season", s: +d.s };
	else if (a === "close") { if (UI.sheet && UI.sheet.k === "coach" && UI.coach && !UI.coach.done) return coachSim(); stopLive(); stopCoach(); if (UI.sheet && UI.sheet.k === "coach") UI.coach = null; UI.sheet = null; }
	else if (a === "livefast") { const L = UI.live; L.fast = !L.fast; stopLive(); L.timer = setInterval(liveTick, L.fast ? 110 : 550); }
	else if (a === "livebox") { UI.live.box = !UI.live.box; }
	else if (a === "liveskip") { const L = UI.live; stopLive(); L.pos = L.ev.length; L.done = true; }
	else if (a === "finprice") { G.fin.price = clamp(G.fin.price + (+d.k), 10, 250); save(); }
	else if (a === "finlv") { const i = +d.i; G.fin.lv[i] = clamp(G.fin.lv[i] + (+d.k), 1, 5); save(); }
	else if (a === "viewteam") { UI.viewTid = d.tid === "" || +d.tid === G.userTid ? null : +d.tid; UI.tab = "roster"; UI.keepScroll = false; }
	else if (a === "tradewith") { UI.tradeTid = +d.tid; UI.tradeA = []; UI.tradeB = []; UI.tradePA = []; UI.tradePB = []; UI.tab = "moves"; UI.moves = "trade"; UI.keepScroll = false; }
	else if (a === "tradeteam") { UI.tradeTid = +el.value; UI.tradeB = []; UI.tradePB = []; }
	else if (a === "tsel") { UI.block = null; const l = d.side === "A" ? UI.tradeA : UI.tradeB, id = +d.id, i = l.indexOf(id); if (i < 0) l.push(id); else l.splice(i, 1); }
	else if (a === "trade") return doTrade();
	else if (a === "auto") { G.auto = !G.auto; if (!G.auto) G.order = roster(G.userTid).sort((x, y2) => y2.ovr - x.ovr).map((p) => p.id); save(); }
	else if (a === "move") { const i = G.order.indexOf(+d.id), j = i + (+d.k); if (i >= 0 && j >= 0 && j < G.order.length) { [G.order[i], G.order[j]] = [G.order[j], G.order[i]]; save(); } }
	else if (a === "release") { const p = byId(+d.id); p.tid = -1; setAsk(p); G.order = G.order.filter((x) => x !== p.id); UI.sheet = null; save(); return toast(`${p.n} released.`); }
	else if (a === "sign") { const p = byId(+d.id), y = +d.y || p.askY; if (!canSignAt(p, y)) return; sign(p, G.userTid, askFor(p, y), y); if (!G.auto) G.order.push(p.id); news(`You sign ${p.n} for ${money(p.sal)} a year.`); UI.sheet = null; save(); return toast(`${p.n} signed.`); }
	else if (a === "resign") { const p = byId(+d.id), y = +d.y || p.askY; if (mood(p).no) return toast(`${p.n} will not re-sign.`); if (!canResignAt(p, y)) return toast("The hard cap leaves no room to re-sign him."); const amt = askFor(p, y); sign(p, G.userTid, amt, y); news(`You re-sign ${p.n} for ${money(amt)} a year for ${y} year${y > 1 ? "s" : ""}.`); UI.sheet = null; save(); return toast(`${p.n} re-signed: ${money(amt)} a year through ${seasonName(p.exp)}.`); }
	else if (a === "tpick") { const l = d.side === "A" ? UI.tradePA : UI.tradePB, i = l.indexOf(d.k); if (i < 0) l.push(d.k); else l.splice(i, 1); }
	else if (a === "whatwould") return whatWould();
	else if (a === "shop") { UI.block = G.teams.filter((t) => t.tid !== G.userTid).map((t) => buildOffer(t.tid)).filter(Boolean).sort((x, y) => y.v - x.v).slice(0, 6); }
	else if (a === "blockpick" || a === "offer") { const o = a === "offer" ? G.offers.splice(+d.i, 1)[0] : UI.block[+d.i]; if (o) { UI.tradeTid = o.tid; UI.tradeA = o.A.slice(); UI.tradePA = o.PA.slice(); UI.tradeB = o.B.slice(); UI.tradePB = o.PB.slice(); UI.block = null; UI.tab = "moves"; UI.moves = "trade"; UI.keepScroll = false; } }
	else if (a === "takejob") takeJob(+d.tid);
	else if (a === "autoplay") { UI.sheet = null; return autoPlay(+d.k); }
	else if (a === "psort") { if (UI.pmode === "adv" || UI.pmode === "p36") UI["ps" + UI.pmode] = +d.k; else UI.psort = +d.k; }
	else if (a === "finishresign") return finishResign();
	else if (a === "draft") { const p = byId(+d.id), n = G.draft.i + 1; draftPick(p); if (!G.auto) G.order.push(+d.id); UI.sheet = null; save(); return toast(`You drafted ${p.n} with pick #${n}: ${money(p.sal)} a year through ${seasonName(p.exp)}.`); }
	else if (a === "autopick") { UI.sheet = null; const n = G.draft.i + 1; aiPick(); const x = G.draft ? G.draft.log.find((y) => y.n === n) : null; save(); if (x) return toast(`You drafted ${x.name} with pick #${n}.`); }
	else if (a === "draftnext") { if (G.phase === "draft" && G.draft.order[G.draft.i] !== G.userTid) { aiPick(); save(); } UI.keepScroll = true; }
	else if (a === "drhelp") { UI.drHelp = !UI.drHelp; UI.keepScroll = true; }
	else if (a === "dboard") { UI.dBoard = d.k; UI.keepScroll = true; }
	else if (a === "lsort") { const st = (UI.ls = UI.ls || {})[d.l] = UI.ls[d.l] || { k: d.k, pos: "", rev: false }; if (st.k === d.k) st.rev = !st.rev; else { st.k = d.k; st.rev = false; } UI.keepScroll = true; }
	else if (a === "lpos") { const st = (UI.ls = UI.ls || {})[d.l] = UI.ls[d.l] || { k: "", pos: "", rev: false }; st.pos = d.k; UI.keepScroll = true; }
	else if (a === "simdraft") { UI.sheet = null; return simDraft(!!d.k); }
	else if (a === "confirmnew") UI.sheet = { k: "new" };
	else if (a === "newgame") { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } G = null; UI.sheet = null; UI.keepScroll = false; }
	else if (a === "go") { UI.sheet = null; const [k, v] = d.k.split(":"); if (k === "days") return playDays(+v); if (k === "coach") return startCoach(false); if (k === "coachpo") return startCoach(true); if (k === "watch") return watchNext(false); if (k === "watchpo") return watchNext(true); if (k === "po") return playPlayoffs(v); if (k === "simdraft") return simDraft(!!v); if (k === "autopick") { aiPick(); save(); } else if (k === "finishresign") return finishResign(); else if (k === "startseason") return startSeason(); else if (k === "fa") return faAdvance(+v); }
	render();
}
document.addEventListener("click", (e) => { const sheet = e.target.closest(".sheet"), el = e.target.closest("[data-a]"); if (!el) return; if (el.classList.contains("veil") && sheet) return; if (el.tagName === "SELECT" || el.tagName === "INPUT") return; if (el.disabled) return; act(el.dataset.a, el.dataset, el); });
document.addEventListener("change", (e) => { const el = e.target.closest("select[data-a], input[data-a]"); if (el) act(el.dataset.a, el.dataset, el); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && UI.sheet && !(UI.sheet.k === "coach" && UI.coach && !UI.coach.done)) { UI.sheet = null; UI.keepScroll = true; render(); } });
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => render());
new MutationObserver(() => render()).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

fetch("data.json").then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }).then((rows) => {
	for (const r of rows) DATA[r.k] = r.v;
	G = load(); render(); connectCloud();
	fetch("hist.json").then((r) => (r.ok ? r.json() : null)).then((a) => { if (!a) return; HIST = a; PIDX = {}; DATA.players.forEach((b, i) => { PIDX[b[0] + "|" + b[1]] = i; }); if (UI.sheet && UI.sheet.k === "player") { UI.keepScroll = true; render(); } }).catch(() => {});
}).catch(() => { $("#app").innerHTML = '<main><h1 class="d">Hardwood GM</h1><p>The roster data did not load. Check your connection and reload the page.</p></main>'; });
window.HG = { get G() { return G; }, planFor, autoPlan, styleOf, identity, stratOf, rotation, progSummary, askFor, committed, capYear, canSignAt, faAdvance, fillMine, aiFreeAgencyDay, offSteps, get HIST() { return HIST; }, advCtx, ADV, opt, BX, gameLog, bxNeed, makeGame, dayCtx, startCoach, coachSim, get COACH() { return COACH; }, startFantasy, exportLeague, leagues, load, save, checkAch, allRatings, autoSeason, autoPlay, buildOffer, aiOffer, allStar, mood, ownerReview, takeJob, startLive, buildFeed, watchNext, asset, pickVal, hype, crowd, migrate, aiTrade, whatWould, tradeCheck, newGame, playDays, playPlayoffs, simDraft, finishResign, startSeason, render, UI, DATA, teamRating, standings };
