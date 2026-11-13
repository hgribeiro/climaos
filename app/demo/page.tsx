"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, ClipboardList, FileText, Plus, Snowflake, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

type View = "login" | "customers" | "customer" | "orders" | "create" | "execute" | "review" | "report";
type Photo = { id: string; src: string; caption: string; phase: string };
type Draft = { objective: string; date: string; technician: string; equipment: string; checks: boolean[]; notes: string; photos: Photo[]; signer: string; signature: string; status: string; context?: string };
type Report = { draft: Draft; emittedAt: string; version: number };
const KEY = "climaos-demo-v1";
const checklist = ["Inspeção visual da evaporadora e dos filtros", "Higienização dos filtros", "Limpeza da bandeja e verificação do escoamento do dreno", "Teste de funcionamento após o serviço", "Inspeção visual da unidade externa", "Orientação ao responsável"];
const blank = (): Draft => ({ objective: "Manutenção preventiva", date: "", technician: "Ana · Técnica demonstração", equipment: "EQ-001 · Split 12.000 BTU · Recepção", checks: checklist.map(() => false), notes: "", photos: [], signer: "", signature: "", status: "Rascunho" });
const example = (): Draft => ({ ...blank(), date: "2026-11-12", checks: [true, true, true, true, true, true], context: "Solicitação fictícia: recepção com gotejamento após algumas horas de uso. Split de parede de 12.000 BTU/h; unidade externa na área técnica. Histórico fictício: limpeza dos filtros há quatro meses. Visita combinada fora do horário de pico.", notes: "Relato fictício: responsável informou gotejamento na unidade interna após algumas horas de uso. Na inspeção simulada, havia acúmulo de poeira nos filtros e escoamento lento no dreno. Foram simuladas a higienização dos filtros e da bandeja, a limpeza do dreno e a verificação de escoamento. No teste demonstrativo, o aparelho operou sem gotejamento aparente. Orientação: acompanhar o funcionamento e solicitar avaliação técnica caso o sintoma retorne.", photos: [{ id: "reference-equipment", src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0f/Air_Conditioner_1.jpg/960px-Air_Conditioner_1.jpg", caption: "Equipamento de referência · Open Grid Scheduler / Grid Engine, Wikimedia Commons, CC0", phase: "Foto ilustrativa" }, { id: "reference-service", src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ea/5233Aircon_cleaning_in_the_Philippines_02.jpg/960px-5233Aircon_cleaning_in_the_Philippines_02.jpg", caption: "Limpeza de ar-condicionado · Judgefloro, Wikimedia Commons, CC0", phase: "Foto ilustrativa" }], signer: "Responsável demonstrativo", status: "Em execução" });
const customer = "Café Horizonte · cliente fictício";
const site = "Unidade Centro · endereço fictício · São Paulo/SP";

function Signature({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  useEffect(() => {
    const canvas = ref.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (value) { const img = new Image(); img.onload = () => context.drawImage(img, 0, 0); img.src = value; }
  }, [value]);
  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return [(event.clientX - rect.left) * 800 / rect.width, (event.clientY - rect.top) * 240 / rect.height];
  }
  return <div className="space-y-3">
    <p id="signature-instructions" className="muted">Desenhe com o dedo ou mouse. Assinatura apenas demonstrativa.</p>
    <canvas ref={ref} width={800} height={240} aria-label="Área para desenhar assinatura" aria-describedby="signature-instructions" className="w-full touch-none rounded-xl border border-slate-400 bg-white"
      onPointerDown={event => { drawing.current = true; event.currentTarget.setPointerCapture(event.pointerId); const ctx = event.currentTarget.getContext("2d"); const [x, y] = point(event); if (ctx) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + .5, y + .5); ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.strokeStyle = "#172b3a"; ctx.stroke(); } }}
      onPointerMove={event => { if (!drawing.current) return; const ctx = event.currentTarget.getContext("2d"); const [x, y] = point(event); if (ctx) { ctx.lineTo(x, y); ctx.stroke(); } }}
      onPointerUp={event => { if (!drawing.current) return; drawing.current = false; onChange(event.currentTarget.toDataURL("image/png")); }}
      onPointerCancel={event => { drawing.current = false; onChange(event.currentTarget.toDataURL("image/png")); }}
    />
    <Button variant="outline" onClick={() => onChange("")}>Limpar assinatura</Button>
  </div>;
}

