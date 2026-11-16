// The live side of the app: an agent's feed (pinned task, progress steps, results, question cards), the owner's
// inbox of open questions, and the AI panel. The AI parts run through Firebase AI Logic (see ai.ts): on this device
// first, cloud when needed, and every answer says where it ran.

import { useEffect, useReducer, useState } from "react";
import { aiConfigured, aiSetupError, ask, deviceModelStatus, prompts, type AIAnswer, type Mode } from "./ai";
import { answer, contextText, currentTask, feedFor, inbox, subscribe, type FeedItem } from "./sim";
import type { CityData } from "./data";
import { STATE_INFO } from "./data";

export function useSim(): void {
  const [, bump] = useReducer((x: number) => x + 1, 0);
  useEffect(() => subscribe(bump), []);
}

const hm = (t: number) => new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

// ---------------------------------------------------------------------------------------------------------------
function Where({ a }: { a: AIAnswer }) {
  return <span className={`ai-where ${a.where}`} title={a.where === "device" ? "Gemini Nano, running in this browser" : "Gemini in the cloud"}>
    {a.where === "device" ? "⚡ On this device · Gemini Nano" : "☁ Cloud · Gemini"} · {(a.ms / 1000).toFixed(1)}s</span>;
}

function AIBlock({ label, run, mode }: { label: string; run: () => string; mode: Mode }) {
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<AIAnswer | null>(null);
  const [err, setErr] = useState("");
  const go = async () => {
    setBusy(true); setErr(""); setOut(null);
    try { setOut(await ask(run(), mode)); } catch (e) { setErr(String((e as Error).message || e)); }
    setBusy(false);
  };
  return (
    <div className="ai-block">
      <button className="ai-btn" onClick={go} disabled={busy}>{busy ? "Thinking…" : `✨ ${label}`}</button>
      {out && <div className="ai-out"><p>{out.text}</p><Where a={out} /></div>}
      {err && <div className="ai-out bad">{err}</div>}
    </div>
  );
}

