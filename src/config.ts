// Demo settings for Agent City. The app always shows the bundled sample business
// (Northgate Home Services). URL options (?product=city|graph, ?theme=light|dark|auto)
// still override the build defaults.

export type Product = "both" | "city" | "graph";
export type Theme = "light" | "dark" | "auto";

export interface AppConfig {
  name: string;                 // shown in the header and the browser tab
  product: Product;             // city, agent graph, or both
  accent: string;               // brand colour (buttons, logo, numbered badges)
  logoText: string;             // 1-3 letters shown in the logo circle when there's no logo image
  logoUrl: string;              // optional logo image next to index.html, e.g. "logo.png"
  theme: Theme;                 // Agent Graph light/dark default ("auto" follows the device)
  assistantName: string;        // the orb over headquarters
  sample: boolean;              // true = the fictional demo business
}

const BUILD_PRODUCT = (import.meta.env.VITE_PRODUCT || "both") as Product;

export const DEFAULTS: AppConfig = {
  name: "Northgate Home Services", product: BUILD_PRODUCT, accent: "#2563EB", logoText: "NH", logoUrl: "", theme: "dark",
  assistantName: "Your AI assistant", sample: true,
};

export let CFG: AppConfig = { ...DEFAULTS };

export function loadConfig(): AppConfig {
  const q = new URLSearchParams(location.search);
  const c: AppConfig = { ...DEFAULTS };
  if (BUILD_PRODUCT !== "both") c.product = BUILD_PRODUCT;           // a product-only build can't show the other one
  const qp = q.get("product");
  if (c.product === "both" && (qp === "city" || qp === "graph")) c.product = qp;
  const qt = q.get("theme");
  if (qt === "light" || qt === "dark" || qt === "auto") c.theme = qt;
  CFG = c;
  document.title = `Agent City · ${c.product === "graph" ? "Agent Graph" : c.product === "city" ? "City" : "City & Agent Graph"}`;
  document.documentElement.style.setProperty("--accent", c.accent);
  return c;
}
