import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Equipe" };

export default function Page() {
  return (
    <ComingSoon title="Equipe" stage="Etapa 2" items={["Convidar pessoas por e-mail", "Papéis: administrador, supervisor e atendente", "Acesso por sistema"]}>
      Esta aba faz parte do plano do WebAgent e entra na etapa indicada acima.
    </ComingSoon>
  );
}
