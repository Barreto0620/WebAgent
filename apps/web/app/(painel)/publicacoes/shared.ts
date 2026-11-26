export const POST_STATUS = {
  draft: { label: "Rascunho", tone: "neutral" as const, dot: "bg-muted" },
  scheduled: { label: "Agendada", tone: "info" as const, dot: "bg-sky-500" },
  publishing: { label: "Publicando", tone: "warning" as const, dot: "bg-gold" },
  published: { label: "Publicada", tone: "success" as const, dot: "bg-primary" },
  partial: { label: "Parcial", tone: "warning" as const, dot: "bg-gold" },
  failed: { label: "Falhou", tone: "danger" as const, dot: "bg-danger" },
  canceled: { label: "Cancelada", tone: "neutral" as const, dot: "bg-muted" },
};
export type PostStatus = keyof typeof POST_STATUS;
