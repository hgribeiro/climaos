#!/usr/bin/env node
import { createServer } from "node:http";
import {
  createHash,
  randomBytes,
  timingSafeEqual,
  randomUUID,
} from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { readFile, stat } from "node:fs/promises";
import { resolve, sep, extname } from "node:path";
import { fileURLToPath } from "node:url";

// Standalone production server for a prebuilt Next export in ./out.
const root = resolve(fileURLToPath(new URL("../", import.meta.url)));
const staticRoot = resolve(root, "out");
const dbPath = process.env.CLIMAOS_DB ?? resolve(root, "server/climaos.sqlite");
const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";
const SESSION_COOKIE = "climaos_session";
const SESSION_TTL = 7 * 24 * 60 * 60 * 1000;
const MAX_BODY = 3 * 1024 * 1024;
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

let users;
try {
  users = JSON.parse(process.env.CLIMAOS_USERS ?? "{}");
} catch {
  throw new Error(
    "CLIMAOS_USERS must be valid JSON mapping usernames to passwords",
  );
}
if (
  !users ||
  Array.isArray(users) ||
  typeof users !== "object" ||
  Object.keys(users).length === 0 ||
  Object.entries(users).some(([u, p]) => !u || typeof p !== "string" || !p)
) {
  throw new Error(
    "Set CLIMAOS_USERS to a non-empty JSON object mapping usernames to passwords",
  );
}

