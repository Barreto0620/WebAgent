import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Publicações" };

export default function Page() {
  return (
    <ComingSoon title="Publicações" stage="Etapa 3" items={["Foto, vídeo, legenda e hashtags para Instagram, Facebook e TikTok", "Calendário com rascunhos e aprovação", "Validação do que cada rede aceita antes de agendar"]}>
      Esta aba faz parte do plano do WebAgent e entra na etapa indicada acima.
    </ComingSoon>
  );
}
