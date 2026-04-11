import { BaseBackgroundRender } from "./BaseBackgroundRender";

export class WebWorkerBackgroundRender extends BaseBackgroundRender {
  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement, targetFps: number = 60) {
    super(targetFps);
    this.canvas = canvas;
  }

  start(colors: string[]) {
    // Web Worker disabled in Next.js - fall back to UI renderer
    console.warn("WebWorkerBackgroundRender: Worker not available in Next.js, using UI fallback");
    return;
  }

  stop() {
    // No-op
  }

  resize(width: number, height: number) {
    // No-op
  }

  override setPaused(paused: boolean) {
    super.setPaused(paused);
  }

  setPlaying(isPlaying: boolean) {
    // No-op
  }

  setColors(colors: string[]) {
    // No-op
  }

  async setCoverImage(url: string) {
    // No-op
  }

  setCoverBitmap(bitmap: ImageBitmap) {
    // No-op
  }

  static isSupported(_canvas: HTMLCanvasElement) {
    // Always return false to force UI renderer
    return false;
  }
}
