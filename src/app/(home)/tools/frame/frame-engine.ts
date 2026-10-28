// Frame renderer — 程序化胶片边框引擎（纯 canvas，MIT，无外部依赖）
// 片型几何参数参考 SpektraLab FilmEdge.swift 的事实数据（mm）：
//   135: 36x24 film 35mm 齿孔 | 半格: 24x18 | XPan: 65x24 | 6x6/6x7/6x12: 120 film 61mm 无齿孔

export type FramePresetId =
  | "plain-white-s" | "plain-white-m" | "plain-white-l"
  | "polaroid" | "gallery" | "darkroom"
  | "film135" | "film135-half" | "film-xpan"
  | "film-6x6" | "film-6x7" | "film-6x12";

export type FilmText = {
  enabled: boolean;
  text: string;        // 片基字样，如 "KODAK PORTRA 400"
  dateText: string;    // 右侧日期，如 "24 10A"
  showPerforations: boolean;
};

export type FrameConfig = {
  preset: FramePresetId;
  // 纯色边框参数（比例 0~0.5，相对图宽/高）
  borderTop: number;
  borderBottom: number;
  borderLeft: number;
  borderRight: number;
  borderColor: string;   // 框色（纯色模式）
  bgColor: string;       // 底色（相纸背景）
  cornerRadius: number;  // 照片圆角 px
  filmText: FilmText;
  seed: number;          // 胶片磨损/漏光随机种子
};

export const PRESETS: { id: FramePresetId; name: string; desc: string; group: string }[] = [
  { id: "plain-white-s", name: "白边 · 细", desc: "等宽 2%", group: "纯色" },
  { id: "plain-white-m", name: "白边 · 中", desc: "等宽 4%", group: "纯色" },
  { id: "plain-white-l", name: "白边 · 粗", desc: "等宽 7%", group: "纯色" },
  { id: "polaroid", name: "宝丽来", desc: "下边加宽", group: "纯色" },
  { id: "gallery", name: "画廊卡纸", desc: "宽框细缝", group: "纯色" },
  { id: "darkroom", name: "暗房黑框", desc: "黑底白缝", group: "纯色" },
  { id: "film135", name: "135 全画幅", desc: "36×24 齿孔", group: "胶片" },
  { id: "film135-half", name: "135 半格", desc: "24×18 竖排双格", group: "胶片" },
  { id: "film-xpan", name: "XPan 宽幅", desc: "65×24 齿孔", group: "胶片" },
  { id: "film-6x6", name: "120 6×6", desc: "方画幅", group: "胶片" },
  { id: "film-6x7", name: "120 6×7", desc: "69.5×56", group: "胶片" },
  { id: "film-6x12", name: "120 6×12", desc: "112×56 全景", group: "胶片" },
];

// 齿孔尺寸（135 实测，mm）：pitch 4.23? 常用 4.75/2=相邻，孔 1.98x1.27 圆角
const PERF = { pitch: 4.75 / 2, w: 1.98, h: 1.27, r: 0.35, edge: 0.45 }; // mm，edge=孔外缘到片边

export function defaultConfig(preset: FramePresetId): FrameConfig {
  const base: FrameConfig = {
    preset,
    borderTop: 0.04, borderBottom: 0.04, borderLeft: 0.04, borderRight: 0.04,
    borderColor: "#ffffff", bgColor: "#f5f5f0", cornerRadius: 0,
    filmText: { enabled: true, text: "KODAK PORTRA 400", dateText: "24 10A", showPerforations: true },
    seed: 1,
  };
  switch (preset) {
    case "plain-white-s": return { ...base, borderTop: 0.02, borderBottom: 0.02, borderLeft: 0.02, borderRight: 0.02 };
    case "plain-white-m": return base;
    case "plain-white-l": return { ...base, borderTop: 0.07, borderBottom: 0.07, borderLeft: 0.07, borderRight: 0.07 };
    case "polaroid": return { ...base, borderTop: 0.05, borderBottom: 0.18, borderLeft: 0.05, borderRight: 0.05 };
    case "gallery": return { ...base, borderTop: 0.10, borderBottom: 0.10, borderLeft: 0.10, borderRight: 0.10, bgColor: "#ffffff" };
    case "darkroom": return { ...base, borderTop: 0.05, borderBottom: 0.05, borderLeft: 0.05, borderRight: 0.05, bgColor: "#111111", borderColor: "#111111" };
    default: return base; // 胶片预设用不到 border*，渲染时走胶片路径
  }
}

