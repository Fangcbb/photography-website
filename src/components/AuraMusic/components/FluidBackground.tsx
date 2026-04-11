import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  FlowingLayer,
  createFlowingLayers,
  defaultColors as mobileDefaultColors,
} from "./background/mobile";
import { UIBackgroundRender } from "./background/renderer/UIBackgroundRender";
import { useI18n } from "../hooks/useI18n";

const desktopGradientDefaults = [
  "rgb(60, 20, 80)",
  "rgb(100, 40, 60)",
  "rgb(20, 20, 40)",
  "rgb(40, 40, 90)",
];

// Irrational-frequency noise — never exactly repeats, seamless looping
const noise = (t: number, seed: number) =>
  Math.sin(t * 0.3183098861837907 + seed) * 0.5 +      // 1/π
  Math.sin(t * 0.15915494309189535 + seed * 1.618) * 0.3 +  // 1/(2π)
  Math.sin(t * 0.06366197723675814 + seed * 2.236) * 0.2;   // 1/(5π)

const calculateTransform = (_layer: FlowingLayer, elapsed: number, index: number) => {
  const t = elapsed * 0.00008;
  const seed = index * 2.71828;  // e — irrational offset per layer

  // Pure organic drift, no rotation, no snapping
  const x = _layer.startX + noise(t, seed) * 0.26;
  const y = _layer.startY + noise(t + 31.4, seed + 1.414) * 0.2;
  const scale = _layer.startScale + noise(t + 62.8, seed + 1.732) * 0.08;

  return { x, y, scale, rotation: 0 };
};

interface FluidBackgroundProps {
  colors?: string[];
  isPlaying?: boolean;
  coverUrl?: string;
  isMobileLayout?: boolean;
}

