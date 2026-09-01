import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import {
  AlertTriangle,
  CalendarClock,
  ClipboardCheck,
  GaugeCircle,
  LoaderCircle,
  Search,
  Timer,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Shell } from "@/components/eduguard/Shell";
import { Card, CardHead, Disclaimer, RiskBadge } from "@/components/eduguard/primitives";
import { getPredictions } from "@/lib/eduguard/api";

const searchSchema = z.object({ student: z.string().optional() });

export const Route = createFileRoute("/student-profile")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Student Profile — EduGuard" },
      {
        name: "description",
        content:
          "Individual student view: predicted risk level, probability indicator, assessment and engagement metrics plus week 1–8 learning activity.",
      },
      { property: "og:title", content: "Student Profile — EduGuard" },
      {
        property: "og:description",
        content: "Per-student academic risk indicators and engagement timeline.",
      },
    ],
  }),
  component: Profile,
});

function Profile() {
  const { student } = Route.useSearch();
  const {
    data = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["predictions"],
    queryFn: getPredictions,
  });
  const [query, setQuery] = useState(student ?? "");
  const normalizedQuery = query.trim().toLowerCase();
  const selected = normalizedQuery
    ? data.find((s) => s.studentId.toLowerCase() === normalizedQuery)
    : data[0];

  if (isLoading) {
    return (
      <Shell title="Student Profile">
        <Card className="p-8 text-center">
          <LoaderCircle className="mx-auto size-5 animate-spin text-primary" />
          <p className="mt-3 text-[13px] font-semibold text-foreground">Loading student data…</p>
        </Card>
      </Shell>
    );
  }

  if (isError) {
    return (
      <Shell title="Student Profile">
        <Card className="p-8 text-center">
          <AlertTriangle className="mx-auto size-5 text-destructive" />
          <p className="mt-3 text-[13px] font-semibold text-foreground">
            Unable to load student data
          </p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            {error instanceof Error ? error.message : "Check that the backend is running."}
          </p>
        </Card>
      </Shell>
    );
  }

  if (!selected) {
    return (
      <Shell
        title="Student Profile"
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
      </Shell>
    );
  }

  const high = selected.riskLevel === "High Risk";
  const weekly = selected.weeklyActivity.map((v, i) => ({ week: `Week ${i + 1}`, clicks: v }));

  return (
    <Shell
      title="Student Profile"
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
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
                Student ID
              </p>
              <p className="mt-1 text-[28px] font-bold tracking-tight text-foreground">
                {selected.studentId}
              </p>
              <div className="mt-3">
                <RiskBadge level={selected.riskLevel} />
              </div>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
                Risk Probability
              </p>
              <p
                className={[
                  "mt-1 text-[34px] font-bold leading-none tracking-tight",
                  high ? "text-destructive" : "text-success",
                ].join(" ")}
              >
                {(selected.riskProbability * 100).toFixed(1)}%
              </p>
            </div>
          </div>

          <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-secondary">
            <div
              className={
                high ? "h-full rounded-full bg-destructive" : "h-full rounded-full bg-success"
              }
              style={{ width: `${selected.riskProbability * 100}%` }}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
            <span>0.00 lower risk</span>
            <span>threshold 0.50</span>
            <span>1.00 high risk</span>
          </div>

          <div className="mt-5 rounded-[14px] border border-border bg-secondary/50 px-4 py-3.5">
            <p className="text-[12.5px] font-semibold text-foreground">Academic review message</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
              {high
                ? "Engagement and assessment signals in the first eight weeks fall below cohort norms. A tutor conversation and a check on assessment support is recommended before week 10."
                : "Engagement and assessment signals in the first eight weeks are consistent with students who go on to pass. Continue routine monitoring."}
            </p>
          </div>
        </Card>

        <Card className="p-5">
          <p className="text-[15px] font-semibold text-foreground">Assessment metrics</p>
          <div className="mt-4 space-y-3.5">
            <Metric
              icon={<ClipboardCheck className="size-4" />}
              label="Assessment completion rate"
              value={`${Math.round(selected.assessmentCompletionRate * 100)}%`}
            />
            <Metric
              icon={<GaugeCircle className="size-4" />}
              label="Mean assessment score"
              value={selected.meanAssessmentScore.toFixed(1)}
            />
            <Metric
              icon={<Timer className="size-4" />}
              label="Late submissions"
              value={`${selected.lateSubmissions}`}
            />
          </div>

          <p className="mt-6 text-[15px] font-semibold text-foreground">Engagement metrics</p>
          <div className="mt-4 space-y-3.5">
            <Metric
              icon={<CalendarClock className="size-4" />}
              label="Last activity day"
              value={`Day ${selected.lastActivityDay} / 56`}
            />
            <Metric
              icon={<GaugeCircle className="size-4" />}
              label="Active weeks"
              value={`${selected.activeWeeks} / 8`}
            />
            <Metric
              icon={<ClipboardCheck className="size-4" />}
              label="Studied credits"
              value={`${selected.studiedCredits}`}
            />
          </div>
        </Card>
      </div>

      <div className="mt-4">
        <Card>
          <CardHead
            title="Week 1–8 Learning Activity"
            hint="Virtual learning environment interactions per week"
          />
          <div className="h-[280px] px-2 pb-4 pt-5">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekly} barSize={34}>
                <CartesianGrid strokeDasharray="4 4" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="week"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  stroke="var(--border)"
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                  width={34}
                />
                <Tooltip
                  cursor={{ fill: "var(--secondary)" }}
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
                <Bar
                  dataKey="clicks"
                  radius={[8, 8, 4, 4]}
                  fill={high ? "var(--chart-4)" : "var(--chart-1)"}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="mt-4">
        <Disclaimer>
          This system supports academic judgement and should not be used as the sole basis for
          decisions about students.
        </Disclaimer>
      </div>
    </Shell>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-9 items-center justify-center rounded-[10px] bg-brand-soft text-primary">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] text-muted-foreground">{label}</p>
      </div>
      <p className="text-[14px] font-semibold text-foreground">{value}</p>
    </div>
  );
}
