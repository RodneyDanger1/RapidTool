// ---------------------------------------------------------------------------
// src/ui/console.tsx — Operator surfaces bound to store fields
// machine-generated from RapidTool packet 4a2c2dc2-9537-46ef-9cd2-8ebd9ba44272; regenerate, don't hand-edit.
// Real canvas game surface: fixed-timestep loop + input + HUD + states.
// Assets are NOT engine-generated — see assets/manifest.json.
// ---------------------------------------------------------------------------

// A real, playable canvas game: fixed-timestep loop, keyboard + pointer input,
// start/HUD/game-over states, a persistent best score and a mute toggle. No
// framework is imported — the game kind declares no react dependency.
export type GameHandle = { stop: () => void };
export type GameStatus = "start" | "playing" | "over";

type Platform = { x: number; y: number; w: number; h: number };
type Coin = { x: number; y: number; taken: boolean };

const VIEW_W = 960;
const VIEW_H = 540;
const GRAVITY = 1800;
const JUMP_VELOCITY = -640;
const BASE_SPEED = 240;
const MAX_SPEED = 520;
const BRAKE_SPEED = 140;
const ACCEL = 220;
const BRAKE = 320;
const GROUND_Y = 440;
const PLAYER_W = 34;
const PLAYER_H = 44;
const PLAYER_X = 140;
const STEP = 1 / 120;
const BEST_KEY = "a-browser-arcade-game.best-score";

/** Deterministic LCG so the procedural world is reproducible (no Math.random). */
function makeRng(): () => number {
  let seed = 0x2f6e2b1;
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
}

