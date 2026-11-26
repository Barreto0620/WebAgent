"use client";
import { useState } from "react";
import Link from "next/link";
import { Cookie } from "lucide-react";
import { COOKIE_CONSENT_VERSION } from "@webagent/shared";
import { Button } from "./ui/button";
import { Switch } from "./ui/switch";
import { saveCookieConsent } from "@/app/actions/consent";

/**
 * Aviso de cookies e cache (LGPD). O WebAgent não usa cookies de publicidade nem de análise
 * de terceiros: só os necessários (sessão, sistema ativo) e, se a pessoa permitir, os de preferência.
 */
export function CookieBanner() {
  const [open, setOpen] = useState(true);
  const [custom, setCustom] = useState(false);
  const [prefs, setPrefs] = useState(true);
  const [saving, setSaving] = useState(false);

  async function save(preferences: boolean) {
    setSaving(true);
    try {
      await saveCookieConsent({ preferences, version: COOKIE_CONSENT_VERSION });
    } finally {
      setOpen(false);
      setSaving(false);
    }
  }

  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-labelledby="cookie-title"
      className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:px-6"
    >
      <div className="mx-auto max-w-3xl rounded-2xl border border-line bg-surface p-4 shadow-2xl shadow-black/40 sm:p-5">
        <div className="flex gap-3">
          <div className="hidden size-10 shrink-0 place-items-center rounded-full bg-primary/15 text-primary sm:grid">
            <Cookie className="size-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="cookie-title" className="text-[15px] font-bold">
              Cookies e cache neste painel
            </h2>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">
              Usamos cookies necessários para manter sua sessão e lembrar o sistema ativo, e cache local do navegador para
              carregar o painel mais rápido. Não usamos cookies de publicidade. Saiba mais na{" "}
              <Link href="/privacidade" className="font-medium text-primary underline-offset-2 hover:underline">
                Política de Privacidade
              </Link>
              .
            </p>

            {custom && (
              <div className="mt-3 flex flex-col gap-2 rounded-xl border border-line bg-bg p-3 text-[13px]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">Necessários</p>
                    <p className="text-muted">Sessão, segurança e sistema ativo. Sempre ativos.</p>
                  </div>
                  <Switch id="ck-necessary" label="Cookies necessários" checked disabled />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">Preferências</p>
                    <p className="text-muted">Lembrar tema claro ou escuro neste aparelho.</p>
                  </div>
                  <Switch id="ck-prefs" label="Cookies de preferência" checked={prefs} onChange={setPrefs} />
                </div>
              </div>
            )}

            <div className="mt-3 flex flex-wrap justify-end gap-2">
              {custom ? (
                <Button size="sm" onClick={() => save(prefs)} loading={saving}>
                  Salvar escolhas
                </Button>
              ) : (
                <>
                  <Button size="sm" variant="secondary" onClick={() => setCustom(true)}>
                    Personalizar
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => save(false)} loading={saving}>
                    Só necessários
                  </Button>
                  <Button size="sm" onClick={() => save(true)} loading={saving}>
                    Aceitar
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
