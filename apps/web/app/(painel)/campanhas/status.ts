export const CAMPAIGN_STATUS = {
  draft: { label: "Rascunho", tone: "neutral" as const },
  scheduled: { label: "Agendada", tone: "info" as const },
  running: { label: "Enviando", tone: "success" as const },
  paused: { label: "Pausada", tone: "warning" as const },
  completed: { label: "Concluída", tone: "success" as const },
  canceled: { label: "Cancelada", tone: "neutral" as const },
};