export function bootGame(root: HTMLElement): GameHandle {
  const canvas = document.createElement("canvas");
  canvas.width = VIEW_W;
  canvas.height = VIEW_H;
  canvas.tabIndex = 0;
  canvas.setAttribute("role", "application");
  canvas.setAttribute("aria-label", "A Browser Arcade Game — arrow keys or WASD to move, space to jump, M to mute");
  canvas.style.width = "100%";
  canvas.style.height = "auto";
  canvas.style.background = "#0b1020";
  canvas.style.touchAction = "none";
  root.appendChild(canvas);
  const context2d = canvas.getContext("2d");
  if (context2d === null) {
    const notice = document.createElement("p");
    notice.textContent = "This browser cannot provide a 2D canvas context, so the game cannot start.";
    root.appendChild(notice);
    return {
      stop: () => {
        notice.remove();
        canvas.remove();
      },
    };
  }
  // Bind the narrowed context to a non-null const: TypeScript does not carry an
  // outer narrowing into the drawing closures, so this is what keeps them typed.
  const ctx: CanvasRenderingContext2D = context2d;

  let muted = false;
  let status: GameStatus = "start";
  let paused = false;
  let score = 0;
  let coinsTaken = 0;
  let speed = BASE_SPEED;
  let best = 0;
  try {
    const raw = window.localStorage.getItem(BEST_KEY);
    const parsed = raw === null ? 0 : Number(raw);
    best = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    best = 0;
  }

  const rng = makeRng();
  let platforms: Platform[] = [];
  let coins: Coin[] = [];
  let playerY = GROUND_Y;
  let vy = 0;
  let jumps = 0;
  let worldScroll = 0;
  let onGround = true;
  let audio: AudioContext | null = null;

  function seedWorld(): void {
    platforms = [{ x: -200, y: GROUND_Y, w: 520, h: 60 }];
    coins = [];
    let x = 420;
    for (let i = 0; i < 240; i++) {
      const gap = 120 + rng() * (140 + Math.min(220, i * 4));
      const w = 120 + rng() * 220;
      const y = GROUND_Y - rng() * 200;
      x += gap;
      platforms.push({ x, y, w, h: 26 });
      if (rng() > 0.45) coins.push({ x: x + w / 2, y: y - 44, taken: false });
      x += w;
    }
  }

  function beep(freq: number, seconds: number): void {
    if (muted) return;
    try {
      const ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (ctor === undefined) return;
      audio = audio ?? new ctor();
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      gain.gain.value = 0.04;
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(audio.destination);
      osc.start();
      osc.stop(audio.currentTime + seconds);
    } catch {
      // Audio is best-effort; a blocked context never breaks the game.
    }
  }

  function restart(): void {
    seedWorld();
    status = "playing";
    paused = false;
    score = 0;
    coinsTaken = 0;
    speed = BASE_SPEED;
    worldScroll = 0;
    playerY = GROUND_Y;
    vy = 0;
    jumps = 0;
    onGround = true;
  }

  function jump(): void {
    const allowed = onGround ? true : jumps < 2;
    if (!allowed) return;
    vy = JUMP_VELOCITY;
    jumps += 1;
    onGround = false;
    beep(660, 0.05);
  }

  function endRun(): void {
    if (status !== "playing") return;
    status = "over";
    const finalScore = Math.floor(score);
    if (finalScore > best) {
      best = finalScore;
      try {
        window.localStorage.setItem(BEST_KEY, String(best));
      } catch {
        // Storage disabled — the best score still stands for this session.
      }
    }
  }

  const keys = new Set<string>();
  function onKeyDown(event: KeyboardEvent): void {
    const key = event.key.toLowerCase();
    if (key === " " || key === "arrowup" || key === "arrowdown" || key === "arrowleft" || key === "arrowright") {
      event.preventDefault();
    }
    if (key === "m") {
      muted = !muted;
      return;
    }
    keys.add(key);
    if (status === "start" || status === "over") {
      restart();
      return;
    }
    if (key === "arrowup" || key === "w" || key === " " || key === "space") jump();
  }
  function onKeyUp(event: KeyboardEvent): void {
    keys.delete(event.key.toLowerCase());
  }
  function onBlur(): void {
    paused = true;
  }
  function onFocus(): void {
    paused = false;
  }
  function onPointerDown(event: PointerEvent): void {
    if (status === "start" || status === "over") {
      restart();
      return;
    }
    const rect = canvas.getBoundingClientRect();
    if (event.clientX >= rect.left + rect.width / 2) jump();
    else keys.add("arrowleft");
  }
  function onPointerUp(): void {
    keys.delete("arrowleft");
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);
  window.addEventListener("focus", onFocus);
  canvas.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointerup", onPointerUp);

  function step(dt: number): void {
    if (keys.has("arrowright") || keys.has("d")) speed = Math.min(MAX_SPEED, speed + ACCEL * dt);
    if (keys.has("arrowleft") || keys.has("a")) speed = Math.max(BRAKE_SPEED, speed - BRAKE * dt);
    worldScroll += speed * dt;
    score += speed * dt * 0.1;

    vy += GRAVITY * dt;
    playerY += vy * dt;
    if (playerY < 0) {
      playerY = 0;
      vy = 0;
    }
    onGround = false;
    for (const p of platforms) {
      const sx = p.x - worldScroll;
      if (PLAYER_X + PLAYER_W < sx || PLAYER_X > sx + p.w) continue;
      if (vy >= 0 && playerY >= p.y && playerY <= p.y + p.h + vy * dt + 2) {
        playerY = p.y;
        vy = 0;
        onGround = true;
        jumps = 0;
      }
    }
    for (const c of coins) {
      if (c.taken) continue;
      const sx = c.x - worldScroll;
      if (Math.abs(sx - PLAYER_X - PLAYER_W / 2) < 30 && Math.abs(c.y - (playerY - PLAYER_H / 2)) < 40) {
        c.taken = true;
        coinsTaken += 1;
        score += 25;
        beep(990, 0.04);
      }
    }
    if (playerY > VIEW_H + 200) endRun();
  }

  function overlay(title: string, line: string, call: string): void {
    ctx.fillStyle = "rgba(11, 16, 32, 0.78)";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = "#f3ede4";
    ctx.textAlign = "center";
    ctx.font = "700 44px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText(title, VIEW_W / 2, VIEW_H / 2 - 40);
    ctx.font = "400 22px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText(line, VIEW_W / 2, VIEW_H / 2 + 4);
    ctx.fillText(call, VIEW_W / 2, VIEW_H / 2 + 44);
  }

  function draw(): void {
    ctx.fillStyle = "#0b1020";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = "#131a33";
    ctx.fillRect(0, VIEW_H - 120, VIEW_W, 120);
    for (const p of platforms) {
      const sx = p.x - worldScroll;
      if (sx > VIEW_W || sx + p.w < 0) continue;
      ctx.fillStyle = "#2dd4bf";
      ctx.fillRect(sx, p.y, p.w, p.h);
    }
    for (const c of coins) {
      if (c.taken) continue;
      const sx = c.x - worldScroll;
      if (sx > VIEW_W || sx < -40) continue;
      ctx.fillStyle = "#fbbf24";
      ctx.beginPath();
      ctx.arc(sx, c.y, 12, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#f472b6";
    ctx.fillRect(PLAYER_X, playerY - PLAYER_H, PLAYER_W, PLAYER_H);
    ctx.fillStyle = "#f3ede4";
    ctx.textAlign = "left";
    ctx.font = "600 20px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText("Score " + Math.floor(score) + "   Coins " + coinsTaken + "   Best " + best, 20, 36);
    if (muted) ctx.fillText("Muted (M)", VIEW_W - 150, 36);
    if (status === "start") {
      overlay("A Browser Arcade Game", "Space / up jumps · right accelerates · left brakes", "Press space to start");
    } else if (status === "over") {
      overlay("Run over", "Score " + Math.floor(score) + " · coins " + coinsTaken, "Press space to play again");
    } else if (paused) {
      overlay("Paused", "The window lost focus", "Click the game to resume");
    }
  }

  let raf = 0;
  let last = 0;
  let acc = 0;
  function frame(now: number): void {
    raf = window.requestAnimationFrame(frame);
    if (last === 0) last = now;
    let delta = (now - last) / 1000;
    last = now;
    if (delta > 0.25) delta = 0.25;
    if (status === "playing" && !paused) {
      acc += delta;
      while (acc >= STEP) {
        step(STEP);
        acc -= STEP;
      }
    }
    draw();
  }

  seedWorld();
  draw();
  canvas.focus();
  raf = window.requestAnimationFrame(frame);

  return {
    stop: () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.remove();
    },
  };
}
