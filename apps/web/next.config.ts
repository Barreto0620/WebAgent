import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const config: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  transpilePackages: ["@webagent/shared"],
  serverExternalPackages: ["exceljs"],
  experimental: {
    // Planilhas de leads são enviadas por server action
    serverActions: { bodySizeLimit: "15mb" },
    // Voltar a uma aba visitada há pouco abre na hora (dados recarregam em segundo plano ao salvar algo)
    staleTimes: { dynamic: 30, static: 180 },
  },
  outputFileTracingRoot: new URL("../../", import.meta.url).pathname,
  images: { remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }, { protocol: "https", hostname: "pps.whatsapp.net" }] },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default config;
