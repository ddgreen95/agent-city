// The sample business's workday, running in the browser.
//
// Agent City has no server. This module plays a scripted workday for the fictional sample business
// (Northgate Home Services) from the bundled roster: agents pick up tasks, post progress steps, finish
// with a result, and stop to ask the owner a question when a decision is theirs.
// Everything here is labelled as sample data in the UI. Nothing is sent, paid or posted anywhere.

import type { CityData, Member, State } from "./data";

export type FeedKind = "start" | "step" | "result" | "question" | "answer" | "note";

export interface Option { label: string; then: string[]; result: string }

export interface FeedItem {
  id: string;
  at: number;                 // ms timestamp
  kind: FeedKind;
  text: string;
  options?: string[];         // question cards
  chosen?: string;            // the owner's answer (on the question card once answered)
  task?: string;
}

interface Script {
  agent: string;
  task: string;
  due?: string;
  steps: string[];
  ask?: { after: number; prompt: string; options: Option[] };
  result?: string;            // when there is no question
}

// ---------------------------------------------------------------------------------------------------------------
// The scripts. Plain sentences, the way a good assistant reports progress.
const SCRIPTS: Script[] = [
  { agent: "Invoice Drafter", task: "Invoices for 4 finished jobs", due: "today",
    steps: ["Starting on this week's finished jobs. First I'm matching each job ticket to the price book.",
      "Job 1 (furnace tune-up, Maple St) matches the standard price: $129.",
      "Job 2 (water heater swap) used two extra fittings, so I'm adding them as parts.",
      "Jobs 3 and 4 are drafted. One customer has a 10% senior discount on file."],
    ask: { after: 4, prompt: "The Lakeside Apartments job ran 1.5 hours over the quote. How should I bill it?", options: [
      { label: "Bill the quote only ($480)", then: ["Keeping the invoice at the quoted $480 and adding a note about the extra time, no charge."], result: "4 invoices drafted ($1,283 total). They're in Drafts for your review; nothing has been sent." },
      { label: "Add the extra time ($615)", then: ["Adding 1.5 hours of labour at $90/hour with a short explanation line."], result: "4 invoices drafted ($1,418 total). They're in Drafts for your review; nothing has been sent." },
      { label: "Ask the customer first", then: ["Drafting a short, friendly note to Lakeside explaining the extra time and asking how they'd like it handled."], result: "3 invoices drafted and 1 customer note drafted. All waiting in Drafts; nothing has been sent." }] } },

  { agent: "Follow-Up", task: "Follow-up to Lakeside Apartments", due: "this week",
    steps: ["Starting on the Lakeside Apartments follow-up. First I'm reading the last three emails and the quote.",
      "They asked about a maintenance plan for 24 units on Oct 30 and haven't replied to the quote since.",
      "Drafting a short follow-up that answers their open question about response times."],
    ask: { after: 3, prompt: "Which offer should the follow-up lead with?", options: [
      { label: "Annual plan, 8% off", then: ["Leading with the annual plan and the 8% multi-unit discount."], result: "Follow-up drafted (leads with the annual plan). It's in Drafts; nothing goes out without your go-ahead." },
      { label: "Free first inspection", then: ["Leading with a free first inspection for 3 units, so they can try us."], result: "Follow-up drafted (leads with a free first inspection). It's in Drafts; nothing goes out without your go-ahead." },
      { label: "Just a friendly check-in", then: ["Keeping it to a friendly two-line check-in, no offer."], result: "Check-in drafted. It's in Drafts; nothing goes out without your go-ahead." }] } },

  { agent: "List Builder", task: "40 property managers in Ann Arbor",
    steps: ["Starting on the Ann Arbor property-manager list. First I'm pulling companies from public business listings.",
      "Found 63 companies; removing ones outside our service area.",
      "41 are in range. Checking each one has a public business email or phone.",
      "Removing 3 that asked not to be contacted, and 2 that are already customers."],
    result: "List ready: 36 property managers in Ann Arbor, each with a public contact and a reason they fit. Saved to the CRM as \"Ann Arbor PMs\"." },

  { agent: "Caption Writer", task: "Captions for the furnace tune-up post",
    steps: ["Starting on this week's furnace tune-up post. First I'm checking last month's best-performing captions.",
      "Short, practical tips did twice as well as promotions. Writing three options in the brand voice.",
      "Checking each caption against the brand voice guide: no jargon, one clear call to action."],
    ask: { after: 3, prompt: "Which caption should go on Friday's post?", options: [
      { label: "\"5 signs your furnace needs a tune-up\"", then: ["Using the 5-signs caption with a carousel of the checklist."], result: "Friday post ready to schedule with the 5-signs caption. It waits for your go-ahead before it's published." },
      { label: "\"Cold snap coming: book by Thursday\"", then: ["Using the cold-snap caption with the booking link."], result: "Friday post ready to schedule with the cold-snap caption. It waits for your go-ahead before it's published." }] } },

  { agent: "Ticket Triage", task: "6 new service requests",
    steps: ["Starting on 6 new service requests from the website and voicemail.",
      "2 are urgent (no heat, a leak under a sink). Flagging both for today.",
      "3 are routine maintenance; 1 is a billing question I'm passing to Billing."],
    result: "All 6 sorted: 2 urgent for today, 3 booked into next week's open slots, 1 sent to Invoice Drafter." },

  { agent: "Scheduler", task: "3 emergency calls into tomorrow", due: "tomorrow",
    steps: ["Starting on tomorrow's schedule. First I'm looking for gaps near the three emergency addresses.",
      "Mike has a 2-hour gap at 10:00 near two of them.",
      "The third (Riverside Dr) only fits if I move a routine tune-up to Thursday."],
    ask: { after: 3, prompt: "To fit Riverside Dr tomorrow, should I move the 1:00 tune-up to Thursday?", options: [
      { label: "Yes, move it", then: ["Moving the tune-up to Thursday 1:00 and drafting a heads-up text to that customer."], result: "All 3 emergencies are on tomorrow's schedule. The tune-up customer's heads-up text is drafted for your OK." },
      { label: "No, send Riverside to Friday", then: ["Keeping the tune-up and offering Riverside Dr the first Friday slot."], result: "2 emergencies scheduled tomorrow; Riverside Dr offered Friday 8:00 (draft reply waiting for your OK)." }] } },

  { agent: "Collections", task: "Reminders for 2 overdue invoices",
    steps: ["Starting on overdue invoices. First I'm checking who has paid since yesterday.",
      "Two are still open: 18 days and 41 days overdue.",
      "Writing a polite first reminder for the 18-day one."],
    ask: { after: 3, prompt: "The 41-day invoice ($860) already had two reminders. What next?", options: [
      { label: "Firm third reminder", then: ["Drafting a firm, polite third reminder with a payment link and a 7-day date."], result: "2 reminders drafted. Both wait in Drafts; nothing is sent without your go-ahead." },
      { label: "Offer a payment plan", then: ["Drafting a reminder that offers two monthly payments of $430."], result: "2 reminders drafted, one with a payment-plan offer. Both wait in Drafts." },
      { label: "I'll call them myself", then: ["Leaving the 41-day account to you and adding a call reminder to your calendar draft."], result: "1 reminder drafted; a call note for the 41-day account is on your list." }] } },

  { agent: "Person Research", task: "Riverbend HOA board before Thursday's call", due: "Thu",
    steps: ["Starting on the Riverbend HOA board. First I'm reading their public meeting minutes.",
      "Their last two meetings mention a boiler that keeps failing in Building C.",
      "The board president runs a property-management firm; their annual budget vote is in December."],
    result: "Call brief ready: 5 board members, the Building C boiler problem, December budget timing, and three questions to ask Thursday." },

  { agent: "Chief of Staff", task: "Tomorrow's morning page",
    steps: ["Starting on tomorrow's morning page. First I'm collecting everything that's waiting on you.",
      "Adding today's finished work, open questions, money in and out, and tomorrow's appointments."],
    result: "Morning page ready: 3 things need you, $2,140 expected in, 7 appointments, 1 risk (a parts delay on Thursday's install)." },

  { agent: "Proposal Writer", task: "Proposal for Riverbend HOA",
    steps: ["Starting on the Riverbend HOA proposal. First I'm pulling the research brief and our price book.",
      "Drafting a two-option proposal: repair the Building C boiler, or replace it with a high-efficiency unit."],
    ask: { after: 2, prompt: "Should the proposal include the rebate paperwork as a free extra?", options: [
      { label: "Yes, include it", then: ["Adding rebate paperwork as a no-charge line; it usually wins HOA votes."], result: "Proposal drafted with two options and free rebate paperwork. Ready for your review." },
      { label: "No, keep it simple", then: ["Keeping the proposal to the two options and prices."], result: "Proposal drafted with two options. Ready for your review." }] } },

  { agent: "SEO & AI Visibility", task: "Check how we show up in AI answers",
    steps: ["Starting on our AI-search check. First I'm asking common questions like \"best furnace repair near Ann Arbor\".",
      "We're named in 2 of 6 answers; a competitor is named in 4.",
      "Their pages answer \"how much does it cost\" directly; ours don't."],
    result: "Report ready: add a pricing FAQ to 3 service pages to show up in more AI answers. Draft FAQ text attached." },

  { agent: "Contract Reviewer", task: "Review the new parts-supplier agreement",
    steps: ["Starting on the parts-supplier agreement. First I'm reading payment terms and auto-renewal.",
      "It auto-renews for 2 years unless cancelled 90 days before the end date.",
      "Late-payment interest is 2% a month, higher than our other suppliers."],
    result: "Review done: 2 things to push back on (90-day auto-renewal, 2%/month late fee). Suggested wording is in the notes." },
];

