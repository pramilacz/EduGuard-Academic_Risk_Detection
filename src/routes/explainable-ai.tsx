import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AlertTriangle, LoaderCircle, Search, TrendingDown, TrendingUp } from "lucide-react";

import { Shell } from "@/components/eduguard/Shell";
import { Card, CardHead, Disclaimer, RiskBadge } from "@/components/eduguard/primitives";
import { getPredictions, getStudentExplanation } from "@/lib/eduguard/api";
import type { ExplanationFactor } from "@/lib/eduguard/types";

export const Route = createFileRoute("/explainable-ai")({
  head: () => ({
    meta: [
      { title: "Explainable AI — EduGuard" },
      {
        name: "description",
        content:
          "Local feature contributions for a single prediction: which factors increased and which reduced the model's predicted academic risk.",
      },
      { property: "og:title", content: "Explainable AI — EduGuard" },
      {
        property: "og:description",
        content: "Per-student feature contributions behind the XGBoost risk prediction.",
      },
    ],
  }),
  component: ExplainableAI,
});

function ExplainableAI() {
  const {
    data = [],
    isLoading: predictionsLoading,
    isError: predictionsError,
    error: predictionsErrorValue,
  } = useQuery({ queryKey: ["predictions"], queryFn: getPredictions });
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const selected = normalizedQuery
    ? data.find((s) => s.studentId.toLowerCase() === normalizedQuery)
    : data[0];
  const {
    data: explanation,
    isLoading: explanationLoading,
    isError: explanationError,
    error: explanationErrorValue,
  } = useQuery({
    queryKey: ["explanation", selected?.studentId],
    queryFn: () => getStudentExplanation(selected!.studentId),
    enabled: !!selected,
  });

  const max = explanation
    ? Math.max(
        ...[...explanation.increasing, ...explanation.reducing].map((f) =>
          Math.abs(f.contribution),
        ),
        0.01,
      )
    : 1;

  return (
    <Shell
      title="Explainable AI"
      actions={
        <label className="relative flex items-center">
          <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter Student ID…"
            className="h-10 w-[220px] rounded-full border border-border bg-card pl-9 pr-3 text-[13px] outline-none placeholder:text-muted-foreground focus:border-ring/60"
          />
        </label>
      }
    >
      {predictionsLoading && (
        <Card className="p-8 text-center">
          <LoaderCircle className="mx-auto size-5 animate-spin text-primary" />
          <p className="mt-3 text-[13px] font-semibold text-foreground">
            Loading explainable predictions…
          </p>
        </Card>
      )}

      {predictionsError && !predictionsLoading && (
        <Card className="p-8 text-center">
          <AlertTriangle className="mx-auto size-5 text-destructive" />
          <p className="mt-3 text-[13px] font-semibold text-foreground">
            Unable to load prediction data
          </p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            {predictionsErrorValue instanceof Error
              ? predictionsErrorValue.message
              : "Check that the backend is running."}
          </p>
        </Card>
      )}

      {!predictionsLoading && !predictionsError && !selected && (
        <Card className="p-8 text-center">
          <Search className="mx-auto size-5 text-primary" />
          <p className="mt-3 text-[13px] font-semibold text-foreground">
            {data.length === 0 ? "No cohort loaded" : `Student ${query.trim()} was not found`}
          </p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            {data.length === 0
              ? "Upload a cohort from the Overview page first."
              : "Enter an exact Student ID from the current cohort."}
          </p>
        </Card>
      )}

      {selected && (
        <Card className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
                  Local explanation for
                </p>
                <p className="mt-1 text-[22px] font-bold tracking-tight text-foreground">
                  {selected.studentId}
                </p>
              </div>
              <RiskBadge level={selected.riskLevel} />
            </div>
            <div className="flex gap-8">
              <Stat
                label="Base risk"
                value={explanation ? `${(explanation.baseValue * 100).toFixed(1)}%` : "—"}
              />
              <Stat
                label="Predicted risk"
                value={`${((explanation?.predicted ?? selected.riskProbability) * 100).toFixed(1)}%`}
                accent={selected.riskLevel === "High Risk" ? "danger" : "success"}
              />
            </div>
          </div>
        </Card>
      )}

      {selected && explanationLoading && (
        <Card className="mt-4 p-8 text-center">
          <LoaderCircle className="mx-auto size-5 animate-spin text-primary" />
          <p className="mt-3 text-[13px] font-semibold text-foreground">
            Generating SHAP explanation…
          </p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            The explanation is being calculated for this exact student prediction.
          </p>
        </Card>
      )}

      {selected && explanationError && !explanationLoading && (
        <Card className="mt-4 p-8 text-center">
          <AlertTriangle className="mx-auto size-5 text-destructive" />
          <p className="mt-3 text-[13px] font-semibold text-foreground">
            Unable to generate this explanation
          </p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            {explanationErrorValue instanceof Error
              ? explanationErrorValue.message
              : "Please try another student or verify the backend."}
          </p>
        </Card>
      )}

      {selected && explanation && !explanationLoading && !explanationError && (
        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Card>
            <CardHead
              title="Factors increasing predicted risk"
              hint="Pushed the prediction towards Fail / Withdrawn"
              right={
                <span className="flex size-8 items-center justify-center rounded-[10px] bg-destructive/12 text-destructive">
                  <TrendingUp className="size-4" />
                </span>
              }
            />
            <div className="space-y-4 px-5 py-5">
              {explanation?.increasing.map((f) => (
                <FactorBar key={f.feature} factor={f} max={max} tone="danger" />
              ))}
              {explanation?.increasing.length === 0 && <Empty />}
            </div>
          </Card>

          <Card>
            <CardHead
              title="Factors reducing predicted risk"
              hint="Pushed the prediction towards Pass / Distinction"
              right={
                <span className="flex size-8 items-center justify-center rounded-[10px] bg-success/14 text-success">
                  <TrendingDown className="size-4" />
                </span>
              }
            />
            <div className="space-y-4 px-5 py-5">
              {explanation?.reducing.map((f) => (
                <FactorBar key={f.feature} factor={f} max={max} tone="success" />
              ))}
              {explanation?.reducing.length === 0 && <Empty />}
            </div>
          </Card>
        </div>
      )}

      {selected && explanation && (
        <div className="mt-4">
          <Disclaimer>
            These factors influenced the model prediction. They do not prove the cause of the
            student&apos;s academic outcome.
          </Disclaimer>
        </div>
      )}
    </Shell>
  );
}

function FactorBar({
  factor,
  max,
  tone,
}: {
  factor: ExplanationFactor;
  max: number;
  tone: "danger" | "success";
}) {
  const width = (Math.abs(factor.contribution) / max) * 100;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[13px] font-medium text-foreground">{factor.feature}</p>
        <p className="text-[12px] text-muted-foreground">
          {factor.value} ·{" "}
          <span
            className={
              tone === "danger" ? "font-semibold text-destructive" : "font-semibold text-success"
            }
          >
            {factor.contribution > 0 ? "+" : ""}
            {factor.contribution.toFixed(3)}
          </span>
        </p>
      </div>
      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-secondary">
        <div
          className={
            tone === "danger"
              ? "h-full rounded-full bg-destructive"
              : "h-full rounded-full bg-success"
          }
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

function Empty() {
  return <p className="text-[12.5px] text-muted-foreground">No contributing factors found.</p>;
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "danger" | "success";
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
        {label}
      </p>
      <p
        className={[
          "mt-1 text-[20px] font-bold tracking-tight",
          accent === "danger"
            ? "text-destructive"
            : accent === "success"
              ? "text-success"
              : "text-foreground",
        ].join(" ")}
      >
        {value}
      </p>
    </div>
  );
}
