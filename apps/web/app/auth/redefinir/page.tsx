import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { NewPasswordForm } from "./new-password-form";

export const metadata: Metadata = { title: "Nova senha" };

export default function Page() {
  return (
    <AuthShell>
      <h2 className="text-2xl font-extrabold">Criar nova senha</h2>
      <p className="mt-1 text-sm text-muted">Mínimo de 10 caracteres, com letras e números.</p>
      <NewPasswordForm />
    </AuthShell>
  );
}
