import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Toaster } from "sonner";
import { CookieBanner } from "@/components/cookie-banner";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "WebAgent", template: "%s · WebAgent" },
  description: "Central de atendimento e mensageria da WebCash Company.",
  applicationName: "WebAgent",
  robots: { index: false, follow: false },
  icons: { icon: "/favicon.ico", apple: "/apple-touch-icon.png" },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0d0b" },
    { media: "(prefers-color-scheme: light)", color: "#f5f7f5" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const store = await cookies();
  const theme = store.get("wa_theme")?.value === "light" ? "light" : "dark";
  const hasConsent = Boolean(store.get("wa_consent")?.value);
  return (
    <html lang="pt-BR" data-theme={theme} suppressHydrationWarning>
      <body className="min-h-dvh">
        {children}
        <Toaster position="top-center" theme={theme} richColors closeButton />
        {!hasConsent && <CookieBanner />}
      </body>
    </html>
  );
}
