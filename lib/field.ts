/** Offline field visit cache and retryable evidence synchronization. */
export type Order = {
  id: string;
  ticketId: string;
  client: string;
  request: string;
  equipment: string;
  objective: string;
};

export type Evidence = {
  id: string;
  orderId: string;
  note: string;
  photo: string;
  sent: boolean;
};

type StoredOrder = Order & { username: string };
type StoredEvidence = Evidence & { username: string; updatedAt: number };

const DB_NAME = "climaos-field-cache";
const DB_VERSION = 1;
const ORDERS = "orders";
const EVIDENCE = "evidence";

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(
      new Error("O cache offline não está disponível neste navegador."),
    );
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(ORDERS)) {
        const store = db.createObjectStore(ORDERS, {
          keyPath: ["username", "id"],
        });
        store.createIndex("by-user", "username");
      }
      if (!db.objectStoreNames.contains(EVIDENCE)) {
        const store = db.createObjectStore(EVIDENCE, {
          keyPath: ["username", "orderId", "id"],
        });
        store.createIndex("by-user-order", ["username", "orderId"]);
        store.createIndex("by-user", "username");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        request.error ?? new Error("Não foi possível abrir o cache offline."),
      );
    request.onblocked = () =>
      reject(new Error("Feche outras abas para atualizar o cache offline."));
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        request.error ?? new Error("Não foi possível acessar o cache offline."),
      );
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = transaction.onerror = () =>
      reject(
        transaction.error ??
          new Error("Não foi possível salvar os dados offline."),
      );
  });
}

function requireUsername(username: string): string {
  const value = username.trim();
  if (!value)
    throw new Error("Informe o usuário para acessar os dados offline.");
  return value;
}

export async function cacheOrders(
  username: string,
  orders: Order[],
): Promise<void> {
  const user = requireUsername(username);
  const db = await openDatabase();
  try {
    const tx = db.transaction(ORDERS, "readwrite");
    const store = tx.objectStore(ORDERS);
    for (const order of orders)
      store.put({ ...order, username: user } satisfies StoredOrder);
    await transactionDone(tx);
  } finally {
    db.close();
  }
}

export async function readOrders(username: string): Promise<Order[]> {
  const user = requireUsername(username);
  const db = await openDatabase();
  try {
    const tx = db.transaction(ORDERS, "readonly");
    const rows = (await requestResult(
      tx.objectStore(ORDERS).index("by-user").getAll(user),
    )) as StoredOrder[];
    await transactionDone(tx);
    return rows.map(({ username: _username, ...order }) => order);
  } finally {
    db.close();
  }
}

export async function readEvidence(
  username: string,
  orderId: string,
): Promise<Evidence[]> {
  const user = requireUsername(username);
  const db = await openDatabase();
  try {
    const tx = db.transaction(EVIDENCE, "readonly");
    const rows = (await requestResult(
      tx.objectStore(EVIDENCE).index("by-user-order").getAll([user, orderId]),
    )) as StoredEvidence[];
    await transactionDone(tx);
    return rows.map(
      ({ username: _username, updatedAt: _updatedAt, ...evidence }) => evidence,
    );
  } finally {
    db.close();
  }
}

function makeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function")
    return crypto.randomUUID();
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export async function saveEvidence(
  username: string,
  orderId: string,
  note: string,
  photo: string,
): Promise<Evidence> {
  const user = requireUsername(username);
  const evidence: StoredEvidence = {
    id: makeId(),
    orderId,
    note,
    photo,
    sent: false,
    username: user,
    updatedAt: Date.now(),
  };
  const db = await openDatabase();
  try {
    const tx = db.transaction(EVIDENCE, "readwrite");
    tx.objectStore(EVIDENCE).put(evidence);
    await transactionDone(tx);
    const { username: _username, updatedAt: _updatedAt, ...result } = evidence;
    return result;
  } finally {
    db.close();
  }
}

function apiUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "");
  return `${base}/api${path}`;
}

async function responseError(response: Response): Promise<Error> {
  await response.text().catch(() => "");
  if (response.status === 401 || response.status === 403)
    return new Error(
      "Sua sessão expirou. Entre novamente para sincronizar os registros.",
    );
  if (response.status === 404)
    return new Error("A ordem de serviço ou o registro não foi encontrado.");
  if (response.status >= 500)
    return new Error(
      "O servidor está indisponível. Os registros continuam salvos neste dispositivo.",
    );
  return new Error("Não foi possível sincronizar o registro. Tente novamente.");
}

