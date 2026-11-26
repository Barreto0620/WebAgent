import Image from "next/image";
import Link from "next/link";

const CHANNELS = [
  { name: "WhatsApp", live: true },
  { name: "Instagram", live: false },
  { name: "Facebook", live: false },
  { name: "TikTok", live: false },
];

/** Moldura das telas públicas (login, senha): painel da marca à esquerda, formulário à direita. */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <section className="grid-bg relative hidden overflow-hidden bg-sidebar px-12 py-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -right-24 -bottom-24 size-[420px] rounded-full border-[56px] border-neon/10" />
        <div className="pointer-events-none absolute top-24 right-28 size-2 rounded-full bg-gold shadow-[0_0_18px_4px_rgba(233,162,59,0.6)]" />
        <div className="flex items-center gap-3">
          <Image src="/logo-webcash.png" alt="WebCash Company" width={44} height={44} priority className="rounded-full" />
          <div>
            <p className="font-display text-lg font-extrabold">WebAgent</p>
            <p className="text-xs text-sidebar-fg/70">by WebCash Company</p>
          </div>
        </div>
        <div className="relative max-w-md">
          <h1 className="text-[34px] leading-tight font-extrabold">
            Todo o atendimento da <span className="text-neon">WebCash</span> em um só lugar.
          </h1>
          <p className="mt-3 text-[15px] text-sidebar-fg/80">
            Respostas automáticas, horário de funcionamento, fila de suporte e publicações nas redes sociais.
          </p>
          <ul className="mt-6 flex flex-wrap gap-2">
            {CHANNELS.map((c) => (
              <li
                key={c.name}
                className={`rounded-full border px-3 py-1 text-xs ${c.live ? "border-neon/40 text-neon" : "border-white/15 text-white/45"}`}
              >
                {c.name}
                {!c.live && " · em breve"}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-white/40">Dados protegidos conforme a LGPD (Lei 13.709/2018).</p>
      </section>

      <section className="flex flex-col justify-center px-5 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <Image src="/logo-webcash.png" alt="WebCash Company" width={40} height={40} priority className="rounded-full" />
            <p className="font-display text-lg font-extrabold">WebAgent</p>
          </div>
          {children}
        </div>
        <footer className="mx-auto mt-10 flex w-full max-w-sm justify-between text-xs text-muted">
          <span>© {new Date().getFullYear()} WebCash Company</span>
          <Link href="/privacidade" className="hover:text-fg">
            Privacidade
          </Link>
        </footer>
      </section>
    </main>
  );
}
