import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree, ThreeEvent } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { CityData, Department, Member, STATE_INFO, Trainee } from "./data";

// ---------------------------------------------------------------------------------------------------------------
// Inside a building: a cut-away office floor with one desk per member of that department.
// Everything comes from the live feed: a member types / hovers busily ONLY while a task is really running for it;
// waiting-for-you members stand and wave; idle ones lean back and rest. The line above each head is the member's
// real current task or Board card title ("doing"), or "Idle". Members away at the AI School leave an empty desk.
// Nothing is animated for show and no card numbers are shown (the feed strips them; clean() strips any stragglers).
// ---------------------------------------------------------------------------------------------------------------

const SPACING_X = 5.2, SPACING_Z = 4.6;
const clean = (s?: string) => (s || "").replace(/\s*\(?(card|to-do)?\s*#\s*\d+\)?/gi, "").trim();
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);
const keyOf = (m: { kind: string; name: string }) => m.kind + ":" + m.name;

export function doingKindWords(k?: string): string {
  if (!k) return "";
  if (k === "task_running") return "Task running right now";
  if (k === "task_queued") return "Task queued — starts soon";
  if (k === "task_retrying") return "Task retrying";
  if (k === "task_approved") return "Approved task — about to start";
  if (k === "card_waiting" || k === "card_ready_for_owner") return "Board card — waiting for your yes";
  if (k.startsWith("card_")) return "Board card · " + k.slice(5).replace(/_/g, " ");
  if (k.startsWith("task_")) return "Task · " + k.slice(5).replace(/_/g, " ");
  return k.replace(/_/g, " ");
}

type Seat = { m: Member; away: Trainee | null; x: number; z: number };

function layout(members: Member[], training: Trainee[], phone: boolean) {
  const n = Math.max(1, members.length);
  // landscape screens get a wide floor; a phone held upright gets a deep one (2 desks across)
  const cols = phone ? Math.min(n, 2) : n <= 3 ? n : n <= 8 ? Math.ceil(n / 2) : 4;
  const rows = Math.ceil(n / cols);
  const seats: Seat[] = members.map((m, i) => {
    const c = i % cols, r = Math.floor(i / cols);
    const away = training.find((t) => t.status !== "graduated" && keyOf(t) === keyOf(m)) ?? null;
    return { m, away, x: (c - (cols - 1) / 2) * SPACING_X, z: (r - (rows - 1) / 2) * SPACING_Z };
  });
  return { seats, W: cols * SPACING_X + 4, D: rows * SPACING_Z + 5 };
}

// ---------------------------------------------------------------------------------------------------------------
function Room({ W, D, color, night }: { W: number; D: number; color: string; night: boolean }) {
  const c = new THREE.Color(color);
  const wallH = 7;
  const nWin = Math.max(2, Math.floor(W / 6));
  return (
    <group>
      {/* floor + carpet in department colour */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow><planeGeometry args={[W, D]} />
        <meshStandardMaterial color={night ? "#3A4458" : "#C9CED6"} roughness={0.9} /></mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]} receiveShadow><planeGeometry args={[W - 2, D - 2]} />
        <meshStandardMaterial color={c.clone().multiplyScalar(night ? 0.38 : 0.5)} roughness={1} /></mesh>
      {/* cut-away: only the two back walls stand, so you look in from the open corner */}
      <mesh position={[0, wallH / 2, -D / 2]} receiveShadow><boxGeometry args={[W, wallH, 0.3]} />
        <meshStandardMaterial color={night ? "#2B3547" : "#E7EAF0"} /></mesh>
      <mesh position={[-W / 2, wallH / 2, 0]} receiveShadow><boxGeometry args={[0.3, wallH, D]} />
        <meshStandardMaterial color={night ? "#253042" : "#DCE0E8"} /></mesh>
      {/* neon trim along the wall tops + a stripe at desk height */}
      <mesh position={[0, wallH, -D / 2]}><boxGeometry args={[W, 0.25, 0.4]} /><meshStandardMaterial color={c} emissive={c} emissiveIntensity={night ? 1.6 : 0.5} /></mesh>
      <mesh position={[-W / 2, wallH, 0]}><boxGeometry args={[0.4, 0.25, D]} /><meshStandardMaterial color={c} emissive={c} emissiveIntensity={night ? 1.6 : 0.5} /></mesh>
      <mesh position={[0, 2.2, -D / 2 + 0.17]}><boxGeometry args={[W, 0.12, 0.05]} /><meshStandardMaterial color={c} emissive={c} emissiveIntensity={0.8} /></mesh>
      <mesh position={[-W / 2 + 0.17, 2.2, 0]}><boxGeometry args={[0.05, 0.12, D]} /><meshStandardMaterial color={c} emissive={c} emissiveIntensity={0.8} /></mesh>
      {/* windows in the back wall */}
      {Array.from({ length: nWin }, (_, i) => (
        <mesh key={i} position={[(i - (nWin - 1) / 2) * (W / nWin), 4.6, -D / 2 + 0.17]}>
          <planeGeometry args={[Math.min(3.6, W / nWin - 1), 2]} />
          <meshStandardMaterial color={night ? "#0B1630" : "#A9D2F5"} emissive={night ? "#1B2D5C" : "#6FAEE0"} emissiveIntensity={night ? 0.6 : 0.3} />
        </mesh>
      ))}
      {/* a plant in the corner */}
      <group position={[W / 2 - 1.2, 0, -D / 2 + 1.2]}>
        <mesh position={[0, 0.45, 0]}><cylinderGeometry args={[0.45, 0.35, 0.9, 10]} /><meshStandardMaterial color="#5B4636" /></mesh>
        <mesh position={[0, 1.6, 0]}><sphereGeometry args={[0.8, 10, 10]} /><meshStandardMaterial color="#3E9B5C" /></mesh>
      </group>
    </group>
  );
}