/** Atualiza os registros remotos e mantém evidências locais ainda não enviadas. */
export async function refreshEvidence(
  username: string,
  orderId: string,
): Promise<Evidence[]> {
  const user = requireUsername(username);
  const response = await fetch(
    apiUrl(`/orders/${encodeURIComponent(orderId)}/evidence`),
  );
  if (!response.ok) throw await responseError(response);
  const payload: unknown = await response.json();
  if (!Array.isArray(payload))
    throw new Error("O servidor retornou uma lista de registros inválida.");
  const remote = payload.map((item): Evidence => {
    if (!item || typeof item !== "object")
      throw new Error("O servidor retornou um registro inválido.");
    const value = item as Partial<Evidence>;
    if (
      typeof value.id !== "string" ||
      !value.id ||
      value.orderId !== orderId ||
      typeof value.note !== "string" ||
      typeof value.photo !== "string"
    ) {
      throw new Error(
        "O servidor retornou um registro incompleto ou associado a outra ordem.",
      );
    }
    return {
      id: value.id,
      orderId,
      note: value.note,
      photo: value.photo,
      sent: true,
    };
  });

  const db = await openDatabase();
  try {
    const tx = db.transaction(EVIDENCE, "readwrite");
    const store = tx.objectStore(EVIDENCE);
    // Evidence is append-only. A response captured before a concurrent PUT can omit that item.
    for (const item of remote)
      store.put({
        ...item,
        username: user,
        updatedAt: Date.now(),
      } satisfies StoredEvidence);
    await transactionDone(tx);
    const rows = await readEvidence(user, orderId);
    return rows;
  } finally {
    db.close();
  }
}

const syncs = new Map<string, Promise<Evidence[]>>();

/** Reenvia cada registro pendente; o ID estável torna as tentativas idempotentes. */
export function syncEvidence(username: string): Promise<Evidence[]> {
  const user = requireUsername(username);
  const running = syncs.get(user);
  if (running) return running;
  const work = syncEvidenceForUser(user).finally(() => syncs.delete(user));
  syncs.set(user, work);
  return work;
}

async function syncEvidenceForUser(user: string): Promise<Evidence[]> {
  const db = await openDatabase();
  let pending: StoredEvidence[];
  try {
    const tx = db.transaction(EVIDENCE, "readonly");
    const rows = (await requestResult(
      tx.objectStore(EVIDENCE).index("by-user").getAll(user),
    )) as StoredEvidence[];
    await transactionDone(tx);
    pending = rows.filter((item) => !item.sent);
  } finally {
    db.close();
  }

  // Re-scan after each pass: saves that happen while a request is in flight are sent now.
  // Bound extra passes to avoid looping forever when the network keeps failing.
  let pass = 0;
  while (pending.length && pass < 3) {
    pass += 1;
    for (const item of pending) {
      try {
        const response = await fetch(
          apiUrl(
            `/orders/${encodeURIComponent(item.orderId)}/evidence/${encodeURIComponent(item.id)}`,
          ),
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              "Idempotency-Key": item.id,
            },
            body: JSON.stringify({ note: item.note, photo: item.photo }),
          },
        );
        if (!response.ok) continue;
        const payload: unknown = await response.json();
        if (!payload || typeof payload !== "object") continue;
        const returned = payload as Partial<Evidence>;
        if (
          returned.id !== item.id ||
          returned.orderId !== item.orderId ||
          returned.note !== item.note ||
          returned.photo !== item.photo
        )
          continue;
        const confirmed: Evidence = {
          ...item,
          note: returned.note ?? item.note,
          photo: returned.photo ?? item.photo,
          sent: true,
        };
        const currentDb = await openDatabase();
        try {
          const tx = currentDb.transaction(EVIDENCE, "readwrite");
          const store = tx.objectStore(EVIDENCE);
          const current = (await requestResult(
            store.get([user, item.orderId, item.id]),
          )) as StoredEvidence | undefined;
          // If edited/replaced while the request was in flight, don't mark newer content sent.
          if (
            current &&
            current.updatedAt === item.updatedAt &&
            current.note === item.note &&
            current.photo === item.photo
          ) {
            store.put({
              ...confirmed,
              username: user,
              updatedAt: current.updatedAt,
            } satisfies StoredEvidence);
          }
          await transactionDone(tx);
        } finally {
          currentDb.close();
        }
      } catch {
        // Registros que falharem permanecem na fila para uma nova tentativa.
      }
    }
    const checkDb = await openDatabase();
    try {
      const tx = checkDb.transaction(EVIDENCE, "readonly");
      const rows = (await requestResult(
        tx.objectStore(EVIDENCE).index("by-user").getAll(user),
      )) as StoredEvidence[];
      await transactionDone(tx);
      pending = rows.filter(
        (item) => !item.sent && !pending.some((prior) => prior.id === item.id),
      );
    } finally {
      checkDb.close();
    }
  }
  const resultDb = await openDatabase();
  try {
    const tx = resultDb.transaction(EVIDENCE, "readonly");
    const rows = (await requestResult(
      tx.objectStore(EVIDENCE).index("by-user").getAll(user),
    )) as StoredEvidence[];
    await transactionDone(tx);
    return rows.map(
      ({ username: _username, updatedAt: _updatedAt, ...evidence }) => evidence,
    );
  } finally {
    resultDb.close();
  }
}
