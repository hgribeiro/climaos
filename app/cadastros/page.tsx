import Link from "next/link";
import { requireOrganization } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { createCustomer, createEquipment, logout, updateCustomer } from "./actions";
export const dynamic = "force-dynamic";
export default async function Cadastros() {
  const org = await requireOrganization();
  const customers = await db.customer.findMany({ where: { organizationId: org.id }, orderBy: { name: "asc" }, include: { equipment: { orderBy: { createdAt: "asc" } } } });
  return <main className="mx-auto max-w-4xl space-y-6 px-5 py-8">
    <h1>Clientes e equipamentos</h1>
    <p>Ambiente de testes S1 · Organização: {org.name}. Campos provisórios; use apenas dados fictícios.</p>
    <div className="flex gap-4"><Link href="/">Demonstração S0</Link><form action={logout}><button>Sair</button></form></div>
    <form action={createCustomer} className="panel space-y-3">
      <h2>Novo cliente</h2>
      <label className="block">Nome<input name="name" required maxLength={160} /></label>
      <button className="rounded bg-teal-800 px-4 py-3 text-white">Salvar cliente</button>
    </form>
    {customers.length === 0 && <p>Nenhum cliente cadastrado.</p>}
    {customers.map(customer => <section className="panel space-y-5" key={customer.id}>
      <form action={updateCustomer} className="space-y-3">
        <input type="hidden" name="id" value={customer.id} />
        <label className="block">Nome do cliente<input name="name" defaultValue={customer.name} required maxLength={160} /></label>
        <button className="rounded border px-4 py-3">Atualizar cliente</button>
      </form>
      <div><h2>Equipamentos</h2>{customer.equipment.length === 0 ? <p>Nenhum equipamento cadastrado.</p> : <ul>{customer.equipment.map(item => <li key={item.id}>{item.description}</li>)}</ul>}</div>
      <form action={createEquipment} className="space-y-3">
        <input type="hidden" name="customerId" value={customer.id} />
        <label className="block">Descrição do equipamento<input name="description" required maxLength={160} /></label>
        <button className="rounded border px-4 py-3">Adicionar equipamento</button>
      </form>
    </section>)}
  </main>;
}
