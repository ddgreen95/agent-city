import { useMemo, useRef } from "react";
import { useFrame, useThree, ThreeEvent } from "@react-three/fiber";
import { Html, OrbitControls, Stars } from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { atInstitute, CityData, Department, Member, STATE_INFO, Trainee } from "./data";
import { CFG } from "./config";

// ---------------------------------------------------------------------------------------------------------------
// City layout: blocks on a grid with streets between. Each department owns a block. Headquarters has
// the assistant's beacon on its roof; the AI School is where agents train and graduate.
// ---------------------------------------------------------------------------------------------------------------
export const BLOCK = 26;          // building plot size
export const STREET = 12;         // road width
const PITCH = BLOCK + STREET;

// Buildings are placed in the order the sample business lists its departments.
// Headquarters is always the centre, the AI School beside it.
const SLOTS: [number, number][] = [[0, -1], [-1, -1], [1, -1], [-2, -1], [2, -1], [-1, 0], [2, 0], [-2, 0],
  [-1, 1], [0, 1], [1, 1], [-2, 1], [2, 1], [-3, 0], [3, 0], [-3, -1], [3, -1], [-3, 1], [3, 1]];
let LOTS: Record<string, [number, number]> = { headquarters: [0, 0] };
export function layoutCity(keys: string[]) {
  const next: Record<string, [number, number]> = { headquarters: [0, 0] };
  keys.filter((k) => k !== "headquarters").forEach((k, i) => { next[k] = SLOTS[i] ?? [4 + i, 0]; });
  LOTS = next;
}
export const INSTITUTE_LOT: [number, number] = [1, 0];
const SCENERY_LOTS: [number, number][] = [];   // every block is a department now (the ring road runs round the edge)

export const lotPos = ([c, r]: [number, number]) => new THREE.Vector3(c * PITCH, 0, r * PITCH);
export const deptPos = (key: string) => lotPos(LOTS[key] ?? [3, 0]);

function heightFor(d: Department) {
  if (d.key === "headquarters") return 46 + d.members * 3;
  return 12 + Math.min(d.members, 10) * 3.2;
}

// ---------------------------------------------------------------------------------------------------------------
function Ground({ night }: { night: boolean }) {
  const lines = useMemo(() => {
    const out: { x: number; z: number; rot: number }[] = [];
    for (let c = -3; c <= 3; c++) for (let s = -3; s <= 3; s++) {
      for (let k = -2; k <= 2; k++) {
        out.push({ x: c * PITCH + PITCH / 2, z: s * PITCH + k * 6, rot: 0 });              // north-south streets
        out.push({ x: s * PITCH + k * 6, z: c * PITCH + PITCH / 2, rot: Math.PI / 2 });    // east-west streets
      }
    }
    return out;
  }, []);
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[2400, 2400]} />
        <meshStandardMaterial color={night ? "#0A1222" : "#3B4452"} roughness={0.95} />
      </mesh>
      {/* sidewalks / plots */}
      {Array.from({ length: 7 }, (_, i) => i - 3).flatMap((c) => Array.from({ length: 7 }, (_, j) => j - 3).map((r) => (
        <mesh key={`p${c}${r}`} position={[c * PITCH, 0.05, r * PITCH]} rotation-x={-Math.PI / 2} receiveShadow>
          <planeGeometry args={[BLOCK + 4, BLOCK + 4]} />
          <meshStandardMaterial color={night ? "#131E33" : "#7C8798"} roughness={0.9} />
        </mesh>
      )))}
      {/* lane dashes */}
      {lines.map((l, i) => (
        <mesh key={i} position={[l.x, 0.08, l.z]} rotation={[-Math.PI / 2, 0, l.rot]}>
          <planeGeometry args={[0.35, 2.4]} />
          <meshBasicMaterial color={night ? "#5C6E8F" : "#E8E2C8"} />
        </mesh>
      ))}
    </group>
  );
}