// ---------------------------------------------------------------------------------------------------------------
interface Run { script: Script; i: number; phase: "steps" | "asking" | "after" | "done"; option?: Option; j: number; nextAt: number; qid?: string }

const feeds = new Map<string, FeedItem[]>();         // agent name -> feed, oldest first
const runs = new Map<string, Run>();                  // agent name -> current task run
const restUntil = new Map<string, number>();          // agent name -> idle until (between tasks)
let base: CityData | null = null;
let seq = 0;
const listeners = new Set<() => void>();
let started = false;

const now = () => Date.now();
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const push = (agent: string, item: Omit<FeedItem, "id" | "at"> & { at?: number }) => {
  const f = feeds.get(agent) ?? []; f.push({ id: `f${++seq}`, at: item.at ?? now(), ...item }); feeds.set(agent, f.slice(-80));
};

// a little history so the feeds aren't empty the first time you open them
function seedHistory() {
  const t0 = now() - 1000 * 60 * 95;
  const past: [string, string, string][] = [
    ["Chief of Staff", "Morning page", "Morning page ready: 4 things needed you, 6 appointments, no risks."],
    ["Ticket Triage", "Overnight voicemails", "Sorted 4 overnight voicemails: 1 urgent, 3 booked for this week."],
    ["List Builder", "Ypsilanti landlords", "List ready: 22 landlords in Ypsilanti, saved to the CRM."],
    ["Collections", "Last week's overdue reminder", "Reminder drafted for a 12-day invoice and left in Drafts."],
  ];
  past.forEach(([agent, task, result], k) => {
    const at = t0 + k * 1000 * 60 * 12;
    push(agent, { kind: "start", task, text: `Started: ${task}.`, at });
    push(agent, { kind: "result", task, text: result, at: at + 1000 * 60 * 4 });
  });
}

