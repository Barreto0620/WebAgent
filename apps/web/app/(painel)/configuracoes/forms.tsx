"use client";
import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { changePassword, updateProfile } from "@/app/actions/profile";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";

export function ProfileForm({ name, email }: { name: string; email: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateProfile, {});
  useEffect(() => {
    if (state.ok) toast.success(state.ok);
  }, [state]);
  return (
    <Card>
      <CardHeader title="Perfil" description="Seu nome aparece para a equipe nas conversas." />
      <form action={action} className="flex flex-col gap-4 p-5">
        <Field label="Nome" htmlFor="full_name">
          <Input id="full_name" name="full_name" defaultValue={name} required minLength={2} maxLength={120} autoComplete="name" />
        </Field>
        <Field label="E-mail" htmlFor="email" hint="Para trocar o e-mail, fale com um administrador.">
          <Input id="email" value={email} disabled readOnly />
        </Field>
        {state.error && <p className="text-sm text-danger">{state.error}</p>}
        <div className="flex justify-end">
          <Button type="submit" loading={pending}>Salvar nome</Button>
        </div>
      </form>
    </Card>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(changePassword, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) {
      toast.success(state.ok);
      ref.current?.reset();
    }
  }, [state]);
  return (
    <Card>
      <CardHeader title="Alterar senha" description="Mínimo de 10 caracteres, com letras e números." />
      <form ref={ref} action={action} className="flex flex-col gap-4 p-5">
        <Field label="Senha atual" htmlFor="current">
          <Input id="current" name="current" type="password" required autoComplete="current-password" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nova senha" htmlFor="password">
            <Input id="password" name="password" type="password" required minLength={10} autoComplete="new-password" />
          </Field>
          <Field label="Repita a nova senha" htmlFor="confirm">
            <Input id="confirm" name="confirm" type="password" required minLength={10} autoComplete="new-password" />
          </Field>
        </div>
        {state.error && <p className="text-sm text-danger">{state.error}</p>}
        <div className="flex justify-end">
          <Button type="submit" loading={pending}>Alterar senha</Button>
        </div>
      </form>
    </Card>
  );
}
