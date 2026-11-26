"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createSystem } from "@/app/actions/systems-admin";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";

const SWATCHES = ["#2BD14A", "#E9A23B", "#3BA7F5", "#B57CF6", "#F25F8B", "#12B5A6"];

export function NewSystemForm() {
  const [open, setOpen] = useState(false);
  const [color, setColor] = useState(SWATCHES[2]!);
  const [state, action, pending] = useActionState<FormState, FormData>(createSystem, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      toast.success(state.ok);
      formRef.current?.reset();
      setOpen(false);
    }
  }, [state]);

  if (!open) {
    return (
      <div>
        <Button variant="secondary" onClick={() => setOpen(true)}>
          <Plus className="size-4" /> Novo sistema
        </Button>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader title="Novo sistema" description="Só administradores da plataforma veem esta opção." />
      <form ref={formRef} action={action} className="grid gap-4 p-5 sm:grid-cols-2">
        <Field label="Nome" htmlFor="name">
          <Input id="name" name="name" required minLength={2} maxLength={60} placeholder="Ex.: Promoforia" />
        </Field>
        <Field label="Identificador (para links)" htmlFor="slug" hint="Só letras minúsculas, números e hífen.">
          <Input id="slug" name="slug" required pattern="[a-z0-9-]{2,40}" placeholder="promoforia" />
        </Field>
        <Field label="Prefixo do protocolo" htmlFor="protocol_prefix" hint="2 a 5 letras ou números. Ex.: PF gera PF-261126-0001.">
          <Input id="protocol_prefix" name="protocol_prefix" required pattern="[A-Za-z0-9]{2,5}" className="uppercase" placeholder="PF" />
        </Field>
        <Field label="Descrição (opcional)" htmlFor="description">
          <Input id="description" name="description" maxLength={280} />
        </Field>
        <fieldset className="flex flex-col gap-1.5 sm:col-span-2">
          <legend className="text-[13px] font-medium text-muted">Cor</legend>
          <input type="hidden" name="color" value={color} />
          <div className="flex gap-2">
            {SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={`Cor ${c}`}
                aria-pressed={color === c}
                className="size-8 rounded-lg ring-offset-2 ring-offset-surface aria-pressed:ring-2 aria-pressed:ring-fg"
                style={{ background: c }}
              />
            ))}
          </div>
        </fieldset>
        {state.error && <p className="text-sm text-danger sm:col-span-2">{state.error}</p>}
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button type="submit" loading={pending}>
            Criar sistema
          </Button>
        </div>
      </form>
    </Card>
  );
}