const FluidBackground: React.FC<FluidBackgroundProps> = ({
  colors,
  isPlaying = true,
  coverUrl,
  isMobileLayout = false,
}) => {
  const { dict } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<UIBackgroundRender | null>(null);
  const layersRef = useRef<FlowingLayer[]>([]);
  const isPlayingRef = useRef(isPlaying);
  const startTimeOffsetRef = useRef(0);
  const lastPausedTimeRef = useRef(0);
  const colorsRef = useRef<string[] | undefined>(colors);
  const coverUrlRef = useRef<string | undefined>(coverUrl);
  const [canvasInstanceKey, setCanvasInstanceKey] = useState(0);
  const previousModeRef = useRef(isMobileLayout);

  const normalizedColors = useMemo(
    () => (colors && colors.length > 0 ? colors : mobileDefaultColors),
    [colors],
  );

  const colorKey = useMemo(
    () => normalizedColors.join("|"),
    [normalizedColors],
  );

  useEffect(() => {
    colorsRef.current = colors;
  }, [colors]);

  useEffect(() => {
    coverUrlRef.current = coverUrl;
  }, [coverUrl]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    if (previousModeRef.current !== isMobileLayout) {
      setCanvasInstanceKey((prev) => prev + 1);
      previousModeRef.current = isMobileLayout;
    }
  }, [isMobileLayout]);

  // Generate flowing layers (for both mobile and desktop)
  useEffect(() => {
    layersRef.current = [];
    let cancelled = false;
    const generate = async () => {
      const layerCount = isMobileLayout ? 4 : 6;
      const newLayers = await createFlowingLayers(
        normalizedColors,
        coverUrl,
        layerCount,
      );
      if (cancelled) return;
      layersRef.current = newLayers;
    };
    generate();
    return () => {
      cancelled = true;
    };
  }, [colorKey, coverUrl, normalizedColors, isMobileLayout]);

  const renderFrame = useCallback(
    (ctx: CanvasRenderingContext2D, currentTime: number) => {
      const width = ctx.canvas.width;
      const height = ctx.canvas.height;
      let elapsed = currentTime;

      if (!isPlayingRef.current) {
        lastPausedTimeRef.current = currentTime;
        elapsed = startTimeOffsetRef.current;
      } else if (lastPausedTimeRef.current > 0) {
        startTimeOffsetRef.current = elapsed;
        lastPausedTimeRef.current = 0;
      }

      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, width, height);

      if (layersRef.current.length === 0) {
        // Fallback: draw animated gradient while layers load
        const palette =
          colorsRef.current && colorsRef.current.length > 0
            ? colorsRef.current
            : desktopGradientDefaults;

        // Animate the gradient angle
        const angle = (elapsed * 0.0001) % 1;
        const x1 = width * (0.3 + Math.sin(angle * Math.PI * 2) * 0.3);
        const y1 = 0;
        const x2 = width * (0.7 + Math.cos(angle * Math.PI * 2) * 0.3);
        const y2 = height;

        const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
        palette.forEach((color, index) => {
          gradient.addColorStop(
            index / Math.max(1, palette.length - 1),
            color,
          );
        });
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        if (isMobileLayout) {
          ctx.fillStyle = "#666";
          ctx.font = "16px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(dict.bg.loading, width / 2, height / 2);
        }
        return;
      }

      // Draw base gradient that gently shifts
      const bgAngle = (elapsed * 0.00005) % 1;
      const bgGrad = ctx.createLinearGradient(
        width * (0.5 + Math.sin(bgAngle * Math.PI) * 0.3),
        0,
        width * (0.5 + Math.cos(bgAngle * Math.PI) * 0.3),
        height,
      );
      const palette =
        colorsRef.current && colorsRef.current.length > 0
          ? colorsRef.current
          : desktopGradientDefaults;
      palette.forEach((color, index) => {
        bgGrad.addColorStop(index / Math.max(1, palette.length - 1), color);
      });
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Draw flowing layers with animation
      const blurAmount = isMobileLayout ? 25 : 40;
      layersRef.current.forEach((layer, index) => {
        const transform = calculateTransform(layer, elapsed, index);
        ctx.save();
        ctx.translate(width / 2, height / 2);
        ctx.rotate(transform.rotation);
        ctx.scale(transform.scale, transform.scale);
        ctx.translate(width * transform.x, height * transform.y);
        ctx.globalCompositeOperation = "screen";
        // Higher alpha for more vivid colors
        ctx.globalAlpha = 0.5 + index * 0.05;
        ctx.filter = `blur(${blurAmount}px)`;
        const drawWidth = width * 1.8;
        const drawHeight = height * 1.8;
        ctx.drawImage(
          layer.image,
          -drawWidth / 2,
          -drawHeight / 2,
          drawWidth,
          drawHeight,
        );
        ctx.restore();
      });

      // Add a subtle vignette for depth
      const vignette = ctx.createRadialGradient(
        width / 2,
        height / 2,
        width * 0.3,
        width / 2,
        height / 2,
        width * 0.8,
      );
      vignette.addColorStop(0, "rgba(0,0,0,0)");
      vignette.addColorStop(1, "rgba(0,0,0,0.4)");
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, width, height);
    },
    [dict.bg.loading, isMobileLayout],
  );

  // Canvas resize
  useEffect(() => {
    const resize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const canvas = canvasRef.current;
      if (!canvas) return;

      canvas.width = width;
      canvas.height = height;
      rendererRef.current?.resize(width, height);
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [isMobileLayout, canvasInstanceKey]);

  // Initialize renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (rendererRef.current) {
      rendererRef.current.stop();
      rendererRef.current = null;
    }

    const uiRenderer = new UIBackgroundRender(canvas, renderFrame);
    uiRenderer.resize(window.innerWidth, window.innerHeight);
    uiRenderer.setPaused(!isPlaying);
    uiRenderer.start();
    rendererRef.current = uiRenderer;

    return () => {
      uiRenderer.stop();
      rendererRef.current = null;
    };
  }, [isMobileLayout, renderFrame, canvasInstanceKey]);

  // Sync playing state
  useEffect(() => {
    const renderer = rendererRef.current;
    if (renderer) {
      renderer.setPaused(!isPlaying);
    }
  }, [isPlaying]);

  const canvasKey = `${isMobileLayout ? "mobile" : "desktop"}-${canvasInstanceKey}`;

  return (
    <>
      <canvas
        ref={canvasRef}
        key={canvasKey}
        className="absolute inset-0 w-full h-full pointer-events-none z-0"
        aria-hidden="true"
      />
      <div className="absolute inset-0 z-[1] pointer-events-none bg-black/10" />
    </>
  );
};

export default React.memo(FluidBackground);
