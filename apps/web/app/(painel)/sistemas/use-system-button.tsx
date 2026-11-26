"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setActiveSystem } from "@/app/actions/system";
import { Button } from "@/components/ui/button";

export function UseSystemButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button
      size="sm"
      variant="secondary"
      loading={pending}
      onClick={() =>
        start(async () => {
          await setActiveSystem(id);
          toast.success("Sistema trocado.");
          router.push("/dashboard");
        })
      }
    >
      Usar este sistema
    </Button>
  );
}