// ---------- 随机数（种子稳定，同一图同参数同结果） ----------
function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- 程序化胶片边渲染 ----------
type FilmSpec = {
  gateW: number; gateH: number;   // 片窗 mm（长边沿片）
  filmW: number;                  // 胶片横向总宽 mm（135=35, 120=61）
  perforated: boolean;            // 是否带齿孔（135 系）
  verticalFilm: boolean;          // 片基竖走（半格竖排）→ 齿孔在左右
  edgePrint: string;              // 默认片基字样
  marginFactor: number;           // 片边留白相对胶片宽比例
};

const FILM_SPECS: Record<string, FilmSpec> = {
  "film135": { gateW: 36, gateH: 24, filmW: 35, perforated: true, verticalFilm: false, edgePrint: "KODAK PORTRA 400", marginFactor: 0.06 },
  "film135-half": { gateW: 24, gateH: 18, filmW: 35, perforated: true, verticalFilm: false, edgePrint: "KODAK PORTRA 400", marginFactor: 0.06 },
  "film-xpan": { gateW: 65, gateH: 24, filmW: 35, perforated: true, verticalFilm: false, edgePrint: "KODAK  ", marginFactor: 0.05 },
  "film-6x6": { gateW: 56, gateH: 56, filmW: 61, perforated: false, verticalFilm: false, edgePrint: "KODAK PORTRA 400", marginFactor: 0.045 },
  "film-6x7": { gateW: 69.5, gateH: 56, filmW: 61, perforated: false, verticalFilm: true, edgePrint: "ILFORD HP5 PLUS", marginFactor: 0.045 },
  "film-6x12": { gateW: 112, gateH: 56, filmW: 61, perforated: false, verticalFilm: false, edgePrint: "FUJI PROVIA 100F", marginFactor: 0.04 },
};

/**
 * 渲染胶片边框到 canvas。
 * ctx: 已清空的 canvas（尺寸 = 输出尺寸），photo: 已解码的原图。
 */
