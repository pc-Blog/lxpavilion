"use client";

import { useEffect, useRef } from "react";

/**
 * 程序化生成的「外星风景」动态背景。
 *
 * <p>移植自 OmniPavilion 音乐模块的 {@code music/components/WaveBackground.vue}，
 * 算法与配色完全保持原样，仅把压缩后的变量名还原为可读命名。</p>
 *
 * <p>每帧绘制：纵向渐变铺底 → 4000 个星点 → 星系光晕 → 流星轨迹 → 8 层正弦山峦。
 * 点击画布会重新播种随机数，整幅风景随之改变。</p>
 */
export default function WaveBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    // 设置容器样式（对应源项目的 container.style.*）
    container.style.position = "fixed";
    container.style.width = "100vw";
    container.style.height = "100vh";
    container.style.overflow = "hidden";
    container.style.background = "#000";
    container.style.top = "0";
    container.style.left = "0";
    container.style.zIndex = "-1";

    // 设置画布样式
    canvas.style.position = "absolute";
    canvas.style.transform = "translate(-50%, 0%)";
    canvas.style.left = "50%";
    canvas.style.height = "100%";
    canvas.style.width = "100%";

    return setupAlienLandscape(canvas);
  }, []);

  return (
    <div ref={containerRef} className="alien-landscape-container">
      <canvas ref={canvasRef} />
    </div>
  );
}

/** 每帧最多推进一次，避免高刷屏超频重绘（源项目 e < S - 3 的节流） */
const FRAME_MS = 1000 / 60;

/**
 * 定种 xorshift 随机数，对应源项目的 {@code let r = 1} 与 {@code const a}。
 *
 * <p>源项目把它定义在 {@code setupAlienLandscape} 的闭包里，供颜色类
 * {@code o.mutate()} 与逐帧绘制共用。此处提到模块级，语义完全一致：
 * 每帧绘制前重置为当次场景种子，因此同一帧内所有取数都确定且可复现。</p>
 */
let rngState = 1;

function seeded(max = 1, min = 0) {
  rngState ^= rngState << 13;
  rngState ^= rngState >>> 17;
  rngState ^= rngState << 5;
  return min + (max - min) * (Math.abs(rngState % 1e9) / 1e9);
}

/** 在 [min, max) 上的均匀随机，对应源项目的 {@code const e = Math.random} */
function rand(max = 1, min = 0) {
  return min + (max - min) * Math.random();
}

/** 色值容器，对应源项目的 class o */
class Rgba {
  constructor(
    public r = 1,
    public g = 1,
    public b = 1,
    public a = 1,
  ) {}

  add(o: Rgba) {
    return new Rgba(this.r + o.r, this.g + o.g, this.b + o.b, this.a + o.a);
  }

  subtract(o: Rgba) {
    return new Rgba(this.r - o.r, this.g - o.g, this.b - o.b, this.a - o.a);
  }

  scale(s: number, sa: number = s) {
    return new Rgba(this.r * s, this.g * s, this.b * s, this.a * sa);
  }

  clamp() {
    return new Rgba(clamp01(this.r), clamp01(this.g), clamp01(this.b), clamp01(this.a));
  }

  lerp(target: Rgba, t: number) {
    return this.add(target.subtract(this).scale(clamp01(t)));
  }

  /** 用 HSL 设置颜色，对应源项目 setHSLA */
  setHSLA(h = 0, s = 0, l = 1, a = 1) {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const hue = (t: number, e: number, hh: number) => {
      const v = ((hh % 1) + 1) % 1;
      if (v < 1 / 6) return t + 6 * (e - t) * v;
      if (v < 1 / 2) return e;
      if (v < 2 / 3) return t + (e - t) * (2 / 3 - v) * 6;
      return t;
    };
    this.r = hue(p, q, h + 1 / 3);
    this.g = hue(p, q, h);
    this.b = hue(p, q, h - 1 / 3);
    this.a = a;
    return this;
  }

  /**
   * 颜色扰动。
   *
   * <p>源项目用定种随机 {@code a()} 而非 {@code Math.random()}，
   * 因此同一帧内每次绘制都得到相同结果，画面才不会闪烁。此处必须保持一致。</p>
   */
  mutate(amount = 0.05, alphaAmount = 0) {
    return new Rgba(
      this.r + seeded(amount, -amount),
      this.g + seeded(amount, -amount),
      this.b + seeded(amount, -amount),
      this.a + seeded(alphaAmount, -alphaAmount),
    ).clamp();
  }
  rgba() {
    return `rgb(${(255 * this.r) | 0},${(255 * this.g) | 0},${(255 * this.b) | 0},${this.a})`;
  }
}

