import { Badge } from "@/components/ui/badge";
import type { WorkStatus } from "@/lib/wataseru/types";

const MAP: Record<WorkStatus, { label: string; variant: "muted" | "warn" | "ready" }> = {
  draft: { label: "下書き", variant: "muted" },
  holes: { label: "穴あき", variant: "warn" },
  ready: { label: "言語化済み", variant: "ready" },
};

export function StatusBadge({ status }: { status: WorkStatus }) {
  const m = MAP[status];
  return <Badge variant={m.variant}>{m.label}</Badge>;
}
