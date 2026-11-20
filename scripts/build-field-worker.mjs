import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";

const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
const root = "out";
async function list(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const groups = await Promise.all(
    entries.map((entry) => {
      const path = dir + "/" + entry.name;
      return entry.isDirectory() ? list(path) : [path];
    }),
  );
  return groups.flat();
}

const assets = (await list(root + "/_next/static"))
  .filter((path) => /\.(css|js|woff2?)$/.test(path))
  .sort();
const page = root + "/campo/index.html";
const hash = createHash("sha256");
for (const path of [page, ...assets]) hash.update(await readFile(path));
const prefix = "climaos-field:" + base + ":";
const name = prefix + hash.digest("hex").slice(0, 16);
const field = base + "/campo/";
const urls = [field, ...assets.map((path) => base + path.slice(root.length))];
await writeFile(
  root + "/campo/sw.js",
  `
const name = ${JSON.stringify(name)};
const prefix = ${JSON.stringify(prefix)};
const field = ${JSON.stringify(field)};
const urls = ${JSON.stringify(urls)};
self.addEventListener("install", event => {
  event.waitUntil(caches.open(name).then(cache => cache.addAll(urls)));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => key.startsWith(prefix) && key !== name)
    .map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== location.origin) return;
  const path = event.request.mode === "navigate" && url.pathname === field.slice(0, -1) ? field : url.pathname;
  if (urls.includes(path)) {
    event.respondWith(caches.open(name).then(cache => cache.match(path)).then(hit => hit || fetch(event.request)));
  }
});
`,
);
