# Agent City

A standalone contest demo for Google's **#BuildHybridAI** Devpost contest (Firebase AI Logic hybrid inference).

Agent City shows a small business's AI agents as a **3D city** and as an **Agent Graph**. You can watch a scripted workday, open **live feeds**, answer **tap-to-answer question cards**, clear a **Waiting-for-you** inbox, and use an **Ask AI** panel. The business on screen is fictional. Every name and number is sample data.

## What you can do

- **City.** Each department is a building. People at the desks are the agents. Busy buildings light up while a task is running, and anyone waiting on you is marked in the legend.
- **Agent Graph.** The same roster on one page: department cards, a network, a sample scoreboard, and the connected-tools list.
- **Live feeds.** Tap an agent for the task pinned at the top, each progress step, and the result.
- **Question cards.** When a decision is yours, the agent stops and asks. One tap answers it. Nothing in the demo is sent, paid, or published.
- **Waiting for you.** The inbox lists every open question.
- **Ask AI.** "Brief me on right now", "What has this agent done?", "Help me decide", and a free-form question. Answers come from Firebase AI Logic when it is configured.

The sample company is **Northgate Home Services**, a made-up HVAC, plumbing, and handyman shop with 12 agents in Front Office, Dispatch, Billing, Sales, and Field Ops. The workday is played in the browser from `public/samples/business.json` and `src/sim.ts`. There is no server and no live customer data.

## How Firebase AI Logic hybrid is used

All model calls go through `src/ai.ts`:

```ts
import { getAI, getGenerativeModel, GoogleAIBackend, InferenceMode } from "firebase/ai";

const model = getGenerativeModel(getAI(app, { backend: new GoogleAIBackend() }), {
  mode: InferenceMode.PREFER_ON_DEVICE,                 // Gemini Nano in Chrome first
  inCloudParams: { model: "gemini-2.5-flash-lite" },    // cloud fallback
});
const result = await model.generateContent(prompt);
result.response.inferenceSource;                        // "on_device" | "in_cloud"
```

The Ask AI panel has three modes:

| Mode | InferenceMode | What it does |
|---|---|---|
| Auto | `PREFER_ON_DEVICE` | Gemini Nano in Chrome when the browser has it, otherwise the cloud model. This is the default. |
| On this device only | `ONLY_ON_DEVICE` | Nano only. If Nano is missing, the panel says so instead of sending the prompt to the cloud. |
| Cloud | `ONLY_IN_CLOUD` | Always `gemini-2.5-flash-lite` in the cloud. |

Every answer shows an **inferenceSource** badge: **On this device · Gemini Nano** or **Cloud · Gemini**, plus how long it took.

**Firebase App Check** with **reCAPTCHA v3** protects the cloud model. Put the site key in `VITE_RECAPTCHA_SITE_KEY`. On localhost the app turns on the App Check debug token automatically. Register that token in the Firebase console (App Check → Manage debug tokens) before cloud calls will succeed locally.

The city, the feeds, and the question cards work with no Firebase project. The AI buttons need the values in `.env`.

## Setup

Requirements: Node 20+. A Firebase project is only needed for the Ask AI panel.

```bash
npm install
cp .env.example .env
npm run dev
```

Open http://localhost:5190.

`.env.example` has empty placeholders only. Fill these in `.env` (do not commit `.env`):

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_RECAPTCHA_SITE_KEY`

In the [Firebase console](https://console.firebase.google.com/), create a project, add a **Web app**, and copy its config into `.env`. Open **AI Logic** and get started with the Gemini Developer API. Then set up **App Check** with reCAPTCHA v3 and paste the site key into `VITE_RECAPTCHA_SITE_KEY`.

### On-device Gemini Nano (Chrome Prompt API)

On-device answers need desktop Chrome with the Prompt API available (Chrome 139 or newer).

1. Open `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input`.
2. Set **Prompt API for Gemini Nano multimodal input** to **Enabled**.
3. Relaunch Chrome.
4. In Agent City, open **Ask AI**. If the panel says Gemini Nano can be downloaded, Chrome fetches the model on first use. That download can take a few minutes.

Without the flag, or in a browser that has no Prompt API, Auto falls back to the cloud model and the badge says the answer ran in the cloud.

### Production build

```bash
npm run build
```

`dist/` is a static site (City and Agent Graph). `firebase.json` points Firebase Hosting at `dist` and rewrites every path to `index.html`. This repo does not deploy anything; point Hosting at your own Firebase project before you publish a build.

## Sample data

All data is fictional sample data. The banner in the app reads **SAMPLE BUSINESS, fictional**. The roster, the tools (Email, Calendar, Payments, Accounting, CRM), and the scoreboard numbers are made up for this demo. They are not a real company and not live metrics.

## License

Apache License 2.0. Copyright 2026 Dylan Green. See [LICENSE](LICENSE).
