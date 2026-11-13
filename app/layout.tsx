import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "ClimaOS · Protótipo", description: "Protótipo de atendimento em campo com dados fictícios" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