function startRun(s: Script) {
  runs.set(s.agent, { script: s, i: 0, phase: "steps", j: 0, nextAt: now() + rand(1500, 4000) });
  push(s.agent, { kind: "start", task: s.task, text: `Started: ${s.task}${s.due ? ` (due ${s.due})` : ""}.` });
}

function tick() {
  const t = now();
  for (const [agent, r] of runs) {
    if (r.phase === "asking" || r.phase === "done" || t < r.nextAt) continue;
    const s = r.script;
    if (r.phase === "steps") {
      if (r.i < s.steps.length && (!s.ask || r.i < s.ask.after)) {
        push(agent, { kind: "step", task: s.task, text: s.steps[r.i++] });
        r.nextAt = t + rand(4500, 9000);
      } else if (s.ask) {
        r.phase = "asking"; r.qid = `q${++seq}`;
        push(agent, { kind: "question", task: s.task, text: s.ask.prompt, options: s.ask.options.map((o) => o.label) });
      } else {
        push(agent, { kind: "result", task: s.task, text: s.result ?? "Done." });
        finish(agent);
      }
    } else if (r.phase === "after" && r.option) {
      if (r.j < r.option.then.length) { push(agent, { kind: "step", task: s.task, text: r.option.then[r.j++] }); r.nextAt = t + rand(4000, 7000); }
      else { push(agent, { kind: "result", task: s.task, text: r.option.result }); finish(agent); }
    }
  }
  // idle agents with a script pick it up again after a rest (one at a time keeps the city readable)
  const active = [...runs.values()].filter((r) => r.phase !== "done").length;
  if (active < 7) {
    const idle = SCRIPTS.filter((s) => { const r = runs.get(s.agent); return (!r || r.phase === "done") && (restUntil.get(s.agent) ?? 0) < t; });
    if (idle.length) startRun(idle[Math.floor(Math.random() * idle.length)]);
  }
  emit();
}