// One desk + chair + monitor. The monitor shows the member's real state: green flicker = working, amber = waiting
// for you, blue = queued, slate = has a card, dark = idle.
function Desk({ seat, picked, onPick, color, phone }: { seat: Seat; picked: boolean; onPick: (k: string) => void; color: string; phone: boolean }) {
  const { m, away } = seat;
  const st = away ? null : m.state;
  const screen = useRef<THREE.MeshStandardMaterial>(null);
  const sc = st === "running" ? "#3DDC97" : st === "waiting_for_you" ? "#FFC542" : st === "queued" ? "#4DA3FF" : st === "assigned" ? "#6F85A8" : "#0A0F18";
  useFrame(({ clock }) => {
    const mat = screen.current; if (!mat) return;
    const t = clock.elapsedTime;
    mat.emissiveIntensity = st === "running" ? 1.4 + Math.sin(t * 13 + seat.x) * 0.35 + Math.sin(t * 5.3) * 0.2
      : st === "waiting_for_you" ? 0.9 + Math.sin(t * 3) * 0.4 : st === "idle" || !st ? 0.05 : 0.8;
  });
  const click = (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onPick(keyOf(m)); };
  const ring = away ? "#2EE6D6" : STATE_INFO[m.state].color;
  return (
    <group position={[seat.x, 0, seat.z]} onClick={click}
      onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { document.body.style.cursor = "auto"; }}>
      {/* state ring on the floor (white when picked) */}
      <mesh rotation-x={-Math.PI / 2} position={[0.5, 0.04, 0]}>
        <ringGeometry args={[1.75, picked ? 2.05 : 1.9, 40]} />
        <meshBasicMaterial color={picked ? "#FFFFFF" : ring} transparent opacity={picked ? 0.95 : 0.55} />
      </mesh>
      {/* desk */}
      <mesh position={[-0.4, 1.0, 0]} castShadow receiveShadow><boxGeometry args={[1.4, 0.12, 2.6]} /><meshStandardMaterial color="#5E6B80" roughness={0.6} /></mesh>
      <mesh position={[-0.95, 0.5, -1.1]}><boxGeometry args={[0.1, 1, 0.1]} /><meshStandardMaterial color="#39424F" /></mesh>
      <mesh position={[-0.95, 0.5, 1.1]}><boxGeometry args={[0.1, 1, 0.1]} /><meshStandardMaterial color="#39424F" /></mesh>
      <mesh position={[0.15, 0.5, -1.1]}><boxGeometry args={[0.1, 1, 0.1]} /><meshStandardMaterial color="#39424F" /></mesh>
      <mesh position={[0.15, 0.5, 1.1]}><boxGeometry args={[0.1, 1, 0.1]} /><meshStandardMaterial color="#39424F" /></mesh>
      {/* monitor faces +x (toward the chair) */}
      <mesh position={[-0.85, 1.75, 0]}><boxGeometry args={[0.08, 0.95, 1.5]} /><meshStandardMaterial color="#1A1F29" /></mesh>
      <mesh position={[-0.8, 1.75, 0]} rotation-y={Math.PI / 2}><planeGeometry args={[1.38, 0.82]} />
        <meshStandardMaterial ref={screen} color={sc} emissive={sc} emissiveIntensity={0.5} /></mesh>
      <mesh position={[-0.85, 1.15, 0]}><boxGeometry args={[0.1, 0.25, 0.1]} /><meshStandardMaterial color="#1A1F29" /></mesh>
      {/* keyboard */}
      <mesh position={[-0.25, 1.08, 0]}><boxGeometry args={[0.35, 0.04, 0.9]} /><meshStandardMaterial color="#2A3140" /></mesh>
      {/* chair */}
      <group position={[0.85, 0, 0]}>
        <mesh position={[0, 0.65, 0]}><boxGeometry args={[0.8, 0.12, 0.8]} /><meshStandardMaterial color="#2B3446" /></mesh>
        <mesh position={[0.38, 1.15, 0]}><boxGeometry args={[0.1, 0.9, 0.8]} /><meshStandardMaterial color="#2B3446" /></mesh>
        <mesh position={[0, 0.32, 0]}><cylinderGeometry args={[0.06, 0.06, 0.6, 6]} /><meshStandardMaterial color="#555" /></mesh>
      </group>
      {away ? <AwayTag seat={seat} phone={phone} /> : m.kind === "agent" ? <Person m={m} color={color} seed={seat.x * 3 + seat.z} /> : <Drone m={m} color={color} seed={seat.x * 3 + seat.z} />}
      {!away && <Label m={m} picked={picked} onPick={onPick} phone={phone} />}
    </group>
  );
}

