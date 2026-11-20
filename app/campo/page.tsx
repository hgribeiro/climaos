"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Camera,
  Cloud,
  CloudOff,
  LogOut,
  Plus,
  RefreshCw,
  Wifi,
  WifiOff,
} from "lucide-react";
import {
  cacheOrders,
  readOrders,
  readEvidence,
  saveEvidence,
  refreshEvidence,
  syncEvidence,
  type Evidence,
  type Order,
} from "../../lib/field";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const LAST_USER = "climaos:last-authenticated-user";
const LOGGED_OUT = "climaos:explicitly-logged-out";
const api = (path: string) => `${BASE}/api${path}`;

export default function CampoPage() {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [visits, setVisits] = useState<Record<string, Evidence[]>>({});
  const [selected, setSelected] = useState<Order | null>(null);
  const [screen, setScreen] = useState<"list" | "new" | "visit">("list");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [login, setLogin] = useState({ username: "", password: "" });
  const [form, setForm] = useState({
    ticketId: "",
    client: "",
    request: "",
    equipment: "",
    objective: "",
  });
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState("");
  const createKey = useRef("");
  const photoReader = useRef<FileReader | null>(null);
  const [readingPhoto, setReadingPhoto] = useState(false);

  const loadVisits = useCallback(async (user: string, list: Order[]) => {
    const pairs = await Promise.all(
      list.map(
        async (order) =>
          [order.id, await readEvidence(user, order.id)] as const,
      ),
    );
    setVisits(Object.fromEntries(pairs));
  }, []);

  const activate = useCallback(
    async (user: string, fromCache = false) => {
      setUsername(user);
      localStorage.setItem(LAST_USER, user);
      if (fromCache) {
        const cached = await readOrders(user);
        setOrders(cached);
        await loadVisits(user, cached);
        setNotice("Modo offline · dados deste dispositivo");
        return;
      }
      try {
        const response = await fetch(api("/orders"), {
          credentials: "same-origin",
        });
        if (!response.ok)
          throw new Error("Não foi possível carregar as ordens.");
        const list = (await response.json()) as Order[];
        setOrders(list);
        await cacheOrders(user, list);
        await loadVisits(user, list);
        if (navigator.onLine) {
          const synced = await syncEvidence(user).catch(() => []);
          if (synced.length) await loadVisits(user, list);
          setNotice(
            synced.some((item) => !item.sent)
              ? "Alguns registros não foram enviados · permanecem salvos neste dispositivo. Tente novamente."
              : "",
          );
        } else setNotice("");
      } catch {
        const cached = await readOrders(user);
        setOrders(cached);
        await loadVisits(user, cached);
        setNotice("Sem conexão · exibindo dados salvos neste dispositivo");
      }
    },
    [loadVisits],
  );

  useEffect(() => {
    const status = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) setNotice("");
    };
    window.addEventListener("online", status);
    window.addEventListener("offline", status);
    status();
    (async () => {
      const previous = localStorage.getItem(LAST_USER);
      if (localStorage.getItem(LOGGED_OUT) === "1") {
        setLoading(false);
        return;
      }
      try {
        const response = await fetch(api("/session"), {
          credentials: "same-origin",
        });
        if (response.ok) {
          const session = (await response.json()) as { username: string };
          if (session.username) await activate(session.username);
        } else if (previous && !navigator.onLine)
          await activate(previous, true);
      } catch {
        if (previous) await activate(previous, true);
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      window.removeEventListener("online", status);
      window.removeEventListener("offline", status);
    };
  }, [activate]);

  const loginUser = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch(api("/login"), {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(login),
      });
      if (!response.ok) throw new Error("Usuário ou senha inválidos.");
      const result = (await response.json()) as { username: string };
      localStorage.removeItem(LOGGED_OUT);
      await activate(result.username);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Falha ao entrar. Verifique a conexão.",
      );
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    photoReader.current?.abort();
    setPhoto("");
    setNote("");
    localStorage.removeItem(LAST_USER);
    localStorage.setItem(LOGGED_OUT, "1");
    try {
      await fetch(api("/logout"), {
        method: "POST",
        credentials: "same-origin",
      });
    } catch {
      /* clear local identity regardless */
    }
    setUsername("");
    setOrders([]);
    setVisits({});
    setSelected(null);
    setScreen("list");
    setNotice("");
    setLogin({ username: "", password: "" });
  };

  const createOrder = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      if (!createKey.current) createKey.current = crypto.randomUUID();
      const response = await fetch(api("/orders"), {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": createKey.current,
        },
        body: JSON.stringify({ ...form, ticketId: form.ticketId || undefined }),
      });
      if (!response.ok)
        throw new Error(
          "Não foi possível criar a OS. Tente novamente quando houver conexão.",
        );
      const order = (await response.json()) as Order;
      const next = [order, ...orders];
      setOrders(next);
      await cacheOrders(username, next);
      setSelected(order);
      setScreen("visit");
      setForm({
        ticketId: "",
        client: "",
        request: "",
        equipment: "",
        objective: "",
      });
      createKey.current = "";
      setNotice("OS criada");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Falha ao criar OS.");
    } finally {
      setBusy(false);
    }
  };

  const chooseOrder = async (order: Order) => {
    setSelected(order);
    setScreen("visit");
    setNote("");
    setPhoto("");
    if (online)
      await refreshEvidence(username, order.id).catch(() => undefined);
    const items = await readEvidence(username, order.id);
    setVisits((v) => ({ ...v, [order.id]: items }));
  };

  const attachPhoto = async (file?: File) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setNotice("Use uma imagem JPEG, PNG ou WebP.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setNotice("A imagem deve ter no máximo 2 MiB.");
      return;
    }
    photoReader.current?.abort();
    const reader = new FileReader();
    photoReader.current = reader;
    setReadingPhoto(true);
    reader.onload = () => {
      setPhoto(String(reader.result));
      setNotice("");
    };
    reader.onerror = () =>
      setNotice("Falha ao ler a foto. Selecione o arquivo novamente.");
    reader.onloadend = () => setReadingPhoto(false);
    reader.readAsDataURL(file);
  };

  const addEvidence = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected || (!note.trim() && !photo)) {
      setNotice("Inclua uma observação ou uma foto.");
      return;
    }
    if (busy || readingPhoto) return;
    setBusy(true);
    try {
      const item = await saveEvidence(
        username,
        selected.id,
        note.trim(),
        photo,
      );
      setVisits((v) => ({
        ...v,
        [selected.id]: [
          ...(v[selected.id] || []).filter((record) => record.id !== item.id),
          item,
        ],
      }));
      setNote("");
      setPhoto("");
      setNotice(
        online
          ? "Evidência salva neste dispositivo · aguardando sincronização"
          : "Evidência salva neste dispositivo · pendente de conexão",
      );
      if (online) await syncNow();
    } catch {
      setNotice(
        "Falha ao salvar neste aparelho. Verifique o espaço disponível e tente novamente.",
      );
    } finally {
      setBusy(false);
    }
  };

  const syncNow = async () => {
    setBusy(true);
    try {
      const result = await syncEvidence(username);
      await loadVisits(username, orders);
      setNotice(
        result.some((item) => !item.sent)
          ? "Alguns registros não foram enviados · permanecem salvos neste dispositivo. Tente novamente."
          : "Sincronização concluída",
      );
    } catch {
      setNotice(
        "Falha de sincronização · evidências continuam salvas neste dispositivo",
      );
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const reconnect = () => {
      if (username) void syncNow();
    };
    window.addEventListener("online", reconnect);
    return () => window.removeEventListener("online", reconnect);
  }, [username, orders]);
  const grouped = useMemo(
    () =>
      orders.reduce<Record<string, Order[]>>((acc, order) => {
        (acc[order.ticketId] ||= []).push(order);
        return acc;
      }, {}),
    [orders],
  );

  if (loading)
    return (
      <main className="mx-auto max-w-lg p-6">
        <p>Carregando área de campo…</p>
      </main>
    );
  if (!username)
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center p-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-bold uppercase tracking-widest text-teal-800">
            ClimaOS · Campo
          </p>
          <h1 className="mt-3">Entrar na operação</h1>
          <p className="muted">
            Acesse suas ordens de serviço e registre as visitas.
          </p>
          <form onSubmit={loginUser} className="mt-6 grid gap-4">
            <label>
              Usuário
              <input
                autoComplete="username"
                required
                value={login.username}
                onChange={(e) =>
                  setLogin({ ...login, username: e.target.value })
                }
              />
            </label>
            <label>
              Senha
              <input
                type="password"
                autoComplete="current-password"
                required
                value={login.password}
                onChange={(e) =>
                  setLogin({ ...login, password: e.target.value })
                }
              />
            </label>
            <button
              className="min-h-12 rounded-xl bg-teal-800 px-5 font-semibold text-white disabled:opacity-50"
              disabled={busy}
            >
              {busy ? "Entrando…" : "Entrar"}
            </button>
          </form>
          {notice && (
            <p role="status" className="mt-4 text-sm text-rose-700">
              {notice}
            </p>
          )}
        </div>
      </main>
    );

  return (
    <main className="mx-auto min-h-screen max-w-2xl bg-slate-50 px-4 pb-10 sm:px-6">
      <header className="sticky top-0 z-10 -mx-4 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <a href="/" className="text-lg font-bold text-teal-900">
          ClimaOS{" "}
          <span className="text-sm font-medium text-slate-500">· Campo</span>
        </a>
        <div className="flex items-center gap-2">
          <span
            aria-label={online ? "Conectado" : "Sem conexão"}
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${online ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}
          >
            {online ? (
              <>
                <Wifi size={14} className="mr-1 inline" />
                Conectado
              </>
            ) : (
              <>
                <WifiOff size={14} className="mr-1 inline" />
                Offline
              </>
            )}
          </span>
          <button
            onClick={logout}
            title="Sair"
            className="grid min-h-11 min-w-11 place-items-center rounded-lg text-slate-600 hover:bg-slate-100"
          >
            <LogOut size={19} />
            <span className="sr-only">Sair de {username}</span>
          </button>
        </div>
      </header>
      <div className="py-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-teal-800">
              Operação
            </p>
            <h1 className="mt-1">Ordens e visitas</h1>
            <p className="muted">Olá, {username}</p>
          </div>
          {screen === "list" && (
            <button
              onClick={() => {
                setForm({
                  ticketId: "",
                  client: "",
                  request: "",
                  equipment: "",
                  objective: "",
                });
                setScreen("new");
                setNote("");
                setPhoto("");
              }}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-teal-800 px-4 font-semibold text-white"
            >
              <Plus size={18} />
              Nova OS
            </button>
          )}
        </div>
        {notice && (
          <p
            role="status"
            className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
          >
            {notice}
          </p>
        )}
        {screen === "list" && (
          <>
            <div className="mt-5 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-slate-700">
                {online ? <Cloud size={18} /> : <CloudOff size={18} />}
                <span>
                  {online
                    ? "Estado da conexão: disponível"
                    : "Alterações ficam salvas neste dispositivo"}
                </span>
              </div>
              <button
                onClick={syncNow}
                disabled={busy || !online}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-teal-900 disabled:opacity-50"
              >
                <RefreshCw size={16} className={busy ? "animate-spin" : ""} />
                Tentar sincronizar
              </button>
            </div>
            {Object.keys(grouped).length === 0 ? (
              <section className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center">
                <h2>Nenhuma OS disponível</h2>
                <p className="muted">
                  Crie uma ordem ou conecte-se para carregar os atendimentos.
                </p>
              </section>
            ) : (
              Object.entries(grouped).map(([ticket, list]) => (
                <section key={ticket} className="mt-6">
                  <h2 className="mb-3 text-sm uppercase tracking-wide text-slate-500">
                    Chamado {ticket}
                  </h2>
                  <div className="grid gap-3">
                    {list.map((order) => (
                      <button
                        key={order.id}
                        onClick={() => chooseOrder(order)}
                        className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-teal-700"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-teal-800">
                              OS {order.id}
                            </p>
                            <h3 className="mt-1 text-lg font-bold">
                              {order.client}
                            </h3>
                          </div>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                            {(visits[order.id] || []).some((v) => !v.sent)
                              ? "Pendente"
                              : "Visita"}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-slate-600">
                          {order.equipment}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {order.request}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          Objetivo: {order.objective}
                        </p>
                        <p className="mt-3 text-sm font-semibold text-teal-900">
                          {(visits[order.id] || []).length} registro(s) · Abrir
                          visita →
                        </p>
                      </button>
                    ))}
                  </div>
                </section>
              ))
            )}
          </>
        )}
        {screen === "new" && (
          <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5">
            <button
              onClick={() => {
                photoReader.current?.abort();
                setScreen("list");
              }}
              className="mb-3 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-teal-900"
            >
              <ArrowLeft size={17} />
              Voltar
            </button>
            <h2>Nova ordem de serviço</h2>
            <p className="muted">
              Abra um chamado ou selecione um existente para retorno.
            </p>
            <form onSubmit={createOrder} className="mt-5 grid gap-4">
              <label>
                Vincular a chamado existente
                <select
                  value={form.ticketId}
                  onChange={(e) => {
                    const selectedOrder = orders.find(
                      (o) => o.ticketId === e.target.value,
                    );
                    setForm({
                      ...form,
                      ticketId: e.target.value,
                      client: selectedOrder?.client || form.client,
                      request: selectedOrder?.request || "",
                      equipment: selectedOrder?.equipment || "",
                      objective: selectedOrder?.objective || "",
                    });
                  }}
                >
                  <option value="">Novo chamado</option>
                  {Object.keys(grouped).map((ticket) => (
                    <option key={ticket} value={ticket}>
                      {ticket} · {grouped[ticket][0].client}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Cliente
                <input
                  required
                  readOnly={!!form.ticketId}
                  value={form.client}
                  onChange={(e) => setForm({ ...form, client: e.target.value })}
                />
              </label>
              <label>
                Solicitação
                <input
                  required
                  readOnly={!!form.ticketId}
                  value={form.request}
                  onChange={(e) =>
                    setForm({ ...form, request: e.target.value })
                  }
                />
              </label>
              <label>
                Equipamento
                <input
                  required
                  value={form.equipment}
                  onChange={(e) =>
                    setForm({ ...form, equipment: e.target.value })
                  }
                />
              </label>
              <label>
                Objetivo do atendimento
                <textarea
                  required
                  rows={3}
                  value={form.objective}
                  onChange={(e) =>
                    setForm({ ...form, objective: e.target.value })
                  }
                />
              </label>
              <button
                disabled={busy || !online}
                className="min-h-12 rounded-xl bg-teal-800 px-5 font-semibold text-white disabled:opacity-50"
              >
                {busy
                  ? "Criando…"
                  : form.ticketId
                    ? "Criar OS de retorno"
                    : "Criar chamado e OS"}
              </button>
              {!online && (
                <p className="muted">
                  A criação da OS exige conexão. Você pode registrar evidências
                  em uma OS já carregada.
                </p>
              )}
            </form>
          </section>
        )}
        {screen === "visit" && selected && (
          <section className="mt-5">
            <button
              onClick={() => {
                photoReader.current?.abort();
                setScreen("list");
              }}
              className="mb-3 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-teal-900"
            >
              <ArrowLeft size={17} />
              Todas as visitas
            </button>
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-teal-800">
                Chamado {selected.ticketId} · OS {selected.id}
              </p>
              <h2 className="mt-2 text-2xl">{selected.client}</h2>
              <p className="mt-1 text-slate-600">{selected.equipment}</p>
              <div className="mt-4 rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase text-slate-500">
                  Atendimento
                </p>
                <p className="mt-1 font-medium">{selected.request}</p>
                <p className="mt-2 text-sm text-slate-600">
                  {selected.objective}
                </p>
              </div>
              <form onSubmit={addEvidence} className="mt-5 grid gap-4">
                <label>
                  Observação da visita
                  <textarea
                    maxLength={10000}
                    rows={4}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Descreva o que foi feito, medições ou pendências…"
                  />
                </label>
                <label className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 text-sm font-semibold text-teal-900">
                  <Camera size={19} />
                  Adicionar foto (JPEG, PNG ou WebP · até 2 MiB)
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    capture="environment"
                    className="sr-only"
                    onChange={(e) => void attachPhoto(e.target.files?.[0])}
                  />
                </label>
                {photo && (
                  <div className="relative">
                    <img
                      src={photo}
                      alt="Prévia da evidência anexada"
                      className="max-h-64 rounded-xl object-contain"
                    />
                    <button
                      type="button"
                      className="mt-2 text-sm font-semibold text-rose-700"
                      onClick={() => setPhoto("")}
                    >
                      Remover foto
                    </button>
                  </div>
                )}
                <button
                  disabled={busy || readingPhoto}
                  className="min-h-12 rounded-xl bg-teal-800 px-5 font-semibold text-white disabled:opacity-50"
                >
                  Salvar evidência
                </button>
              </form>
            </div>
            <div className="mt-5">
              <div className="mb-3 flex items-center justify-between">
                <h2>Registros da visita</h2>
                <button
                  onClick={async () => {
                    try {
                      const saved = await refreshEvidence(
                        username,
                        selected.id,
                      );
                      setVisits((v) => ({ ...v, [selected.id]: saved }));
                    } catch {
                      setNotice(
                        "Falha ao atualizar. Os registros locais continuam disponíveis.",
                      );
                    }
                  }}
                  className="min-h-10 px-2 text-sm font-semibold text-teal-900"
                >
                  Atualizar
                </button>
              </div>
              <div className="grid gap-3">
                {(visits[selected.id] || []).length === 0 ? (
                  <p className="rounded-xl bg-white p-4 text-sm text-slate-500">
                    Nenhuma evidência registrada.
                  </p>
                ) : (
                  (visits[selected.id] || []).map((item) => (
                    <article
                      key={item.id}
                      className="rounded-xl border border-slate-200 bg-white p-4"
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.sent ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}
                        >
                          {item.sent
                            ? "Enviado"
                            : "Salvo neste aparelho · pendente"}
                        </span>
                        {!item.sent && (
                          <CloudOff size={16} className="text-amber-800" />
                        )}
                      </div>
                      {item.note && (
                        <p className="whitespace-pre-wrap text-sm">
                          {item.note}
                        </p>
                      )}
                      {item.photo && (
                        <img
                          src={item.photo}
                          alt="Foto registrada na visita"
                          className="mt-3 max-h-64 rounded-xl object-contain"
                        />
                      )}
                    </article>
                  ))
                )}
              </div>
              {(visits[selected.id] || []).some((item) => !item.sent) && (
                <button
                  onClick={syncNow}
                  disabled={!online || busy}
                  className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-teal-800 px-4 font-semibold text-teal-900 disabled:opacity-50"
                >
                  <RefreshCw size={17} />
                  Tentar enviar pendentes
                </button>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