function finish(agent: string) {
  const r = runs.get(agent); if (r) r.phase = "done";
  restUntil.set(agent, now() + rand(60_000, 150_000));
}

function emit() { listeners.forEach((l) => l()); }

// ---------------------------------------------------------------------------------------------------------------
// Public API

export async function startSim(): Promise<void> {
  if (started) return; started = true;
  const r = await fetch("./samples/business.json", { cache: "no-store" });
  base = await r.json();
  seedHistory();
  // start the agents the sample business already shows as busy, so the first screen matches the data
  for (const name of ["Invoice Drafter", "Follow-Up", "List Builder", "Caption Writer", "Ticket Triage", "Scheduler"]) {
    const s = SCRIPTS.find((x) => x.agent === name); if (s) startRun(s);
  }
  // fast-forward the two that are already "waiting for you" to their question
  for (const name of ["Invoice Drafter", "Follow-Up"]) {
    const r0 = runs.get(name); if (!r0 || !r0.script.ask) continue;
    while (r0.i < r0.script.ask.after) push(name, { kind: "step", task: r0.script.task, text: r0.script.steps[r0.i++], at: now() - (r0.script.ask.after - r0.i) * 40_000 });
    r0.phase = "asking"; push(name, { kind: "question", task: r0.script.task, text: r0.script.ask.prompt, options: r0.script.ask.options.map((o) => o.label) });
  }
  setInterval(tick, 1000);
  emit();
}

export function subscribe(fn: () => void): () => void { listeners.add(fn); return () => { listeners.delete(fn); }; }

export function feedFor(agent: string): FeedItem[] { return feeds.get(agent) ?? []; }

export function currentTask(agent: string): { task: string; due?: string; phase: string } | null {
  const r = runs.get(agent); if (!r || r.phase === "done") return null;
  return { task: r.script.task, due: r.script.due, phase: r.phase };
}

export function openQuestion(agent: string): FeedItem | null {
  const r = runs.get(agent); if (!r || r.phase !== "asking") return null;
  const f = feeds.get(agent) ?? [];
  for (let k = f.length - 1; k >= 0; k--) if (f[k].kind === "question" && !f[k].chosen) return f[k];
  return null;
}

