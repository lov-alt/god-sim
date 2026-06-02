import type { WorldState, Terrain } from "./world";

const W = 100, H = 70, P = 10;

const TEX: Record<Terrain, string> = {
  grass: "#6db35a", forest: "#3a7d28", plain: "#8cc96a", mountain: "#9a9a9a", water: "#4d94ff", sand: "#f0d480",
};

const ST: Record<number, (c: string) => string> = {
  1: (c) => c, 2: (c) => c,
  3: (c) => c.replace("6db35a", "#b8a44a").replace("3a7d28", "#7a5e28"),
  0: (c) => c.replace("6db35a", "#c8c8c8").replace("3a7d28", "#808080"),
};

const FX: Record<string, string> = {
  smite: "rgba(255,255,100,0.5)", rain: "rgba(59,130,246,0.3)", plague: "rgba(139,0,255,0.25)",
  bless: "rgba(255,215,0,0.25)", fire: "rgba(255,100,0,0.4)", lightning: "rgba(255,255,255,0.7)",
  terraform: "rgba(0,255,0,0.25)", heal: "rgba(0,255,128,0.25)",
};

/* ── Terraria-style Pixel Sprites (16×16) ──
   . = transparent, # = outline, letters = color bands */

const PAL: Record<string, string> = {
  ".": "", "#": "#1a1a1a",
  // Tree: green family
  g: "#2d7a1e", G: "#4a9e3a", h: "#6db35a",
  t: "#5a3e1b", T: "#8b6914",
  // Rabbit
  p: "#c4956e", P: "#d4a574", q: "#e8c9a0", Q: "#fff",
  // Deer
  d: "#7a5a1e", D: "#8b6914", e: "#a07828",
  // Wolf
  w: "#4a4a4a", W: "#5a5a5a", x: "#3a3a3a",
  // Human
  s: "#e2a871", S: "#f0c8a0", k: "#222", r: "#c4956e",
};

const SPR: Record<string, string[]> = {
  tree: [
    "......gg........",
    ".....gGGg.......",
    "....gGGGGg......",
    "...gGGhGGGg.....",
    "....gGGGGg......",
    ".....gGGg.......",
    "......tt........",
    "......tTt.......",
    "......tTt.......",
    ".....tTTt.......",
    ".....tTTt.......",
    "....tTTTt.......",
  ],
  rabbit: [
    ".......PP.......",
    "......PPPP......",
    ".....PqPqP......",
    ".....PqqqP......",
    "....PqqqqqP.....",
    "....PPqqqPP.....",
    "....PPqPqPP.....",
    "...##PPPPP##....",
    "...##PPPPP##....",
    ".....#PPP#......",
    ".....#PPP#......",
  ],
  deer: [
    ".......dD.......",
    "......dDDe......",
    ".....DDeeee.....",
    "....DDDeeeD.....",
    "....DDeeeDD.....",
    "...DDeDDeeD.....",
    "...DPeDDPeD.....",
    "...##PPP##......",
    "...##PPP##......",
    "....#PPP#.......",
    "....#PPP#.......",
  ],
  wolf: [
    "......wWw.......",
    ".....WWWWW......",
    "....WWxWxWW.....",
    "....WWWxWWW.....",
    "...WWWWWWWWW....",
    "...WWWWWWWWW....",
    "..##WWWWW##.....",
    "..##WWWWW##.....",
    "...#WWWWW#......",
    "...#WW###W#.....",
    "....W#..#W......",
    "....#....#......",
  ],
  human: [
    "......SS........",
    ".....SSSS.......",
    ".....SkS........",
    "....SSSSS.......",
    "....SSSSS.......",
    "....SS#SS.......",
    "...SSS.SS.......",
    "...rrS.Srr......",
    "...rrS.Srr......",
    "...##S.S##......",
    "...##S.S##......",
    "....#...#.......",
  ],
};

