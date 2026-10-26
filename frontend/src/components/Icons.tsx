const base = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

export const LogoIcon = () => (
  <svg {...base} width={22} height={22}><path d="M3 12h4l2-6 4 12 2-6h6" /></svg>
);
export const FormIcon = () => (
  <svg {...base}><rect x="4" y="3" width="16" height="18" rx="3" /><path d="M8 8h8M8 12h8M8 16h5" /></svg>
);
export const ChartIcon = () => (
  <svg {...base}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>
);
export const CheckIcon = () => (
  <svg {...base} width={12} height={12} strokeWidth={3}><path d="M5 12l5 5 9-10" /></svg>
);
