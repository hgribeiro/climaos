import Link from "next/link";
import { login } from "../actions";
export const dynamic = "force-dynamic";
export default async function Login({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  return <main className="mx-auto max-w-xl space-y-5 px-5 py-8">
    <h1>Entrar nos cadastros</h1>
    <p>Área de testes S1. Use apenas dados fictícios em um ambiente separado.</p>
    {erro && <p role="alert">{erro === "sem-vinculo" ? "Usuário sem vínculo com uma organização. Peça o provisionamento ao administrador." : "Não foi possível entrar. Confira suas credenciais."}</p>}
    <form action={login} className="panel space-y-4">
      <label className="block">E-mail<input name="email" type="email" required maxLength={254} autoComplete="username" /></label>
      <label className="block">Senha<input name="password" type="password" required maxLength={256} autoComplete="current-password" /></label>
      <button className="rounded bg-teal-800 px-4 py-3 text-white">Entrar</button>
    </form>
    <Link href="/">Voltar à demonstração S0</Link>
  </main>;
}
