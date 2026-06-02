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
  const cursorRef = useRef<{ x: number; y: number } | null>(null);
  const powerRef = useRef<GodPower>("smite");
  const pausedRef = useRef(false);
  const speedRef = useRef(1);

  const [ui, setUi] = useState({ world: worldRef.current, power: "smite" as GodPower, species: "rabbit" as Species, paused: false, speed: 1, info: null as any });
  const hoveredRef = useRef<number | null>(null);

  // Single rAF game loop — sim + render, decoupled from React
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let lastTick = performance.now();
    let rid = 0;

    const loop = (now: number) => {
      const interval = 400 / speedRef.current;
      if (!pausedRef.current && now - lastTick >= interval) {
        try { worldRef.current = tick(worldRef.current); } catch { worldRef.current = createWorld(); }
        lastTick = now;
      }
      renderWorld(canvas, worldRef.current, cursorRef.current);
      rid = requestAnimationFrame(loop);
    };
    rid = requestAnimationFrame(loop);

    // Slow UI sync
    const sync = setInterval(() => {
      setUi((p) => ({ ...p, world: worldRef.current }));
    }, 600);

    return () => { cancelAnimationFrame(rid); clearInterval(sync); };
  }, []);

  // Keyboard
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const tool = GOD_TOOLS.find((t) => t.key === e.key);
      if (tool) { powerRef.current = tool.power; setUi((p) => ({ ...p, power: tool.power })); }
      if (e.key === " ") { e.preventDefault(); pausedRef.current = !pausedRef.current; setUi((p) => ({ ...p, paused: pausedRef.current })); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const s = (100 * 10) / rect.width;
    const gx = Math.floor((e.clientX - rect.left) * s / 10);
    const gy = Math.floor((e.clientY - rect.top) * s / 10);
    const creatures = worldRef.current.creatures.filter((o) => Math.floor(o.x) === gx && Math.floor(o.y) === gy);
    if (creatures.length > 0) {
      setUi((p) => ({ ...p, info: { x: gx, y: gy, creatures, cell: worldRef.current.cells[gy]?.[gx] } }));
    } else {
      const container = containerRef.current;
      const flash = flashRef.current;
      if (container) gsap.to(container, { x: 3, y: 2, duration: 0.04, repeat: 4, yoyo: true, onComplete: () => gsap.set(container, { x: 0, y: 0 }) });
      if (flash) gsap.fromTo(flash, { opacity: 0.6 }, { opacity: 0, duration: 0.5 });
      const next = applyGodPower(worldRef.current, powerRef.current, gx, gy);
      worldRef.current = next;
    }
  }, []);

  const handleSpawn = useCallback(() => {
    const pos = cursorRef.current ?? { x: 50, y: 35 };
    worldRef.current = spawnCreature(worldRef.current, ui.species, pos.x, pos.y);
  }, [ui.species]);

  const pop = Object.fromEntries(
    ["tree", "rabbit", "deer", "wolf", "human"].map((s) => [s, ui.world.creatures.filter((c) => c.species === s).length])
  );

  const seasonName = ["Winter", "Spring", "Summer", "Autumn"][ui.world.season % 4];

  return (
    <div style={{ display: "flex", height: "100vh", background: "#0a0a12", fontFamily: "system-ui, sans-serif", overflow: "hidden", userSelect: "none" }}>
      <div ref={containerRef} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", background: "#000" }}>
        <div ref={flashRef} style={{ position: "absolute", inset: 0, background: "#fff", pointerEvents: "none", opacity: 0, zIndex: 20 }} />
        <canvas ref={canvasRef}
          onClick={handleCanvasClick}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const s = (100 * 10) / rect.width;
            cursorRef.current = { x: Math.floor((e.clientX - rect.left) * s / 10), y: Math.floor((e.clientY - rect.top) * s / 10) };
            const c = ui.world.creatures.find((o) => Math.floor(o.x) === cursorRef.current!.x && Math.floor(o.y) === cursorRef.current!.y);
            hoveredRef.current =c?.id ?? null);
          }}
          onMouseLeave={() => hoveredRef.current =null)}
          style={{ imageRendering: "pixelated", maxWidth: "100%", maxHeight: "100%", objectFit: "contain", cursor: "crosshair" }} />

        {/* HUD */}
        <div style={{ position: "absolute", top: 10, left: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
          {Object.entries(pop).map(([s, n]) => (
            <span key={s} style={{ fontSize: 10, padding: "3px 8px", borderRadius: 5, background: "rgba(0,0,0,0.7)", color: "#e4e4e7", fontFamily: "monospace" }}>{s}: {n}</span>
          ))}
        </div>
        <div style={{ position: "absolute", top: 10, right: 10, display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 10, color: "#71717a", fontFamily: "monospace" }}>{seasonName} · Tick {ui.world.tick}</span>
          <button onClick={() => { pausedRef.current = !pausedRef.current; setUi((p) => ({ ...p, paused: pausedRef.current })); }} style={ctrlBtn}>{ui.paused ? "▶" : "⏸"}</button>
          {[1, 3, 10].map((s) => (
            <button key={s} onClick={() => { speedRef.current = s; setUi((p) => ({ ...p, speed: s })); }} style={{ ...ctrlBtn, opacity: ui.speed === s ? 1 : 0.5 }}>{s}×</button>
          ))}
        </div>
        <div style={{ position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)", fontSize: 13, color: "#e4e4e7", background: "rgba(0,0,0,0.7)", padding: "6px 16px", borderRadius: 8, fontFamily: "monospace" }}>
          {GOD_TOOLS.find((t) => t.power === ui.power)?.icon} {ui.power.toUpperCase()} — click on world
        </div>
        {ui.info && (
          <div style={{ position: "absolute", bottom: 50, left: 10, padding: 10, borderRadius: 8, background: "rgba(0,0,0,0.85)", color: "#e4e4e7", fontSize: 10, fontFamily: "monospace", maxWidth: 260 }}>
            <div style={{ marginBottom: 4 }}>📍 ({ui.info.x},{ui.info.y}) {ui.info.cell?.terrain}</div>
            {ui.info.creatures.map((cr: any) => (
              <div key={cr.id}>🐾 {cr.species}#{cr.id} ❤️{cr.health} age:{cr.age} 🍖{cr.hunger}</div>
            ))}
            <button onClick={() => setUi((p) => ({ ...p, info: null }))} style={{ ...ctrlBtn, marginTop: 4 }}>Close</button>
          </div>
        )}
      </div>

      {/* Sidebar */}
      <div style={{ width: 170, borderLeft: "1px solid #1a1a2e", background: "#0a0a12", padding: 14, display: "flex", flexDirection: "column", gap: 8, overflowY: "auto" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#6366f1", textTransform: "uppercase", letterSpacing: "0.15em" }}>⚡ God Powers</div>
        {GOD_TOOLS.map((t) => (
          <button key={t.power} onClick={() => { powerRef.current = t.power; setUi((p) => ({ ...p, power: t.power })); }}
            style={{ ...sideBtn, background: ui.power === t.power ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.02)", borderColor: ui.power === t.power ? "rgba(239,68,68,0.5)" : "rgba(255,255,255,0.05)", color: ui.power === t.power ? "#f87171" : "#a1a1aa" }}>
            <span style={{ width: 20 }}>{t.icon}</span> {t.label}<span style={{ marginLeft: "auto", fontSize: 9, color: "#52525b" }}>{t.key}</span>
          </button>
        ))}
        <div style={{ height: 1, background: "#1a1a2e", margin: "4px 0" }} />
        <div style={{ fontSize: 10, fontWeight: 700, color: "#22c55e", textTransform: "uppercase", letterSpacing: "0.15em" }}>🌱 Spawn</div>
        {SPAWN_CHOICES.map((s) => (
          <button key={s.species} onClick={() => setUi((p) => ({ ...p, species: s.species }))}
            style={{ ...sideBtn, background: ui.species === s.species ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.02)", borderColor: ui.species === s.species ? "rgba(34,197,94,0.4)" : "rgba(255,255,255,0.05)", color: ui.species === s.species ? "#4ade80" : "#a1a1aa" }}>
            <span style={{ width: 20 }}>{s.icon}</span> {s.label}
          </button>
        ))}
        <button onClick={handleSpawn} style={{ ...sideBtn, background: "#22c55e", color: "#fff", justifyContent: "center", fontWeight: 600, border: "none" }}>✨ Spawn</button>
        <div style={{ height: 1, background: "#1a1a2e", margin: "4px 0" }} />
        <div style={{ fontSize: 10, fontWeight: 700, color: "#71717a", textTransform: "uppercase", letterSpacing: "0.15em" }}>📜 Events</div>
        <div style={{ fontSize: 9, color: "#52525b", lineHeight: 1.5, maxHeight: 120, overflowY: "auto" }}>
          {ui.world.eventLog.slice(-12).map((e, i) => <div key={i} style={{ marginBottom: 1 }}>{e}</div>)}
        </div>
      </div>
    </div>
  );
}

const ctrlBtn: React.CSSProperties = { padding: "3px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600, cursor: "pointer", border: "none", background: "rgba(0,0,0,0.6)", color: "#e4e4e7", fontFamily: "monospace" };
const sideBtn: React.CSSProperties = { width: "100%", padding: "5px 8px", borderRadius: 6, fontSize: 11, cursor: "pointer", border: "1px solid rgba(255,255,255,0.05)", color: "#a1a1aa", textAlign: "left", display: "flex", alignItems: "center", gap: 4, transition: "all 0.15s", background: "rgba(255,255,255,0.02)" };
