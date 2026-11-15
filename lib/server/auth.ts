import "server-only";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";

export async function authClient() {
  const jar = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (items: { name: string; value: string; options: CookieOptions }[]) => { try { items.forEach(({ name, value, options }) => jar.set(name, value, options)); } catch { /* Server Components cannot update cookies. */ } },
    },
  });
}
async function requireMembership() {
  const supabase = await authClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/cadastros/login");
  const membership = await db.membership.findUnique({ where: { userId: user.id }, include: { organization: true } });
  if (!membership) redirect("/cadastros/login?erro=sem-vinculo");
  return membership;
}
export async function requireOrganization() {
  return (await requireMembership()).organization;
}
export async function requireAdmin() {
  const membership = await requireMembership();
  if (membership.role !== "ADMIN") throw new Error("Acesso restrito a administradores.");
  return membership.organization;
}