export default function Home() {
  const [view, setView] = useState<View>("execute");
  const [draft, setDraft] = useState<Draft>(example);
  const [exists, setExists] = useState(true);
  const [report, setReport] = useState<Report | null>(null);
  const [ready, setReady] = useState(false);
  const [storageBlocked, setStorageBlocked] = useState(false);
  const [saved, setSaved] = useState("");
  const [error, setError] = useState("");
  const [storageError, setStorageError] = useState("");
  const draftGeneration = useRef(0);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [replace, setReplace] = useState(false);
  const [newOrder, setNewOrder] = useState<Draft>(blank);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (!data || typeof data.exists !== "boolean" || !data.draft || !Array.isArray(data.draft.checks) || !Array.isArray(data.draft.photos) || typeof data.draft.objective !== "string") throw new Error("invalid storage");
        setDraft(data.draft); setExists(data.exists); setReport(data.report ?? null);
      }
    } catch {
      setStorageBlocked(true);
      setError("Armazenamento indisponível. A demonstração funciona nesta sessão, mas alterações não serão salvas.");
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || storageBlocked) return;
    try {
      localStorage.setItem(KEY, JSON.stringify({ draft, exists, report }));
      setSaved("Rascunho salvo neste navegador");
      setStorageError("");
    } catch {
      setSaved("");
      setStorageError("Não foi possível salvar neste navegador. Não feche a página: remova fotos para reduzir o tamanho ou permita o armazenamento local.");
    }
  }, [draft, exists, report, ready, storageBlocked]);

  function patch(change: Partial<Draft>) { setSaved(""); setDraft(previous => ({ ...previous, ...change })); }
  function go(next: View) { setView(next); setError(storageBlocked ? "Recuperação local indisponível; salvamento desativado para preservar os dados existentes." : ""); window.scrollTo({ top: 0 }); }
  function startNew() { setNewOrder(blank()); setReplace(false); go("create"); }
  async function addPhoto(file?: File) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setError("Escolha uma imagem JPEG, PNG ou WebP."); return; }
    if (file.size > 500 * 1024 || draft.photos.length >= 6 || draft.photos.reduce((total, photo) => total + photo.src.length, 0) + Math.ceil(file.size / 3) * 4 + 64 > 800 * 1024) { setError("Limite local: até seis fotos, 500 KB por foto e aproximadamente 600 KB no conjunto. Reduza as imagens ou remova uma foto."); return; }
    const generation = draftGeneration.current;
    setPhotoBusy(true); setError("");
    try {
      const src = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
      await new Promise<void>((resolve, reject) => { const img = new Image(); img.onload = () => resolve(); img.onerror = reject; img.src = src; });
      if (draftGeneration.current === generation) setDraft(previous => ({ ...previous, photos: [...previous.photos, { id: crypto.randomUUID(), src, caption: file.name, phase: "Antes" }] }));
    } catch { setError("Não foi possível ler esta imagem. Tente outro arquivo."); }
    finally { setPhotoBusy(false); }
  }
  function saveReport() {
    if (!draft.objective.trim()) { setError("Preencha o objetivo."); return; }
    const snapshot: Report = { draft: structuredClone(draft), emittedAt: new Date().toISOString(), version: (report?.version ?? 0) + 1 };
    setReport(snapshot); go("report");

  }
  const title: Record<View, string> = { login: "Seu atendimento, bem documentado.", customers: "Clientes", customer: customer, orders: "Ordens de serviço", create: "Nova ordem de serviço", execute: "Execução do atendimento", review: "Revisão e assinatura", report: "Relatório do atendimento" };
  const data = view === "report" ? report?.draft : draft;

  if (!ready) return <main className="p-8" role="status">Carregando demonstração…</main>;

  return <div>
    <header className="no-print border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div className="flex items-center gap-2 text-xl font-bold"><Snowflake className="text-teal-800" aria-hidden="true" />ClimaOS</div>
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-950">Demonstração · Dados fictícios</span>
      </div>
    </header>
    {view !== "login" && <nav aria-label="Navegação principal" className="no-print mx-auto flex max-w-6xl flex-wrap gap-2 px-5 py-4">
      <Link href="/" className="self-center text-sm underline">Site institucional</Link>
      <Button variant="outline" onClick={() => { if (!window.confirm("Restaurar o exemplo e substituir o rascunho e relatório atuais?")) return; draftGeneration.current += 1; setDraft(example()); setExists(true); setReport(null); setStorageBlocked(false); setError(""); setStorageError(""); setView("execute"); window.scrollTo({ top: 0 }); }}>Restaurar demonstração</Button>
      <Button variant="outline" onClick={() => go("customers")}><Users size={17} />Clientes</Button>
      <Button variant="outline" onClick={() => go("orders")}><ClipboardList size={17} />Ordens de serviço</Button>
      {report && <Button variant="outline" onClick={() => go("report")}><FileText size={17} />Último relatório</Button>}
    </nav>}
    <main className="mx-auto max-w-5xl space-y-6 px-5 py-8"><p className="no-print rounded-xl bg-amber-50 p-4 text-sm text-amber-950">Use apenas dados fictícios. Alterações são salvas neste navegador quando o armazenamento estiver disponível.</p>
      <div className="no-print"><p className="mb-2 text-xs font-semibold uppercase tracking-widest text-teal-800">Ambiente de demonstração</p><h1>{title[view]}</h1></div>
      {storageError && <p role="alert" className="no-print rounded-xl border border-red-300 bg-red-50 p-4 text-red-900">{storageError}</p>}
      {error && <p role="alert" className="no-print rounded-xl border border-red-300 bg-red-50 p-4 text-red-900">{error}</p>}

      {view === "login" && <section className="panel max-w-xl space-y-5">
        <p>Registre a visita pelo celular e revise as evidências antes de preparar o relatório.</p>
        <p className="muted">Entrada demonstrativa sem senha. Nenhum usuário é autenticado. Use apenas informações fictícias.</p>
        <Button onClick={() => go("customers")}>Entrar na demonstração <ArrowRight size={18} /></Button>
      </section>}

      {view === "customers" && <section className="space-y-4">
        <label>Buscar cliente<input value={query} onChange={event => setQuery(event.target.value)} placeholder="Nome do cliente" /></label>
        {customer.toLocaleLowerCase().includes(query.toLocaleLowerCase()) ? <article className="panel flex flex-wrap items-center justify-between gap-4"><div><h2>{customer}</h2><p className="muted">1 local · 1 equipamento · Cadastro fictício</p></div><Button onClick={() => go("customer")}>Ver cliente <ArrowRight size={16} /></Button></article> : <p>Nenhum cliente encontrado.</p>}
      </section>}

      {view === "customer" && <section className="space-y-5">
        <div className="panel space-y-2"><h2>Contato e local</h2><p>Marina Exemplo · contato@example.com</p><p>{site}</p><p className="muted">Identificação fiscal omitida no protótipo.</p></div>
        <div className="panel space-y-3"><h2>Equipamentos</h2><p>EQ-001 · Split 12.000 BTU · Recepção</p><p className="muted">Modelo fictício SPL-12 · Série fictícia DEMO-001 · Unidade externa na área técnica.</p><Button onClick={startNew}><Plus size={18} />Nova OS para este cliente</Button></div>
      </section>}

      {view === "orders" && <section className="space-y-4">
        <Button onClick={startNew}><Plus size={18} />Nova OS</Button>
        {exists ? <article className="panel space-y-3"><div className="flex flex-wrap justify-between gap-2"><h2>OS DEMO-001 · {customer}</h2><span className="rounded-full bg-teal-50 px-3 py-1 text-sm text-teal-900">{draft.status}</span></div><p>{draft.objective} · {draft.date}</p><p className="muted">{draft.technician}</p><Button onClick={() => go("execute")}>Retomar atendimento</Button></article> : <div className="panel"><p>Nenhuma OS criada. Comece pelo cliente fictício.</p></div>}
      </section>}

      {view === "create" && <form className="panel space-y-5" onSubmit={event => { event.preventDefault(); if (exists && !replace) return; draftGeneration.current += 1; setDraft({ ...newOrder, status: "Em execução" }); setExists(true); go("execute"); }}>
        <p><strong>Cliente:</strong> {customer}<br /><span className="muted">{site}</span></p>
        <div className="grid-fields">
          <label>Equipamento<select required value={newOrder.equipment} onChange={event => setNewOrder({ ...newOrder, equipment: event.target.value })}><option>EQ-001 · Split 12.000 BTU · Recepção</option></select></label>
          <label>Técnico<select required value={newOrder.technician} onChange={event => setNewOrder({ ...newOrder, technician: event.target.value })}><option>Ana · Técnica demonstração</option><option>Bruno · Técnico demonstração</option></select></label>
          <label>Data do atendimento<input type="date" required value={newOrder.date} onChange={event => setNewOrder({ ...newOrder, date: event.target.value })} /></label>
          <label>Objetivo<input required maxLength={200} value={newOrder.objective} onChange={event => setNewOrder({ ...newOrder, objective: event.target.value })} /></label>
        </div>
        {exists && <label className="flex items-start gap-3"><input type="checkbox" checked={replace} onChange={event => setReplace(event.target.checked)} />Substituir o rascunho atual. O último relatório salvo será preservado.</label>}
        <div className="flex flex-wrap gap-3"><Button variant="outline" type="button" onClick={() => go("customer")}>Cancelar</Button><Button disabled={(exists && !replace) || !newOrder.objective.trim()}>Criar e iniciar atendimento <ArrowRight size={16} /></Button></div>
      </form>}

      {view === "execute" && <section className="space-y-5">
        <div className="panel space-y-2"><h2>OS DEMO-001 · {customer}</h2><p>{draft.equipment}</p><p className="muted">{draft.technician} · {draft.date}</p>{draft.context && <p className="whitespace-pre-wrap">{draft.context}</p>}<p role="status" className="text-sm text-teal-800">{saved || "Alterações ainda não confirmadas no armazenamento"}</p></div>
        <div className="panel space-y-4"><h2>Checklist</h2>{checklist.map((item, index) => <label key={item} className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={!!draft.checks[index]} onChange={event => patch({ checks: checklist.map((_, position) => position === index ? event.target.checked : !!draft.checks[position]) })} />{item}</label>)}</div>
        <div className="panel space-y-4"><h2>Imagens ilustrativas · EQ-001</h2><p className="muted">Fotografias de referência: não mostram o equipamento ou o atendimento fictício. Disponíveis online via Wikimedia Commons.</p><div className="grid gap-5 sm:grid-cols-2">{draft.photos.map(photo => <figure key={photo.id}><img src={photo.src} alt={photo.caption} className="w-full rounded-lg" /><figcaption>{photo.phase} · {photo.caption}</figcaption></figure>)}</div></div>
        <div className="panel space-y-4"><label className="block">Objetivo<input maxLength={200} value={draft.objective} onChange={event => patch({ objective: event.target.value })} /></label><label className="block">Observações<textarea rows={5} maxLength={5000} value={draft.notes} onChange={event => patch({ notes: event.target.value })} placeholder="Descreva o que foi realizado e os pontos de atenção." /></label></div>
        <Button disabled={photoBusy || !draft.objective.trim()} onClick={() => go("review")}>Revisar atendimento <ArrowRight size={16} /></Button>
      </section>}

      {(view === "review" || view === "report") && data && <section className="space-y-5">
        <article className="panel space-y-6">
          <div><p className="text-xs font-semibold uppercase tracking-widest text-teal-800">Documento demonstrativo</p><h2>Relatório de atendimento · OS DEMO-001</h2>{view === "report" && report && <p className="muted">Versão {report.version} · Salvo em {new Date(report.emittedAt).toLocaleString("pt-BR")}</p>}</div>
          <div className="grid-fields"><div><h2>Cliente e local</h2><p>{customer}<br />{site}</p></div><div><h2>Atendimento</h2><p>{data.date} · {data.technician}<br />{data.equipment}</p></div></div>
          {data.context && <div><h2>Contexto da solicitação</h2><p className="whitespace-pre-wrap">{data.context}</p></div>}<div><h2>Objetivo</h2><p className="whitespace-pre-wrap">{data.objective}</p></div>
          <div><h2>Checklist</h2><ul className="mt-2 space-y-2">{checklist.map((item, index) => <li key={item}>{data.checks[index] ? "✓ Realizado" : "○ Não marcado"} — {item}</li>)}</ul></div>
          <div><h2>Observações</h2><p className="whitespace-pre-wrap">{data.notes || "Sem observações registradas."}</p></div>
          <div><h2>Imagens de referência</h2><p className="muted">As fotos de referência identificadas como ilustrativas não registram esta OS. Fontes: Wikimedia Commons, Open Grid Scheduler / Grid Engine e Judgefloro (CC0).</p>{data.photos.length === 0 && <p className="muted">Nenhuma foto anexada.</p>}<div className="mt-3 grid gap-5 sm:grid-cols-2">{data.photos.map(photo => <figure key={photo.id} className="space-y-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="max-h-80 w-full object-contain" src={photo.src} alt={photo.caption || "Evidência do equipamento"} /><figcaption className="text-sm">{photo.phase} · {photo.caption || "Sem legenda"}</figcaption>
          </figure>)}</div></div>
          {view === "report" && <div className="signature"><h2>Responsável pelo aceite</h2><p>{data.signer}</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {data.signature ? <img className="max-w-full w-80" src={data.signature} alt={"Assinatura demonstrativa de " + data.signer} /> : <p>________________________________<br />Espaço para assinatura</p>}<p className="muted">Demonstração sem validade de emissão. Assinatura capturada como evidência visual.</p></div>}
        </article>
        {view === "review" ? <div className="panel space-y-5 no-print"><h2>Assinatura do responsável</h2><label className="block">Nome completo (fictício)<input maxLength={100} value={draft.signer} onChange={event => patch({ signer: event.target.value })} /></label><Signature value={draft.signature} onChange={signature => patch({ signature })} /><p className="muted">Ao salvar, uma cópia do conteúdo revisado fica disponível nesta sessão e, quando possível, neste navegador. Uma nova versão substitui a última versão consultável.</p><div className="flex flex-wrap gap-3"><Button variant="outline" onClick={() => go("execute")}><ArrowLeft size={16} />Editar</Button><Button disabled={!draft.objective.trim()} onClick={saveReport}><CheckCircle2 size={16} />Salvar relatório demonstrativo</Button></div></div> : <div className="no-print space-y-4"><p className="muted">Use a impressão do navegador para visualizar ou salvar como PDF. Se o armazenamento estiver indisponível, este relatório dura apenas nesta sessão.</p><Button onClick={() => window.print()}>Imprimir / Salvar como PDF</Button></div>}
      </section>}
      <footer className="no-print border-t border-slate-200 pt-5 text-xs text-slate-600">S0 · Sem autenticação real ou envio ao servidor. Rascunhos e relatório disponíveis apenas neste navegador.</footer>
    </main>
  </div>;
}
