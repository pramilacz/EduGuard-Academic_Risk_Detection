import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AlertTriangle, ArrowUpDown, Download, LoaderCircle, Search } from "lucide-react";

import { Shell } from "@/components/eduguard/Shell";
import { Card, CardHead, RiskBadge } from "@/components/eduguard/primitives";
import { getPredictions, toCSV } from "@/lib/eduguard/api";
import { downloadCSV } from "@/lib/eduguard/download";
import type { StudentPrediction } from "@/lib/eduguard/types";

export const Route = createFileRoute("/risk-list")({
  head: () => ({
    meta: [
      { title: "Student Risk List — EduGuard" },
      {
        name: "description",
        content:
          "Search, filter and sort every scored student by risk level, predicted probability, assessment completion and engagement, then export as CSV.",
      },
      { property: "og:title", content: "Student Risk List — EduGuard" },
      {
        property: "og:description",
        content: "Filterable table of predicted academic risk for the full cohort.",
      },
    ],
  }),
  component: RiskList,
});

type SortKey = keyof Pick<
  StudentPrediction,
  | "studentId"
  | "riskProbability"
  | "assessmentCompletionRate"
  | "meanAssessmentScore"
  | "lastActivityDay"
  | "activeWeeks"
>;

const columns: { key: SortKey | "riskLevel"; label: string; align?: "right" }[] = [
  { key: "studentId", label: "Student ID" },
  { key: "riskLevel", label: "Risk Level" },
  { key: "riskProbability", label: "Risk Probability", align: "right" },
  { key: "assessmentCompletionRate", label: "Assessment Completion", align: "right" },
  { key: "meanAssessmentScore", label: "Mean Score", align: "right" },
  { key: "lastActivityDay", label: "Last Activity Day", align: "right" },
  { key: "activeWeeks", label: "Active Weeks", align: "right" },
];

function RiskList() {
  const {
    data = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["predictions"],
    queryFn: getPredictions,
  });
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("all");
  const [minProb, setMinProb] = useState(0);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "riskProbability",
    dir: "desc",
  });

  const rows = useMemo(() => {
    const filtered = data.filter(
      (r) =>
        r.studentId.toLowerCase().includes(query.trim().toLowerCase()) &&
        (level === "all" || r.riskLevel === level) &&
        r.riskProbability >= minProb,
    );
    return filtered.sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      const cmp =
        typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [data, query, level, minProb, sort]);

  return (
    <Shell
      title="Student Risk List"
      actions={
        <button
          onClick={() => downloadCSV("eduguard-risk-list.csv", toCSV(rows))}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-[12.5px] font-semibold text-primary-foreground shadow-soft transition-opacity hover:opacity-90"
        >
          <Download className="size-3.5" /> Download CSV
        </button>
      }
    >
      {isLoading && (
        <Card className="p-8 text-center">
          <LoaderCircle className="mx-auto size-5 animate-spin text-primary" />
          <p className="mt-3 text-[13px] font-semibold text-foreground">Loading risk list…</p>
        </Card>
      )}

      {isError && !isLoading && (
        <Card className="p-8 text-center">
          <AlertTriangle className="mx-auto size-5 text-destructive" />
          <p className="mt-3 text-[13px] font-semibold text-foreground">Unable to load students</p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            {error instanceof Error ? error.message : "Check that the backend is running."}
          </p>
        </Card>
      )}

      {!isLoading && !isError && (
        <Card>
          <CardHead
            title={`${rows.length} students`}
            hint="Filtered from the first eight weeks of activity"
          />
          <div className="flex flex-wrap items-center gap-3 px-5 pt-4">
            <label className="relative flex min-w-[200px] flex-1 items-center">
              <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search Student ID…"
                className="h-10 w-full rounded-full border border-border bg-secondary/60 pl-9 pr-3 text-[13px] outline-none placeholder:text-muted-foreground focus:border-ring/60"
              />
            </label>

            <div className="flex rounded-full border border-border bg-secondary/60 p-1">
              {["all", "High Risk", "Lower Risk"].map((opt) => (
                <button
                  key={opt}
                  onClick={() => setLevel(opt)}
                  className={[
                    "rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-colors",
                    level === opt
                      ? "bg-card text-foreground shadow-card"
                      : "text-muted-foreground hover:text-foreground",
                  ].join(" ")}
                >
                  {opt === "all" ? "All" : opt}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3 rounded-full border border-border bg-secondary/60 px-4 py-2">
              <span className="text-[11.5px] font-medium text-muted-foreground">
                Min probability
              </span>
              <input
                type="range"
                min={0}
                max={0.95}
                step={0.05}
                value={minProb}
                onChange={(e) => setMinProb(Number(e.target.value))}
                className="w-28 accent-[var(--primary)]"
              />
              <span className="w-9 text-[12px] font-semibold text-foreground">
                {Math.round(minProb * 100)}%
              </span>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[880px] text-left">
              <thead>
                <tr className="border-b border-border text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground">
                  {columns.map((c) => (
                    <th
                      key={c.key}
                      className={[
                        "px-5 py-3 font-semibold",
                        c.align === "right" ? "text-right" : "",
                      ].join(" ")}
                    >
                      {c.key === "riskLevel" ? (
                        c.label
                      ) : (
                        <button
                          onClick={() =>
                            setSort((p) =>
                              p.key === c.key
                                ? { key: p.key, dir: p.dir === "asc" ? "desc" : "asc" }
                                : { key: c.key as SortKey, dir: "desc" },
                            )
                          }
                          className={[
                            "inline-flex items-center gap-1 uppercase tracking-[0.08em] transition-colors hover:text-foreground",
                            sort.key === c.key ? "text-foreground" : "",
                          ].join(" ")}
                        >
                          {c.label}
                          <ArrowUpDown className="size-3" />
                        </button>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 60).map((r) => (
                  <tr
                    key={r.studentId}
                    className="border-b border-border/60 transition-colors last:border-0 hover:bg-secondary/50"
                  >
                    <td className="px-5 py-3.5 text-[13px] font-semibold">
                      <Link
                        to="/student-profile"
                        search={{ student: r.studentId }}
                        className="text-foreground hover:text-primary"
                      >
                        {r.studentId}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5">
                      <RiskBadge level={r.riskLevel} />
                    </td>
                    <td className="px-5 py-3.5 text-right text-[13px] font-semibold text-foreground">
                      {(r.riskProbability * 100).toFixed(1)}%
                    </td>
                    <td className="px-5 py-3.5 text-right text-[13px] text-muted-foreground">
                      {Math.round(r.assessmentCompletionRate * 100)}%
                    </td>
                    <td className="px-5 py-3.5 text-right text-[13px] text-muted-foreground">
                      {r.meanAssessmentScore.toFixed(1)}
                    </td>
                    <td className="px-5 py-3.5 text-right text-[13px] text-muted-foreground">
                      Day {r.lastActivityDay}
                    </td>
                    <td className="px-5 py-3.5 text-right text-[13px] text-muted-foreground">
                      {r.activeWeeks}/8
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-5 py-10 text-center text-[12.5px] text-muted-foreground"
                    >
                      {data.length === 0
                        ? "No persisted cohort is available. Upload a cohort from the Overview page."
                        : "No students match the current filters."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="px-5 py-4 text-[11.5px] text-muted-foreground">
            Showing {Math.min(60, rows.length)} of {rows.length} matching students.
          </p>
        </Card>
      )}
    </Shell>
  );
}