export function renderFilmFrame(
  ctx: CanvasRenderingContext2D,
  photo: CanvasImageSource,
  photoW: number, photoH: number,
  preset: FramePresetId, cfg: FrameConfig,
  W: number, H: number,
) {
  const spec = FILM_SPECS[preset];
  if (!spec) throw new Error("not a film preset");
  const rnd = mulberry32(cfg.seed);

  // 1. 照片按片窗宽高比 cover 裁切。片窗宽高比（横片长边沿水平）
  const gateAspect = spec.verticalFilm ? spec.gateW / spec.gateH : spec.gateW / spec.gateH;
  // cover-fit 计算 draw 区
  const photoAspect = photoW / photoH;
  let sw = photoW, sh = photoH, sx = 0, sy = 0;
  if (photoAspect > gateAspect) { sw = photoH * gateAspect; sx = (photoW - sw) / 2; }
  else { sh = photoW / gateAspect; sy = (photoH - sh) / 2; }

  // 2. 布局：胶片总宽 = filmW，两侧留边 margin；片窗高 = gateH；上下留白 = filmW-gateH ±
  const mmToPx = (() => {
    // 以片窗为基准：gateW 占输出宽的 ~78%（横片）；竖排半格 gateW 沿片基即竖直方向
    const gatePxW = W * 0.78;
    return gatePxW / (spec.verticalFilm ? spec.gateH : spec.gateW);
  })();

  const filmTotalH = (() => {
    // 沿片基方向的胶片长度：片窗 + 上下边距（含齿孔区）
    const margin = spec.filmW * spec.marginFactor; // 横向两侧
    const vertMargin = (spec.perforated ? (spec.filmW - spec.gateH) * 0.6 : spec.filmW * 0.12);
    return (spec.verticalFilm ? spec.gateW : spec.gateH) * mmToPx + 2 * vertMargin * mmToPx;
  })();

  const filmTotalW = (() => {
    const margin = spec.filmW * spec.marginFactor * mmToPx;
    const along = (spec.verticalFilm ? spec.gateH : spec.gateW) * mmToPx;
    // 横向总宽 = 片窗(沿片基) + 两侧 margin*2 ... 依方向
    return spec.verticalFilm ? filmTotalH : (spec.gateW * mmToPx + 2 * margin) * (spec.verticalFilm ? 0 : 1) || W * 0.92;
  })();

  // 简化：先算统一的"胶片画布"尺寸，再居中
  const alongMm = spec.verticalFilm ? spec.gateW : spec.gateW; // 沿片基方向片窗长度 = gateW (水平横片) or gateW(竖片沿片基)
  // 统一模型：film 本地坐标 u=沿片基方向, v=横穿方向(v 总宽=filmW)
  const uGateMm = spec.verticalFilm ? spec.gateH : spec.gateW;
  const vGateMm = spec.verticalFilm ? spec.gateW : spec.gateH;
  const uMarginMm = spec.filmW * spec.marginFactor * (spec.verticalFilm ? 1.4 : 1);
  const vMarginMm = (spec.filmW - vGateMm) / 2;
  const uPx = uGateMm * mmToPx, vPx = vGateMm * mmToPx;
  const uMarginPx = uMarginMm * mmToPx, vMarginPx = vMarginMm * mmToPx;
  const filmUPx = uPx + 2 * uMarginPx;
  const filmVPx = vPx + 2 * vMarginPx;

  const ox = (W - (spec.verticalFilm ? filmVPx : filmUPx)) / 2;
  const oy = (H - (spec.verticalFilm ? filmUPx : filmVPx)) / 2;

  // 3. 画胶片底（深色片基 + 轻微噪点/漏光）
  ctx.save();
  // film 区域（旋转到屏幕方向）
  ctx.translate(ox, oy);
  if (spec.verticalFilm) {
    ctx.translate(0, filmUPx + filmVPx * 0);
    // 竖片：本地 u 映射到屏幕 y，v 映射到屏幕 x —— 用旋转最简单
  }
  const drawFilmLocal = (x: number, y: number, w: number, h: number) => {
    // 本地 (u,v) → 屏幕：横片 u=x v=y；竖片 u=y v=x
    if (spec.verticalFilm) ctx.fillRect(y, x, h, w);
    else ctx.fillRect(x, y, w, h);
  };

  const filmLocalW = filmUPx, filmLocalH = filmVPx;
  const grad = ctx.createLinearGradient(0, 0, spec.verticalFilm ? 0 : filmLocalW, spec.verticalFilm ? filmLocalH : 0);
  grad.addColorStop(0, "#15130f");
  grad.addColorStop(0.5, "#0d0c0a");
  grad.addColorStop(1, "#171410");
  ctx.fillStyle = grad;
  if (spec.verticalFilm) ctx.fillRect(0, 0, filmVPx, filmUPx);
  else ctx.fillRect(0, 0, filmUPx, filmVPx);

  // 噪点（片基颗粒）
  ctx.globalAlpha = 0.05;
  for (let i = 0; i < 260; i++) {
    const nx = rnd() * (spec.verticalFilm ? filmVPx : filmUPx);
    const ny = rnd() * (spec.verticalFilm ? filmUPx : filmVPx);
    ctx.fillStyle = rnd() > 0.5 ? "#ffffff" : "#000000";
    if (spec.verticalFilm) ctx.fillRect(ny, nx, 1.2, 1.2);
    else ctx.fillRect(nx, ny, 1.2, 1.2);
  }
  ctx.globalAlpha = 1;

  // 漏光（1-2 处柔和橙色光斑）
  const nLeaks = 1 + Math.floor(rnd() * 2);
  for (let i = 0; i < nLeaks; i++) {
    const side = rnd() > 0.5 ? 0 : 1; // 上下边
    const lx = rnd() * (spec.verticalFilm ? filmVPx : filmUPx);
    const ly = side === 0 ? rnd() * vMarginPx * 0.5 : (spec.verticalFilm ? filmUPx : filmVPx) - rnd() * vMarginPx * 0.5;
    const lr = (6 + rnd() * 14) * mmToPx;
    const g2 = ctx.createRadialGradient(lx, ly, 0, lx, ly, lr);
    const warm = rnd() > 0.5 ? "255,140,40" : "255,80,30";
    g2.addColorStop(0, `rgba(${warm},${0.10 + rnd() * 0.08})`);
    g2.addColorStop(1, `rgba(${warm},0)`);
    ctx.fillStyle = g2;
    if (spec.verticalFilm) { ctx.save(); ctx.translate(0, 0); ctx.fillRect(lx - lr, ly - lr, lr * 2, lr * 2); ctx.restore(); }
    else ctx.fillRect(lx - lr, ly - lr, lr * 2, lr * 2);
  }

  // 4. 画照片进片窗（本地坐标：片窗位于 [uMargin, uMargin+uPx] x [vMargin, vMargin+vPx]）
  const gateX = uMarginPx, gateY = vMarginPx;
  ctx.save();
  ctx.beginPath();
  // 片窗圆角极小（胶片压片框会有轻微圆角+非黑边）
  const gr = 1.5 * mmToPx;
  if (spec.verticalFilm) {
    // 竖片屏幕坐标: x=v(0..filmVPx), y=u(0..filmUPx)
    roundRectPath(ctx, gateY, gateX, uPx, vPx, gr);
  } else {
    roundRectPath(ctx, gateX, gateY, uPx, vPx, gr);
  }
  ctx.clip();
  if (spec.verticalFilm) {
    ctx.drawImage(photo, sx, sy, sw, sh, gateY, gateX, uPx, vPx);
  } else {
    ctx.drawImage(photo, sx, sy, sw, sh, gateX, gateY, uPx, vPx);
  }
  // 轻微内阴影（gate shadow）
  const ish = ctx.createLinearGradient(0, gateY, 0, gateY + 6 * mmToPx);
  ish.addColorStop(0, "rgba(0,0,0,0.25)");
  ish.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = ish;
  if (spec.verticalFilm) ctx.fillRect(gateY, gateX, uPx, 6 * mmToPx);
  else ctx.fillRect(gateX, gateY, uPx, 6 * mmToPx);
  ctx.restore();

  // 5. 齿孔（135 系，在 v 方向两侧即屏幕上下 for 横片）
  if (spec.perforated && cfg.filmText.showPerforations) {
    const pitch = PERF.pitch * mmToPx;
    const pw = PERF.w * mmToPx, ph = PERF.h * mmToPx, pr = PERF.r * mmToPx;
    const inset = PERF.edge * mmToPx;
    // 横片：齿孔沿 u 排布，位于 vMargin 区中间；竖片：沿 u（屏幕竖直）排布，位于 x 两侧
    const drawRow = (vCenter: number) => {
      const n = Math.floor(uPx / pitch);
      const startX = uMarginPx + (uPx - n * pitch) / 2 + pitch / 2;
      for (let i = 0; i < n; i++) {
        const cx = startX + i * pitch;
        if (spec.verticalFilm) roundRectFill(ctx, vCenter, cx, ph, pw, pr);
        else roundRectFill(ctx, cx, vCenter, pw, ph, pr);
      }
    };
    ctx.fillStyle = "rgba(0,0,0,0.92)";
    // 孔是"透光"的——胶片底是暗的，孔内更暗接近黑；描个亮边模拟光
    const holeFill = (x: number, y: number, w: number, h: number, r: number) => {
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.85)";
      roundRectPath(ctx, x, y, w, h, r); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.18)"; ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.restore();
    };
    const rowA = vMarginPx / 2, rowB = vMarginPx + vPx + vMarginPx / 2;
    const n = Math.floor(uPx / (PERF.pitch * mmToPx));
    const startX = uMarginPx + (uPx - n * PERF.pitch * mmToPx) / 2;
    for (let i = 0; i < n; i++) {
      const cx = startX + i * PERF.pitch * mmToPx + (PERF.pitch * mmToPx) / 2;
      for (const cy of [rowA, rowB]) {
        if (spec.verticalFilm) holeFill(cy - (ph * mmToPx) / 2, cx - (pw * mmToPx) / 2, ph * mmToPx, pw * mmToPx, pr);
        else holeFill(cx - pw / 2, cy - ph / 2, pw, ph, pr);
      }
    }
  }

  // 6. 片基字样（edge print）——沿片基方向排布在 margin 区
  if (cfg.filmText.enabled) {
    const fontSize = (spec.perforated ? 2.2 : 3.2) * mmToPx;
    ctx.font = `${fontSize}px Roboto, "Helvetica Neue", Arial, sans-serif`;
    ctx.fillStyle = "rgba(230,220,200,0.55)";
    const text = cfg.filmText.text || spec.edgePrint;
    const date = cfg.filmText.dateText;
    if (spec.perforated && !spec.verticalFilm) {
      // 横片：字样在上齿孔与片窗之间那道缝里
      // 上缝写日期（居中偏右），下缝写字样
      ctx.textAlign = "right";
      ctx.fillText(date, gateX + uPx - 4 * mmToPx, vMarginPx * 0.62 + fontSize * 0.35);
      ctx.textAlign = "left";
      ctx.fillText(text, gateX + 4 * mmToPx, vMarginPx + vPx + vMarginPx * 0.62 + fontSize * 0.35);
    } else if (spec.verticalFilm) {
      // 竖片（半格）：字样沿竖直方向写在左右 margin。rotate -90°
      ctx.save();
      ctx.translate(ox + vMarginPx / 2, oy + gateY + uPx - 4 * mmToPx);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = "left";
      ctx.fillText(text, 0, 0);
      ctx.restore();
      ctx.save();
      ctx.translate(ox + filmVPx - vMarginPx / 2, oy + gateY + 4 * mmToPx);
      ctx.rotate(Math.PI / 2);
      ctx.textAlign = "left";
      ctx.fillText(date, 0, 0);
      ctx.restore();
    } else {
      // 120：上下 margin 较宽，写字样+帧号
      ctx.textAlign = "left";
      ctx.fillText(text, gateX, vMarginPx / 2 + fontSize * 0.35);
      ctx.textAlign = "right";
      ctx.fillText(date, gateX + uPx, vMarginPx + vPx + vMarginPx / 2 + fontSize * 0.35);
    }
  }
  ctx.restore();
}

