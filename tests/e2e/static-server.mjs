// Tiny static server for tests/fixtures (no dependencies).
//  - HTML has its canonical host (https://www.acme-plumbing.com) rewritten to the request's host,
//    so pages are self-consistent on whatever test domain they're served from.
//  - /robots.txt: hosts starting with "blocked." get "Disallow: /", everyone else a normal file.
//  - ?x-robots=noindex adds an X-Robots-Tag: noindex response header.
//  - /, /services, /contact serve the baseline page so its nav links aren't broken.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../fixtures/", import.meta.url));
const types = { ".html": "text/html; charset=utf-8", ".txt": "text/plain" };
const aliases = { "/": "good.html", "/services": "good.html", "/contact": "good.html" };

createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  const host = req.headers.host ?? "";
  let path = aliases[url.pathname] ?? normalize(url.pathname).replace(/^(\.\.[/\\])+/, "");
  if (path === "/robots.txt") {
    path = host.startsWith("blocked.") ? "robots-txt-blocks-all.bad.txt" : "robots-txt-blocks-all.good.txt";
  }
  try {
    let body = await readFile(join(root, path));
    const type = types[extname(path)] ?? "application/octet-stream";
    if (type.startsWith("text/html")) {
      body = Buffer.from(body.toString().replaceAll("https://www.acme-plumbing.com", `http://${host}`));
    }
    const headers = { "content-type": type };
    if (url.searchParams.get("x-robots") === "noindex") headers["x-robots-tag"] = "noindex";
    res.writeHead(200, headers);
    res.end(body);
  } catch {
    res.writeHead(404).end("not found");
  }
}).listen(4173, "127.0.0.1");
