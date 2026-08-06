import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = process.cwd();
const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml" };

createServer(async (request, response) => {
  const requested = request.url === "/" ? "/index.html" : request.url;
  const file = normalize(join(root, requested.split("?")[0]));
  if (!file.startsWith(root)) return response.writeHead(403).end("Forbidden");
  try {
    response.setHeader("Content-Type", `${types[extname(file)] || "application/octet-stream"}; charset=utf-8`);
    response.setHeader("Content-Security-Policy", "default-src 'self'; connect-src 'none'; img-src 'self' data:; style-src 'self'; script-src 'self'");
    response.end(await readFile(file));
  } catch {
    response.writeHead(404).end("Not found");
  }
}).listen(4173, "127.0.0.1", () => console.log("Citizen Health: http://127.0.0.1:4173"));
