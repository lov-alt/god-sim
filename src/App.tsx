import { useRef, useEffect, useState, useCallback } from "react";
import { createWorld, tick, applyGodEffects, addCreature, type GodPower, type Species } from "./engine/world";
import { renderWorld } from "./engine/renderer";

const GOD_TOOLS: { power: GodPower; icon: string; label: string }[] = [
  { power: "bless", icon: "✨", label: "Bless" },
  { power: "rain", icon: "🌧️", label: "Rain" },
  { power: "smite", icon: "⚡", label: "Smite" },
  { power: "heal", icon: "💚", label: "Heal" },
  { power: "fire", icon: "🔥", label: "Fire" },
  { power: "plague", icon: "🦠", label: "Plague" },
  { power: "terraform", icon: "🏔️", label: "Terra" },
  { power: "lightning", icon: "💀", label: "Bolt" },
];

const SPAWN_SPECIES: { species: Species; icon: string; label: string }[] = [
  { species: "tree", icon: "🌳", label: "Tree" },
  { species: "rabbit", icon: "🐰", label: "Rabbit" },
  { species: "deer", icon: "🦌", label: "Deer" },
  { species: "wolf", icon: "🐺", label: "Wolf" },
  { species: "human", icon: "👤", label: "Human" },
];

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef(createWorld());
  const [world, setWorld] = useState(worldRef.current);
  const [selectedPower, setSelectedPower] = useState<GodPower>("bless");
  const [selectedSpecies, setSelectedSpecies] = useState<Species>("rabbit");
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [info, setInfo] = useState<{ x: number; y: number; cell: any; creatures: any[] } | null>(null);

  // Tick loop
  useEffect(() => {
    if (paused) return;
    const interval = setInterval(() => {
      const next = tick(worldRef.current);
      worldRef.current = next;
      setWorld(next);
    }, 500 / speed);
    return () => clearInterval(interval);
  }, [paused, speed]);

  // Render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    renderWorld(canvas, world, cursor);
  }, [world, cursor]);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const scale = 800 / rect.width;
    const gx = Math.floor((e.clientX - rect.left) * scale / 8);
    const gy = Math.floor((e.clientY - rect.top) * scale / 8);
    const cell = world.cells[gy]?.[gx];
    const creatures = world.creatures.filter((c) => Math.floor(c.x) === gx && Math.floor(c.y) === gy);
    setInfo({ x: gx, y: gy, cell, creatures });
  }, [world]);

  const handleCanvasRightClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const scale = 800 / rect.width;
    const gx = Math.floor((e.clientX - rect.left) * scale / 8);
    const gy = Math.floor((e.clientY - rect.top) * scale / 8);
    const logs = applyGodEffects(worldRef.current, selectedPower, gx, gy);
    const next = { ...worldRef.current, eventLog: [...worldRef.current.eventLog, ...logs] };
    worldRef.current = next;
    setWorld(next);
  }, [selectedPower, world]);

  const handleSpawn = useCallback(() => {
    const cx = cursor?.x ?? 50, cy = cursor?.y ?? 35;
    const next = addCreature(worldRef.current, selectedSpecies, cx, cy);
    worldRef.current = next;
    setWorld(next);
  }, [cursor, selectedSpecies]);

  const population = Object.fromEntries(
    Object.keys({ tree: 1, bush: 1, rabbit: 1, deer: 1, wolf: 1, human: 1 } as Record<Species, number>)
      .map((s) => [s, world.creatures.filter((c) => c.species === s).length])
  );

  return (
    <div style={{ display: "flex", height: "100vh", background: "#09090b", fontFamily: "system-ui, sans-serif", overflow: "hidden" }}>
      {/* Canvas */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
        <canvas ref={canvasRef}
          onClick={handleCanvasClick}
          onContextMenu={handleCanvasRightClick}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const scale = 800 / rect.width;
            setCursor({ x: Math.floor((e.clientX - rect.left) * scale / 8), y: Math.floor((e.clientY - rect.top) * scale / 8) });
          }}
          style={{ imageRendering: "pixelated", maxWidth: "100%", maxHeight: "100%", objectFit: "contain", cursor: "crosshair" }} />
        {/* HUD: population */}
        <div style={{ position: "absolute", top: 12, left: 12, display: "flex", gap: 8, flexWrap: "wrap", maxWidth: 400 }}>
          {Object.entries(population).map(([s, n]) => (
            <span key={s} style={{ fontSize: 11, padding: "4px 8px", borderRadius: 6, background: "rgba(0,0,0,0.6)", color: "#e4e4e7", fontFamily: "monospace" }}>
              {s}: {n}
            </span>
          ))}
        </div>
        {/* Controls */}
        <div style={{ position: "absolute", top: 12, right: 12, display: "flex", gap: 6 }}>
          <button onClick={() => setPaused(!paused)} style={ctrlBtnStyle}>{paused ? "▶" : "⏸"}</button>
          <button onClick={() => setSpeed(1)} style={{ ...ctrlBtnStyle, background: speed === 1 ? "rgba(99,102,241,0.3)" : "rgba(0,0,0,0.5)" }}>1×</button>
          <button onClick={() => setSpeed(3)} style={{ ...ctrlBtnStyle, background: speed === 3 ? "rgba(99,102,241,0.3)" : "rgba(0,0,0,0.5)" }}>3×</button>
          <button onClick={() => setSpeed(10)} style={{ ...ctrlBtnStyle, background: speed === 10 ? "rgba(99,102,241,0.3)" : "rgba(0,0,0,0.5)" }}>10×</button>
        </div>
        {/* Info tooltip */}
        {info && (
          <div style={{ position: "absolute", bottom: 12, left: 12, padding: 10, borderRadius: 10, background: "rgba(0,0,0,0.8)", color: "#e4e4e7", fontSize: 11, fontFamily: "monospace", maxWidth: 280 }}>
            <div style={{ marginBottom: 4 }}>📍 ({info.x}, {info.y}) {info.cell?.terrain} · moist: {info.cell?.moisture} · fert: {info.cell?.fertility}</div>
            {info.creatures.map((c: any) => (
              <div key={c.id} style={{ opacity: 0.8 }}>🐾 {c.species}#{c.id} · ❤️{c.health} ·  age:{c.age} · 🍖{c.hunger}</div>
            ))}
            <button onClick={() => setInfo(null)} style={{ ...ctrlBtnStyle, marginTop: 6 }}>Close</button>
          </div>
        )}
      </div>

      {/* Sidebar */}
      <div style={{ width: 180, borderLeft: "1px solid #27272a", background: "#0f0f15", padding: 16, display: "flex", flexDirection: "column", gap: 12, overflowY: "auto" }}>
        {/* God Powers */}
        <div style={{ fontSize: 10, fontWeight: 600, color: "#52525b", textTransform: "uppercase", letterSpacing: "0.1em" }}>God Powers</div>
        <div style={{ fontSize: 10, color: "#52525b" }}>Right-click on world to use</div>
        {GOD_TOOLS.map((t) => (
          <button key={t.power} onClick={() => setSelectedPower(t.power)}
            style={{ ...toolBtnStyle, background: selectedPower === t.power ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.03)", borderColor: selectedPower === t.power ? "rgba(239,68,68,0.4)" : "transparent" }}>
            {t.icon} {t.label}
          </button>
        ))}

        <div style={{ height: 1, background: "#27272a" }} />

        {/* Spawn */}
        <div style={{ fontSize: 10, fontWeight: 600, color: "#52525b", textTransform: "uppercase", letterSpacing: "0.1em" }}>Spawn</div>
        <div style={{ fontSize: 10, color: "#52525b" }}>Click "Spawn" to create</div>
        {SPAWN_SPECIES.map((s) => (
          <button key={s.species} onClick={() => setSelectedSpecies(s.species)}
            style={{ ...toolBtnStyle, background: selectedSpecies === s.species ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.03)", borderColor: selectedSpecies === s.species ? "rgba(34,197,94,0.4)" : "transparent" }}>
            {s.icon} {s.label}
          </button>
        ))}
        <button onClick={handleSpawn}
          style={{ padding: "8px 12px", borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "none", background: "#22c55e", color: "#fff" }}>
          ✨ Spawn
        </button>

        <div style={{ height: 1, background: "#27272a" }} />

        {/* Event log */}
        <div style={{ fontSize: 10, fontWeight: 600, color: "#52525b", textTransform: "uppercase", letterSpacing: "0.1em" }}>Events</div>
        <div style={{ fontSize: 10, color: "#71717a", maxHeight: 160, overflowY: "auto", lineHeight: 1.6 }}>
          {world.eventLog.slice(-15).map((e, i) => <div key={i} style={{ marginBottom: 2 }}>{e}</div>)}
        </div>
      </div>
    </div>
  );
}

const ctrlBtnStyle: React.CSSProperties = { padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer", border: "none", background: "rgba(0,0,0,0.5)", color: "#e4e4e7", fontFamily: "monospace" };
const toolBtnStyle: React.CSSProperties = { width: "100%", padding: "6px 10px", borderRadius: 8, fontSize: 12, cursor: "pointer", border: "1px solid transparent", color: "#e4e4e7", textAlign: "left", transition: "all 0.15s" };
