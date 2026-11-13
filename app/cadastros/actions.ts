"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { authClient, requireOrganization } from "@/lib/server/auth";
import { db } from "@/lib/server/db";

function field(data: FormData, key: string, max = 160) {
  const value = data.get(key);
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) throw new Error("Dados inválidos.");
  return value.trim();
}
export async function login(data: FormData) {
  const email = field(data, "email", 254), password = field(data, "password", 256);
  const client = await authClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) redirect("/cadastros/login?erro=credenciais");
  redirect("/cadastros");
}
export async function logout() {
  const client = await authClient();
  await client.auth.signOut();
  redirect("/cadastros/login");
}
export async function createCustomer(data: FormData) {
  const org = await requireOrganization();
  await db.customer.create({ data: { organizationId: org.id, name: field(data, "name") } });
  revalidatePath("/cadastros");
}
export async function updateCustomer(data: FormData) {
  const org = await requireOrganization();
  await db.customer.updateMany({ where: { id: field(data, "id", 36), organizationId: org.id }, data: { name: field(data, "name") } });
  revalidatePath("/cadastros");
}
export async function createEquipment(data: FormData) {
  const org = await requireOrganization();
  const customerId = field(data, "customerId", 36);
  const customer = await db.customer.findFirst({ where: { id: customerId, organizationId: org.id }, select: { id: true } });
  if (!customer) throw new Error("Cliente não encontrado.");
  await db.equipment.create({ data: { organizationId: org.id, customerId: customer.id, description: field(data, "description") } });
  revalidatePath("/cadastros");
}