function QuestionCard({ agent, q, mode }: { agent: string; q: FeedItem; mode: Mode }) {
  return (
    <div className={`qcard ${q.chosen ? "done" : ""}`}>
      <div className="q-ask">{q.text}</div>
      <div className="q-opts">
        {(q.options ?? []).map((o, i) => (
          <button key={o} className={`q-opt ${q.chosen === o ? "on" : ""}`} disabled={!!q.chosen}
            onClick={() => answer(agent, q.id, o)}>
            <span className="q-key">{q.chosen === o ? "✓" : String.fromCharCode(65 + i)}</span>{o}
          </button>))}
      </div>
      {!q.chosen && <AIBlock label="Help me decide" mode={mode}
        run={() => prompts.decide(contextText(agent), agent, q.text, q.options ?? [])} />}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------
export function AgentFeed({ agent, data, mode, onClose }: { agent: string; data: CityData; mode: Mode; onClose: () => void }) {
  useSim();
  const m = data.members.find((x) => x.name === agent);
  const dept = data.departments.find((d) => d.key === m?.department);
  const feed = feedFor(agent);
  const cur = currentTask(agent);
  let last = 0;
  useEffect(() => {
    const el = document.querySelector(".feed-list"); if (el) el.scrollTop = el.scrollHeight;
  }, [feed.length]);
  return (
    <aside className="feed" style={{ ["--dc" as string]: dept?.color ?? "#4D7BFF" }}>
      <header className="feed-h">
        <button className="close" onClick={onClose} aria-label="Close">×</button>
        <div className="feed-av" style={{ background: dept?.color }}>{agent.split(/\s+/).map((w) => w[0]).join("").slice(0, 2)}</div>
        <div><b>{agent}</b><div className="muted">{dept?.name ?? ""}{m ? ` · ${STATE_INFO[m.state].label}` : ""}</div></div>
      </header>
      {cur && <div className="feed-pin"><span>📌</span> {cur.task}{cur.due ? <em> · due {cur.due}</em> : null}
        <i className={cur.phase === "asking" ? "warn" : "live"}>{cur.phase === "asking" ? "Needs your answer" : "Working"}</i></div>}
      {m?.about && <p className="feed-about">{m.about}</p>}
      <div className="feed-list">
        {!feed.length && <p className="muted center">No work yet today. When {agent} picks up a task, every step shows up here as it happens.</p>}
        {feed.map((f) => {
          const sep = f.at - last > 1000 * 60 * 10; last = f.at;
          return (
            <div key={f.id}>
              {sep && <div className="feed-time">{hm(f.at)}</div>}
              {f.kind === "start" && <div className="feed-start">{f.text}</div>}
              {f.kind === "step" && <div className="fbub">{f.text}</div>}
              {f.kind === "result" && <div className="fbub result"><b>Done.</b> {f.text}</div>}
              {f.kind === "question" && <QuestionCard agent={agent} q={f} mode={mode} />}
              {f.kind === "answer" && <div className="fbub me">{f.text}</div>}
            </div>
          );
        })}
      </div>
      <div className="feed-foot">
        <AIBlock label={`What has ${agent} done?`} mode={mode} run={() => prompts.agent(contextText(agent), agent)} />
        <p className="safety">Nothing gets sent, paid or published without your go-ahead.</p>
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------------------------------------------
export function Inbox({ mode, onOpen, onClose }: { mode: Mode; onOpen: (agent: string) => void; onClose: () => void }) {
  useSim();
  const items = inbox();
  return (
    <aside className="feed inbox">
      <header className="feed-h">
        <button className="close" onClick={onClose} aria-label="Close">×</button>
        <div><b>Waiting for you</b><div className="muted">{items.length ? `${items.length} question${items.length === 1 ? "" : "s"} from your agents` : "All clear"}</div></div>
      </header>
      <div className="feed-list">
        {!items.length && <p className="muted center">No questions right now. When an agent needs a decision, it shows up here and on its building.</p>}
        {items.map(({ agent, q }) => (
          <div key={q.id} className="inbox-item">
            <button className="inbox-who" onClick={() => onOpen(agent)}>{agent} · {q.task} ›</button>
            <QuestionCard agent={agent} q={q} mode={mode} />
          </div>))}
      </div>
      <div className="feed-foot"><p className="safety">Nothing gets sent, paid or published without your go-ahead.</p></div>
    </aside>
  );
}

// ---------------------------------------------------------------------------------------------------------------
export function AIPanel({ mode, setMode, onClose }: { mode: Mode; setMode: (m: Mode) => void; onClose: () => void }) {
  const [device, setDevice] = useState("checking…");
  const [q, setQ] = useState("");
  const [asked, setAsked] = useState<{ q: string; key: number } | null>(null);
  useEffect(() => { deviceModelStatus().then(setDevice); }, []);
  const deviceWords: Record<string, string> = {
    available: "Gemini Nano is ready on this device", downloadable: "Gemini Nano can be downloaded (Chrome does it on first use)",
    downloading: "Gemini Nano is downloading", unavailable: "Gemini Nano isn't available in this browser, so answers use the cloud",
  };
  return (
    <aside className="feed ai-panel">
      <header className="feed-h">
        <button className="close" onClick={onClose} aria-label="Close">×</button>
        <div className="feed-av ai">✨</div>
        <div><b>Ask about your business</b><div className="muted">{deviceWords[device] ?? device}</div></div>
      </header>
      <div className="feed-list">
        {!aiConfigured() && <div className="ai-out bad">{aiSetupError() || "AI isn't configured yet: add your Firebase web config to .env (see README)."}</div>}
        <div className="ai-mode" role="radiogroup" aria-label="Where the AI runs">
          {([["auto", "Auto", "On this device when it can, cloud when it can't"], ["device", "On this device only", "Private: nothing about the business leaves this computer"],
            ["cloud", "Cloud", "Always use Gemini in the cloud"]] as [Mode, string, string][]).map(([k, l, d]) => (
            <button key={k} role="radio" aria-checked={mode === k} className={mode === k ? "on" : ""} onClick={() => setMode(k)} title={d}><b>{l}</b><small>{d}</small></button>))}
        </div>
        <AIBlock label="Brief me on right now" mode={mode} run={() => prompts.brief(contextText())} />
        <form className="ai-ask" onSubmit={(e) => { e.preventDefault(); if (q.trim()) setAsked({ q: q.trim(), key: Date.now() }); }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. What's blocking the Lakeside deal?" maxLength={300} />
          <button type="submit">Ask</button>
        </form>
        {asked && <AskOnce key={asked.key} q={asked.q} mode={mode} />}
      </div>
      <div className="feed-foot"><p className="safety">The AI reads the city's live state and explains it. It can't send, pay or change anything.</p></div>
    </aside>
  );
}

function AskOnce({ q, mode }: { q: string; mode: Mode }) {
  const [out, setOut] = useState<AIAnswer | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { ask(prompts.question(contextText(), q), mode).then(setOut).catch((e) => setErr(String(e.message || e))); }, [q, mode]);
  return <div className="ai-block"><div className="fbub me">{q}</div>
    {!out && !err && <div className="ai-out muted">Thinking…</div>}
    {out && <div className="ai-out"><p>{out.text}</p><Where a={out} /></div>}
    {err && <div className="ai-out bad">{err}</div>}</div>;
}
