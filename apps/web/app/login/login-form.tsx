"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { signIn, type FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(signIn, {});
  const [show, setShow] = useState(false);
  return (
    <form action={action} className="mt-6 flex flex-col gap-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="E-mail" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required placeholder="voce@empresa.com.br" />
      </Field>
      <Field label="Senha" htmlFor="password">
        <div className="relative">
          <Input id="password" name="password" type={show ? "text" : "password"} autoComplete="current-password" required className="pr-10" />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted hover:text-fg"
            aria-label={show ? "Ocultar senha" : "Mostrar senha"}
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </Field>
      <div className="flex justify-end text-[13px]">
        <Link href="/esqueci-senha" className="font-medium text-primary hover:underline">
          Esqueci a senha
        </Link>
      </div>
      {state.error && (
        <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      )}
      <Button type="submit" size="lg" loading={pending} className="justify-center">
        Entrar
      </Button>
      <p className="text-center text-xs text-muted">
        Ao entrar, você concorda com a{" "}
        <Link href="/privacidade" className="underline underline-offset-2">
          Política de Privacidade
        </Link>
        .
      </p>
    </form>
  );
}
