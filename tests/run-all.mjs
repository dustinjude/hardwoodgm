// Runs the regression tests one after another (starts its own servers) and prints a one-line result for each.
import { spawn } from "node:child_process";
import { serve } from "../serve.mjs";
const servers = await Promise.all([serve(".", 3400), serve("old/v20", 3420), serve("old/v21", 3421)]);
const tests = ["t3", "t4", "t5", "t6", "t7", "t7b", "t8", "t9", "t10", "t11", "t12", "t13", "t14", "t15", "t16", "t17", "t18", "t19", "t19b", "t20", "t22c", "t23", "t24", "t25", "t26", "t27", "t28", "t29", "t30", "click"];
let bad = 0;
for (const t of tests) {
	const out = await new Promise((ok) => { let s = ""; const c = spawn(process.execPath, [`tests/${t}.mjs`], { stdio: ["ignore", "pipe", "pipe"] }); c.stdout.on("data", (d) => (s += d)); c.stderr.on("data", (d) => (s += d)); c.on("close", (code) => ok({ s, code })); });
	const errs = (out.s.match(/ERRORS (.*)/) || [])[1]; const ok = out.code === 0 && errs && errs.startsWith("[]");
	if (!ok) bad++; console.log(`${ok ? "ok  " : "FAIL"} ${t}${ok ? "" : ": " + (errs || out.s.trim().split("\n").slice(-3).join(" | ")).slice(0, 300)}`);
}
console.log(bad ? `${bad} failed` : "all passed"); for (const s of servers) s.close(); process.exit(bad ? 1 : 0);