// An agent: a little person in the department's colour. Working = seated, typing fast. Queued / has a card =
// seated, reading. Waiting for you = standing beside the desk, waving. Idle = leaning back, resting.
function Person({ m, color, seed }: { m: Member; color: string; seed: number }) {
  const body = useRef<THREE.Group>(null), armL = useRef<THREE.Group>(null), armR = useRef<THREE.Group>(null), head = useRef<THREE.Mesh>(null);
  const st = m.state;
  const standing = st === "waiting_for_you";
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + seed;
    const b = body.current, l = armL.current, r = armR.current, h = head.current;
    if (!b || !l || !r || !h) return;
    if (st === "running") {                                        // typing
      b.rotation.z = 0.08; b.position.y = 0;
      l.rotation.z = -(1.25 + Math.sin(t * 18) * 0.12); r.rotation.z = -(1.25 + Math.sin(t * 18 + 1.7) * 0.12);
      h.rotation.z = 0.1 + Math.sin(t * 2.2) * 0.05; h.position.y = 1.62 + Math.abs(Math.sin(t * 9)) * 0.015;
    } else if (standing) {                                         // waving for your attention
      b.rotation.z = 0; b.position.y = 0;
      l.rotation.z = -(0.15); r.rotation.z = -(Math.PI - 0.35 + Math.sin(t * 6) * 0.35);
      h.rotation.z = 0; h.position.y = 1.62;
    } else if (st === "idle") {                                    // leaning back, slow breathing
      b.rotation.z = -0.38; b.position.y = Math.sin(t * 1.2) * 0.02;
      l.rotation.z = -(0.25); r.rotation.z = -(0.25);
      h.rotation.z = -0.15 + Math.sin(t * 0.6) * 0.06; h.position.y = 1.62;
    } else {                                                       // queued / has a card: reading the screen
      b.rotation.z = 0.04; b.position.y = 0;
      l.rotation.z = -(1.0); r.rotation.z = -(0.9 + Math.sin(t * 1.5) * 0.08);
      h.rotation.z = 0.05 + Math.sin(t * 0.8) * 0.04; h.position.y = 1.62;
    }
  });
  const shirt = <meshStandardMaterial color={color} roughness={0.7} />;
  const skin = <meshStandardMaterial color="#E7C3A0" roughness={0.8} />;
  // seated on the chair at x=+0.85 facing -x; standing = beside the desk, facing the open corner
  return (
    <group position={standing ? [1.0, 0, 1.55] : [0.8, 0.7, 0]} rotation-y={standing ? (3 * Math.PI) / 4 : 0}>
      {/* legs */}
      {standing ? (
        <><mesh position={[0, 0.45, -0.16]}><capsuleGeometry args={[0.12, 0.6, 3, 6]} /><meshStandardMaterial color="#2C3550" /></mesh>
          <mesh position={[0, 0.45, 0.16]}><capsuleGeometry args={[0.12, 0.6, 3, 6]} /><meshStandardMaterial color="#2C3550" /></mesh></>
      ) : (
        <><mesh position={[-0.3, 0.05, -0.16]} rotation-z={Math.PI / 2}><capsuleGeometry args={[0.12, 0.45, 3, 6]} /><meshStandardMaterial color="#2C3550" /></mesh>
          <mesh position={[-0.3, 0.05, 0.16]} rotation-z={Math.PI / 2}><capsuleGeometry args={[0.12, 0.45, 3, 6]} /><meshStandardMaterial color="#2C3550" /></mesh>
          <mesh position={[-0.55, -0.3, -0.16]}><capsuleGeometry args={[0.11, 0.4, 3, 6]} /><meshStandardMaterial color="#2C3550" /></mesh>
          <mesh position={[-0.55, -0.3, 0.16]}><capsuleGeometry args={[0.11, 0.4, 3, 6]} /><meshStandardMaterial color="#2C3550" /></mesh></>
      )}
      <group ref={body} position={[0, standing ? 0.85 : 0.15, 0]}>
        <mesh position={[0, 0.5, 0]} castShadow><capsuleGeometry args={[0.3, 0.5, 4, 8]} />{shirt}</mesh>
        {/* arms pivot at the shoulders; rotation.z swings them forward (-x) toward the keyboard */}
        <group ref={armL} position={[0, 0.85, -0.38]}><mesh position={[0, -0.32, 0]}><capsuleGeometry args={[0.09, 0.45, 3, 6]} />{shirt}</mesh></group>
        <group ref={armR} position={[0, 0.85, 0.38]}><mesh position={[0, -0.32, 0]}><capsuleGeometry args={[0.09, 0.45, 3, 6]} />{shirt}</mesh></group>
        <mesh ref={head} position={[0, 1.62, 0]} castShadow><sphereGeometry args={[0.27, 14, 14]} />{skin}</mesh>
      </group>
    </group>
  );
}

