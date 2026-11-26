/**
 * Substitui variáveis em mensagens automáticas.
 * Variáveis: {{nome}}, {{primeiro_nome}}, {{protocolo}}, {{sistema}}, {{horario}}
 */
export function renderTemplate(template: string, vars: Record<string, string | undefined>): string {
  return template.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_, key: string) => vars[key.toLowerCase()] ?? "");
}

export function firstName(name?: string | null): string {
  return (name ?? "").trim().split(/\s+/)[0] ?? "";
}