function StreetLights({ night }: { night: boolean }) {
  const posts = useMemo(() => {
    const p: [number, number][] = [];
    for (let c = -3; c <= 2; c++) for (let r = -3; r <= 2; r++) p.push([c * PITCH + PITCH / 2, r * PITCH + PITCH / 2]);
    return p;
  }, []);
  return (
    <group>
      {posts.map(([x, z], i) => (
        <group key={i} position={[x - STREET / 2 + 1, 0, z - STREET / 2 + 1]}>
          <mesh position={[0, 2.5, 0]}><cylinderGeometry args={[0.12, 0.15, 5, 6]} /><meshStandardMaterial color="#334" /></mesh>
          <mesh position={[0, 5.1, 0]}><sphereGeometry args={[0.35, 10, 10]} />
            <meshStandardMaterial color="#FFE7B0" emissive="#FFD27A" emissiveIntensity={night ? 3 : 0.2} /></mesh>
        </group>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// A department building: tower + one window per member (lit by real state) + neon sign + people at the door.
function Building({ dept, members, selected, onSelect, night }: {
  dept: Department; members: Member[]; selected: boolean; onSelect: (k: string) => void; night: boolean;
}) {
  const pos = deptPos(dept.key);
  const h = heightFor(dept), w = dept.key === "headquarters" ? 16 : 14, d = w;
  const base = new THREE.Color(dept.color);
  const glass = base.clone().multiplyScalar(night ? 0.42 : 0.55);
  const click = (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onSelect(dept.key); };

  // window slots: 3 columns x floors on the two faces that face the camera (south +z and east +x)
  const floors = Math.max(3, Math.floor(h / 4));
  const slots = useMemo(() => {
    const s: { p: [number, number, number]; r: number }[] = [];
    for (let f = 0; f < floors; f++) for (let col = 0; col < 3; col++) {
      const y = 3 + f * 4;
      s.push({ p: [-w / 2 + 2.5 + col * ((w - 5) / 2), y, d / 2 + 0.06], r: 0 });
      s.push({ p: [w / 2 + 0.06, y, d / 2 - 2.5 - col * ((d - 5) / 2)], r: Math.PI / 2 });
    }
    return s;
  }, [floors, w, d]);

  return (
    <group position={pos}>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow onClick={click}
        onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { document.body.style.cursor = "auto"; }}>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={glass} metalness={0.45} roughness={0.3}
          emissive={base} emissiveIntensity={selected ? 0.35 : night ? 0.12 : 0.04} />
      </mesh>
      {/* neon edges in the department colour */}
      <lineSegments position={[0, h / 2, 0]}>
        <edgesGeometry args={[new THREE.BoxGeometry(w + 0.05, h + 0.05, d + 0.05)]} />
        <lineBasicMaterial color={base} transparent opacity={night ? 0.95 : 0.5} />
      </lineSegments>
      {/* roof trim in department colour */}
      <mesh position={[0, h + 0.4, 0]}><boxGeometry args={[w + 0.6, 0.8, d + 0.6]} />
        <meshStandardMaterial color={base} emissive={base} emissiveIntensity={night ? 1.4 : 0.3} /></mesh>
      {/* windows: the first N belong to members; colour = their real state. The rest stay dark. */}
      {slots.map((s, i) => {
        const m = members[i];
        const c = m ? STATE_INFO[m.state].color : "#0B1424";
        const lit = m && m.state !== "idle";
        return (
          <mesh key={i} position={s.p} rotation-y={s.r}>
            <planeGeometry args={[2.6, 2]} />
            <meshStandardMaterial color={c} emissive={lit ? c : m ? "#16243A" : "#000"} emissiveIntensity={lit ? 2.2 : 0.6} />
          </mesh>
        );
      })}
      <People members={members} radius={(w / 2 + 3) / 1.8} selected={selected} />
      <Html position={[0, h + 4, 0]} center distanceFactor={88} zIndexRange={[10, 0]}>
        <button className={`sign ${selected ? "sel" : ""} ${dept.busy ? "busy" : ""}`} style={{ borderColor: dept.color, color: dept.color }}
          onClick={() => onSelect(dept.key)}>
          {dept.building}<small>{members.length} here{dept.members > members.length ? ` · ${dept.members - members.length} in training` : ""}{dept.running ? ` · ${dept.running} working` : ""}{dept.waiting ? ` · ${dept.waiting} waiting` : ""}</small>
        </button>
      </Html>
    </group>
  );
}

// The team outside the lobby, one figure per member: AGENTS are people, BOTS are hovering drones.
// Only members that are REALLY working move: a working agent walks laps of the sidewalk around its building (legs
// swinging, facing where it walks), a working drone circles overhead. Everyone else stands at the door.
// A speech bubble says what each one is doing, in words, from the real feed ("doing" = its live task or Board card).
// Nothing is invented: no "doing" text -> no bubble.
const MAX_FIGS = 12;
const BUBBLES_UNSELECTED = 2;               // keep the skyline readable; select a building to see every bubble
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

function walkPoint(k: number, R: number): [number, number, number] {   // lap of a square sidewalk, k in [0,1)
  const s = (k % 1) * 4, side = Math.floor(s), f = s - side, a = -R + 2 * R * f;
  const pts: [number, number, number][] = [[a, R, 0], [R, -a, Math.PI / 2], [-a, -R, Math.PI], [-R, a, -Math.PI / 2]];
  return pts[side];                                                    // [x, z, heading]
}

function People({ members, radius, selected }: { members: Member[]; radius: number; selected: boolean }) {
  const figs = useRef<(THREE.Group | null)[]>([]);
  const legs = useRef<(THREE.Group | null)[]>([]);
  const shown = members.slice(0, MAX_FIGS);
  const R = radius * 1.08;
  // which bubbles to show: the selected building shows all; otherwise the first few working / waiting ones
  const bubbleFor = useMemo(() => {
    const prio = (m: Member) => (m.state === "running" ? 0 : m.state === "waiting_for_you" ? 1 : 2);
    const order = shown.map((m, i) => ({ m, i })).filter(({ m }) => m.doing).sort((x, y) => prio(x.m) - prio(y.m));
    return new Set(order.slice(0, selected ? MAX_FIGS : BUBBLES_UNSELECTED).map(({ i }) => i));
  }, [shown, selected]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    shown.forEach((m, i) => {
      const g = figs.current[i]; if (!g) return;
      const walking = m.state === "running";
      if (m.kind === "bot") {
        if (walking) {
          const a = t * 0.5 + i * 1.3;
          g.position.set(Math.cos(a) * R * 0.8, 4.2 + Math.sin(t * 3 + i) * 0.5, Math.sin(a) * R * 0.8);
          g.rotation.y = t * 3;
        }
        return;
      }
      if (walking) {
        const [x, z, h] = walkPoint(t * 0.035 + i * 0.27, R);
        g.position.set(x, Math.abs(Math.sin(t * 7 + i)) * 0.12, z);
        g.rotation.y = h + Math.PI / 2;
        const l = legs.current[i];
        if (l) { l.children[0].rotation.x = Math.sin(t * 7 + i) * 0.7; l.children[1].rotation.x = -Math.sin(t * 7 + i) * 0.7; }
      }
    });
  });

  return (
    <group scale={1.8}>
      {shown.map((m, i) => {
        const a = -Math.PI / 4 + (i - (shown.length - 1) / 2) * 0.28;
        const home: [number, number, number] = [Math.sin(a) * radius, m.kind === "bot" ? 2.6 : 0, Math.cos(a) * radius];
        const c = STATE_INFO[m.state].color, on = m.state !== "idle";
        const mat = <meshStandardMaterial color={c} emissive={on ? c : "#000"} emissiveIntensity={on ? 0.9 : 0} />;
        return (
          <group key={m.kind + m.name} position={home} ref={(el) => { figs.current[i] = el; }}>
            {m.kind === "agent" ? (
              <>
                <group ref={(el) => { legs.current[i] = el; }} position={[0, 0.7, 0]}>
                  <mesh position={[-0.18, -0.35, 0]}><capsuleGeometry args={[0.13, 0.45, 3, 6]} />{mat}</mesh>
                  <mesh position={[0.18, -0.35, 0]}><capsuleGeometry args={[0.13, 0.45, 3, 6]} />{mat}</mesh>
                </group>
                <mesh position={[0, 1.15, 0]} castShadow><capsuleGeometry args={[0.38, 0.55, 4, 8]} />{mat}</mesh>
                <mesh position={[0, 2.05, 0]} castShadow><sphereGeometry args={[0.34, 12, 12]} />{mat}</mesh>
              </>
            ) : (
              <>
                <mesh castShadow><sphereGeometry args={[0.5, 14, 14]} />{mat}</mesh>
                <mesh rotation-x={Math.PI / 2}><torusGeometry args={[0.9, 0.08, 6, 24]} />{mat}</mesh>
              </>
            )}
            {bubbleFor.has(i) && m.doing && (
              <Html position={[0, m.kind === "bot" ? 1.8 : 3.1, 0]} center distanceFactor={60} zIndexRange={[30, 20]}>
                <div className="bubble" style={{ borderColor: c }} title={`${m.name}: ${m.doing}`}>
                  <b style={{ color: c }}>{m.name}</b>{clip(m.doing, selected ? 70 : 44)}
                </div>
              </Html>
            )}
          </group>
        );
      })}
    </group>
  );
}

function EmptyLot({ dept, selected, onSelect }: { dept: Department; selected: boolean; onSelect: (k: string) => void }) {
  const pos = deptPos(dept.key);
  return (
    <group position={pos}>
      <mesh position={[0, 0.12, 0]} rotation-x={-Math.PI / 2} onClick={(e) => { e.stopPropagation(); onSelect(dept.key); }}>
        <ringGeometry args={[9, 10, 4, 1, Math.PI / 4]} />
        <meshBasicMaterial color={dept.color} transparent opacity={selected ? 1 : 0.6} />
      </mesh>
      <mesh position={[0, 1.2, 0]}><boxGeometry args={[0.3, 2.4, 0.3]} /><meshStandardMaterial color="#556" /></mesh>
      <Html position={[0, 5, 0]} center distanceFactor={88} zIndexRange={[10, 0]}>
        <button className={`sign lot ${selected ? "sel" : ""}`} style={{ borderColor: dept.color, color: dept.color }} onClick={() => onSelect(dept.key)}>
          {dept.building}<small>open lot · no agents yet</small>
        </button>
      </Html>
    </group>
  );
}

// The assistant's beacon over headquarters: a glowing orb that pulses faster while agents are working.
function OrbSvg({ thinking }: { thinking: boolean }) {
  return <div className={`beacon-orb ${thinking ? "thinking" : ""}`}><i /><i /><i /></div>;
}

function BeaconOrb({ height, thinking }: { height: number; thinking: boolean }) {
  return (
    <group position={deptPos("headquarters")}>
      <mesh position={[0, height + 3, 0]}><cylinderGeometry args={[0.35, 0.7, 6, 10]} /><meshStandardMaterial color="#9BB8FF" metalness={0.85} roughness={0.2} /></mesh>
      <pointLight position={[0, height + 12, 0]} color="#8FA8FF" intensity={120} distance={90} />
      <Html position={[0, height + 14, 0]} center distanceFactor={70} zIndexRange={[20, 10]}>
        <div className="beacon-holder">
          <OrbSvg thinking={thinking} />
          <div className="sign beacon">{CFG.assistantName}<small>sees the whole city</small></div>
        </div>
      </Html>
    </group>
  );
}

// The AI Institute: a glass classroom. Desks fill with whoever is REALLY in training (data.training); a trainee
// that passed waits at the front for your yes. Empty desks when nobody is training.
function Institute({ night, training, onSelect, selected }: {
  night: boolean; training: Trainee[]; onSelect: (k: string) => void; selected: boolean;
}) {
  const p = lotPos(INSTITUTE_LOT);
  const desks = 12;
  return (
    <group position={p}>
      <mesh position={[0, 7, 0]} castShadow onClick={(e) => { e.stopPropagation(); onSelect("institute"); }}>
        <boxGeometry args={[20, 14, 16]} />
        <meshPhysicalMaterial color={night ? "#0E3346" : "#5C8FAE"} transparent opacity={0.32} roughness={0.05} metalness={0.1}
          emissive={selected ? "#2EE6D6" : "#000"} emissiveIntensity={selected ? 0.25 : 0} />
      </mesh>
      <mesh position={[0, 14.4, 0]}><boxGeometry args={[20.6, 0.8, 16.6]} /><meshStandardMaterial color="#2EE6D6" emissive="#2EE6D6" emissiveIntensity={night ? 1.5 : 0.3} /></mesh>
      <mesh position={[0, 0.1, 0]}><boxGeometry args={[19.6, 0.2, 15.6]} /><meshStandardMaterial color="#13202F" /></mesh>
      {/* big screen at the front of the class */}
      <mesh position={[0, 6, -7.6]}><planeGeometry args={[12, 5]} /><meshStandardMaterial color="#061A26" emissive="#2EE6D6" emissiveIntensity={0.35} /></mesh>
      {Array.from({ length: desks }, (_, i) => {
        const x = -6.6 + (i % 4) * 4.4, z = -3.5 + Math.floor(i / 4) * 4.2;
        const tr = training[i];
        const c = tr ? (tr.status === "passed" ? "#FFC542" : "#2EE6D6") : "#22374A";
        return (
          <group key={i} position={[x, 0, z]}>
            <mesh position={[0, 1.1, 0]}><boxGeometry args={[2.6, 0.2, 1.4]} /><meshStandardMaterial color="#2A4258" /></mesh>
            <mesh position={[0, 1.6, -0.5]}><boxGeometry args={[1.2, 0.8, 0.08]} /><meshStandardMaterial color={c} emissive={tr ? c : "#000"} emissiveIntensity={tr ? 1.2 : 0} /></mesh>
            {tr && (tr.kind === "bot"
              ? <mesh position={[0, 2.6, 0.9]}><sphereGeometry args={[0.45, 12, 12]} /><meshStandardMaterial color={c} emissive={c} emissiveIntensity={0.9} /></mesh>
              : <group position={[0, 0, 0.9]}>
                  <mesh position={[0, 0.85, 0]}><capsuleGeometry args={[0.38, 0.7, 4, 8]} /><meshStandardMaterial color={c} emissive={c} emissiveIntensity={0.8} /></mesh>
                  <mesh position={[0, 1.85, 0]}><sphereGeometry args={[0.32, 10, 10]} /><meshStandardMaterial color={c} emissive={c} emissiveIntensity={0.8} /></mesh>
                </group>)}
          </group>
        );
      })}
      <Html position={[0, 18, 0]} center distanceFactor={88} zIndexRange={[10, 0]}>
        <button className={`sign ${selected ? "sel" : ""}`} style={{ borderColor: "#2EE6D6", color: "#2EE6D6" }} onClick={() => onSelect("institute")}>
          AI School<small>{training.length ? `${training.length} in training` : "no one in training right now"} · graduation needs your yes</small>
        </button>
      </Html>
    </group>
  );
}

function Scenery({ night }: { night: boolean }) {
  return (
    <group>
      {SCENERY_LOTS.map((l, i) => {
        const p = lotPos(l);
        return (
          <group key={i} position={p}>
            <mesh position={[0, 0.1, 0]} rotation-x={-Math.PI / 2}><planeGeometry args={[BLOCK, BLOCK]} /><meshStandardMaterial color={night ? "#0F2A1E" : "#3F7D4F"} /></mesh>
            {Array.from({ length: 7 }, (_, t) => (
              <group key={t} position={[Math.sin(t * 2.1) * 8, 0, Math.cos(t * 1.7) * 8]}>
                <mesh position={[0, 1.5, 0]}><cylinderGeometry args={[0.25, 0.3, 3, 6]} /><meshStandardMaterial color="#4A3524" /></mesh>
                <mesh position={[0, 4, 0]} castShadow><coneGeometry args={[1.8, 4, 8]} /><meshStandardMaterial color={night ? "#1F5A3A" : "#3E9B5C"} /></mesh>
              </group>
            ))}
          </group>
        );
      })}
    </group>
  );
}

// Scenery traffic on the ring road (cars are scenery, not agents - the legend says so)
function Traffic({ count }: { count: number }) {
  const cars = useRef<THREE.Group>(null);
  const loop = 3 * PITCH;
  useFrame(({ clock }) => {
    const g = cars.current; if (!g) return;
    g.children.forEach((car, i) => {
      const t = ((clock.elapsedTime * (0.018 + (i % 3) * 0.004) + i / count) % 1) * 4;
      const side = Math.floor(t), f = t - side, L = loop - PITCH / 2, a = -L, b = L, lane = i % 2 ? 2.5 : -2.5;
      const pts: [number, number][] = [[a + (b - a) * f, a - PITCH / 2 + lane], [b + PITCH / 2 - lane, a + (b - a) * f],
        [b - (b - a) * f, b + PITCH / 2 - lane], [a - PITCH / 2 + lane, b - (b - a) * f]];
      const [x, z] = pts[side];
      car.position.set(x, 0.7, z);
      car.rotation.y = [0, -Math.PI / 2, Math.PI, Math.PI / 2][side];
    });
  });
  return (
    <group ref={cars}>
      {Array.from({ length: count }, (_, i) => (
        <mesh key={i} castShadow>
          <boxGeometry args={[3, 1.2, 1.6]} />
          <meshStandardMaterial color={["#E94F37", "#F6F7EB", "#3F88C5", "#FFBA08"][i % 4]} metalness={0.5} roughness={0.4} />
        </mesh>
      ))}
    </group>
  );
}

// A graduate walks from the AI Institute to its new building (shown for an hour after the owner's yes), with a banner.
function Graduate({ t }: { t: Trainee }) {
  const fig = useRef<THREE.Group>(null);
  const from = lotPos(INSTITUTE_LOT), to = deptPos(t.department);
  useFrame(({ clock }) => {
    const g = fig.current; if (!g) return;
    const k = (clock.elapsedTime % 10) / 10;                       // walk the route every 10 s
    const mid = new THREE.Vector3(to.x, 0, from.z);                 // along the street: east-west, then north-south
    const p = k < 0.5 ? from.clone().lerp(mid, k * 2) : mid.clone().lerp(to, (k - 0.5) * 2);
    g.position.set(p.x + 6, Math.abs(Math.sin(clock.elapsedTime * 6)) * 0.3, p.z + 6);
  });
  return (
    <group ref={fig}>
      <group scale={2}>
        {t.kind === "bot"
          ? <mesh position={[0, 2.2, 0]}><sphereGeometry args={[0.5, 14, 14]} /><meshStandardMaterial color="#FFC542" emissive="#FFC542" emissiveIntensity={1.2} /></mesh>
          : <><mesh position={[0, 0.85, 0]}><capsuleGeometry args={[0.42, 0.8, 4, 8]} /><meshStandardMaterial color="#FFC542" emissive="#FFC542" emissiveIntensity={1} /></mesh>
              <mesh position={[0, 1.95, 0]}><sphereGeometry args={[0.36, 12, 12]} /><meshStandardMaterial color="#FFC542" emissive="#FFC542" emissiveIntensity={1} /></mesh></>}
      </group>
      <Html position={[0, 7, 0]} center distanceFactor={88} zIndexRange={[30, 20]}><div className="sign grad">◆ Graduation<small>{t.name} joins its building</small></div></Html>
    </group>
  );
}

// fly the camera to the selected building
function CameraRig({ target, controls }: { target: THREE.Vector3 | null; controls: React.RefObject<OrbitControlsImpl> }) {
  const { camera } = useThree();
  const goal = useRef<THREE.Vector3 | null>(null);
  const last = useRef<string>("");
  useFrame(() => {
    const c = controls.current; if (!c || !target) return;
    const key = target.toArray().join(",");
    if (key !== last.current) { last.current = key; goal.current = target.clone(); }
    if (!goal.current) return;
    c.target.lerp(goal.current, 0.06);
    const want = goal.current.clone().add(new THREE.Vector3(22, 70, 42));
    camera.position.lerp(want, 0.04);
    if (c.target.distanceTo(goal.current) < 0.3) goal.current = null;
    c.update();
  });
  return null;
}

export function CityScene({ data, selected, onSelect, night, quality, traffic }: {
  data: CityData; selected: string | null; onSelect: (k: string | null) => void; night: boolean;
  quality: "low" | "high"; traffic: boolean;
}) {
  layoutCity(data.departments.map((d) => d.key));
  const controls = useRef<OrbitControlsImpl>(null);
  const hq = data.departments.find((d) => d.key === "headquarters");
  const target = selected ? (selected === "institute" ? lotPos(INSTITUTE_LOT) : deptPos(selected)).clone().setY(10) : null;
  return (
    <>
      <color attach="background" args={[night ? "#040914" : "#9CC4E8"]} />
      <fog attach="fog" args={[night ? "#040914" : "#9CC4E8", 160, 420]} />
      {night && <Stars radius={300} depth={60} count={quality === "high" ? 4000 : 1200} factor={4} fade />}
      <hemisphereLight args={[night ? "#5A72B0" : "#DDEBFF", night ? "#0A1020" : "#5C6B52", night ? 1.0 : 1.1]} />
      <directionalLight position={[80, 140, 60]} intensity={night ? 0.5 : 2.2} color={night ? "#9DB4FF" : "#FFF4DE"}
        castShadow={quality === "high"} shadow-mapSize={[2048, 2048]} shadow-camera-left={-160} shadow-camera-right={160}
        shadow-camera-top={160} shadow-camera-bottom={-160} />
      <group onPointerMissed={() => onSelect(null)}>
        <Ground night={night} />
        <StreetLights night={night} />
        <Scenery night={night} />
        <Institute night={night} training={(data.training ?? []).filter((t) => t.status !== "graduated")} onSelect={onSelect} selected={selected === "institute"} />
        {data.departments.map((d) => {
          const away = atInstitute(data);
          const ms = data.members.filter((m) => m.department === d.key && !away.has(m.kind + ":" + m.name));
          return d.empty
            ? <EmptyLot key={d.key} dept={d} selected={selected === d.key} onSelect={onSelect} />
            : <Building key={d.key} dept={d} members={ms} selected={selected === d.key} onSelect={onSelect} night={night} />;
        })}
        {hq && <BeaconOrb height={heightFor(hq)} thinking={data.totals.running > 0} />}
        {(data.training ?? []).filter((t) => t.status === "graduated").map((t) => <Graduate key={t.kind + t.name} t={t} />)}
        {traffic && <Traffic count={quality === "high" ? 14 : 6} />}
      </group>
      <OrbitControls ref={controls} makeDefault enableDamping maxPolarAngle={Math.PI / 2.15} minDistance={25} maxDistance={330} />
      <CameraRig target={target} controls={controls} />
    </>
  );
}
