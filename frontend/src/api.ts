import type { HoldoutPayload, MetricsPayload, PredictionResult, Schema } from "./types/result";

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...init,
    });
  } catch {
    throw new Error(`Cannot reach the API at ${BASE}. Is the FastAPI server running?`);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const detail = body?.detail;
    const msg = Array.isArray(detail) ? detail.join("; ") : detail ?? res.statusText;
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export const fetchSchema = () => request<Schema>("/schema");
export const fetchMetrics = () => request<MetricsPayload>("/metrics");
export const fetchHoldout = () => request<HoldoutPayload>("/holdout");

export const predict = (features: Record<string, string | number>, model: string | null) =>
  request<PredictionResult>("/predict", {
    method: "POST",
    body: JSON.stringify({ features, model }),
  });
