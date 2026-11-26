import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { canManage, getSession } from "@/lib/session";
import { apiFetch } from "@/lib/api";
import { PageHeader } from "@/components/ui/page-header";
import type { TeamRow } from "@/app/actions/team";
import { TeamManager } from "./team-manager";

export const metadata: Metadata = { title: "Equipe" };

export default async function EquipePage() {
  const { active, role, user } = await getSession();
  if (!active) redirect("/sistemas");
  if (!canManage(role, "admin")) redirect("/dashboard");

  let rows: TeamRow[] = [];
  let error: string | null = null;
  try {
    rows = await apiFetch<TeamRow[]>(`/team?systemId=${active.id}`);
  } catch (e) {
    error = e instanceof Error ? e.message : "Não foi possível carregar a equipe.";
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={active.name}
        title="Equipe"
        description="Quem acessa este sistema e com qual papel. Cada pessoa só vê os sistemas em que foi incluída."
      />
      {error ? <p className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p> : <TeamManager rows={rows} meId={user.id} systemName={active.name} />}
    </div>
  );
}
