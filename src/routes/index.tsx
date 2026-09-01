import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useRef } from "react";
import {
  Activity,
  AlertTriangle,
  Download,
  Gauge,
  LoaderCircle,
  Percent,
  Server,
  ShieldCheck,
  Upload,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Shell } from "@/components/eduguard/Shell";
import { Card, CardHead, MetricCard, RiskBadge } from "@/components/eduguard/primitives";
import { getHealth, getPredictions, summarise, toCSV, uploadStudentCSV } from "@/lib/eduguard/api";
import { downloadCSV } from "@/lib/eduguard/download";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Overview — EduGuard Academic Risk Analytics" },
      {
        name: "description",
        content:
          "Cohort-level early academic risk overview: risk distribution, weekly engagement and top high-risk students from the first eight weeks of study.",
      },
      { property: "og:title", content: "Overview — EduGuard Academic Risk Analytics" },
      {
        property: "og:description",
        content: "Early academic risk detection and learning analytics dashboard.",
      },
    ],
  }),
  component: Overview,
});

const axis = {
  tick: { fontSize: 11, fill: "var(--muted-foreground)" },
  stroke: "var(--border)",
};

function chartTooltip() {
  return {
    contentStyle: {
      background: "var(--popover)",
      border: "1px solid var(--border)",
      borderRadius: 12,
      fontSize: 12,
      color: "var(--popover-foreground)",
    },
    labelStyle: { color: "var(--muted-foreground)", fontSize: 11 },
  };
}

