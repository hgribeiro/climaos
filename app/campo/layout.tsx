"use client";

import { useEffect, useState } from "react";

export default function FieldLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [status, setStatus] = useState("Preparando acesso offline…");
  useEffect(() => {
    let active = true;
    async function prepare() {
      try {
        const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
        const registration = await navigator.serviceWorker.register(
          base + "/campo/sw.js",
        );
        const worker = registration.installing;
        if (worker && !registration.active) {
          await new Promise<void>((resolve, reject) => {
            const check = () => {
              if (worker.state === "activated") resolve();
              if (worker.state === "redundant") reject(new Error());
            };
            worker.addEventListener("statechange", check);
            check();
          });
        }
        await navigator.serviceWorker.ready;
        if (active) setStatus("Aplicativo disponível para reabrir offline.");
      } catch {
        if (active) setStatus("Acesso offline indisponível neste navegador.");
      }
    }
    void prepare();
    return () => {
      active = false;
    };
  }, []);
  return (
    <>
      {children}
      <footer className="p-4 text-center text-sm text-slate-600" role="status">
        {status}
      </footer>
    </>
  );
}
