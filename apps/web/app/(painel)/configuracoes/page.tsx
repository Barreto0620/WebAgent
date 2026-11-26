import type { Metadata } from "next";
import { getSession } from "@/lib/session";
import { PageHeader } from "@/components/ui/page-header";
import { ProfileForm, PasswordForm } from "./forms";

export const metadata: Metadata = { title: "Configurações" };

export default async function ConfiguracoesPage() {
  const { user, profile } = await getSession();
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader title="Configurações" description="Seus dados de acesso ao WebAgent." />
      <ProfileForm name={profile?.full_name ?? ""} email={user.email ?? ""} />
      <PasswordForm />
    </div>
  );
}
