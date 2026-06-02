import { useRef, useEffect, useState, useCallback } from "react";
import { createWorld, tick, applyGodPower, spawnCreature, type GodPower, type Species } from "./engine/world";
import { renderWorld } from "./engine/renderer";
import gsap from "gsap";

const GOD_TOOLS: { power: GodPower; icon: string; label: string; key: string }[] = [
  { power: "bless", icon: "✨", label: "Bless", key: "q" },
  { power: "rain", icon: "🌧️", label: "Rain", key: "w" },
  { power: "smite", icon: "⚡", label: "Smite", key: "e" },
  { power: "heal", icon: "💚", label: "Heal", key: "r" },
  { power: "fire", icon: "🔥", label: "Fire", key: "t" },
  { power: "plague", icon: "🦠", label: "Plague", key: "y" },
  { power: "terraform", icon: "🏔️", label: "Terra", key: "u" },
  { power: "lightning", icon: "💀", label: "Bolt", key: "i" },
];

const SPAWN_CHOICES: { species: Species; icon: string; label: string }[] = [
  { species: "tree", icon: "🌳", label: "Tree" },
  { species: "rabbit", icon: "🐰", label: "Rabbit" },
  { species: "deer", icon: "🦌", label: "Deer" },
  { species: "wolf", icon: "🐺", label: "Wolf" },
  { species: "human", icon: "👤", label: "Human" },
];

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef(createWorld());
  const [world, setWorld] = useState(worldRef.current);
  const [power, setPower] = useState<GodPower>("smite");
  const [species, setSpecies] = useState<Species>("rabbit");
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [info, setInfo] = useState<any>(null);
  const [hovered, setHovered] = useState<number | null>(null);

  // Tick
  useEffect(() => {
    if (paused) return;
    const interval = setInterval(() => {
      const next = tick(worldRef.current);
      worldRef.current = next;
      setWorld(next);
    }, 400 / speed);
    return () => clearInterval(interval);
  }, [paused, speed]);

  // Render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    renderWorld(canvas, world, cursor, hovered);
  }, [world, cursor, hovered]);

  // God power on click
  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const scale = (100 * 8) / rect.width;
    const gx = Math.floor((e.clientX - rect.left) * scale / 8);
    const gy = Math.floor((e.clientY - rect.top) * scale / 8);
    const cList = world.creatures.filter((o) => Math.floor(o.x) === gx && Math.floor(o.y) === gy);
    if (cList.length > 0) {
      setInfo({ x: gx, y: gy, creatures: cList, cell: world.cells[gy]?.[gx] });
    } else {
      // Fire god power on empty tile — shake + flash
      const container = containerRef.current;
      const flash = flashRef.current;
      if (container) gsap.to(container, { x: 3, y: 2, duration: 0.04, repeat: 4, yoyo: true, onComplete: () => gsap.set(container, { x: 0, y: 0 }) });
      if (flash) gsap.fromTo(flash, { opacity: 0.6 }, { opacity: 0, duration: 0.5 });
      const next = applyGodPower(worldRef.current, power, gx, gy);
      worldRef.current = next;
      setWorld({ ...next });
    }
  }, [world, power]);

  const handleSpawn = useCallback(() => {
    if (!cursor) return;
    const next = spawnCreature(worldRef.current, species, cursor.x, cursor.y);
    worldRef.current = next;
    setWorld({ ...next });
  }, [cursor, species]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tool = GOD_TOOLS.find((t) => t.key === e.key);
      if (tool) setPower(tool.power);
      if (e.key === " ") { e.preventDefault(); setPaused((p) => !p); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const pop = Object.fromEntries(
    ["tree", "rabbit", "deer", "wolf", "human"].map((s) => [s, world.creatures.filter((c) => c.species === s).length])
  );

  const seasonName = ["Winter", "Spring", "Summer", "Autumn"][world.season % 4];

  return (
    <div style={{ display: "flex", height: "100vh", background: "#0a0a12", fontFamily: "system-ui, sans-serif", overflow: "hidden", userSelect: "none" }}>
      {/* Canvas */}
      <div ref={containerRef} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", background: "#000" }}>
        <div ref={flashRef} style={{ position: "absolute", inset: 0, background: "#fff", pointerEvents: "none", opacity: 0, zIndex: 20 }} />
        <canvas ref={canvasRef}
          onClick={handleClick}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const scale = (100 * 8) / rect.width;
            const gx = Math.floor((e.clientX - rect.left) * scale / 8);
            const gy = Math.floor((e.clientY - rect.top) * scale / 8);
            setCursor({ x: gx, y: gy });
            const c = world.creatures.find((o) => Math.floor(o.x) === gx && Math.floor(o.y) === gy);
            setHovered(c?.id ?? null);
          }}
          onMouseLeave={() => { setCursor(null); setHovered(null); }}
          style={{ imageRendering: "pixelated", maxWidth: "100%", maxHeight: "100%", objectFit: "contain", cursor: "crosshair" }} />

        {/* HUD top-left: population */}
        <div style={{ position: "absolute", top: 10, left: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
          {Object.entries(pop).map(([s, n]) => (
            <span key={s} style={{ fontSize: 10, padding: "3px 8px", borderRadius: 5, background: "rgba(0,0,0,0.7)", color: "#e4e4e7", fontFamily: "monospace" }}>{s}: {n}</span>
          ))}
        </div>

        {/* HUD top-right: season + speed */}
        <div style={{ position: "absolute", top: 10, right: 10, display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 10, color: "#71717a", fontFamily: "monospace" }}>{seasonName} · Tick {world.tick}</span>
          <button onClick={() => setPaused(!paused)} style={ctrlBtn}>{paused ? "▶" : "⏸"}</button>
          {[1, 3, 10].map((s) => (
            <button key={s} onClick={() => setSpeed(s)} style={{ ...ctrlBtn, opacity: speed === s ? 1 : 0.5 }}>{s}×</button>
          ))}
        </div>

        {/* HUD center: active power */}
        <div style={{ position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)", fontSize: 13, color: "#e4e4e7", background: "rgba(0,0,0,0.7)", padding: "6px 16px", borderRadius: 8, fontFamily: "monospace" }}>
          {GOD_TOOLS.find((t) => t.power === power)?.icon} {power.toUpperCase()} — click on world to unleash
        </div>

        {/* Info tooltip */}
        {info && (
          <div style={{ position: "absolute", bottom: 50, left: 10, padding: 10, borderRadius: 8, background: "rgba(0,0,0,0.85)", color: "#e4e4e7", fontSize: 10, fontFamily: "monospace", maxWidth: 260 }}>
            <div style={{ marginBottom: 4 }}>📍 ({info.x},{info.y}) {info.cell?.terrain} · moist:{info.cell?.moisture} · fert:{info.cell?.fertility}</div>
            {info.creatures.map((cr: any) => (
              <div key={cr.id} style={{ marginBottom: 1 }}>🐾 {cr.species}#{cr.id} ❤️{cr.health} age:{cr.age} 🍖{cr.hunger} {cr.settlementId ? `🏠settlement#${cr.settlementId}` : ""}</div>
            ))}
            <button onClick={() => setInfo(null)} style={{ ...ctrlBtn, marginTop: 4 }}>Close</button>
          </div>
        )}
      </div>

      {/* Sidebar */}
      <div style={{ width: 170, borderLeft: "1px solid #1a1a2e", background: "#0a0a12", padding: 14, display: "flex", flexDirection: "column", gap: 8, overflowY: "auto" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#6366f1", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 4 }}>⚡ God Powers</div>
        {GOD_TOOLS.map((t) => (
          <button key={t.power} onClick={() => setPower(t.power)}
            style={{
              ...sideBtn,
              background: power === t.power ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.02)",
              borderColor: power === t.power ? "rgba(239,68,68,0.5)" : "rgba(255,255,255,0.05)",
              color: power === t.power ? "#f87171" : "#a1a1aa",
            }}>
            <span style={{ width: 20 }}>{t.icon}</span> {t.label}
            <span style={{ marginLeft: "auto", fontSize: 9, color: "#52525b" }}>{t.key}</span>
          </button>
        ))}

        <div style={{ height: 1, background: "#1a1a2e", margin: "4px 0" }} />

        <div style={{ fontSize: 10, fontWeight: 700, color: "#22c55e", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 4 }}>🌱 Spawn</div>
        {SPAWN_CHOICES.map((s) => (
          <button key={s.species} onClick={() => setSpecies(s.species)}
            style={{
              ...sideBtn,
              background: species === s.species ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.02)",
              borderColor: species === s.species ? "rgba(34,197,94,0.4)" : "rgba(255,255,255,0.05)",
              color: species === s.species ? "#4ade80" : "#a1a1aa",
            }}>
            <span style={{ width: 20 }}>{s.icon}</span> {s.label}
          </button>
        ))}
        <button onClick={handleSpawn} style={{ ...sideBtn, background: "#22c55e", color: "#fff", justifyContent: "center", fontWeight: 600, border: "none" }}>
          ✨ Spawn at Cursor
        </button>

        <div style={{ height: 1, background: "#1a1a2e", margin: "4px 0" }} />

        <div style={{ fontSize: 10, fontWeight: 700, color: "#71717a", textTransform: "uppercase", letterSpacing: "0.15em" }}>📜 Events</div>
        <div style={{ fontSize: 9, color: "#52525b", lineHeight: 1.5, maxHeight: 120, overflowY: "auto" }}>
          {world.eventLog.slice(-12).map((e, i) => <div key={i} style={{ marginBottom: 1 }}>{e}</div>)}
        </div>
        <div style={{ fontSize: 9, color: "#3a3a4a", marginTop: "auto", textAlign: "center" }}>WASD to pan · Scroll to zoom</div>
      </div>
    </div>
  );
}

const ctrlBtn: React.CSSProperties = { padding: "3px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600, cursor: "pointer", border: "none", background: "rgba(0,0,0,0.6)", color: "#e4e4e7", fontFamily: "monospace" };
const sideBtn: React.CSSProperties = { width: "100%", padding: "5px 8px", borderRadius: 6, fontSize: 11, cursor: "pointer", border: "1px solid rgba(255,255,255,0.05)", color: "#a1a1aa", textAlign: "left", display: "flex", alignItems: "center", gap: 4, transition: "all 0.15s", background: "rgba(255,255,255,0.02)" };
