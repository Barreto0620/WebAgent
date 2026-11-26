import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Privacidade (LGPD)" };

export default function Page() {
  return (
    <ComingSoon title="Privacidade (LGPD)" stage="Etapa 2" items={["Pedidos do titular com prazo de 15 dias (art. 19)", "Histórico de consentimentos e trilha de auditoria", "Prazo de retenção e exclusão automática"]}>
      Esta aba faz parte do plano do WebAgent e entra na etapa indicada acima.
    </ComingSoon>
  );
}
