// Hybrid AI through Firebase AI Logic: Gemini Nano on this device first, Gemini in the cloud when Nano isn't there.
//
// - initializeApp + App Check (reCAPTCHA v3; a debug token on localhost) protect the cloud model from abuse.
// - getGenerativeModel(ai, { mode }) picks where each request runs. PREFER_ON_DEVICE = Chrome's built-in Gemini
//   Nano when the browser has it, otherwise the cloud model. ONLY_ON_DEVICE keeps everything on the laptop
//   (nothing about the business leaves it). ONLY_IN_CLOUD always uses the cloud model.
// - Every answer reports where it ran (response.inferenceSource), so the UI can say "on this device" or "cloud".

import { initializeApp, type FirebaseApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { getAI, getGenerativeModel, GoogleAIBackend, InferenceMode, type GenerativeModel } from "firebase/ai";

export type Mode = "auto" | "device" | "cloud";
export interface AIAnswer { text: string; where: "device" | "cloud"; ms: number }

const env = import.meta.env;
const CLOUD_MODEL = (env.VITE_GEMINI_CLOUD_MODEL as string) || "gemini-2.5-flash-lite";

const SYSTEM = [
  "You are the narrator for an AI-run small business shown as a city of agents.",
  "Speak to the business owner in plain, friendly English. Be short and concrete: names, numbers, next steps.",
  "Never invent facts that are not in the context. Never claim anything was sent, paid or published:",
  "in this business nothing goes out without the owner's go-ahead.",
].join(" ");

let app: FirebaseApp | null = null;
const models = new Map<Mode, GenerativeModel>();
let setupError = "";

export function aiConfigured(): boolean {
  return Boolean(env.VITE_FIREBASE_API_KEY && env.VITE_FIREBASE_PROJECT_ID && env.VITE_FIREBASE_APP_ID);
}

export function aiSetupError(): string { return setupError; }

function init(): boolean {
  if (app) return true;
  if (!aiConfigured()) { setupError = "AI isn't configured yet: add your Firebase web config to .env (see README)."; return false; }
  try {
    app = initializeApp({
      apiKey: env.VITE_FIREBASE_API_KEY, authDomain: env.VITE_FIREBASE_AUTH_DOMAIN, projectId: env.VITE_FIREBASE_PROJECT_ID,
      appId: env.VITE_FIREBASE_APP_ID, storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET, messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    });
    // App Check: a debug token while developing on localhost (register it in the Firebase console), reCAPTCHA v3 in production
    if (location.hostname === "localhost" || env.VITE_APPCHECK_DEBUG === "1") {
      (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN: boolean | string }).FIREBASE_APPCHECK_DEBUG_TOKEN = env.VITE_APPCHECK_DEBUG_TOKEN || true;
    }
    if (env.VITE_RECAPTCHA_SITE_KEY) {
      initializeAppCheck(app, { provider: new ReCaptchaV3Provider(env.VITE_RECAPTCHA_SITE_KEY), isTokenAutoRefreshEnabled: true });
    }
    return true;
  } catch (e) {
    setupError = "Firebase didn't start: " + String((e as Error).message || e);
    app = null;
    return false;
  }
}

function model(mode: Mode): GenerativeModel | null {
  if (!init() || !app) return null;
  let m = models.get(mode);
  if (!m) {
    const ai = getAI(app, { backend: new GoogleAIBackend() });
    m = getGenerativeModel(ai, {
      mode: mode === "device" ? InferenceMode.ONLY_ON_DEVICE : mode === "cloud" ? InferenceMode.ONLY_IN_CLOUD : InferenceMode.PREFER_ON_DEVICE,
      inCloudParams: { model: CLOUD_MODEL, systemInstruction: SYSTEM, generationConfig: { temperature: 0.4, maxOutputTokens: 400 } },
      onDeviceParams: { createOptions: {
        expectedInputs: [{ type: "text", languages: ["en"] }], expectedOutputs: [{ type: "text", languages: ["en"] }],
        initialPrompts: [{ role: "system", content: [{ type: "text", value: SYSTEM }] }] } },
    });
    models.set(mode, m);
  }
  return m;
}

/** Is Chrome's built-in model on this machine? "available" | "downloadable" | "downloading" | "unavailable" */
export async function deviceModelStatus(): Promise<string> {
  const LM = (globalThis as unknown as { LanguageModel?: { availability: (o?: object) => Promise<string> } }).LanguageModel;
  if (!LM) return "unavailable";
  try { return await LM.availability({ expectedInputs: [{ type: "text", languages: ["en"] }], expectedOutputs: [{ type: "text", languages: ["en"] }] }); }
  catch { return "unavailable"; }
}

export async function ask(prompt: string, mode: Mode): Promise<AIAnswer> {
  const m = model(mode);
  if (!m) throw new Error(setupError || "AI isn't configured yet.");
  const t0 = performance.now();
  try {
    const r = await m.generateContent(prompt);
    const where = r.response.inferenceSource === "on_device" ? "device" : "cloud";
    return { text: r.response.text().trim(), where, ms: Math.round(performance.now() - t0) };
  } catch (e) {
    const msg = String((e as Error).message || e);
    if (mode === "device") throw new Error("Gemini Nano isn't available in this browser, and \"On this device only\" is on. Switch to Auto to use the cloud, or see README to turn on Chrome's built-in AI.");
    throw new Error(msg);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// The four things the AI does in the app. Each builds a prompt from the live business context.

export const prompts = {
  brief: (ctx: string) => `${ctx}\n\nGive the owner a 3-sentence briefing of what's happening right now. Start with what needs them.`,
  agent: (ctx: string, agent: string) => `${ctx}\n\nIn 2-3 sentences, explain what ${agent} has done so far and what it's waiting on, if anything.`,
  decide: (ctx: string, agent: string, question: string, options: string[]) =>
    `${ctx}\n\n${agent} asks the owner: "${question}"\nOptions:\n${options.map((o, i) => `${i + 1}. ${o}`).join("\n")}\n\n` +
    `Help the owner decide. For each option give one short line on the trade-off, then recommend one and say why in one sentence. ` +
    `The owner makes the final choice.`,
  question: (ctx: string, q: string) => `${ctx}\n\nThe owner asks: "${q}"\nAnswer from the context only, in at most 4 sentences. If the context doesn't say, say so.`,
};