function rowCenterPx(spec: FilmSpec, which: "top" | "bottom", vMarginPx: number, vPx: number) {
  return which === "top" ? vMarginPx / 2 : vMarginPx + vPx + vMarginPx / 2;
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
function roundRectFill(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fill();
}

// ---------- 纯色边框渲染 ----------
export function renderPlainFrame(
  ctx: CanvasRenderingContext2D,
  photo: CanvasImageSource, photoW: number, photoH: number,
  cfg: FrameConfig, W: number, H: number,
) {
  ctx.fillStyle = cfg.bgColor;
  ctx.fillRect(0, 0, W, H);
  const pt = cfg.borderTop * H, pb = cfg.borderBottom * H;
  const pl = cfg.borderLeft * W, prr = cfg.borderRight * W;
  const iw = W - pl - prr, ih = H - pt - pb;
  if (cfg.cornerRadius > 0) {
    ctx.save();
    roundRectPath(ctx, pl, pt, iw, ih, cfg.cornerRadius);
    ctx.clip();
    ctx.drawImage(photo, 0, 0, photoW, photoH, pl, pt, iw, ih);
    ctx.restore();
  } else {
    ctx.drawImage(photo, 0, 0, photoW, photoH, pl, pt, iw, ih);
  }
}

// ---------- 输出尺寸计算 ----------
export function outputSize(photoW: number, photoH: number, preset: FramePresetId, cfg: FrameConfig, maxDim = 4096) {
  const filmIds: FramePresetId[] = ["film135", "film135-half", "film-xpan", "film-6x6", "film-6x7", "film-6x12"];
  if (filmIds.includes(preset)) {
    const spec = FILM_SPECS[preset];
    // 以长边 3600px 为基准（胶片质感需要分辨率）
    const uGateMm = spec.verticalFilm ? spec.gateH : spec.gateW;
    const vGateMm = spec.verticalFilm ? spec.gateW : spec.gateH;
    const uMarginMm = spec.filmW * spec.marginFactor * (spec.verticalFilm ? 1.4 : 1);
    const vMarginMm = (spec.filmW - vGateMm) / 2;
    const mmPx = 3600 / uGateMm;
    let w = (uGateMm + 2 * uMarginMm) * mmPx;
    let h = (vGateMm + 2 * vMarginMm) * mmPx;
    if (spec.verticalFilm) [w, h] = [h, w];
    const k = Math.min(1, maxDim / Math.max(w, h));
    return { W: Math.round(w * k), H: Math.round(h * k) };
  }
  // 纯色：保持照片比例 + 边框占比
  let w = photoW * (1 + cfg.borderLeft + cfg.borderRight);
  let h = photoH * (1 + cfg.borderTop + cfg.borderBottom);
  const k = Math.min(1, maxDim / Math.max(w, h));
  return { W: Math.round(w * k), H: Math.round(h * k) };
}
