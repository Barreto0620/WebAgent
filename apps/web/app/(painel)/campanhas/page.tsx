import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Campanhas" };

export default function Page() {
  return (
    <ComingSoon title="Campanhas" stage="Etapa 2" items={["Envio para listas segmentadas, só para quem aceitou receber (opt-in)", "Intervalo aleatório entre envios para proteger o número", "Relatório de entregues, lidas e respostas"]}>
      Esta aba faz parte do plano do WebAgent e entra na etapa indicada acima.
    </ComingSoon>
  );
}
