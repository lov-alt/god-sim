import type { WorldState, Terrain } from "./world";

const W = 100, H = 70, PX = 8;

const T: Record<Terrain, string> = {
  grass: "#5a9e4b", forest: "#2d6b1e", plain: "#7ab648", mountain: "#8a8a8a", water: "#3b82f6", sand: "#e2c171",
};

const SEASON_TINT: Record<number, (c: string) => string> = {
  1: (c) => c, // spring
  2: (c) => c, // summer
  3: (c) => c.replace("5a9e4b", "#c4a44a").replace("2d6b1e", "#8b6b2e"), // autumn
  0: (c) => c.replace("5a9e4b", "#d0d0d0").replace("2d6b1e", "#909090"), // winter
};

const FX_CLR: Record<string, string> = {
  smite: "rgba(255,255,100,0.5)", rain: "rgba(59,130,246,0.3)", plague: "rgba(139,0,255,0.25)",
  bless: "rgba(255,215,0,0.25)", fire: "rgba(255,100,0,0.4)", lightning: "rgba(255,255,255,0.7)",
  terraform: "rgba(0,255,0,0.25)", heal: "rgba(0,255,128,0.25)",
};

export function renderWorld(canvas: HTMLCanvasElement, world: WorldState, cursor: { x: number; y: number } | null, hoveredCreatureId: number | null) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = W * PX;
  canvas.height = H * PX;
  ctx.imageSmoothingEnabled = false;

  // Sky
  const skyColors = [["#1a1a3e", "#2d2d5e", "#3a5a8a"], ["#0f0f2e", "#1e3a5e", "#4a8aba"], ["#2a1a1e", "#4a3a2e", "#8a6a4a"], ["#1a1a2e", "#2a2a3e", "#6a6a8a"]][world.season % 4];
  const sky = ctx.createLinearGradient(0, 0, 0, H * PX);
  sky.addColorStop(0, skyColors[0]); sky.addColorStop(0.4, skyColors[1]);
  sky.addColorStop(1, skyColors[2]);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W * PX, H * PX);

  const tint = SEASON_TINT[world.season % 4] ?? ((c: string) => c);

  // Terrain
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const cell = world.cells[y][x];
      ctx.fillStyle = tint(T[cell.terrain] ?? "#333");
      ctx.fillRect(x * PX, y * PX, PX, PX);
      if (cell.fertility > 50 && (cell.terrain === "grass" || cell.terrain === "plain")) {
        ctx.fillStyle = "rgba(34,197,94,0.2)"; ctx.fillRect(x * PX, y * PX, PX, PX);
      }
    }

  // Buildings
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const b = world.cells[y][x].building;
      if (!b) continue;
      const bx = x * PX, by = y * PX;
      ctx.fillStyle = { hut: "#8b6914", farm: "#5a9e4b", house: "#a07828", temple: "#e2c171" }[b] ?? "#8b6914";
      if (b === "farm") { ctx.fillRect(bx + 1, by + 5, PX - 2, 2); ctx.fillStyle = "#8b6914"; ctx.fillRect(bx + 3, by + 2, 2, 4); }
      else { ctx.fillRect(bx + 1, by + 2, PX - 2, PX - 3); }
    }

  // Creatures
  const spClr: Record<string, string> = { tree: "#2d5a1e", rabbit: "#d4a574", deer: "#8b6914", wolf: "#6b6b6b", human: "#e2a871" };
  for (const c of world.creatures) {
    const cx = Math.floor(c.x) * PX, cy = Math.floor(c.y) * PX;
    ctx.fillStyle = spClr[c.species] ?? "#888";
    ctx.fillRect(cx + 2, cy + 2, PX - 4, PX - 4);
    if (c.health < 80) {
      ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(cx, cy - 2, PX, 1);
      ctx.fillStyle = c.health > 40 ? "#22c55e" : "#ef4444";
      ctx.fillRect(cx, cy - 2, PX * (c.health / 100), 1);
    }
  }

  // Active effects
  for (const eff of world.activeEffects) {
    const alpha = Math.max(0, 1 - (world.tick - eff.tick) / 40);
    ctx.fillStyle = (FX_CLR[eff.power] ?? "rgba(255,255,255,0.3)").replace(/[\d.]+\)$/, `${alpha.toFixed(2)})`);
    ctx.beginPath(); ctx.arc(eff.x * PX + 4, eff.y * PX + 4, 4 + (20 - world.tick + eff.tick) * 2, 0, Math.PI * 2); ctx.fill();
  }

  // Hover highlight
  if (hoveredCreatureId !== null) {
    const creature = world.creatures.find((c) => c.id === hoveredCreatureId);
    if (creature) {
      ctx.strokeStyle = "rgba(255,255,255,0.8)"; ctx.lineWidth = 2;
      ctx.strokeRect(Math.floor(creature.x) * PX, Math.floor(creature.y) * PX, PX, PX);
    }
  }

  // Cursor
  if (cursor) {
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.fillRect(cursor.x * PX, cursor.y * PX, PX, PX);
  }
}
