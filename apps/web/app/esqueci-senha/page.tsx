import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { ResetRequestForm } from "./reset-request-form";

export const metadata: Metadata = { title: "Esqueci a senha" };

export default function Page() {
  return (
    <AuthShell>
      <h2 className="text-2xl font-extrabold">Esqueci a senha</h2>
      <p className="mt-1 text-sm text-muted">Informe seu e-mail e enviaremos um link para criar uma nova senha.</p>
      <ResetRequestForm />
    </AuthShell>
  );
}