// A bot: a small drone. Working = hovering over the desk, spinning, bobbing fast. Waiting for you = hovering with a
// pulsing amber halo. Queued / has a card = hovering low and slow. Idle = docked on its charging pad.
function Drone({ m, color, seed }: { m: Member; color: string; seed: number }) {
  const g = useRef<THREE.Group>(null), ring = useRef<THREE.Mesh>(null), halo = useRef<THREE.Mesh>(null);
  const st = m.state;
  const c = STATE_INFO[st].color;
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + seed;
    const d = g.current, r = ring.current; if (!d || !r) return;
    if (st === "running") { d.position.set(0.3 + Math.sin(t * 1.3) * 0.25, 2.5 + Math.sin(t * 6) * 0.15, Math.cos(t * 1.1) * 0.35); r.rotation.z = t * 9; }
    else if (st === "waiting_for_you") { d.position.set(0.6, 2.4 + Math.sin(t * 2) * 0.1, 0); r.rotation.z = t * 2; }
    else if (st === "idle") { d.position.set(1.0, 0.55, 0); r.rotation.z = 0; }
    else { d.position.set(0.6, 1.9 + Math.sin(t * 1.4) * 0.08, 0); r.rotation.z = t * 1.2; }
    if (halo.current) (halo.current.material as THREE.MeshBasicMaterial).opacity = st === "waiting_for_you" ? 0.35 + Math.sin(t * 4) * 0.25 : 0;
  });
  const on = st !== "idle";
  return (
    <group>
      {/* charging pad on the floor beside the chair */}
      <mesh position={[1.0, 0.06, 0]}><cylinderGeometry args={[0.55, 0.6, 0.1, 18]} />
        <meshStandardMaterial color="#1E2635" emissive={st === "idle" ? "#2B5BFF" : "#000"} emissiveIntensity={0.6} /></mesh>
      <group ref={g} position={[1.0, 0.55, 0]}>
        <mesh castShadow><sphereGeometry args={[0.38, 16, 16]} /><meshStandardMaterial color={color} emissive={on ? color : "#000"} emissiveIntensity={on ? 0.6 : 0} metalness={0.4} roughness={0.35} /></mesh>
        <mesh position={[-0.3, 0.05, 0]}><sphereGeometry args={[0.13, 10, 10]} /><meshStandardMaterial color={c} emissive={c} emissiveIntensity={on ? 1.6 : 0.2} /></mesh>
        <mesh ref={ring} rotation-x={Math.PI / 2}><torusGeometry args={[0.62, 0.05, 6, 28]} /><meshStandardMaterial color="#AFC3E8" metalness={0.6} /></mesh>
        <mesh ref={halo}><sphereGeometry args={[0.85, 16, 16]} /><meshBasicMaterial color="#FFC542" transparent opacity={0} depthWrite={false} /></mesh>
      </group>
    </group>
  );
}