/** Every question waiting on the owner, newest first. */
export function inbox(): { agent: string; q: FeedItem }[] {
  const out: { agent: string; q: FeedItem }[] = [];
  for (const agent of runs.keys()) { const q = openQuestion(agent); if (q) out.push({ agent, q }); }
  return out.sort((a, b) => b.q.at - a.q.at);
}

/** The owner taps an option on a question card. */
export function answer(agent: string, qid: string, label: string): boolean {
  const r = runs.get(agent); if (!r || r.phase !== "asking" || !r.script.ask) return false;
  const q = (feeds.get(agent) ?? []).find((x) => x.id === qid); if (!q || q.chosen) return false;
  const opt = r.script.ask.options.find((o) => o.label === label); if (!opt) return false;
  q.chosen = label;
  push(agent, { kind: "answer", task: r.script.task, text: label });
  r.phase = "after"; r.option = opt; r.j = 0; r.nextAt = now() + 1800;
  emit();
  return true;
}

/** The city data with every member's state taken from the running workday. */
export function snapshot(): CityData | null {
  if (!base) return null;
  const members: Member[] = base.members.map((m) => {
    const r = runs.get(m.name);
    if (!r || r.phase === "done") return { ...m, state: "idle" as State, running: 0, waiting: 0, queued: 0, doing: "", doing_kind: "" };
    const asking = r.phase === "asking";
    return { ...m, state: (asking ? "waiting_for_you" : "running") as State, running: asking ? 0 : 1, waiting: asking ? 1 : 0, queued: 0,
      doing: r.script.task, doing_kind: asking ? "card_waiting" : "task_running",
      last_activity: new Date((feeds.get(m.name) ?? []).at(-1)?.at ?? now()).toISOString() };
  });
  const departments = base.departments.map((d) => {
    const ms = members.filter((m) => m.department === d.key);
    const running = ms.filter((m) => m.state === "running").length, waiting = ms.filter((m) => m.state === "waiting_for_you").length;
    return { ...d, members: ms.length, running, waiting, busy: running > 0, empty: ms.length === 0 };
  });
  const running = members.filter((m) => m.state === "running").length, waiting = members.filter((m) => m.state === "waiting_for_you").length;
  const log = [...feeds.entries()].flatMap(([who, f]) => f.filter((x) => x.kind === "result").map((x) => ({ at: new Date(x.at).toISOString(), who, what: x.text, status: "complete" })))
    .sort((a, b) => b.at.localeCompare(a.at)).slice(0, 12);
  return { ...base, members, departments, totals: { members: members.length, running, waiting_for_you: waiting, pending_approvals: waiting }, log };
}

/** A compact, plain-text picture of the business right now, for the AI to reason over. */
export function contextText(focusAgent?: string): string {
  const s = snapshot(); if (!s) return "";
  const lines: string[] = [`Business: Northgate Home Services (sample). ${s.totals.members} AI agents; ${s.totals.running} working; ${s.totals.waiting_for_you} waiting for the owner.`];
  for (const d of s.departments) {
    const busy = s.members.filter((m) => m.department === d.key && m.state !== "idle");
    if (busy.length) lines.push(`${d.name}: ` + busy.map((m) => `${m.name} (${m.state === "waiting_for_you" ? "waiting for owner" : "working"}: ${m.doing})`).join("; "));
  }
  const recent = (s.log ?? []).slice(0, 6).map((l) => `- ${l.who}: ${l.what}`);
  if (recent.length) lines.push("Recently finished:", ...recent);
  if (focusAgent) {
    lines.push(`\nFeed for ${focusAgent} (oldest first):`);
    for (const f of feedFor(focusAgent).slice(-14)) lines.push(`- [${f.kind}] ${f.text}${f.options ? ` Options: ${f.options.join(" | ")}` : ""}${f.chosen ? ` (owner chose: ${f.chosen})` : ""}`);
  }
  return lines.join("\n");
}
