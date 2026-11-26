import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Relatórios" };

export default function Page() {
  return (
    <ComingSoon title="Relatórios" stage="Etapa 2" items={["Tempo de primeira resposta e de resolução (SLA)", "Desempenho por atendente", "Pesquisa de satisfação (nota de 1 a 5) e exportação"]}>
      Esta aba faz parte do plano do WebAgent e entra na etapa indicada acima.
    </ComingSoon>
  );
}
