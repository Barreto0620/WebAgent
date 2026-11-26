import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="text-center">
        <p className="text-sm font-semibold text-primary">404</p>
        <h1 className="mt-2 text-2xl font-extrabold">Página não encontrada</h1>
        <p className="mt-2 text-sm text-muted">O endereço pode ter mudado ou não existe.</p>
        <Link href="/dashboard" className="mt-6 inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary">
          Voltar ao painel
        </Link>
      </div>
    </main>
  );
}