function AwayTag({ seat, phone }: { seat: Seat; phone: boolean }) {
  const t = seat.away!;
  return (
    <Html position={[0.6, 2.4, 0]} center zIndexRange={[30, 20]}>
      <div className={`in-label away${phone ? " compact" : ""}`}><b>{seat.m.name}</b><span>{phone ? "at the AI School" : t.status === "passed" ? "At the AI School · passed, waiting for your yes" : "At the AI School · in training"}</span></div>
    </Html>
  );
}

function Label({ m, picked, onPick, phone }: { m: Member; picked: boolean; onPick: (k: string) => void; phone: boolean }) {
  const c = STATE_INFO[m.state].color;
  const doing = clean(m.doing);
  const y = m.kind === "bot" ? (m.state === "idle" ? 2.6 : 3.9) : m.state === "waiting_for_you" ? 3.9 : 3.5;
  return (
    <Html position={[0.7, y, 0]} center style={{ transform: "translateY(-50%)" }} zIndexRange={[picked ? 40 : 30, 20]}>
      <button className={`in-label ${picked ? "sel" : ""} ${m.state}${phone && !picked ? " compact" : ""}`} style={{ borderColor: c }} onClick={(e) => { e.stopPropagation(); onPick(keyOf(m)); }}>
        <b><i style={{ background: c }} />{m.name}</b>
        <span>{doing ? clip(doing, phone ? (picked ? 40 : 22) : 46) : m.state === "idle" ? "Idle" : STATE_INFO[m.state].label}</span>
      </button>
    </Html>
  );
}

// Smallest camera distance (along dir) at which the whole room - floor and the two back walls - fits on screen.
function fitDistance(cam: THREE.PerspectiveCamera, dir: THREE.Vector3, target: THREE.Vector3, W: number, D: number) {
  const pts: THREE.Vector3[] = [];
  for (const x of [-W / 2, W / 2]) for (const z of [-D / 2, D / 2]) for (const y of [0, 3.6]) pts.push(new THREE.Vector3(x, y, z));
  pts.push(new THREE.Vector3(-W / 2, 7, -D / 2), new THREE.Vector3(W / 2, 7, -D / 2), new THREE.Vector3(-W / 2, 7, D / 2));
  const probe = cam.clone() as THREE.PerspectiveCamera;
  const fits = (d: number) => {
    probe.position.copy(target).addScaledVector(dir, d); probe.lookAt(target); probe.updateMatrixWorld(); probe.updateProjectionMatrix();
    return pts.every((p) => { const v = p.clone().project(probe); return Math.abs(v.x) <= 0.94 && Math.abs(v.y) <= 0.9; });
  };
  let lo = 4, hi = 400;
  for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (fits(mid)) hi = mid; else lo = mid; }
  return hi;
}

