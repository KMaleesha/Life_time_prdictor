export interface NumericSpec {
  min: number;
  max: number;
  median: number;
}

export interface Schema {
  numeric: Record<string, NumericSpec>;
  categorical: Record<string, string[]>;
  target: string;
  feature_order?: string[];
}

export interface ModelMetrics {
  MAE: number;
  RMSE: number;
  R2: number;
  Train_R2: number;
  Val_RMSE?: number;
  train_seconds: number;
}

export interface Pdp {
  type: "numeric" | "categorical";
  x: (number | string)[];
  y: Record<string, number[]>;
}

export interface FairnessEntry {
  feature: string;
  groups: { group: string; n: number; mae: number; bias: number }[];
}

export interface MetricsPayload {
  metrics: Record<string, ModelMetrics>;
  importances: Record<string, Record<string, number>>;
  best_model: string;
  primary_model?: string;
  pdp?: Record<string, Pdp>;
  fairness?: FairnessEntry[];
}

export type FormValues = Record<string, string>;

export interface Explanation {
  intercept: number;
  contributions: { term: string; input: string; value: number }[];
  other: number;
}

export interface PredictionResult {
  model: string;
  predicted_age_of_death: number;
  estimated_remaining_years: number;
  all_models: Record<string, number>;
  explanation?: Explanation | null;
  disclaimer: string;
}

export interface HoldoutPayload {
  features: Record<string, string | number>;
  actual: number;
}