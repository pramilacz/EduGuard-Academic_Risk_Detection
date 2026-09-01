import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { cn } from "@/lib/utils";

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("rounded-[18px] border border-border bg-card shadow-card", className)}>
      {children}
    </div>
  );
}

export function CardHead({
  title,
  hint,
  right,
}: {
  title: string;
  hint?: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pt-5">
      <div>
        <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>
        {hint && <p className="mt-0.5 text-[12px] text-muted-foreground">{hint}</p>}
      </div>
      {right}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  sub,
  delta,
  icon,
  tone = "brand",
}: {
  label: string;
  value: string;
  sub?: string;
  delta?: { value: string; positive: boolean };
  icon: ReactNode;
  tone?: "brand" | "danger" | "success" | "warning";
}) {
  const tones = {
    brand: "bg-brand-soft text-primary",
    danger: "bg-destructive/12 text-destructive",
    success: "bg-success/14 text-success",
    warning: "bg-warning/16 text-warning",
  } as const;

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
        <span className={cn("flex size-8 items-center justify-center rounded-[10px]", tones[tone])}>
          {icon}
        </span>
      </div>
      <div className="mt-3 flex items-end gap-2">
        <p className="text-[30px] font-bold leading-none tracking-tight text-foreground">{value}</p>
        {delta && (
          <span
            className={cn(
              "mb-0.5 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold",
              delta.positive ? "bg-success/14 text-success" : "bg-destructive/12 text-destructive",
            )}
          >
            {delta.positive ? (
              <ArrowUpRight className="size-3" />
            ) : (
              <ArrowDownRight className="size-3" />
            )}
            {delta.value}
          </span>
        )}
      </div>
      {sub && <p className="mt-2.5 text-[11.5px] text-muted-foreground">{sub}</p>}
    </Card>
  );
}

export function RiskBadge({ level }: { level: string }) {
  const high = level === "High Risk";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold",
        high ? "bg-destructive/12 text-destructive" : "bg-success/14 text-success",
      )}
    >
      <span className={cn("size-1.5 rounded-full", high ? "bg-destructive" : "bg-success")} />
      {level}
    </span>
  );
}

export function Disclaimer({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-[14px] border border-border bg-secondary/60 px-4 py-3 text-[12px] leading-relaxed text-muted-foreground">
      {children}
    </p>
  );
}
