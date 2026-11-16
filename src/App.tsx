import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { CityData, STATE_INFO, State } from "./data";
import { CFG } from "./config";
import { snapshot, startSim, subscribe } from "./sim";
import { AgentFeed, AIPanel, Inbox } from "./Hybrid";
import type { Mode } from "./ai";

// each product loads only its own code: an Agent Graph build never downloads the 3D engine, and vice versa
const CityView = import.meta.env.VITE_PRODUCT === "graph" ? null : lazy(() => import("./CityView"));
// the inside-a-building view (city builds only)
const Interior = import.meta.env.VITE_PRODUCT === "graph" ? null : lazy(() => import("./Interior").then((m) => ({ default: m.Interior })));
const AgentGraph = import.meta.env.VITE_PRODUCT === "city" ? null : lazy(() => import("./AgentGraph").then((m) => ({ default: m.AgentGraph })));

const QS = new URLSearchParams(location.search);
const sysDark = () => matchMedia("(prefers-color-scheme: dark)").matches;

function urlTheme(): "light" | "dark" | null {   // ?theme=light|dark|system sets the Agent Graph appearance
  const q = QS.get("theme");
  if (q === "light" || q === "dark") return q;
  if (q === "system") return sysDark() ? "dark" : "light";
  return null;
}

function startTheme(): "light" | "dark" {
  const q = urlTheme(); if (q) return q;
  try { const t = localStorage.getItem("agentcity-graph-theme"); if (t === "light" || t === "dark") return t; } catch { /* storage blocked */ }
  if (CFG.theme === "auto") return sysDark() ? "dark" : "light";
  return CFG.theme === "dark" ? "dark" : "light";
}

