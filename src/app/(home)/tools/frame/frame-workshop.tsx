"use client";

// 边框工坊 — 访客工具页（内测版）
// 纯浏览器渲染：上传 → 预设/自定义 → canvas 导出下载。无服务器存储。

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FrameConfig, FramePresetId, PRESETS, defaultConfig,
  renderPlainFrame, renderFilmFrame, outputSize,
} from "./frame-engine";

type Item = {
  id: string;
  file: File;
  img: HTMLImageElement;
  url: string;          // objectURL for preview
  status: "idle" | "done" | "working" | "error";
  resultUrl?: string;
};

const FILM_PRESETS: FramePresetId[] = ["film135", "film135-half", "film-xpan", "film-6x6", "film-6x7", "film-6x12"];

export default function FrameWorkshopPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [preset, setPreset] = useState<FramePresetId>("plain-white-m");
  const [cfg, setCfg] = useState<FrameConfig>(() => defaultConfig("plain-white-m"));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const previewCanvas = useRef<HTMLCanvasElement>(null);

  const isFilm = FILM_PRESETS.includes(preset);

  const pickFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const arr = Array.from(files).filter((f) => /image\/(jpeg|png|webp)/.test(f.type)).slice(0, 30);
    const next: Item[] = arr.map((f) => {
      const img = new Image();
      const url = URL.createObjectURL(f);
      img.src = url;
      return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, file: f, img, url, status: "idle" };
    });
    next.forEach((n) => { n.img.onload = () => setItems((p) => [...p]); });
    setItems((p) => [...p, ...next].slice(0, 30));
    setActiveId((a) => a ?? next[0]?.id ?? null);
  };

  const active = items.find((i) => i.id === activeId) ?? null;

  const applyPreset = (id: FramePresetId) => {
    setPreset(id);
    setCfg(defaultConfig(id));
  };

  const renderTo = useCallback((canvas: HTMLCanvasElement, img: HTMLImageElement, config: FrameConfig, maxDim: number) => {
    const { W, H } = outputSize(img.naturalWidth, img.naturalHeight, config.preset, config, maxDim);
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d")!;
    if (FILM_PRESETS.includes(config.preset)) {
      renderFilmFrame(ctx, img, img.naturalWidth, img.naturalHeight, config.preset, config, W, H);
    } else {
      renderPlainFrame(ctx, img, img.naturalWidth, img.naturalHeight, config, W, H);
    }
  }, []);

  // 实时预览（降采样 1400px 提速）
  useEffect(() => {
    if (!active || !active.img.complete || !previewCanvas.current) return;
    try {
      renderTo(previewCanvas.current, active.img, cfg, 1400);
    } catch { /* img 未就绪 */ }
  }, [active, cfg, renderTo, items]);

  const processOne = async (item: Item, config: FrameConfig): Promise<string> => {
    // 大图先降采样到 4096 再合成，防止手机端 canvas 爆内存
    const maxDim = 4096;
    let src: CanvasImageSource = item.img;
    let w = item.img.naturalWidth, h = item.img.naturalHeight;
    const k = Math.min(1, maxDim / Math.max(w, h));
    if (k < 1) {
      const c = document.createElement("canvas");
      c.width = Math.round(w * k); c.height = Math.round(h * k);
      c.getContext("2d")!.drawImage(item.img, 0, 0, c.width, c.height);
      src = c; w = c.width; h = c.height;
    }
    const { W, H } = outputSize(w, h, config.preset, config, maxDim);
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d")!;
    if (FILM_PRESETS.includes(config.preset)) {
      renderFilmFrame(ctx, src, w, h, config.preset, config, W, H);
    } else {
      renderPlainFrame(ctx, src, w, h, config, W, H);
    }
    return canvas.toDataURL("image/jpeg", 0.92);
  };

  const download = (dataUrl: string, name: string) => {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = name;
    a.click();
  };

  const processAll = async () => {
    setBusy(true);
    const updated = [...items];
    for (const it of updated) {
      if (it.status === "done") continue;
      it.status = "working"; setItems([...updated]);
      try {
        const url = await processOne(it, cfg);
        it.resultUrl = url; it.status = "done";
      } catch {
        it.status = "error";
      }
      setItems([...updated]);
      await new Promise((r) => setTimeout(r, 30)); // 让 UI 呼吸
    }
    setBusy(false);
  };

  const downloadAll = async () => {
    const done = items.filter((i) => i.status === "done" && i.resultUrl);
    if (!done.length) return;
    if (done.length === 1) {
      download(done[0].resultUrl!, `framed-${done[0].file.name.replace(/\.\w+$/, "")}.jpg`);
      return;
    }
    // 批量:逐个下载(浏览器兼容性最好,不引zip库)
    for (const it of done) {
      download(it.resultUrl!, `framed-${it.file.name.replace(/\.\w+$/, "")}.jpg`);
      await new Promise((r) => setTimeout(r, 350));
    }
  };

  const setCfgField = <K extends keyof FrameConfig>(k: K, v: FrameConfig[K]) => setCfg((c) => ({ ...c, [k]: v }));
  const setText = (k: keyof FrameConfig["filmText"], v: string | boolean) =>
    setCfg((c) => ({ ...c, filmText: { ...c.filmText, [k]: v } }));

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-8">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">边框工坊</h1>
        <p className="mt-1 text-sm opacity-60">
          上传照片，加胶片边框或纯色边框，全程在你的浏览器内完成——照片不会上传到任何服务器。
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* 左：预览 + 列表 */}
        <div>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); pickFiles(e.dataTransfer.files); }}
            onClick={() => inputRef.current?.click()}
            className="flex min-h-[220px] cursor-pointer items-center justify-center rounded-xl border border-dashed border-black/15 bg-black/[0.02] text-center text-sm opacity-70 transition hover:bg-black/[0.04] dark:border-white/20 dark:bg-white/[0.03]"
          >
            <div>
              <p>拖拽照片到这里，或点击选择（可多选，最多 30 张）</p>
              <p className="mt-1 text-xs opacity-60">支持 JPG / PNG / WebP</p>
            </div>
          </div>
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden
            onChange={(e) => { pickFiles(e.target.files); e.target.value = ""; }} />

          <div className="mt-4 overflow-hidden rounded-xl bg-black/[0.03] dark:bg-white/[0.05]">
            <canvas ref={previewCanvas} className="mx-auto block max-h-[60vh] w-auto max-w-full" />
            {!active && <div className="p-10 text-center text-sm opacity-50">预览区</div>}
          </div>

          {items.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {items.map((it) => (
                <button key={it.id} onClick={() => setActiveId(it.id)}
                  className={`relative h-16 w-16 overflow-hidden rounded-lg border-2 transition ${it.id === activeId ? "border-foreground" : "border-transparent opacity-70 hover:opacity-100"}`}>
                  <img src={it.url} alt="" className="h-full w-full object-cover" />
                  {it.status === "done" && <span className="absolute right-0.5 top-0.5 rounded bg-emerald-600 px-1 text-[10px] text-white">✓</span>}
                  {it.status === "error" && <span className="absolute inset-0 grid place-items-center bg-red-600/70 text-[10px] text-white">失败</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 右：控制面板 */}
        <aside className="space-y-5">
          <section>
            <h2 className="mb-2 text-sm font-medium">预设</h2>
            <div className="grid grid-cols-3 gap-1.5">
              {PRESETS.map((p) => (
                <button key={p.id} onClick={() => applyPreset(p.id)}
                  className={`rounded-lg border px-2 py-2 text-left text-xs transition ${preset === p.id ? "border-foreground bg-foreground text-background" : "border-black/10 hover:bg-black/[0.04] dark:border-white/15 dark:hover:bg-white/[0.06]"}`}>
                  <div className="font-medium">{p.name}</div>
                  <div className="mt-0.5 opacity-60">{p.desc}</div>
                </button>
              ))}
            </div>
          </section>

          {!isFilm && (
            <section className="space-y-3 text-sm">
              <h2 className="font-medium">边框</h2>
              {([["borderTop", "上"], ["borderBottom", "下"], ["borderLeft", "左"], ["borderRight", "右"]] as const).map(([k, label]) => (
                <label key={k} className="flex items-center gap-2">
                  <span className="w-8 opacity-70">{label}</span>
                  <input type="range" min={0} max={0.3} step={0.005} value={cfg[k]}
                    onChange={(e) => setCfgField(k, Number(e.target.value))} className="flex-1" />
                  <span className="w-10 text-right text-xs tabular-nums opacity-60">{Math.round(cfg[k] * 100)}%</span>
                </label>
              ))}
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5">
                  框色 <input type="color" value={cfg.borderColor} onChange={(e) => setCfgField("borderColor", e.target.value)} className="h-7 w-9" />
                </label>
                <label className="flex items-center gap-1.5">
                  底色 <input type="color" value={cfg.bgColor} onChange={(e) => setCfgField("bgColor", e.target.value)} className="h-7 w-9" />
                </label>
              </div>
              <label className="flex items-center gap-2">
                圆角
                <input type="range" min={0} max={60} value={cfg.cornerRadius}
                  onChange={(e) => setCfgField("cornerRadius", Number(e.target.value))} className="flex-1" />
              </label>
            </section>
          )}

          {isFilm && (
            <section className="space-y-3 text-sm">
              <h2 className="font-medium">胶片边</h2>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={cfg.filmText.showPerforations}
                  onChange={(e) => setText("showPerforations", e.target.checked)} />
                齿孔
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={cfg.filmText.enabled}
                  onChange={(e) => setText("enabled", e.target.checked)} />
                片基字样
              </label>
              {cfg.filmText.enabled && (
                <>
                  <input className="w-full rounded-lg border border-black/10 bg-transparent px-2 py-1.5 dark:border-white/15"
                    value={cfg.filmText.text} onChange={(e) => setText("text", e.target.value)} placeholder="片基字样" />
                  <input className="w-full rounded-lg border border-black/10 bg-transparent px-2 py-1.5 dark:border-white/15"
                    value={cfg.filmText.dateText} onChange={(e) => setText("dateText", e.target.value)} placeholder="日期码" />
                </>
              )}
              <label className="flex items-center gap-2">
                磨损/漏光种子
                <input type="number" value={cfg.seed} min={1} max={999}
                  onChange={(e) => setCfgField("seed", Number(e.target.value) || 1)} className="w-20 rounded border border-black/10 bg-transparent px-2 py-1 dark:border-white/15" />
              </label>
            </section>
          )}

          <div className="space-y-2 pt-2">
            <button onClick={processAll} disabled={busy || !items.length}
              className="w-full rounded-xl bg-foreground py-2.5 text-sm font-medium text-background transition disabled:opacity-40">
              {busy ? "处理中…" : `生成${items.length > 1 ? `（${items.length} 张）` : ""}`}
            </button>
            <button onClick={downloadAll} disabled={busy || !items.some((i) => i.status === "done")}
              className="w-full rounded-xl border border-black/15 py-2.5 text-sm transition hover:bg-black/[0.04] disabled:opacity-40 dark:border-white/20 dark:hover:bg-white/[0.06]">
              下载{items.filter((i) => i.status === "done").length > 1 ? "全部" : ""}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
