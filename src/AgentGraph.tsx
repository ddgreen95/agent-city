import { useEffect, useMemo, useRef, useState } from "react";
import { atInstitute, CityData, Member, STATE_INFO } from "./data";

// Agent Graph: the sample business on one board. Department cards sit around a radial agent network,
// with numbered sections 01-06. Every number comes from the bundled sample business, which is labelled fictional.
// Motion has two layers: slow AMBIENT drift (core swirl, clusters floating, spokes flowing) that never means work, and
// LIVE signals from the scripted workday: bright packets flow to HQ from members with a task running right now, an amber
// ripple marks members waiting for your yes, a department node ripples while anyone in it is working.

// where each department's cluster sits on the network (degrees), spread evenly from the top in roster order
// (set each render from the departments in the sample file)
let ANGLE: Record<string, number> = {};
let SLOT: Record<string, number> = {};
const TOOL_COLORS = ["#EA4335", "#FF7A59", "#4285F4", "#611F69", "#635BFF", "#2CA01C", "#F4B400", "#2D8CFF", "#0A66C2", "#25D366", "#1877F2", "#E1306C"];
const initials = (s: string) => s.replace(/[^A-Za-z0-9 ]/g, " ").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

let IDLE = "#1B2333";

// Chart-only zoom (phone feedback): pinch / drag inside the
// network, ctrl+wheel or trackpad pinch on a computer, + / - / Reset buttons. The rest of the page never zooms.
// k = SVG units per screen pixel, so labels can be sized in real pixels at every width and zoom.
const MAXZ = 5;
function useChartZoom(W: number, H: number) {
  const box = useRef<HTMLDivElement>(null);
  const [z, setZ] = useState({ s: 1, x: 0, y: 0 });
  const [k, setK] = useState(1);
  const zr = useRef(z); zr.current = z;
  const moved = useRef(false);
  const clamp = (s: number, x: number, y: number) => {
    s = Math.min(MAXZ, Math.max(1, s));
    const w = W / s, h = H / s;
    return { s, x: Math.min(W - w, Math.max(0, x)), y: Math.min(H - h, Math.max(0, y)) };
  };
  useEffect(() => {
    const el = box.current; if (!el) return;
    const ro = new ResizeObserver(() => { const w = el.getBoundingClientRect().width; if (w > 0) setK(W / w); });
    ro.observe(el);
    const pts = new Map<number, { x: number; y: number }>();
    let start: { d: number; s: number; mx: number; my: number } | null = null;
    let last: { x: number; y: number } | null = null;
    const toSvg = (cx: number, cy: number) => {
      const r = el.getBoundingClientRect(), c = zr.current;
      return { x: c.x + (cx - r.left) / r.width * (W / c.s), y: c.y + (cy - r.top) / r.height * (H / c.s), r };
    };
    const two = () => { const [a, b] = [...pts.values()]; return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }; };
    const down = (e: PointerEvent) => {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved.current = false;
      if (pts.size === 2) { const t = two(), m = toSvg(t.mx, t.my); start = { d: t.d, s: zr.current.s, mx: m.x, my: m.y }; }
      last = { x: e.clientX, y: e.clientY };
    };
    const move = (e: PointerEvent) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const r = el.getBoundingClientRect();
      if (pts.size === 2 && start) {
        const t = two(), s = Math.min(MAXZ, Math.max(1, start.s * t.d / start.d));
        moved.current = true;
        setZ(clamp(s, start.mx - (t.mx - r.left) / r.width * (W / s), start.my - (t.my - r.top) / r.height * (H / s)));
      } else if (pts.size === 1 && zr.current.s > 1 && last) {
        const dx = e.clientX - last.x, dy = e.clientY - last.y;
        if (Math.abs(dx) + Math.abs(dy) > 2) moved.current = true;
        const c = zr.current;
        setZ(clamp(c.s, c.x - dx / r.width * (W / c.s), c.y - dy / r.height * (H / c.s)));
        last = { x: e.clientX, y: e.clientY };
      }
    };
    const up = (e: PointerEvent) => { pts.delete(e.pointerId); if (pts.size < 2) start = null; last = pts.size ? [...pts.values()][0] : null; };
    const wheel = (e: WheelEvent) => {            // trackpad pinch and ctrl+wheel zoom the chart; a plain wheel scrolls the page
      if (!e.ctrlKey) return;
      e.preventDefault();
      const m = toSvg(e.clientX, e.clientY), c = zr.current, s = Math.min(MAXZ, Math.max(1, c.s * Math.exp(-e.deltaY / 200)));
      setZ(clamp(s, m.x - (e.clientX - m.r.left) / m.r.width * (W / s), m.y - (e.clientY - m.r.top) / m.r.height * (H / s)));
    };
    const noGesture = (e: Event) => e.preventDefault();   // older iOS: stop Safari's own page pinch over the chart
    el.addEventListener("pointerdown", down); window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
    el.addEventListener("wheel", wheel, { passive: false }); el.addEventListener("gesturestart", noGesture);
    return () => {
      ro.disconnect(); el.removeEventListener("pointerdown", down); window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up);
      el.removeEventListener("wheel", wheel); el.removeEventListener("gesturestart", noGesture);
    };
  }, [W, H]);
  const zoomBy = (f: number) => {
    const c = zr.current, s = Math.min(MAXZ, Math.max(1, c.s * f));
    const mx = c.x + W / c.s / 2, my = c.y + H / c.s / 2; setZ(clamp(s, mx - W / s / 2, my - H / s / 2));
  };
  return { box, z, k, moved, zoomBy, reset: () => setZ({ s: 1, x: 0, y: 0 }) };
}
function stateColor(m: Member, away: Set<string>) {
  if (away.has(m.kind + ":" + m.name)) return "#14B8A6";
  return m.state === "idle" ? IDLE : STATE_INFO[m.state].color;
}

