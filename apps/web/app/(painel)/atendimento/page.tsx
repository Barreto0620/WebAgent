import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Atendimento" };

export default function Page() {
  return (
    <ComingSoon title="Atendimento" stage="Etapa 1 · próxima entrega" items={[
      "Caixa de entrada em tempo real com fila, em atendimento e resolvidas",
      "Assumir, transferir e resolver conversas; protocolo visível",
      "Respostas rápidas com “/” e notas internas",
      "Ficha do contato com consentimento LGPD",
    ]}>
      As mensagens já estão sendo recebidas e respondidas automaticamente pelo servidor assim que o WhatsApp é conectado. A tela de conversas é a próxima entrega.
    </ComingSoon>
  );
}
