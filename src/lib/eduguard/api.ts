import type { CohortSummary, StudentExplanation, StudentPrediction, UploadResult } from "./types";

export const API_BASE_URL =
  (import.meta.env["VITE_EDUGUARD_API_URL"] as string | undefined) ??
  (import.meta.env.PROD
    ? "/api/eduguard"
    : "http://127.0.0.1:8000/api/eduguard");

interface BackendStudent {
  student_id: string;
  code_module?: string | null;
  code_presentation?: string | null;
  risk_level: "High Risk" | "Lower Risk";
  risk_probability: number;
  assessment_completion_rate: number;
  mean_assessment_score: number;
  last_activity_day: number;
  active_weeks: number;
  late_submissions: number;
  studied_credits: number;
  weekly_activity: number[];
}

interface PredictionsResponse {
  status: string;
  total_students: number;
  results: BackendStudent[];
}

interface StudentResponse {
  status: string;
  result: BackendStudent;
}

interface BackendExplanationFactor {
  feature: string;
  label: string;
  value: unknown;
  shap_value: number;
  absolute_importance: number;
}

interface ExplanationResponse {
  status: string;
  student_id: string;
  explanation: {
    prediction: {
      prediction: number;
      risk_label: "High Risk" | "Lower Risk";
      risk_probability: number;
      lower_risk_probability: number;
    };

    baseline_probability: number;

    increasing_risk: BackendExplanationFactor[];
    reducing_risk: BackendExplanationFactor[];
  };
}

export interface HealthStatus {
  status: "ok" | "error";
  service: string;
  version: string;
  model_status: string;
  model: {
    ready: boolean;
    model_file: string;
    feature_file: string;
    number_of_features: number;
    error: string | null;
  };
}

export interface ModelInfo {
  model_name: string;
  system_name: string;
  prediction_window: string;
  target_definition: Record<string, string>;
  number_of_features: number;
  metrics: {
    accuracy: number;
    precision: number;
    recall: number;
    f1_score: number;
    roc_auc: number;
    pr_auc: number;
  };
  confusion_matrix: {
    true_negative: number;
    false_positive: number;
    false_negative: number;
    true_positive: number;
  };
  limitations: string[];
  decision_support_notice: string;
}

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);

  if (!response.ok) {
    let message = `Request failed (${response.status})`;

    try {
      const errorData = await response.json();

      if (errorData.detail) {
        message = errorData.detail;
      }
    } catch {
      // Use default error message
    }

    throw new Error(message);
  }

  return (await response.json()) as T;
}

function mapStudent(student: BackendStudent): StudentPrediction {
  return {
    studentId: String(student.student_id),
    codeModule: student.code_module ?? null,
    codePresentation: student.code_presentation ?? null,
    riskLevel: student.risk_level,
    riskProbability: Number(student.risk_probability),
    assessmentCompletionRate: Number(student.assessment_completion_rate),
    meanAssessmentScore: Number(student.mean_assessment_score),
    lastActivityDay: Number(student.last_activity_day),
    activeWeeks: Number(student.active_weeks),
    lateSubmissions: Number(student.late_submissions),
    studiedCredits: Number(student.studied_credits),
    weeklyActivity: (student.weekly_activity ?? []).map(Number),
  };
}

export async function getHealth(): Promise<HealthStatus> {
  return fetchJSON<HealthStatus>(`${API_BASE_URL}/health`);
}

export async function getModelInfo(): Promise<ModelInfo> {
  return fetchJSON<ModelInfo>(`${API_BASE_URL}/model-info`);
}

export async function uploadStudentCSV(file: File): Promise<UploadResult> {
  const formData = new FormData();

  formData.append("file", file);

  const data = await fetchJSON<PredictionsResponse>(`${API_BASE_URL}/predict-csv`, {
    method: "POST",
    body: formData,
  });

  return {
    rows: data.total_students,
    accepted: data.total_students,
    rejected: 0,
    message: `Successfully scored ${data.total_students} students using the real XGBoost model.`,
  };
}

export async function getPredictions(): Promise<StudentPrediction[]> {
  const data = await fetchJSON<PredictionsResponse>(`${API_BASE_URL}/predictions`);

  return data.results.map(mapStudent);
}

export async function getStudentPrediction(studentId: string): Promise<StudentPrediction | null> {
  const response = await fetch(`${API_BASE_URL}/predictions/${encodeURIComponent(studentId)}`);

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Failed to load student (${response.status})`);
  }

  const data = (await response.json()) as StudentResponse;

  return mapStudent(data.result);
}

export async function getStudentExplanation(studentId: string): Promise<StudentExplanation | null> {
  const response = await fetch(`${API_BASE_URL}/explanations/${encodeURIComponent(studentId)}`);

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Failed to load explanation (${response.status})`);
  }

  const data = (await response.json()) as ExplanationResponse;

  const explanation = data.explanation;

  const convertFactor = (factor: BackendExplanationFactor) => ({
    feature: factor.label || factor.feature,
    value: factor.value === null || factor.value === undefined ? "" : String(factor.value),
    contribution: Number(factor.shap_value),
  });

  return {
    studentId: String(data.student_id),

    baseValue: Number(explanation.baseline_probability),

    predicted: Number(explanation.prediction.risk_probability),

    increasing: explanation.increasing_risk.map(convertFactor),

    reducing: explanation.reducing_risk.map(convertFactor),
  };
}

export function summarise(rows: StudentPrediction[]): CohortSummary {
  const highRisk = rows.filter((r) => r.riskLevel === "High Risk").length;

  const buckets = ["0–20%", "20–40%", "40–60%", "60–80%", "80–100%"];

  const distribution = buckets.map((bucket, i) => ({
    bucket,
    count: rows.filter(
      (r) =>
        r.riskProbability >= i * 0.2 && r.riskProbability < (i + 1) * 0.2 + (i === 4 ? 0.01 : 0),
    ).length,
  }));

  const weeklyEngagement = Array.from({ length: 8 }, (_, w) => {
    const avg = (level: string) => {
      const group = rows.filter((r) => r.riskLevel === level);

      return Math.round(
        group.reduce((sum, r) => sum + (r.weeklyActivity[w] ?? 0), 0) / (group.length || 1),
      );
    };

    return {
      week: `W${w + 1}`,
      highRisk: avg("High Risk"),
      lowerRisk: avg("Lower Risk"),
    };
  });

  return {
    totalStudents: rows.length,
    highRisk,
    lowerRisk: rows.length - highRisk,

    highRiskPercentage: rows.length ? (highRisk / rows.length) * 100 : 0,

    averageRiskProbability: rows.length
      ? rows.reduce((sum, r) => sum + r.riskProbability, 0) / rows.length
      : 0,

    distribution,
    weeklyEngagement,
  };
}

export function toCSV(rows: StudentPrediction[]): string {
  const head = [
    "Student ID",
    "Risk Level",
    "Risk Probability",
    "Assessment Completion Rate",
    "Mean Assessment Score",
    "Last Activity Day",
    "Active Weeks",
  ];

  const body = rows.map((r) =>
    [
      r.studentId,
      r.riskLevel,
      r.riskProbability.toFixed(4),
      r.assessmentCompletionRate.toFixed(3),
      r.meanAssessmentScore.toFixed(1),
      r.lastActivityDay,
      r.activeWeeks,
    ].join(","),
  );

  return [head.join(","), ...body].join("\n");
}
