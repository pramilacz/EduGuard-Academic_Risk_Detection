export type RiskLevel = "High Risk" | "Lower Risk";

export interface StudentPrediction {
  studentId: string;
  codeModule?: string | null;
  codePresentation?: string | null;
  riskLevel: RiskLevel;
  riskProbability: number; // 0..1
  assessmentCompletionRate: number; // 0..1
  meanAssessmentScore: number; // 0..100
  lastActivityDay: number; // day index within 56-day window
  activeWeeks: number; // 0..8
  lateSubmissions: number;
  studiedCredits: number;
  weeklyActivity: number[]; // 8 entries, clicks
}

export interface ExplanationFactor {
  feature: string;
  contribution: number; // signed, positive increases risk
  value: string;
}

export interface StudentExplanation {
  studentId: string;
  baseValue: number;
  predicted: number;
  increasing: ExplanationFactor[];
  reducing: ExplanationFactor[];
}

export interface CohortSummary {
  totalStudents: number;
  highRisk: number;
  lowerRisk: number;
  highRiskPercentage: number;
  averageRiskProbability: number;
  distribution: { bucket: string; count: number }[];
  weeklyEngagement: { week: string; highRisk: number; lowerRisk: number }[];
}

export interface UploadResult {
  rows: number;
  accepted: number;
  rejected: number;
  message: string;
}
