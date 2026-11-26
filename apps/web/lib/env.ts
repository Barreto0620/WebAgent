export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
/** Endereço interno da API (rede Docker). Nunca exposto ao navegador. */
export const API_URL = process.env.API_URL ?? "http://webagent-api:3001";
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
