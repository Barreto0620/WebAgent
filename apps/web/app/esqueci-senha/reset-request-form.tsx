"use client";
import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordReset, type FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

export function ResetRequestForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(requestPasswordReset, {});
  return (
    <form action={action} className="mt-6 flex flex-col gap-4">
      <Field label="E-mail" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      {state.ok && <p className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-primary">{state.ok}</p>}
      <Button type="submit" size="lg" loading={pending} className="justify-center">
        Enviar link
      </Button>
      <Link href="/login" className="text-center text-[13px] font-medium text-primary hover:underline">
        Voltar para o login
      </Link>
    </form>
  );
}