export default function App() {
  const [data, setData] = useState<CityData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [inside, setInside] = useState<string | null>(null);          // department whose interior is open
  const enterTimer = useRef<number>(0);
  // the header floats over the page; publish its real height so the Agent Graph page starts below it at any width
  const hud = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = hud.current; if (!el) return;
    const ro = new ResizeObserver(() => document.documentElement.style.setProperty("--hud-h", `${Math.ceil(el.getBoundingClientRect().bottom)}px`));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const [night, setNight] = useState(() => urlTheme() !== "light");   // ?theme=light opens the city in day mode
  const [quality, setQuality] = useState<"low" | "high">(() => (matchMedia("(max-width: 700px)").matches ? "low" : "high"));
  const [traffic, setTraffic] = useState(true);
  const [updated, setUpdated] = useState<Date | null>(null);
  const [view, setView] = useState<"city" | "company">(CFG.product === "graph" ? "company" : "city");
  const [theme, setTheme] = useState<"light" | "dark">(startTheme);
  const flipTheme = () => { const t = theme === "dark" ? "light" : "dark"; setTheme(t); try { localStorage.setItem("agentcity-graph-theme", t); } catch { /* fine */ } };

  // the sample business's workday runs in the browser (sim.ts); the city only re-renders when someone's state changes
  useEffect(() => {
    let sig = "";
    const pull = () => {
      const d = snapshot(); if (!d) return;
      const s = d.members.map((m) => m.state + m.doing).join("|");
      if (s !== sig) { sig = s; setData(d); setUpdated(new Date()); }
    };
    startSim().then(pull).catch((e) => setErr(String(e.message || e)));
    return subscribe(pull);
  }, []);

  // the live feed, inbox and AI panel (one open at a time)
  const [agent, setAgent] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<"inbox" | "ai" | null>(null);
  const [mode, setModeState] = useState<Mode>(() => { try { const m = localStorage.getItem("agentcity-ai-mode"); if (m === "auto" || m === "device" || m === "cloud") return m; } catch { /* fine */ } return "auto"; });
  const setMode = (m: Mode) => { setModeState(m); try { localStorage.setItem("agentcity-ai-mode", m); } catch { /* fine */ } };
  const openAgent = (a: string) => { setDrawer(null); setAgent(a); };

  useEffect(() => {                              // Escape closes an open panel
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") { setSelected(null); setAgent(null); setDrawer(null); } };
    addEventListener("keydown", k); return () => removeEventListener("keydown", k);
  }, []);

  // clicking a building flies the camera to it, then opens its interior (the institute and open lots keep their panel)
  const pick = (k: string | null) => {
    setSelected(k);
    clearTimeout(enterTimer.current);
    const d = k && data ? data.departments.find((x) => x.key === k) : null;
    if (d && !d.empty && Interior) enterTimer.current = window.setTimeout(() => setInside(d.key), 650);
  };
  useEffect(() => () => clearTimeout(enterTimer.current), []);

  const dept = data && selected ? data.departments.find((d) => d.key === selected) : null;
  const team = data && selected ? data.members.filter((m) => m.department === selected) : [];

  return (
    <div className="app">
      {data && view === "company" && AgentGraph ? (
        <div className={`ag-wrap ${theme}`}><Suspense fallback={<div className="loading">Loading…</div>}><AgentGraph data={data} brand={CFG.name} theme={theme} onAgent={openAgent} /></Suspense></div>
      ) : data && CityView ? (
        <Suspense fallback={<div className="loading">Building the city…</div>}>
          <CityView data={data} selected={selected} onSelect={pick} night={night} quality={quality} traffic={traffic} paused={!!inside} />
        </Suspense>
      ) : (
        <div className="loading">{err ? `Couldn't load the sample business. ${err}` : "Loading…"}</div>
      )}

      <header ref={hud} className={`hud ${view === "company" ? "solid" : ""} ${view === "company" && theme === "light" ? "light" : ""}`}>
        <div className="brand">
          {CFG.logoUrl ? <img className="logo-img" src={CFG.logoUrl} alt="" /> : CFG.logoText ? <span className="logo txt">{CFG.logoText}</span> : <span className="logo" />}
          {view === "company" ? "Agent Graph" : "City"}<small className="brand-sub"> · {CFG.name}</small>
        </div>
        {data && (
          <div className="stats">
            <span><b>{data.totals.members}</b> agents &amp; bots</span>
            <span className={data.totals.running ? "hot" : ""}><b>{data.totals.running}</b> working now</span>
            <button className={`stat ${data.totals.waiting_for_you ? "warn" : ""}`} onClick={() => { setAgent(null); setDrawer("inbox"); }}><b>{data.totals.waiting_for_you}</b> waiting for you</button>
          </div>
        )}
        <div className="toggles">
          <button className="ai-open" onClick={() => { setAgent(null); setDrawer("ai"); }}>✨ Ask AI</button>
          {CFG.product === "both" && <div className="seg" role="tablist">
            <button role="tab" aria-selected={view === "city"} className={view === "city" ? "on" : ""} onClick={() => setView("city")}>City</button>
            <button role="tab" aria-selected={view === "company"} className={view === "company" ? "on" : ""} onClick={() => setView("company")}>Agent Graph</button>
          </div>}
          {view === "company" && <button onClick={flipTheme} aria-label="Switch light or dark">{theme === "dark" ? "☀ Light" : "☾ Dark"}</button>}
          {view === "city" && <><button onClick={() => setNight(!night)}>{night ? "☀ Day" : "☾ Night"}</button>
          <button onClick={() => setQuality(quality === "high" ? "low" : "high")}>{quality === "high" ? "Graphics: high" : "Graphics: low"}</button>
          <button onClick={() => setTraffic(!traffic)}>{traffic ? "Traffic on" : "Traffic off"}</button></>}
        </div>
      </header>

      {CFG.sample && <div className="preview-banner">SAMPLE BUSINESS, fictional · names and numbers are sample data · the AI runs on your device when it can</div>}

      {view === "city" && selected === "institute" && data && (
        <aside className="panel" style={{ borderColor: "#2EE6D6" }}>
          <button className="close" onClick={() => setSelected(null)} aria-label="Close">×</button>
          <h2 style={{ color: "#2EE6D6" }}>AI School</h2>
          <p className="sub">New agents and bots start here. Each takes an exam first; passing only asks for your yes on the Board — nothing graduates on its own.</p>
          {(data.training ?? []).length ? (
            <ul>{(data.training ?? []).map((t) => (
              <li key={t.kind + t.name}><i style={{ background: t.status === "passed" ? "#FFC542" : t.status === "failed" ? "#FF6B6B" : "#2EE6D6" }} />
                <div><b>{t.name}</b> <span className="muted">{t.kind}</span>
                  <div className="muted">{t.status === "passed" ? "Passed — waiting for your yes" : t.status === "failed" ? "Didn't pass" : "In training"}{t.score != null ? ` · ${t.score}%` : ""}{t.detail ? ` · ${t.detail}` : ""}</div></div></li>))}
            </ul>
          ) : <p className="muted">No one is in training right now. When an agent or bot is sent for training, it takes a desk here; when it passes, it waits at the front for your approval and then walks to its building.</p>}
        </aside>
      )}

      {view === "city" && inside && data && Interior && (
        <Suspense fallback={<div className="interior"><div className="loading">Opening the doors…</div></div>}>
          <Interior data={data} deptKey={inside} night={night} quality={quality} onClose={() => setInside(null)} onAgent={openAgent} />
        </Suspense>
      )}

      {view === "city" && dept && !inside && (
        <aside className="panel" style={{ borderColor: dept.color }}>
          <button className="close" onClick={() => setSelected(null)} aria-label="Close">×</button>
          <h2 style={{ color: dept.color }}>{dept.building}</h2>
          <p className="sub">{dept.name} · {dept.members} {dept.members === 1 ? "member" : "members"} · {dept.running} working · {dept.waiting} waiting for you</p>
          {!dept.empty && Interior && <button className="look-inside" style={{ borderColor: dept.color }} onClick={() => setInside(dept.key)}>Look inside ›</button>}
          {team.length ? (
            <ul>
              {team.map((m) => (
                <li key={m.kind + m.name} className="tap" onClick={() => openAgent(m.name)}>
                  <i style={{ background: STATE_INFO[m.state].color }} />
                  <div><b>{m.name}</b> <span className="muted">{m.kind}{m.title ? ` · ${m.title}` : ""}</span>
                    <div className="muted">{STATE_INFO[m.state].label}{[
                      m.running && `${m.running} running`, m.queued && `${m.queued} queued`, m.waiting && `${m.waiting} waiting for you`,
                      m.on_card && `${m.on_card} card${m.on_card === 1 ? "" : "s"}`, m.ai_calls_10m && `${m.ai_calls_10m} AI calls (10 min)`,
                      m.failed_24h && `${m.failed_24h} failed today`].filter(Boolean).map((x) => ` · ${x}`).join("")}</div></div>
                </li>
              ))}
            </ul>
          ) : <p className="muted">Open lot — no agents work here yet. Hire one from the catalog and it moves in after it graduates.</p>}
        </aside>
      )}

      {data && agent && <AgentFeed key={agent} agent={agent} data={data} mode={mode} onClose={() => setAgent(null)} />}
      {drawer === "inbox" && <Inbox mode={mode} onOpen={openAgent} onClose={() => setDrawer(null)} />}
      {drawer === "ai" && <AIPanel mode={mode} setMode={setMode} onClose={() => setDrawer(null)} />}

      {view === "city" && <footer className="legend">
        {(Object.keys(STATE_INFO) as State[]).map((k) => <span key={k}><i style={{ background: STATE_INFO[k].color }} />{STATE_INFO[k].label}</span>)}
        <span className="muted">Windows &amp; people = the agents · cars are scenery{updated ? ` · updated ${updated.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : ""}</span>
      </footer>}
    </div>
  );
}