export function AgentGraph({ data, brand, theme = "light", onAgent }: { data: CityData; brand: string; theme?: "light" | "dark"; onAgent?: (name: string) => void }) {
  IDLE = theme === "dark" ? "#8FA6C4" : "#1B2333";
  const away = useMemo(() => atInstitute(data), [data]);
  const [sel, setSel] = useState<string | null>(null);
  const deps = data.departments;
  const ring = deps.filter((d) => d.key !== "headquarters");
  ANGLE = Object.fromEntries(ring.map((d, i) => [d.key, (270 + i * 360 / Math.max(ring.length, 1)) % 360]));
  SLOT = Object.fromEntries(ring.map((d, i) => [d.key, i + 1]));
  const byDept = (k: string) => data.members.filter((m) => m.department === k);
  const hqDept = deps.find((d) => d.key === "headquarters");
  const hq = byDept("headquarters");
  const tools = data.tools ?? [];
  const sb = data.scoreboard;
  const W = 900, H = 760, cx = 450, cy = 380, R = 300;
  const zm = useChartZoom(W, H);
  const px = zm.k / zm.z.s;                                  // SVG units per on-screen pixel right now
  const deptFont = Math.max(15 / zm.z.s, 12 * px);           // department names: always at least 12 px on screen
  const agentFont = Math.max(7.5 / zm.z.s, 9 * px);          // agent names around the network: 9 px on screen...
  const listFont = 10.5 * px;                                 // ...a tapped department's list: 10.5 px
  const showAgents = px <= 1.3; 
  const crowded = ring.length > 9 && !showAgents;          // phones with many departments: names go in buttons below the chart
                            // ...shown once there is room (computers; phones after zooming in)
  // names that would collide with one already drawn wait for more zoom (zooming in always reveals them)
  const placed: [number, number, number, number][] = [];
  const room = (x: number, y: number, len: number, start: boolean) => {
    const w = len * agentFont * 0.56, b: [number, number, number, number] = [start ? x : x - w, y - agentFont, start ? x + w : x, y + agentFont * 0.3];
    if (placed.some((p) => b[0] < p[2] && p[0] < b[2] && b[1] < p[3] && p[1] < b[3])) return false;
    placed.push(b); return true;
  };
  // department title position: just outside its own cluster; above the cluster when it would run off a narrow chart
  const deptLabel = (key: string, name: string) => {
    const a = ANGLE[key] * Math.PI / 180, nx = cx + Math.cos(a) * R * 0.6, ny = cy + Math.sin(a) * R * 0.6;
    const lr = R * 0.6 + 88, lx = cx + Math.cos(a) * lr, ly = cy + Math.sin(a) * lr + deptFont * 0.35;
    let anchor: "middle" | "start" | "end" = Math.abs(Math.cos(a)) < 0.1 ? "middle" : Math.cos(a) > 0 ? "start" : "end", x = lx, y = ly;
    const est = name.length * deptFont * 0.8;
    if ((anchor === "start" && lx + est > W - 4) || (anchor === "end" && lx - est < 4)) { anchor = "middle"; x = nx; y = ny - 30 - deptFont * 0.4; }
    if (anchor === "middle") x = Math.min(W - est / 2 - 4, Math.max(est / 2 + 4, x));
    const x0 = anchor === "start" ? x : anchor === "end" ? x - est : x - est / 2;
    return { anchor, x, y, box: [x0, y - deptFont, x0 + est, y + deptFont * 0.3] as [number, number, number, number] };
  };
  if (!crowded) deps.filter((d) => ANGLE[d.key] !== undefined && sel !== d.key).forEach((d) => placed.push(deptLabel(d.key, d.name).box));
  const pick = (k: string) => { if (zm.moved.current) return; setSel(sel === k ? null : k); };

  // the decorative "core" around headquarters: a soft cloud of tiny points (not agents - the legend says so)
  const core = useMemo(() => Array.from({ length: 260 }, (_, i) => {
    const a = i * 2.399963, r = 10 + Math.sqrt(i) * 5.6;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.92];
  }), []);

  const card = (k: string) => {
    const d = deps.find((x) => x.key === k); if (!d) return null;
    const ms = byDept(k);
    const n = Object.keys(ANGLE).indexOf(k) + 1;
    return (
      <div key={k} className={`ag-card ag-in ${sel === k ? "sel" : ""} `} style={{ gridArea: `s${SLOT[k]}`, ["--dc" as string]: d.color, animationDelay: `${n * 70}ms` }}
        onClick={() => setSel(sel === k ? null : k)} role="button" tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setSel(sel === k ? null : k); }}>
        <div className="ag-card-h"><i style={{ background: d.color }} /><b>{d.name.toUpperCase()}</b>
          <span>{ms.length} {ms.length === 1 ? "agent" : "agents"}</span>{n > 0 && <em>{String(n).padStart(2, "0")}</em>}</div>
        <ul>{ms.slice(0, sel === k ? 40 : 5).map((m) => (
          <li key={m.kind + m.name} title={m.about || ""} className="tap" onClick={(e) => { e.stopPropagation(); onAgent?.(m.name); }}>
            <span className="ag-ic" style={{ background: d.color }}>{initials(m.name)}</span>
            <span className="ag-nm">{m.name}</span>
            <i className={`ag-st ${away.has(m.kind + ":" + m.name) ? "" : m.state}`} style={{ background: stateColor(m, away) }} title={away.has(m.kind + ":" + m.name) ? "At the AI School" : STATE_INFO[m.state].label} />
          </li>))}
          {ms.length > 5 && sel !== k && <li className="more">+{ms.length - 5} more</li>}
          {!ms.length && <li className="more">No agents yet</li>}
        </ul>
        {sel === k && ms.some((m) => m.doing) && <p className="ag-doing">{ms.filter((m) => m.doing).map((m) => `${m.name}: ${m.doing}`).join(" · ")}</p>}
      </div>
    );
  };

  return (
    <div className="ag">
      <section className="ag-sec ag-inputs">
        <span className="ag-num">01</span><b>Inputs</b><span className="ag-muted">everything the company already uses</span>
        <div className="ag-tools">{tools.map((t, i) => (
          <span key={t.name} className={`ag-tool ${t.ok ? "on" : "off"}`} title={t.ok ? "connected" : t.status}>
            <i style={{ background: TOOL_COLORS[i % TOOL_COLORS.length], animationDelay: `${i * 0.45}s` }}>{initials(t.name)}</i>{t.name}</span>))}
        </div>
      </section>

      <div className="ag-board">
        {deps.filter((d) => d.key !== "headquarters").map((d) => card(d.key))}
        <div className="ag-map" style={{ gridArea: "map" }}>
          <div className={`ag-zoom${zm.z.s > 1 ? " on" : ""}`} ref={zm.box}>
          <div className="ag-zbtns">
            <button onClick={() => zm.zoomBy(1.6)} aria-label="Zoom in">+</button>
            <button onClick={() => zm.zoomBy(1 / 1.6)} aria-label="Zoom out" disabled={zm.z.s <= 1}>−</button>
            {zm.z.s > 1 && <button onClick={zm.reset} className="wide">Reset</button>}
          </div>
          {zm.z.s === 1 && !showAgents && <span className="ag-zhint">{crowded ? "Tap a department below to see its agents · pinch or + to zoom" : "Tap a department for its agents · pinch or + to zoom"}</span>}
          <svg viewBox={`${zm.z.x} ${zm.z.y} ${W / zm.z.s} ${H / zm.z.s}`} role="img" aria-label={`${brand} agent network`}>
            <g className="ag-swirl a">{core.filter((_, i) => i % 2 === 0).map(([x, y], i) => <circle key={i} cx={x} cy={y} r={1.1} className={`ag-core${i % 9 === 0 ? " tw" : ""}`} style={i % 9 === 0 ? { animationDelay: `${(i % 7) * 0.6}s` } : undefined} />)}</g>
            <g className="ag-swirl b">{core.filter((_, i) => i % 2 === 1).map(([x, y], i) => <circle key={i} cx={x} cy={y} r={1.1} className={`ag-core${i % 11 === 0 ? " tw" : ""}`} style={i % 11 === 0 ? { animationDelay: `${(i % 5) * 0.8}s` } : undefined} />)}</g>
            {[0, 1, 2].map((k) => (
              <circle key={k} cx={cx} cy={cy} r={20} className="ag-ripple">
                <animate attributeName="r" values="20;118" dur="6s" begin={`${k * 2}s`} repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.45;0" dur="6s" begin={`${k * 2}s`} repeatCount="indefinite" />
              </circle>))}
            {hq.map((m, i) => {
              const a = (i / Math.max(hq.length, 1)) * Math.PI * 2, x = cx + Math.cos(a) * 34, y = cy + Math.sin(a) * 30;
              return <g key={m.kind + m.name} className="ag-bob" style={{ animationDelay: `${-i * 1.1}s` }}><line x1={cx} y1={cy} x2={x} y2={y} className="ag-ln" /><circle cx={x} cy={y} r={3.4} fill={stateColor(m, away)} className={m.state === "waiting_for_you" ? "ag-blink amber" : m.state === "running" ? "ag-pulse" : ""}><title>{m.name}</title></circle></g>;
            })}
            {showAgents && <text x={cx} y={cy + 72} className="ag-hq" style={{ fontSize: Math.max(11 / zm.z.s, 10 * px) }}>{(hqDept?.name ?? "Headquarters").toUpperCase()}</text>}
            {deps.filter((d) => ANGLE[d.key] !== undefined).map((d) => {
              const a = ANGLE[d.key] * Math.PI / 180, nx = cx + Math.cos(a) * R * 0.6, ny = cy + Math.sin(a) * R * 0.6;
              const ms = byDept(d.key), n = Object.keys(ANGLE).indexOf(d.key) + 1, on = sel === null || sel === d.key;
              // phones: a tapped department lists its agents in a tidy column beside its node (radial names would collide)
              const stack = sel === d.key && !showAgents && ms.length > 0, lineH = listFont * 1.4;
              const estW = Math.max(0, ...ms.map((m) => m.name.length)) * listFont * 0.56;
              let side = Math.cos(a) < -0.1 ? -1 : 1;
              if (side < 0 && nx - 24 - estW < 4) side = 1; else if (side > 0 && nx + 24 + estW > W - 4) side = -1;
              const y0 = Math.min(H - lineH * ms.length, Math.max(listFont * 2.9 + 4, ny - (ms.length - 1) * lineH / 2));
              const { anchor, x: tx0, y: ty0 } = deptLabel(d.key, d.name);
              return (
                <g key={d.key} className={`ag-cl ${on ? "" : "dim"}`} onClick={() => pick(d.key)}>
                 <g className="ag-float" style={{ animationDelay: `${-n * 1.7}s`, animationDuration: `${9 + (n % 4) * 1.5}s` }}>
                  <line x1={cx + Math.cos(a) * 60} y1={cy + Math.sin(a) * 56} x2={nx} y2={ny} className={`ag-spoke${d.running ? " live" : ""}`} style={d.running ? { stroke: d.color } : undefined} />
                  {d.running > 0 && [0, 1].map((k) => (
                    <circle key={k} cx={nx} cy={ny} r={13} fill="none" stroke={d.color} strokeWidth={1.5}>
                      <animate attributeName="r" values="13;34" dur="2.4s" begin={`${k * 1.2}s`} repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.8;0" dur="2.4s" begin={`${k * 1.2}s`} repeatCount="indefinite" />
                    </circle>))}
                  {stack && <text x={nx + side * 24} y={y0 - lineH * 1.2} className="ag-agent on" style={{ fontSize: listFont * 1.1, fill: d.color, textAnchor: side > 0 ? "start" : "end" }}>{d.name}</text>}
                  {ms.map((m, j) => {
                    const spread = Math.min(ring.length > 9 ? 1.25 : 2.2, (ring.length > 9 ? 0.22 : 0.35) * ms.length), aa = a + (ms.length > 1 ? (j / (ms.length - 1) - 0.5) * spread : 0);
                    const rr = 40 + (j % 2) * 22 + (m.state === "running" ? 6 : 0);
                    const x = nx + Math.cos(aa) * rr, y = ny + Math.sin(aa) * rr;
                    const tx = nx + Math.cos(aa) * (rr + 9), ty = ny + Math.sin(aa) * (rr + 9);
                    const right = Math.cos(aa) >= 0;
                    const isAway = away.has(m.kind + ":" + m.name);
                    const live = !isAway && m.state === "running", wait = !isAway && m.state === "waiting_for_you";
                    // a packet's route: member -> its department node -> headquarters
                    const route = `M${x.toFixed(1)},${y.toFixed(1)} L${nx.toFixed(1)},${ny.toFixed(1)} L${(cx + Math.cos(a) * 60).toFixed(1)},${(cy + Math.sin(a) * 56).toFixed(1)}`;
                    return (
                      <g key={m.kind + m.name} className="ag-bob" style={{ animationDelay: `${-(j * 0.9 + n)}s` }}>
                        <line x1={nx} y1={ny} x2={x} y2={y} className={`ag-ln${live ? " live" : ""}`} />
                        {wait && [0, 1].map((k) => (
                          <circle key={k} cx={x} cy={y} r={4} fill="none" stroke={STATE_INFO.waiting_for_you.color} strokeWidth={1.2}>
                            <animate attributeName="r" values="4;13" dur="2s" begin={`${k}s`} repeatCount="indefinite" />
                            <animate attributeName="opacity" values="0.9;0" dur="2s" begin={`${k}s`} repeatCount="indefinite" />
                          </circle>))}
                        {live && [0, 1, 2].map((k) => (
                          <circle key={k} r={2.2} className="ag-packet">
                            <animateMotion dur="1.8s" begin={`${k * 0.6}s`} repeatCount="indefinite" path={route} />
                          </circle>))}
                        <circle cx={x} cy={y} r={live ? 4.6 : 3.4} fill={stateColor(m, away)}
                          className={live ? "ag-pulse" : m.state === "queued" && !isAway ? "ag-blink" : ""}><title>{m.name}</title></circle>
                        {showAgents && room(tx, ty + agentFont * 0.35, m.name.length, right) && <text x={tx} y={ty + agentFont * 0.35} className="ag-agent" style={{ fontSize: agentFont, textAnchor: right ? "start" : "end" }}>{m.name}</text>}
                        {stack && <>
                          <line x1={x} y1={y} x2={nx + side * 20} y2={y0 + j * lineH - listFont * 0.35} className="ag-lead" />
                          <text x={nx + side * 24} y={y0 + j * lineH} className="ag-agent on" style={{ fontSize: listFont, textAnchor: side > 0 ? "start" : "end" }}>{m.name}</text>
                        </>}
                      </g>
                    );
                  })}
                  <circle cx={nx} cy={ny} r={13} className="ag-node" style={{ stroke: d.color }} />
                  <text x={nx} y={ny + 4} className="ag-node-t" style={{ fill: d.color }}>{String(n).padStart(2, "0")}</text>
                 </g>
                  {!stack && !crowded && <text x={tx0} y={ty0} className="ag-dept" style={{ fontSize: deptFont, textAnchor: anchor }}>{d.name.toUpperCase()}</text>}
                </g>
              );
            })}
          </svg>
          </div>
          {crowded && <div className="ag-chips" role="tablist" aria-label="Departments">{ring.map((d) => (
            <button key={d.key} role="tab" aria-selected={sel === d.key} className={sel === d.key ? "on" : ""} style={{ ["--dc" as string]: d.color }}
              onClick={() => setSel(sel === d.key ? null : d.key)}><i />{d.name}</button>))}
          </div>}
          <div className="ag-legend">
            <span><i style={{ background: STATE_INFO.running.color }} />Working now</span>
            <span><i style={{ background: STATE_INFO.waiting_for_you.color }} />Waiting for you</span>
            <span><i style={{ background: STATE_INFO.queued.color }} />Queued</span>
            <span><i style={{ background: "#14B8A6" }} />In training</span>
            <span><i style={{ background: IDLE }} />Idle</span>
            <span className="ag-muted">slow drift and the specks in the middle are decoration · bright moving dots = work running right now</span>
          </div>
        </div>
      </div>

      <div className="ag-panels">
        <section className="ag-sec">
          <span className="ag-num">02</span><b>Scoreboard</b>
          {sb ? <div className="ag-score">
            <div><small>Tasks done (7 days)</small><big>{sb.done_7d}</big></div>
            <div><small>Cards finished (7 days)</small><big>{sb.cards_done_7d}</big></div>
            <div><small>Open cards</small><big>{sb.open_cards}</big></div>
            <div><small>AI calls today</small><big>{sb.ai_calls_today}</big></div>
            <div><small>Automations on</small><big>{sb.automations_on}</big></div>
            <div><small>Agent runs failed (7 days)</small><big>{sb.failed_7d}</big></div>
          </div> : <p className="ag-muted">Not available yet.</p>}
        </section>
        <section className="ag-sec">
          <span className="ag-num">03</span><b>Needs your yes</b><span className="ag-muted">human sign-off</span>
          <div className="ag-yes">
            <div><b>You</b><small>Approve from your phone</small><big>{data.totals.waiting_for_you}</big></div>
            <div><b>Your team</b><small>Tagged when it's theirs</small><big>{data.totals.pending_approvals}</big></div>
            <div><b>Customers</b><small>Only after you say yes</small></div>
            <div><b>Daily summary</b><small>One page of what needs you</small></div>
          </div>
        </section>
        <section className="ag-sec wide">
          <span className="ag-num">04</span><b>Agent log</b><span className="ag-muted">latest work</span>
          <ul className="ag-log">{(data.log ?? []).slice(0, 8).map((l, i) => (
            <li key={i}><time>{new Date(l.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>
              <b>{slug(l.who || "agent")}</b><span>{l.what}</span>
              <em className={l.status}>{l.status === "complete" ? "done" : l.status === "failed" ? "failed" : l.status.replace(/_/g, " ")}</em></li>))}
          </ul>
        </section>
        <section className="ag-sec wide">
          <span className="ag-num">05</span><b>Documented workflows</b><span className="ag-muted">{data.members.length}, one per agent</span>
          <div className="ag-flows">{deps.filter((d) => byDept(d.key).length).map((d) => (
            <div key={d.key}><b><i style={{ background: d.color }} />{slug(d.name)}/</b>
              {byDept(d.key).slice(0, 6).map((m) => <span key={m.kind + m.name} title={m.about || ""}>{slug(m.name)}.md</span>)}
              {byDept(d.key).length > 6 && <span className="ag-muted">+{byDept(d.key).length - 6} more</span>}</div>))}
          </div>
        </section>
        <section className="ag-sec wide">
          <span className="ag-num">06</span><b>Connected</b><span className="ag-muted">where the agents work</span>
          <div className="ag-tools">{tools.map((t, i) => (
            <span key={t.name} className={`ag-tool big ${t.ok ? "" : "off"}`}><i style={{ background: TOOL_COLORS[i % TOOL_COLORS.length] }}>{initials(t.name)}</i>{t.name}</span>))}
          </div>
        </section>
      </div>
    </div>
  );
}
