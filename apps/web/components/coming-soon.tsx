import { Sparkles } from "lucide-react";
import { PageHeader } from "./ui/page-header";
import { Card } from "./ui/card";

export function ComingSoon({ title, stage, children, items }: { title: string; stage: string; children: React.ReactNode; items: string[] }) {
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageHeader eyebrow={stage} title={title} />
      <Card className="p-6">
        <div className="flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-gold/15 text-gold">
            <Sparkles className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-sm text-muted">{children}</p>
            <ul className="mt-4 flex flex-col gap-2 text-sm">
              {items.map((i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" /> {i}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}