function Rig({ W, D, controls, phone }: { W: number; D: number; controls: React.RefObject<OrbitControlsImpl>; phone: boolean }) {
  const { camera, size } = useThree();
  const start = useRef(performance.now());
  const plan = useRef<{ dir: THREE.Vector3; dist: number } | null>(null);
  useEffect(() => { start.current = performance.now(); plan.current = null; }, [W, D, size.width, size.height, phone]);
  useFrame(() => {
    const c = controls.current; if (!c) return;
    const k = Math.min(1, (performance.now() - start.current) / 900);
    if (k >= 1 && plan.current) return;                          // after the dolly-in, the viewer is free to orbit
    const target = new THREE.Vector3(0, 1.2, 0);
    if (!plan.current) {
      // landscape: a classic three-quarter view from the open corner. Upright phone: steeper, looking down the long
      // side of the floor so the rows of desks run up the screen.
      const dir = (phone ? new THREE.Vector3(0.42, 1.75, 1) : new THREE.Vector3(1, 1.05, 1.15)).normalize();
      plan.current = { dir, dist: fitDistance(camera as THREE.PerspectiveCamera, dir, target, W, D) };
    }
    const { dir, dist } = plan.current;
    const e = 1 - Math.pow(1 - k, 3);
    camera.position.copy(target).addScaledVector(dir, dist * (2.2 - 1.2 * e));
    c.target.copy(target);
    c.update();
  });
  return null;
}

function Scene({ seats, W, D, dept, night, quality, picked, onPick, phone }: {
  seats: Seat[]; W: number; D: number; dept: Department; night: boolean; quality: "low" | "high";
  picked: string | null; onPick: (k: string | null) => void; phone: boolean;
}) {
  const controls = useRef<OrbitControlsImpl>(null);
  return (
    <>
      <color attach="background" args={[night ? "#060C18" : "#BFD6EC"]} />
      <hemisphereLight args={[night ? "#C8D4F0" : "#FFFFFF", night ? "#2A3346" : "#7A8070", night ? 1.25 : 1.3]} />
      <ambientLight intensity={night ? 0.35 : 0.3} />
      <directionalLight position={[18, 30, 22]} intensity={night ? 1.3 : 1.9} castShadow={quality === "high"} shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-30} shadow-camera-right={30} shadow-camera-top={30} shadow-camera-bottom={-30} />
      <pointLight position={[0, 6, 0]} color={dept.color} intensity={night ? 40 : 12} distance={40} />
      <group onPointerMissed={() => onPick(null)}>
        <Room W={W} D={D} color={dept.color} night={night} />
        {seats.map((s) => <Desk key={keyOf(s.m)} seat={s} picked={picked === keyOf(s.m)} onPick={onPick} color={dept.color} phone={phone} />)}
      </group>
      <OrbitControls ref={controls} makeDefault enableDamping enablePan={false} target={[0, 1.2, 0]}
        minPolarAngle={0.35} maxPolarAngle={1.25} minAzimuthAngle={0.05} maxAzimuthAngle={Math.PI / 2 - 0.05}
        minDistance={8} maxDistance={Math.max(W, D) * 4 + 20} />
      <Rig W={W} D={D} controls={controls} phone={phone} />
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------
export function Interior({ data, deptKey, night, quality, onClose, onAgent }: {
  data: CityData; deptKey: string; night: boolean; quality: "low" | "high"; onClose: () => void; onAgent?: (name: string) => void;
}) {
  const dept = data.departments.find((d) => d.key === deptKey);
  const members = useMemo(() => data.members.filter((m) => m.department === deptKey), [data, deptKey]);
  const training = data.training ?? [];
  const [phone, setPhone] = useState(() => matchMedia("(max-width: 700px)").matches);
  useEffect(() => {
    const q = matchMedia("(max-width: 700px)"); const f = () => setPhone(q.matches);
    q.addEventListener("change", f); return () => q.removeEventListener("change", f);
  }, []);
  const { seats, W, D } = useMemo(() => layout(members, training, phone), [members, training, phone]);
  const [picked, setPicked] = useState<string | null>(null);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopImmediatePropagation(); if (picked) setPicked(null); else onClose(); } };
    addEventListener("keydown", k, true); return () => removeEventListener("keydown", k, true);
  }, [picked, onClose]);
  if (!dept) return null;

  const seat = picked ? seats.find((s) => keyOf(s.m) === picked) ?? null : null;
  const working = dept.running, waiting = dept.waiting;           // same numbers as the building's sign in the city
  const away = seats.filter((s) => s.away).length;

  return (
    <div className="interior" role="dialog" aria-label={`Inside ${dept.building}`} style={{ ["--dc" as string]: dept.color }}>
      <div className="in-head">
        <div>
          <h2 style={{ color: dept.color }}>Inside {dept.building}</h2>
          <p className="muted">{dept.name} · {members.length} {members.length === 1 ? "member" : "members"} · {working} working now · {waiting} waiting for you{away ? ` · ${away} at the AI School` : ""}</p>
        </div>
        <button className="in-close" onClick={onClose} aria-label="Back to the city">← City</button>
      </div>
      <div className="in-stage">
        <Canvas resize={{ offsetSize: true }} shadows={quality === "high"} dpr={quality === "high" ? [1, 2] : 1} camera={{ position: [40, 38, 42], fov: 40, near: 0.5, far: 400 }}
          gl={{ antialias: quality === "high", powerPreference: "high-performance" }}>
          <Scene seats={seats} W={W} D={D} dept={dept} night={night} quality={quality} picked={picked} onPick={setPicked} phone={phone} />
        </Canvas>
        {!members.length && <div className="in-empty">Open lot — no agents work here yet.</div>}
      </div>
      <div className="in-roster" role="list">
        {seats.map((s) => {
          const c = s.away ? "#2EE6D6" : STATE_INFO[s.m.state].color;
          return (
            <button key={keyOf(s.m)} role="listitem" className={picked === keyOf(s.m) ? "on" : ""} onClick={() => setPicked(picked === keyOf(s.m) ? null : keyOf(s.m))}>
              <i style={{ background: c }} />{s.m.name}
            </button>
          );
        })}
      </div>
      {seat && <MemberCard seat={seat} data={data} onClose={() => setPicked(null)} onAgent={onAgent} />}
    </div>
  );
}