const db = new DatabaseSync(dbPath);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY, username TEXT NOT NULL, expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY, owner TEXT NOT NULL, ticket_id TEXT NOT NULL REFERENCES tickets(id),
    equipment TEXT NOT NULL, objective TEXT NOT NULL, created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS orders_owner_created ON orders(owner, created_at DESC);
  CREATE TABLE IF NOT EXISTS tickets (
    id TEXT PRIMARY KEY, owner TEXT NOT NULL, client TEXT NOT NULL, request TEXT NOT NULL, created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS idempotency (
    owner TEXT NOT NULL, key TEXT NOT NULL, order_id TEXT NOT NULL REFERENCES orders(id), PRIMARY KEY(owner, key)
  );
  CREATE TABLE IF NOT EXISTS evidence (
    id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    note TEXT NOT NULL, photo TEXT NOT NULL DEFAULT '', updated_at INTEGER NOT NULL
  );
`);

const json = (res, status, value, headers = {}) => {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers,
  });
  res.end(JSON.stringify(value));
};
function cookieOptions(maxAge) {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}
function cookieToken(req) {
  const raw = req.headers.cookie ?? "";
  for (const part of raw.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE) return decodeURIComponent(rest.join("="));
  }
  return "";
}
function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}
function safeEqual(a, b) {
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}
function sameOrigin(req) {
  if (req.headers["sec-fetch-site"] === "cross-site") return false;
  const origin = req.headers.origin;
  if (!origin) return true; // Native/same-origin clients may omit Origin; state-changing requests still require a session.
  try {
    const parsed = new URL(origin);
    if (process.env.CLIMAOS_ORIGIN) return parsed.origin === process.env.CLIMAOS_ORIGIN;
    const protocol = req.socket.encrypted ? "https:" : "http:";
    return (
      parsed.host.toLowerCase() ===
        String(req.headers.host ?? "").toLowerCase() &&
      parsed.protocol === protocol
    );
  } catch {
    return false;
  }
}
async function body(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY)
      throw Object.assign(new Error("Request body too large"), { status: 413 });
    chunks.push(chunk);
  }
  const data = Buffer.concat(chunks).toString("utf8");
  if (!data) return {};
  try {
    return JSON.parse(data);
  } catch {
    throw Object.assign(new Error("Expected a JSON request body"), {
      status: 400,
    });
  }
}
function validText(v, required = false) {
  return (
    typeof v === "string" &&
    v.length <= 10000 &&
    (!required || v.trim().length > 0)
  );
}
function requireSession(req) {
  const token = cookieToken(req);
  if (!token) return null;
  const row = db
    .prepare("SELECT username, expires_at FROM sessions WHERE token_hash = ?")
    .get(hash(token));
  if (
    !row ||
    !Object.hasOwn(users, row.username) ||
    row.expires_at <= Date.now()
  ) {
    if (row)
      db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hash(token));
    return null;
  }
  return row.username;
}
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(
      req.url ?? "/",
      `http://${req.headers.host ?? "localhost"}`,
    );
    const pathname = decodeURIComponent(url.pathname);
    const api = pathname.startsWith("/api/");
    if (api && !sameOrigin(req))
      return json(res, 403, { error: "Cross-origin request denied" });

    if (req.method === "POST" && pathname === "/api/login") {
      const data = await body(req);
      if (
        !data ||
        typeof data.username !== "string" ||
        typeof data.password !== "string"
      )
        return json(res, 400, { error: "username and password are required" });
      const expected = users[data.username];
      if (typeof expected !== "string" || !safeEqual(data.password, expected))
        return json(res, 401, { error: "Invalid username or password" });
      const token = randomBytes(32).toString("base64url");
      const expires = Date.now() + SESSION_TTL;
      db.prepare(
        "INSERT INTO sessions(token_hash, username, expires_at) VALUES (?, ?, ?)",
      ).run(hash(token), data.username, expires);
      return json(
        res,
        200,
        { username: data.username },
        {
          "Set-Cookie": `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.floor(SESSION_TTL / 1000)}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
        },
      );
    }
    if (req.method === "GET" && pathname === "/api/session") {
      const username = requireSession(req);
      return username
        ? json(res, 200, { username })
        : json(res, 401, { error: "Unauthenticated" });
    }
    if (req.method === "POST" && pathname === "/api/logout") {
      const token = cookieToken(req);
      if (token)
        db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(
          hash(token),
        );
      return json(res, 200, { ok: true }, { "Set-Cookie": cookieOptions(0) });
    }

    if (pathname.startsWith("/api/")) {
      const username = requireSession(req);
      if (!username) return json(res, 401, { error: "Unauthenticated" });
      if (req.method === "GET" && pathname === "/api/orders") {
        const rows = db
          .prepare(
            "SELECT o.id, o.ticket_id AS ticketId, t.client, t.request, o.equipment, o.objective FROM orders o JOIN tickets t ON t.id = o.ticket_id WHERE o.owner = ? ORDER BY o.created_at DESC",
          )
          .all(username);
        return json(res, 200, rows);
      }
      if (req.method === "POST" && pathname === "/api/orders") {
        const data = await body(req);
        if (
          !data ||
          !validText(data.equipment, true) ||
          !validText(data.objective, true) ||
          (data.ticketId !== undefined && !validText(data.ticketId, true)) ||
          (data.client !== undefined && !validText(data.client, true)) ||
          (data.request !== undefined && !validText(data.request, true))
        ) {
          return json(res, 400, {
            error:
              "equipment and objective are required; supplied fields must be non-empty strings up to 10000 characters",
          });
        }
        const idempotencyKey = req.headers["idempotency-key"];
        if (
          idempotencyKey !== undefined &&
          (typeof idempotencyKey !== "string" ||
            idempotencyKey.length < 1 ||
            idempotencyKey.length > 200)
        ) {
          return json(res, 400, {
            error: "Idempotency-Key must be 1 to 200 characters",
          });
        }
        if (
          !data.ticketId &&
          (!validText(data.client, true) || !validText(data.request, true))
        ) {
          return json(res, 400, {
            error: "client and request are required when creating a ticket",
          });
        }
        const orderId = randomUUID();
        let ticketId = data.ticketId ?? randomUUID();
        const status = 201;
        try {
          db.exec("BEGIN IMMEDIATE");
          if (idempotencyKey) {
            const previous = db
              .prepare(
                "SELECT order_id FROM idempotency WHERE owner = ? AND key = ?",
              )
              .get(username, idempotencyKey);
            if (previous) {
              const prior = db
                .prepare(
                  "SELECT o.id, o.ticket_id AS ticketId, t.client, t.request, o.equipment, o.objective FROM orders o JOIN tickets t ON t.id = o.ticket_id WHERE o.id = ?",
                )
                .get(previous.order_id);
              db.exec("COMMIT");
              if (prior) return json(res, 200, prior);
            }
          }
          if (!data.ticketId) {
            db.prepare(
              "INSERT INTO tickets(id, owner, client, request, created_at) VALUES (?, ?, ?, ?, ?)",
            ).run(ticketId, username, data.client, data.request, Date.now());
          } else {
            const ticket = db
              .prepare("SELECT id FROM tickets WHERE id = ? AND owner = ?")
              .get(ticketId, username);
            if (!ticket) {
              db.exec("ROLLBACK");
              return json(res, 404, { error: "Ticket not found" });
            }
          }
          db.prepare(
            "INSERT INTO orders(id, owner, ticket_id, equipment, objective, created_at) VALUES (?, ?, ?, ?, ?, ?)",
          ).run(
            orderId,
            username,
            ticketId,
            data.equipment,
            data.objective,
            Date.now(),
          );
          if (idempotencyKey)
            db.prepare(
              "INSERT INTO idempotency(owner, key, order_id) VALUES (?, ?, ?)",
            ).run(username, idempotencyKey, orderId);
          db.exec("COMMIT");
        } catch (err) {
          try {
            db.exec("ROLLBACK");
          } catch {}
          throw err;
        }
        const order = db
          .prepare(
            "SELECT o.id, o.ticket_id AS ticketId, t.client, t.request, o.equipment, o.objective FROM orders o JOIN tickets t ON t.id = o.ticket_id WHERE o.id = ?",
          )
          .get(orderId);
        return json(res, status, order);
      }
      const match = pathname.match(
        /^\/api\/orders\/([^/]+)\/evidence(?:\/([^/]+))?$/,
      );
      if (match) {
        const orderId = match[1];
        const owned = db
          .prepare("SELECT 1 FROM orders WHERE id = ? AND owner = ?")
          .get(orderId, username);
        if (!owned) return json(res, 404, { error: "Order not found" });
        if (req.method === "GET" && match[2] === undefined) {
          return json(
            res,
            200,
            db
              .prepare(
                "SELECT id, order_id AS orderId, note, photo FROM evidence WHERE order_id = ? ORDER BY updated_at",
              )
              .all(orderId),
          );
        }
        if (req.method === "PUT" && match[2] !== undefined) {
          const data = await body(req);
          const photo = data?.photo ?? "";
          const photoPattern =
            /^data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/;
          const photoMatch = photoPattern.exec(photo);
          const photoBytes = photoMatch
            ? Buffer.from(photoMatch[1], "base64").length
            : 0;
          if (
            !data ||
            !validText(data.note) ||
            (!data.note.trim() && !photo) ||
            typeof photo !== "string" ||
            (photo !== "" && (!photoMatch || photoBytes > MAX_PHOTO_BYTES))
          ) {
            return json(res, 400, {
              error:
                "note must be a string; photo must be empty or a JPEG, PNG, or WebP data URL up to 2 MiB",
            });
          }
          const evidenceId = match[2];
          const existing = db
            .prepare("SELECT id FROM evidence WHERE id = ? AND order_id = ?")
            .get(evidenceId, orderId);
          if (existing)
            db.prepare(
              "UPDATE evidence SET note = ?, photo = ?, updated_at = ? WHERE id = ? AND order_id = ?",
            ).run(data.note, photo, Date.now(), evidenceId, orderId);
          else
            db.prepare(
              "INSERT INTO evidence(id, order_id, note, photo, updated_at) VALUES (?, ?, ?, ?, ?)",
            ).run(evidenceId, orderId, data.note, photo, Date.now());
          return json(res, 200, {
            id: evidenceId,
            orderId,
            note: data.note,
            photo,
          });
        }
      }
      return json(res, 404, { error: "Not found" });
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { Allow: "GET, HEAD" });
      return res.end();
    }
    if (pathname === "/campo" || pathname === "/demo") {
      res.writeHead(308, { Location: pathname + "/" + url.search });
      return res.end();
    }
    const relative = pathname === "/" ? "/index.html" : pathname;
    let file = resolve(staticRoot, `.${relative}`);
    if (!(file === staticRoot || file.startsWith(staticRoot + sep)))
      return json(res, 403, { error: "Forbidden" });
    try {
      const info = await stat(file);
      if (info.isDirectory()) file = resolve(file, "index.html");
      else if (!info.isFile()) throw new Error("not a file");
    } catch {
      // Next static export routes commonly use /route -> /route.html.
      const htmlCandidate = `${file}.html`;
      try {
        if ((await stat(htmlCandidate)).isFile()) file = htmlCandidate;
        else throw new Error("missing");
      } catch {
        return json(res, 404, { error: "Not found" });
      }
    }
    try {
      const bytes = await readFile(file);
      res.writeHead(200, {
        "Content-Type":
          mimeTypes[extname(file).toLowerCase()] ?? "application/octet-stream",
        "Content-Length": bytes.length,
      });
      if (req.method === "HEAD") return res.end();
      return res.end(bytes);
    } catch {
      return json(res, 404, {
        error: "Static build not found; run the export build first",
      });
    }
  } catch (err) {
    if (res.headersSent) return res.destroy();
    return json(res, err.status ?? 500, {
      error: err.status ? err.message : "Internal server error",
    });
  }
});

server.listen(port, host, () =>
  console.log(
    `ClimaOS server listening on http://${host}:${server.address().port}`,
  ),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () =>
    server.close(() => {
      db.close();
      process.exit(0);
    }),
  );