function Overview() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    data = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({ queryKey: ["predictions"], queryFn: getPredictions });
  const { data: health } = useQuery({
    queryKey: ["health"],
    queryFn: getHealth,
    retry: 1,
    refetchInterval: 30_000,
  });
  const upload = useMutation({
    mutationFn: uploadStudentCSV,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["predictions"] }),
        queryClient.invalidateQueries({ queryKey: ["explanation"] }),
      ]);
    },
  });
  const s = summarise(data);
  const top = data
    .filter((student) => student.riskLevel === "High Risk")
    .sort((a, b) => b.riskProbability - a.riskProbability)
    .slice(0, 6);
  const split = [
    { name: "High Risk", value: s.highRisk },
    { name: "Lower Risk", value: s.lowerRisk },
  ];
  const cohortModule = data[0]?.codeModule;
  const cohortPresentation = data[0]?.codePresentation;
  const cohortLabel =
    cohortModule && cohortPresentation
      ? `${cohortModule} · ${cohortPresentation} · Weeks 1–8`
      : "Current cohort · Weeks 1–8";

  const selectUpload = () => fileInputRef.current?.click();

  const handleFile = (file: File | undefined) => {
    if (!file) {
      return;
    }

    upload.mutate(file);
  };

  return (
    <Shell
      title="Overview"
      actions={
        <>
          <span className="hidden items-center rounded-full border border-border bg-card px-3.5 py-2 text-[12.5px] font-medium text-muted-foreground sm:inline-flex">
            {cohortLabel}
          </span>
          <span
            className={[
              "hidden items-center gap-1.5 rounded-full border px-3.5 py-2 text-[12px] font-semibold md:inline-flex",
              health?.status === "ok"
                ? "border-success/30 bg-success/10 text-success"
                : "border-border bg-card text-muted-foreground",
            ].join(" ")}
          >
            <Server className="size-3.5" />
            {health?.status === "ok" ? "Model API ready" : "Checking API"}
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => {
              handleFile(event.target.files?.[0]);
              event.currentTarget.value = "";
            }}
          />
          <button
            onClick={selectUpload}
            disabled={upload.isPending}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-[12.5px] font-semibold text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
          >
            {upload.isPending ? (
              <LoaderCircle className="size-3.5 animate-spin" />
            ) : (
              <Upload className="size-3.5" />
            )}
            {upload.isPending ? "Scoring…" : "Upload Cohort"}
          </button>
          <button
            onClick={() => downloadCSV("eduguard-cohort.csv", toCSV(data))}
            disabled={!data.length}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-[12.5px] font-semibold text-primary-foreground shadow-soft transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="size-3.5" /> Export
          </button>
        </>
      }
    >
      {upload.isSuccess && (
        <div className="mb-4 rounded-[14px] border border-success/25 bg-success/10 px-4 py-3 text-[12.5px] text-success">
          {upload.data.message} The dashboard has been refreshed with the persisted results.
        </div>
      )}

      {upload.isError && (
        <div className="mb-4 rounded-[14px] border border-destructive/25 bg-destructive/10 px-4 py-3 text-[12.5px] text-destructive">
          Upload failed: {upload.error.message}
        </div>
      )}

      {isLoading && (
        <Card className="p-8 text-center">
          <LoaderCircle className="mx-auto size-5 animate-spin text-primary" />
          <p className="mt-3 text-[13px] font-semibold text-foreground">Loading saved cohort…</p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Reading the latest persisted EduGuard predictions.
          </p>
        </Card>
      )}

      {isError && !isLoading && (
        <Card className="p-8 text-center">
          <AlertTriangle className="mx-auto size-5 text-destructive" />
          <p className="mt-3 text-[13px] font-semibold text-foreground">
            EduGuard could not load the prediction service.
          </p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            {error instanceof Error ? error.message : "Check that the FastAPI backend is running."}
          </p>
          <button
            onClick={() => void refetch()}
            className="mt-4 rounded-full bg-primary px-4 py-2 text-[12px] font-semibold text-primary-foreground"
          >
            Try again
          </button>
        </Card>
      )}

      {!isLoading && !isError && data.length === 0 && (
        <Card className="p-8 text-center">
          <Upload className="mx-auto size-5 text-primary" />
          <p className="mt-3 text-[13px] font-semibold text-foreground">No cohort loaded yet</p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Upload the final 45-feature CSV to score students with XGBoost and save the latest
            cohort.
          </p>
          <button
            onClick={selectUpload}
            className="mt-4 rounded-full bg-primary px-4 py-2 text-[12px] font-semibold text-primary-foreground"
          >
            Upload CSV
          </button>
        </Card>
      )}

      {!isLoading && !isError && data.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <MetricCard
              label="Total Students"
              value={s.totalStudents.toLocaleString()}
              sub="Scored in current window"
              icon={<Users className="size-4" />}
            />
            <MetricCard
              label="High-Risk Students"
              value={s.highRisk.toLocaleString()}
              sub="Probability ≥ 0.50"
              tone="danger"
              delta={{ value: "flagged", positive: false }}
              icon={<AlertTriangle className="size-4" />}
            />
            <MetricCard
              label="Lower-Risk Students"
              value={s.lowerRisk.toLocaleString()}
              sub="Pass or Distinction expected"
              tone="success"
              icon={<ShieldCheck className="size-4" />}
            />
            <MetricCard
              label="High-Risk Percentage"
              value={`${s.highRiskPercentage.toFixed(1)}%`}
              sub="Share of scored cohort"
              tone="warning"
              icon={<Percent className="size-4" />}
            />
            <MetricCard
              label="Avg Risk Probability"
              value={`${(s.averageRiskProbability * 100).toFixed(1)}%`}
              sub="Mean XGBoost output"
              icon={<Gauge className="size-4" />}
            />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHead
                title="Risk Probability Distribution"
                hint="Predicted probability of Fail / Withdrawn across the cohort"
              />
              <div className="h-[268px] px-2 pb-4 pt-5">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={s.distribution}>
                    <defs>
                      <linearGradient id="riskFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.28} />
                        <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="4 4" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="bucket" {...axis} tickLine={false} />
                    <YAxis {...axis} tickLine={false} axisLine={false} width={34} />
                    <Tooltip {...chartTooltip()} />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="var(--chart-1)"
                      strokeWidth={2.4}
                      fill="url(#riskFill)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card>
              <CardHead title="High Risk vs Lower Risk" hint="Cohort composition" />
              <div className="h-[268px] px-2 pb-4 pt-5">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={split} barSize={54}>
                    <CartesianGrid strokeDasharray="4 4" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="name" {...axis} tickLine={false} />
                    <YAxis {...axis} tickLine={false} axisLine={false} width={34} />
                    <Tooltip {...chartTooltip()} cursor={{ fill: "var(--secondary)" }} />
                    <Bar dataKey="value" radius={[8, 8, 4, 4]}>
                      {split.map((d) => (
                        <Cell
                          key={d.name}
                          fill={d.name === "High Risk" ? "var(--chart-4)" : "var(--chart-2)"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHead
                title="Top High-Risk Students"
                hint="Ranked by predicted risk probability"
                right={
                  <Link
                    to="/risk-list"
                    className="rounded-full border border-border px-3 py-1.5 text-[11.5px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
                  >
                    View all
                  </Link>
                }
              />
              <div className="mt-4 overflow-x-auto px-2 pb-2">
                <table className="w-full min-w-[560px] text-left">
                  <thead>
                    <tr className="text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground">
                      <th className="px-3 pb-2 font-semibold">Student</th>
                      <th className="px-3 pb-2 font-semibold">Risk</th>
                      <th className="px-3 pb-2 text-right font-semibold">Probability</th>
                      <th className="px-3 pb-2 text-right font-semibold">Completion</th>
                      <th className="px-3 pb-2 text-right font-semibold">Mean score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {top.map((r) => (
                      <tr key={r.studentId} className="border-t border-border/70">
                        <td className="px-3 py-3 text-[13px] font-semibold text-foreground">
                          {r.studentId}
                        </td>
                        <td className="px-3 py-3">
                          <RiskBadge level={r.riskLevel} />
                        </td>
                        <td className="px-3 py-3 text-right text-[13px] font-semibold text-destructive">
                          {(r.riskProbability * 100).toFixed(1)}%
                        </td>
                        <td className="px-3 py-3 text-right text-[13px] text-muted-foreground">
                          {Math.round(r.assessmentCompletionRate * 100)}%
                        </td>
                        <td className="px-3 py-3 text-right text-[13px] text-muted-foreground">
                          {r.meanAssessmentScore.toFixed(1)}
                        </td>
                      </tr>
                    ))}
                    {top.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="border-t border-border/70 px-3 py-8 text-center text-[12.5px] text-muted-foreground"
                        >
                          No students are currently classified as High Risk.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card>
              <CardHead
                title="Weekly Engagement"
                hint="Average VLE interactions, weeks 1–8"
                right={
                  <span className="flex size-8 items-center justify-center rounded-[10px] bg-brand-soft text-primary">
                    <Activity className="size-4" />
                  </span>
                }
              />
              <div className="h-[220px] px-2 pt-5">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={s.weeklyEngagement}>
                    <CartesianGrid strokeDasharray="4 4" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="week" {...axis} tickLine={false} />
                    <YAxis {...axis} tickLine={false} axisLine={false} width={34} />
                    <Tooltip {...chartTooltip()} />
                    <Line
                      type="monotone"
                      dataKey="lowerRisk"
                      stroke="var(--chart-2)"
                      strokeWidth={2.2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="highRisk"
                      stroke="var(--chart-4)"
                      strokeWidth={2.2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center gap-4 px-5 pb-5 pt-3 text-[11.5px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-chart-2" /> Lower risk
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-chart-4" /> High risk
                </span>
              </div>
            </Card>
          </div>
        </>
      )}
    </Shell>
  );
}
