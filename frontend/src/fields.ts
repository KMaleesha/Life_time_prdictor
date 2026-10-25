import type { FormValues, Schema } from "./types";

export const GROUPS: { title: string; fields: string[] }[] = [
  { title: "Demographics", fields: ["age", "gender", "district"] },
  {
    title: "Lifestyle",
    fields: [
      "cigarettes_day", "drinks_week", "exercise", "diet", "diet_type", "sleep",
      "screening", "hydration", "caffeine", "sunlight_exp", "volunteering",
      "pet_ownership", "meditation", "oral_hygiene",
    ],
  },
  {
    title: "Clinical",
    fields: ["bmi_numeric", "blood_pressure", "diabetes", "cholesterol", "ckd", "heart_disease", "cancer_status"],
  },
  { title: "Medical history", fields: ["accidents", "parts_removed", "dengue", "covid", "other_deadly"] },
  { title: "Environment", fields: ["pm25", "water_quality", "occup_hazard", "noise", "air_purifier"] },
  { title: "Family history", fields: ["fam_longevity", "fam_cancer", "fam_heart"] },
];

const LABELS: Record<string, string> = {
  cigarettes_day: "Cigarettes per day",
  drinks_week: "Alcoholic drinks per week",
  bmi_numeric: "BMI",
  pm25: "PM2.5 (air pollution)",
  ckd: "Chronic kidney disease",
  dengue: "Past severe dengue",
  covid: "Past COVID-19 hospitalisation",
  other_deadly: "Other life-threatening illness",
  fam_longevity: "Family longevity",
  fam_cancer: "Family cancer history",
  fam_heart: "Family heart disease",
  occup_hazard: "Occupational hazard",
  sunlight_exp: "Sunlight exposure",
  diet_type: "Diet type",
  parts_removed: "Organs removed (surgery)",
  screening: "Annual health screening",
};

export function labelFor(name: string): string {
  if (LABELS[name]) return LABELS[name];
  const s = name.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function isBinary(schema: Schema, name: string): boolean {
  const spec = schema.numeric[name];
  return !!spec && spec.min === 0 && spec.max === 1;
}

export function isDecimal(name: string): boolean {
  return name === "pm25" || name === "bmi_numeric";
}

/** Fields that exist in the schema but are not in GROUPS go to "Other". */
export function groupsFor(schema: Schema) {
  const all = new Set([...Object.keys(schema.numeric), ...Object.keys(schema.categorical)]);
  const used = new Set<string>();
  const groups = GROUPS.map((g) => {
    const fields = g.fields.filter((f) => all.has(f));
    fields.forEach((f) => used.add(f));
    return { title: g.title, fields };
  }).filter((g) => g.fields.length > 0);
  const rest = [...all].filter((f) => !used.has(f));
  if (rest.length) groups.push({ title: "Other", fields: rest });
  return groups;
}

export function defaultValues(schema: Schema): FormValues {
  const v: FormValues = {};
  for (const [k, spec] of Object.entries(schema.numeric)) {
    v[k] = String(isBinary(schema, k) ? 0 : isDecimal(k) ? Math.round(spec.median * 10) / 10 : Math.round(spec.median));
  }
  for (const [k, opts] of Object.entries(schema.categorical)) v[k] = opts[0];
  return v;
}
