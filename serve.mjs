// Tiny static file server for local play and tests: node serve.mjs [folder] [port]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".json": "application/json", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml" };
export function serve(dir = ".", port = 3400) {
	const root = path.resolve(dir);
	const server = http.createServer((req, res) => {
		let p = decodeURIComponent(new URL(req.url, "http://x").pathname); if (p.endsWith("/")) p += "index.html";
		const f = path.join(root, p); if (!f.startsWith(root)) { res.writeHead(403); return res.end(); }
		fs.readFile(f, (err, buf) => { if (err) { res.writeHead(404); return res.end("Not found"); } res.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream", "Cache-Control": "no-store" }); res.end(buf); });
	});
	return new Promise((ok) => server.listen(port, "127.0.0.1", () => ok(server)));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const [dir = ".", port = "3400"] = process.argv.slice(2);
	await serve(dir, +port); console.log(`Serving ${path.resolve(dir)} at http://localhost:${port}`);
}
