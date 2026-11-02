import { labelFor } from "../fields";

export const termLabel = (t: string) => t.split(" & ").map(labelFor).join(" × ");