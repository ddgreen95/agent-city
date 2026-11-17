import { Canvas } from "@react-three/fiber";
import { CityScene } from "./City";
import { CityData } from "./data";

export default function CityView(p: { data: CityData; selected: string | null; onSelect: (k: string | null) => void;
  night: boolean; quality: "low" | "high"; traffic: boolean; paused?: boolean }) {
  return (
    <Canvas frameloop={p.paused ? "never" : "always"} shadows={p.quality === "high"} dpr={p.quality === "high" ? [1, 2] : 1} camera={{ position: [128, 118, 148], fov: 45, near: 1, far: 900 }}
      gl={{ antialias: p.quality === "high", powerPreference: "high-performance" }}>
      <CityScene data={p.data} selected={p.selected} onSelect={p.onSelect} night={p.night} quality={p.quality} traffic={p.traffic} />
    </Canvas>
  );
}
