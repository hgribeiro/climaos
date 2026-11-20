import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("diagnóstico e retorno preservam vínculo, evidências e acesso por técnico", async (t) => {
  const folder = await mkdtemp(join(tmpdir(), "climaos-test-"));
  const server = spawn(process.execPath, ["server/serve.mjs"], {
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: "0",
      CLIMAOS_DB: join(folder, "field.sqlite"),
      CLIMAOS_USERS: JSON.stringify({ ana: "teste-a", rui: "teste-b" }),
    },
    stdio: ["ignore", "pipe", "inherit"],
  });
  t.after(async () => {
    if (server.exitCode === null && !server.signalCode) {
      const stopped = once(server, "exit");
      server.kill();
      await stopped;
    }
    await rm(folder, { recursive: true, force: true });
  });
  const [line] = await once(server.stdout, "data", {
    signal: AbortSignal.timeout(10000),
  });
  const origin = String(line).match(/http:\/\/127\.0\.0\.1:\d+/)[0];
  function request(path, method, cookie, data) {
    return fetch(origin + "/api/" + path, {
      method,
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify(data),
    });
  }
  async function login(username, password) {
    const res = await request("login", "POST", "", { username, password });
    assert.equal(res.status, 200);
    return res.headers.get("set-cookie").split(";")[0];
  }
  const ana = await login("ana", "teste-a");
  const rui = await login("rui", "teste-b");
  const visit = { equipment: "Split recepção", objective: "Diagnóstico" };
  const first = await request("orders", "POST", ana, {
    ...visit,
    client: "Café",
    request: "Vazamento",
  });
  assert.equal(first.status, 201);
  const order = await first.json();
  assert.ok(order.ticketId);
  const second = await request("orders", "POST", ana, {
    ...visit,
    ticketId: order.ticketId,
    objective: "Reparo",
  });
  assert.equal(second.status, 201);
  const followup = await second.json();
  assert.notEqual(followup.id, order.id);
  assert.equal(followup.ticketId, order.ticketId);
  const evidence = "orders/" + order.id + "/evidence";
  const item = evidence + "/" + crypto.randomUUID();
  for (let attempt = 0; attempt < 2; attempt++) {
    assert.ok(
      (await request(item, "PUT", ana, { note: "Dreno obstruído", photo: "" }))
        .ok,
    );
  }
  assert.equal((await (await request(evidence, "GET", ana)).json()).length, 1);
  assert.deepEqual(
    await (
      await request("orders/" + followup.id + "/evidence", "GET", ana)
    ).json(),
    [],
  );
  assert.deepEqual(await (await request("orders", "GET", rui)).json(), []);
  assert.equal((await request(evidence, "GET", rui)).status, 404);
});
