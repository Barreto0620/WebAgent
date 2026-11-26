export class ProviderError extends Error {}

export async function requestJson<T>(url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(init.timeoutMs ?? 30_000) });
  const text = await res.text();
  let json: any;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text.slice(0, 300) };
  }
  if (!res.ok || json?.error?.message || (json?.error?.code && json.error.code !== "ok")) {
    const msg = json?.error?.message ?? json?.error_description ?? json?.error?.code ?? `${res.status} ${res.statusText}`;
    throw new ProviderError(String(msg).slice(0, 400));
  }
  return json as T;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