function clamp01(v: number) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function setupAlienLandscape(canvas: HTMLCanvasElement): () => void {
  // 每次重新播种时刷新的场景参数
  let baseSeed = 0;
  let hueBase = 0;
  let skyTop = new Rgba();
  let skyBottom = new Rgba();
  let ridgeTint = new Rgba();
  let mountainPhase = 0;
  let denseStars = false;
  let meteorSeedFlag = false;
  let galaxyCount = 0;

  const reseed = () => {
    baseSeed = 0 | rand(1e9);
    hueBase = rand(1);
    skyTop = new Rgba().setHSLA(hueBase, rand(), rand(0.5));
    skyBottom = new Rgba().setHSLA(hueBase + rand(0.3, 0.7), rand(), rand(0.8, 0.2));
    mountainPhase = rand(1e3);
    /*
     * 山峦基色。
     *
     * 源项目写法：
     *   g = ((t=new o(.1,.1,.1), i=new o(.9,.9,.9), r) =>
     *          r ? t.lerp(i, e()) : new o(e(t.r,i.r), e(t.g,i.g), e(t.b,i.b), e(t.a,i.a))
     *       )(new o(.1,.1,.1), new o(.9,.9,.9))
     *
     * 这是逗号表达式的 IIFE：括号内最后一项才是那个箭头函数，因此它被当作
     * 实参传给外层调用，而「调用」时只给了 2 个参数 —— 第三个形参 r 恒为
     * undefined，所以 **永远走 else 分支**，即每个通道独立取 [0.1, 0.9) 的随机值。
     * （t.a 与 i.a 都是 1，e(1,1) 恒等于 1，因此 alpha 固定为 1。）
     */
    ridgeTint = new Rgba(
      rand(0.1, 0.9),
      rand(0.1, 0.9),
      rand(0.1, 0.9),
      1,
    );
    const speed = rand(12, 1) * (rand() < 0.5 ? 1 : -1);
    denseStars = rand() < 0.5;
    meteorSeedFlag = rand() < 0.5;
    galaxyCount = rand() < 0.03 ? 0 : (1 + rand() ** 2 * 5) | 0;
    return speed;
  };

  let speed = reseed();

  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};

  let frameId = 0;
  /** 累计帧数 / 60，驱动星点与山峦的横向漂移（源项目 m++ / 60） */
  let elapsed = 0;
  let lastStamp = 0;

  const draw = (stamp: number) => {
    frameId = requestAnimationFrame(draw);
    // 节流：距离上一帧不足 ~3ms 时跳过，等价于源项目的 e < S - 3
    if (stamp < lastStamp - 3) return;
    lastStamp = Math.max(lastStamp + FRAME_MS, stamp);
    // 源项目写的是 f = m++ / 60：先取当前值再自增，因此首帧 f = 0
    const frame = elapsed;
    elapsed += 1 / 60;

    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    // 每帧重置种子（源项目 r = l），使整幅风景由本次场景种子确定
    rngState = baseSeed;

    // ① 纵向渐变铺底
    const horizon = 600 + seeded(300);
    const sky = (ctx.fillStyle = ctx.createLinearGradient(0, 0, 0, horizon));
    sky.addColorStop(0, skyTop.rgba());
    sky.addColorStop(1, skyBottom.rgba());
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = "lighter";

    // ② 4000 个星点
    for (let i = 4000; i--; ) {
      const size = seeded(2, 1);
      const star = new Rgba().setHSLA(seeded(), seeded() ** 3, seeded() ** 2);
      const x = (seeded(canvas.width) + seeded(9) * frame) % (canvas.width + 20) - 10;
      const y = seeded(horizon);
      ctx.fillStyle = star.rgba();
      ctx.fillRect(x, y, size, size);
    }

    // ③ 星系光晕：两层径向渐变叠加
    ctx.globalCompositeOperation = "source-over";
    if (galaxyCount) {
      for (let layer = 2; layer--; ) {
        ctx.globalCompositeOperation = layer ? "source-over" : "lighter";
        for (let i = galaxyCount; i--; ) {
          const radius = i ? seeded() ** 2 * 5 + 9 : seeded() ** 3 * 30 + 20;
          const color = new Rgba().setHSLA(seeded(), seeded(), seeded(0.5, 1));
          const cx = seeded(canvas.width);
          const cy = seeded(horizon - 300);
          if (layer) {
            const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
            g.addColorStop(0, color.rgba());
            g.addColorStop(0.8, color.mutate(0.3).rgba());
            g.addColorStop(1, color.mutate(0.3).scale(1, 0).rgba());
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          } else {
            const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 400 * radius);
            g.addColorStop(0, color.scale(0.3, 1).rgba());
            g.addColorStop(0.1, color.scale(0.1, 1).rgba());
            g.addColorStop(1, color.scale(0, 1).rgba());
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }
        }
      }
      ctx.globalCompositeOperation = "source-over";
    }

    // ④ 流星轨迹
    const driftDir = seeded() > 0.5 ? -1 : 1;
    for (let i = meteorSeedFlag ? 100 : 20; i--; ) {
      const width = seeded(4, 1);
      const drift = seeded(99, meteorSeedFlag ? 19 : 9);
      const head = new Rgba().setHSLA(seeded(), seeded() ** 7, seeded(1, 0.5));
      const spanX = canvas.width + 1e3;
      const spanY = horizon + 1e3;
      const dx =
        !meteorSeedFlag || seeded() < 0.02
          ? seeded(-99, 99)
          : (drift + seeded(-10, 10)) * driftDir;
      const px = (seeded(spanX) + frame * dx) % spanX - 500;
      const py = (seeded(spanY) + frame * drift) % spanY - 500;
      const tail = seeded(0.5, 3);
      const tx = px - tail * dx;
      const ty = py - tail * drift;
      const streak = new Rgba().setHSLA(seeded(), seeded() ** 9, seeded(0.1, 0.5));
      const g = (ctx.strokeStyle = ctx.createLinearGradient(px, py, tx, ty));
      g.addColorStop(0, streak.rgba());
      g.addColorStop(1, streak.scale(1, 0).rgba());
      ctx.globalCompositeOperation = "lighter";
      ctx.lineWidth = width;
      ctx.lineTo(px, py);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.beginPath();
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = head.rgba();
      ctx.arc(px, py, width / 2, 0, 9);
      ctx.fill();
      ctx.beginPath();
    }

    // ⑤ 8 层正弦山峦
    let ridge = ridgeTint;
    for (let layer = 0; ++layer < 8; ) {
      const amp = seeded(0.3, 1);
      let height = 0;
      let prev = 0;
      const offset = layer * layer * 1e3 + frame * speed * (layer - 1) ** 2;
      let counter = 0 | offset;
      const frac = (offset % 1) - 1;
      const baseY = horizon - 250 + layer * layer * 13;
      // 每层 3000 个采样点，按层序号横向拉伸，形成远近山脊
      for (let x = 3e3; x--; ) {
        const wave = 10 * Math.sin((++counter + mountainPhase) ** 2);
        if (Math.abs(wave) < 1) height = wave * (denseStars ? 3 : 1.5) * amp;
        prev += height -= prev / 2e3;
        ctx.lineTo((x + frac - 1) * layer, (prev * layer ** 0.7) / 2 + baseY);
      }
      const fill = ridge.lerp(skyTop, 1 - 0.2 * layer);
      const g = (ctx.fillStyle = ctx.createLinearGradient(0, baseY - 100, 0, baseY + 300));
      g.addColorStop(0, fill.clamp().rgba());
      g.addColorStop(1, fill.subtract(new Rgba(1, 1, 1, 0)).mutate(0.4).clamp().rgba());
      ridge = ridge.mutate(seeded() ** 2 * 0.3);
      ctx.lineTo(0, canvas.height);
      ctx.lineTo(canvas.width, canvas.height);
      ctx.fill();
      ctx.beginPath();
    }
  };

  const onClick = () => {
    speed = reseed();
  };

  canvas.addEventListener("click", onClick);
  frameId = requestAnimationFrame(draw);

  return () => {
    cancelAnimationFrame(frameId);
    canvas.removeEventListener("click", onClick);
  };
}