function drawPixelSprite(ctx: CanvasRenderingContext2D, sprite: string[] | undefined, x: number, y: number, px: number) {
  if (!sprite || !isFinite(x) || !isFinite(y) || px <= 0) return;
  try {
    for (let row = 0; row < sprite.length; row++) {
      const line = sprite[row];
      if (!line) continue;
      for (let col = 0; col < line.length; col++) {
        const c = PAL[line[col] ?? "."];
        if (c) ctx.fillRect(x + col * px, y + row * px, px, px);
      }
    }
  } catch { /* sprite render error — skip */ }
}

const speciesSprite: Record<string, string[]> = {
  tree: SPR.tree, rabbit: SPR.rabbit, deer: SPR.deer, wolf: SPR.wolf, human: SPR.human,
};

/* ── Render ────────────────── */

export function renderWorld(canvas: HTMLCanvasElement, world: WorldState, cursor: { x: number; y: number } | null) {
  try {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = W * P; canvas.height = H * P;
    ctx.imageSmoothingEnabled = false;

  const sc = [["#1a1a3e", "#2d2d5e", "#3a5a8a"], ["#0f0f2e", "#1e3a5e", "#4a8aba"], ["#2a1a1e", "#4a3a2e", "#8a6a4a"], ["#1a1a2e", "#2a2a3e", "#6a6a8a"]][world.season % 4];
  const sky = ctx.createLinearGradient(0, 0, 0, H * P);
  sky.addColorStop(0, sc[0]); sky.addColorStop(0.4, sc[1]); sky.addColorStop(1, sc[2]);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W * P, H * P);

  const tint = ST[world.season % 4] ?? ((c: string) => c);

  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const cell = world.cells[y]?.[x];
      if (!cell) continue;
      ctx.fillStyle = tint(TEX[cell.terrain] ?? "#333");
      ctx.fillRect(x * P, y * P, P, P);
      if (cell.fertility > 60 && (cell.terrain === "grass" || cell.terrain === "plain"))
        { ctx.fillStyle = "rgba(34,197,94,0.25)"; ctx.fillRect(x * P + 2, y * P + 2, P - 4, P - 4); }
    }

  // Buildings
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const b = world.cells[y]?.[x]?.building;
      if (!b) continue;
      const bx = x * P, by = y * P;
      ctx.fillStyle = ({ hut: "#8b6914", farm: "#5a9e4b", house: "#a07828", temple: "#e2c171" } as any)[b] ?? "#8b6914";
      if (b === "farm") { ctx.fillRect(bx + 1, by + 5, P - 2, 2); ctx.fillStyle = "#8b6914"; ctx.fillRect(bx + 3, by + 2, 2, 4); }
      else { ctx.fillRect(bx + 1, by + 2, P - 2, P - 3); }
    }

  // Creatures
  for (const c of world.creatures) {
    const cx = Math.floor(c.x) * P, cy = Math.floor(c.y) * P;
    if (!isFinite(cx) || !isFinite(cy)) continue;
    if (c.settlementId !== null) { ctx.fillStyle = "rgba(99,102,241,0.2)"; ctx.fillRect(cx - 2, cy - 2, P * 2 + 4, P * 2 + 4); }
    const spSize = 1;
    drawPixelSprite(ctx, speciesSprite[c.species], cx - spSize * 8, cy - spSize * 8, spSize);
    if (c.health < 80) {
      ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(cx, cy - 3, P * 2, 1);
      ctx.fillStyle = c.health > 40 ? "#22c55e" : "#ef4444"; ctx.fillRect(cx, cy - 3, P * 2 * (c.health / 100), 1);
    }
  }

  // Effects
  for (const eff of world.activeEffects) {
    const alpha = Math.max(0, 1 - (world.tick - eff.tick) / 40);
    ctx.fillStyle = (FX[eff.power] ?? "rgba(255,255,255,0.3)").replace(/[\d.]+\)$/, `${alpha.toFixed(2)})`);
    ctx.beginPath(); ctx.arc(eff.x * P + P / 2, eff.y * P + P / 2, 4 + (20 - world.tick + eff.tick) * 2, 0, Math.PI * 2); ctx.fill();
  }

  if (cursor) { ctx.fillStyle = "rgba(255,255,255,0.15)"; ctx.fillRect(cursor.x * P, cursor.y * P, P, P); }
  } catch { /* render error — world might be in transition, skip this frame */ }
}
