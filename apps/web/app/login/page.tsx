import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; erro?: string }> }) {
  const { next, erro } = await searchParams;
  return (
    <AuthShell>
      <h2 className="text-2xl font-extrabold">Entrar</h2>
      <p className="mt-1 text-sm text-muted">Use o e-mail e a senha que a WebCash liberou para você.</p>
      {erro === "link" && (
        <p className="mt-4 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          O link expirou ou já foi usado. Peça um novo em “Esqueci a senha”.
        </p>
      )}
      <LoginForm next={next} />
    </AuthShell>
  );
}
