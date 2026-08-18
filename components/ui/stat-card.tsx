import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";

type StatCardProps = {
  label: string;
  value: string | number;
  hint?: string;
  className?: string;
};

export function StatCard({ label, value, hint, className }: StatCardProps) {
  return (
    <Card className={cn("p-6 md:p-7", className)}>
      <p className="text-sm font-medium uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className="mt-3 text-4xl font-semibold tracking-tight text-foreground">
        {value}
      </p>
      {hint ? <p className="mt-2 text-sm text-muted-dim">{hint}</p> : null}
    </Card>
  );
}
