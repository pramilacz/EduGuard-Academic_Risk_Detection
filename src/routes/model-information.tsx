import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarRange,
  CheckCircle2,
  Cpu,
  LoaderCircle,
  Target,
} from "lucide-react";
import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import { Shell } from "@/components/eduguard/Shell";
import { Card, CardHead, Disclaimer } from "@/components/eduguard/primitives";
import { getModelInfo } from "@/lib/eduguard/api";

export const Route = createFileRoute("/model-information")({
  head: () => ({
    meta: [
      { title: "Model Information — EduGuard" },
      {
        name: "description",
        content:
          "Final XGBoost model details: first eight weeks prediction window, target definition and evaluation metrics including ROC-AUC and PR-AUC.",
      },
      { property: "og:title", content: "Model Information — EduGuard" },
      {
        property: "og:description",
        content: "XGBoost model configuration and evaluation metrics for EduGuard.",
      },
    ],
  }),
  component: ModelInformation,
});

function ModelInformation() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["model-info"],
    queryFn: getModelInfo,
  });

  if (isLoading) {
    return (
      <Shell title="Model Information">
        <Card className="p-8 text-center">
          <LoaderCircle className="mx-auto size-5 animate-spin text-primary" />
          <p className="mt-3 text-[13px] font-semibold text-foreground">Loading model details…</p>
        </Card>
      </Shell>
    );
  }

  if (isError || !data) {
    return (
      <Shell title="Model Information">
        <Card className="p-8 text-center">
          <AlertTriangle className="mx-auto size-5 text-destructive" />
          <p className="mt-3 text-[13px] font-semibold text-foreground">
            Unable to load model information
          </p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            {error instanceof Error ? error.message : "Check that the backend is running."}
          </p>
        </Card>
      </Shell>
    );
  }

  const metrics = [
    { name: "Accuracy", value: data.metrics.accuracy * 100 },
    { name: "Precision", value: data.metrics.precision * 100 },
    { name: "Recall", value: data.metrics.recall * 100 },
    { name: "F1-score", value: data.metrics.f1_score * 100 },
    { name: "ROC-AUC", value: data.metrics.roc_auc * 100 },
    { name: "PR-AUC", value: data.metrics.pr_auc * 100 },
  ];

  return (
    <Shell title="Model Information">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <span className="flex size-9 items-center justify-center rounded-[10px] bg-brand-soft text-primary">
            <Cpu className="size-4" />
          </span>
          <p className="mt-3 text-[12px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
            Final Model
          </p>
          <p className="mt-1 text-[22px] font-bold tracking-tight text-foreground">
            {data.model_name}
          </p>
          <p className="mt-1.5 text-[12.5px] text-muted-foreground">
            {data.number_of_features} model features processed through the saved production
            pipeline.
          </p>
        </Card>

        <Card className="p-5">
          <span className="flex size-9 items-center justify-center rounded-[10px] bg-brand-soft text-primary">
            <CalendarRange className="size-4" />
          </span>
          <p className="mt-3 text-[12px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
            Prediction Window
          </p>
          <p className="mt-1 text-[22px] font-bold tracking-tight text-foreground">First 8 Weeks</p>
          <p className="mt-1.5 text-[12.5px] text-muted-foreground">{data.prediction_window}</p>
        </Card>

        <Card className="p-5">
          <span className="flex size-9 items-center justify-center rounded-[10px] bg-brand-soft text-primary">
            <Target className="size-4" />
          </span>
          <p className="mt-3 text-[12px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
            Target
          </p>
          <p className="mt-2 text-[13px] font-semibold text-success">
            Lower Risk = Pass or Distinction
          </p>
          <p className="mt-1 text-[13px] font-semibold text-destructive">
            High Risk = Fail or Withdrawn
          </p>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHead title="Evaluation Metrics" hint="Held-out test set performance" />
          <div className="grid grid-cols-2 gap-4 px-5 py-5 sm:grid-cols-3">
            {metrics.map((metric) => (
              <div
                key={metric.name}
                className="rounded-[14px] border border-border bg-secondary/50 px-4 py-3.5"
              >
                <p className="text-[11.5px] font-medium text-muted-foreground">{metric.name}</p>
                <p className="mt-1 text-[22px] font-bold tracking-tight text-foreground">
                  {metric.value.toFixed(2)}%
                </p>
                <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${metric.value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHead title="Metric Profile" hint="Balance across evaluation measures" />
          <div className="h-[320px] px-2 pb-4 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={metrics} outerRadius="72%">
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
                <Radar
                  dataKey="value"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  fill="var(--chart-1)"
                  fillOpacity={0.22}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHead title="Confusion Matrix" hint="Held-out test set counts" />
          <div className="grid grid-cols-2 gap-3 p-5">
            <MatrixCell label="True Negative" value={data.confusion_matrix.true_negative} />
            <MatrixCell label="False Positive" value={data.confusion_matrix.false_positive} />
            <MatrixCell label="False Negative" value={data.confusion_matrix.false_negative} />
            <MatrixCell label="True Positive" value={data.confusion_matrix.true_positive} />
          </div>
        </Card>

        <Card>
          <CardHead title="Known Limitations" hint="Important context for responsible use" />
          <div className="space-y-3 px-5 py-5">
            {data.limitations.map((limitation) => (
              <div key={limitation} className="flex items-start gap-2.5">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                <p className="text-[12.5px] leading-relaxed text-muted-foreground">{limitation}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-4">
        <Disclaimer>{data.decision_support_notice}</Disclaimer>
      </div>
    </Shell>
  );
}

function MatrixCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[14px] border border-border bg-secondary/50 px-4 py-3.5">
      <p className="text-[11.5px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-[22px] font-bold tracking-tight text-foreground">
        {value.toLocaleString()}
      </p>
    </div>
  );
}
