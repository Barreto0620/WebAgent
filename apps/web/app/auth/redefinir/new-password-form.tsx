"use client";
import { useActionState } from "react";
import { setNewPassword, type FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

export function NewPasswordForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(setNewPassword, {});
  return (
    <form action={action} className="mt-6 flex flex-col gap-4">
      <Field label="Nova senha" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} />
      </Field>
      <Field label="Repita a nova senha" htmlFor="confirm">
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={10} />
      </Field>
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      <Button type="submit" size="lg" loading={pending} className="justify-center">
        Salvar e entrar
      </Button>
    </form>
  );
}
