export interface NumericSpec {
  min: number;
  max: number;
  median: number;
}

export interface Schema {
  numeric: Record<string, NumericSpec>;
  categorical: Record<string, string[]>;
  target: string;
}

export interface ModelMetrics {
  MAE: number;
  RMSE: number;
  R2: number;
  Train_R2: number;
  train_seconds: number;
}

export interface MetricsPayload {
  metrics: Record<string, ModelMetrics>;
  importances: Record<string, Record<string, number>>;
  best_model: string;
}

export type FormValues = Record<string, string>;

export interface PredictionResult {
  model: string;
  predicted_age_of_death: number;
  estimated_remaining_years: number;
  all_models: Record<string, number>;
  disclaimer: string;
}

export interface HoldoutPayload {
  features: Record<string, string | number>;
  actual: number;
}
