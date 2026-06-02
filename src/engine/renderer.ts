import type { WorldState, Terrain, Species } from "./world";

const CW = 100, CH = 70, PX = 8;

const TERRAIN_COLORS: Record<Terrain, string> = {
  grass: "#4a7c3f", dirt: "#8b6914", stone: "#6b6b6b", water: "#3b82f6", sand: "#e2c171",
};

const SPECIES_SHAPES: Record<Species, (ctx: CanvasRenderingContext2D, x: number, y: number, px: number) => void> = {
  tree: (c, x, y, p) => { c.fillStyle = "#2d5a1e"; c.fillRect(x + p * 3, y, p * 2, p * 6); c.fillStyle = "#3d7a2e"; c.fillRect(x + p, y - p * 3, p * 6, p * 4); },
  bush: (c, x, y, p) => { c.fillStyle = "#3d7a2e"; c.beginPath(); c.arc(x + p * 4, y + p * 4, p * 3, 0, Math.PI * 2); c.fill(); },
  rabbit: (c, x, y, p) => { c.fillStyle = "#d4a574"; c.fillRect(x + p * 2, y + p * 4, p * 4, p * 3); c.fillStyle = "#e8c9a0"; c.fillRect(x + p, y + p * 2, p * 2, p * 2); },
  deer: (c, x, y, p) => { c.fillStyle = "#8b6914"; c.fillRect(x + p, y + p * 2, p * 6, p * 5); c.fillStyle = "#a07828"; c.fillRect(x, y, p * 3, p * 4); },
  wolf: (c, x, y, p) => { c.fillStyle = "#4a4a4a"; c.fillRect(x + p, y + p * 3, p * 6, p * 4); c.fillStyle = "#6b6b6b"; c.fillRect(x, y + p, p * 4, p * 3); },
  human: (c, x, y, p) => { c.fillStyle = "#e2a871"; c.fillRect(x + p * 3, y, p * 2, p * 3); c.fillStyle = "#c4956e"; c.fillRect(x + p * 2, y + p * 3, p * 4, p * 5); },
};

const skyColors = ["#1a1a2e", "#2d2d44", "#1a1a2e"];

export function renderWorld(canvas: HTMLCanvasElement, world: WorldState, cursor: { x: number; y: number } | null) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  canvas.width = CW * PX;
  canvas.height = CH * PX;
  ctx.imageSmoothingEnabled = false;

  // Sky gradient
  const sky = ctx.createLinearGradient(0, 0, 0, CH * PX * 0.3);
  sky.addColorStop(0, skyColors[0]);
  sky.addColorStop(0.5, skyColors[1]);
  sky.addColorStop(1, skyColors[2]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, CW * PX, CH * PX);

  // Terrain
  for (let y = 0; y < CH; y++)
    for (let x = 0; x < CW; x++) {
      const cell = world.cells[y][x];
      ctx.fillStyle = TERRAIN_COLORS[cell.terrain] ?? "#333";
      ctx.fillRect(x * PX, y * PX, PX, PX);

      // Moisture overlay
      if (cell.moisture > 60) { ctx.fillStyle = "rgba(59,130,246,0.15)"; ctx.fillRect(x * PX, y * PX, PX, PX); }
      // Fertility overlay (green tint)
      if (cell.fertility > 70 && cell.terrain === "grass") { ctx.fillStyle = "rgba(34,197,94,0.2)"; ctx.fillRect(x * PX, y * PX, PX, PX); }
    }

  // Creatures
  for (const c of world.creatures) {
    const shape = SPECIES_SHAPES[c.species] ?? SPECIES_SHAPES.rabbit;
    shape(ctx, Math.floor(c.x) * PX, Math.floor(c.y) * PX, PX);

    // Health bar (tiny)
    if (c.health < 80) {
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(Math.floor(c.x) * PX, Math.floor(c.y) * PX - 3, PX * 8, 2);
      ctx.fillStyle = c.health > 40 ? "#22c55e" : "#ef4444";
      ctx.fillRect(Math.floor(c.x) * PX, Math.floor(c.y) * PX - 3, PX * 8 * (c.health / 100), 2);
    }
  }

  // Cursor highlight
  if (cursor) {
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.lineWidth = 1;
    ctx.strokeRect(cursor.x * PX, cursor.y * PX, PX, PX);
  }
}