function MemberCard({ seat, data, onClose, onAgent }: { seat: Seat; data: CityData; onClose: () => void; onAgent?: (name: string) => void }) {
  const { m, away } = seat;
  const c = away ? "#2EE6D6" : STATE_INFO[m.state].color;
  const doing = clean(m.doing);
  const recent = (data.log ?? []).filter((l) => l.who === m.name).slice(0, 3);
  const counts = [m.running && `${m.running} running`, m.queued && `${m.queued} queued`, m.waiting && `${m.waiting} waiting for you`,
    m.on_card && `${m.on_card} Board card${m.on_card === 1 ? "" : "s"}`, m.ai_calls_10m && `${m.ai_calls_10m} AI calls in the last 10 min`,
    m.failed_24h && `${m.failed_24h} failed today`].filter(Boolean) as string[];
  const when = (s: string) => new Date(s).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  return (
    <aside className="in-card" style={{ borderColor: c }}>
      <button className="close" onClick={onClose} aria-label="Close">×</button>
      {onAgent && <button className="look-inside live-feed" onClick={() => onAgent(seat.m.name)}>Open live feed ›</button>}
      <h3><i style={{ background: c }} />{m.name}</h3>
      <p className="muted">{m.kind === "agent" ? "Agent" : "Bot"}{m.title ? ` · ${m.title}` : ""} · {away ? "At the AI School" : STATE_INFO[m.state].label}</p>
      {away ? (
        <div className="in-doing"><small>AI School</small>{away.status === "passed" ? "Passed its exam — waiting for your yes on the Board" : away.status === "failed" ? "Didn't pass yet — practising" : "In training"}{away.score != null ? ` · ${away.score}%` : ""}</div>
      ) : doing ? (
        <div className="in-doing" style={{ borderColor: c }}><small>{doingKindWords(m.doing_kind) || "Working on"}</small>{doing}</div>
      ) : (
        <div className="in-doing idle"><small>Right now</small>Idle — no task running and no Board card assigned.</div>
      )}
      {counts.length > 0 && <p className="muted">{counts.join(" · ")}</p>}
      {m.about && <p className="about">{m.about}</p>}
      {recent.length > 0 && (
        <div className="in-recent"><small>Latest work</small>
          <ul>{recent.map((l, i) => <li key={i}><time>{when(l.at)}</time><span>{clean(l.what)}</span><em className={`st ${l.status}`}>{l.status}</em></li>)}</ul>
        </div>
      )}
      {m.last_activity && <p className="muted">Last active {when(m.last_activity)}</p>}
    </aside>
  );
}
