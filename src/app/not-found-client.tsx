"use client";

import { useEffect, useRef } from "react";

export default function NotFoundClient() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", { antialias: true, alpha: false });
    if (!gl) {
      document.body.style.background =
        "linear-gradient(135deg, rgb(244,205,159), rgb(62,98,238) 45%, rgb(219,115,193) 100%)";
      return;
    }

    const vertexSource = `
      attribute vec2 position;
      void main() {
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `;

    const fragmentSource = `
      precision highp float;
      uniform vec2 iResolution;
      uniform float iTime;
      
      #define S(a,b,t) smoothstep(a,b,t)
      
      mat2 Rot(float a) {
        float s = sin(a);
        float c = cos(a);
        return mat2(c, -s, s, c);
      }
      
      vec2 hash(vec2 p) {
        p = vec2(dot(p, vec2(2127.1, 81.17)), dot(p, vec2(1269.5, 283.37)));
        return fract(sin(p) * 43758.5453);
      }
      
      float noise(in vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        float n = mix(
          mix(dot(-1.0 + 2.0 * hash(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0)),
              dot(-1.0 + 2.0 * hash(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
          mix(dot(-1.0 + 2.0 * hash(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),
              dot(-1.0 + 2.0 * hash(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x),
          u.y
        );
        return 0.5 + 0.5 * n;
      }
      
      void main() {
        vec2 fragCoord = gl_FragCoord.xy;
        vec2 uv = fragCoord / iResolution.xy;
        float ratio = iResolution.x / iResolution.y;
        
        vec2 tuv = uv;
        tuv -= 0.5;
        
        float degree = noise(vec2(iTime * 0.1, tuv.x * tuv.y));
        
        tuv.y *= 1.0 / ratio;
        tuv *= Rot(radians((degree - 0.5) * 720.0 + 180.0));
        tuv.y *= ratio;
        
        float frequency = 5.0;
        float amplitude = 30.0;
        float speed = iTime * 2.0;
        
        tuv.x += sin(tuv.y * frequency + speed) / amplitude;
        tuv.y += sin(tuv.x * frequency * 1.5 + speed) / (amplitude * 0.5);
        
        vec3 colorYellow = vec3(0.957, 0.804, 0.623);
        vec3 colorDeepBlue = vec3(0.192, 0.384, 0.933);
        vec3 layer1 = mix(colorYellow, colorDeepBlue, S(-0.3, 0.2, (tuv * Rot(radians(-5.0))).x));
        
        vec3 colorRed = vec3(0.910, 0.510, 0.8);
        vec3 colorBlue = vec3(0.350, 0.71, 0.953);
        vec3 layer2 = mix(colorRed, colorBlue, S(-0.3, 0.2, (tuv * Rot(radians(-5.0))).x));
        
        vec3 finalComp = mix(layer1, layer2, S(0.5, -0.3, tuv.y));
        
        gl_FragColor = vec4(finalComp, 1.0);
      }
    `;

    function compileShader(type: number, source: string): WebGLShader | null {
      const glCtx = gl!;
      const shader = glCtx.createShader(type);
      if (!shader) return null;
      glCtx.shaderSource(shader, source);
      glCtx.compileShader(shader);
      if (!glCtx.getShaderParameter(shader, glCtx.COMPILE_STATUS)) {
        console.error("Shader compile error:", glCtx.getShaderInfoLog(shader));
        glCtx.deleteShader(shader);
        return null;
      }
      return shader;
    }

    const vertexShader = compileShader(gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentSource);

    if (!vertexShader || !fragmentShader) {
      console.error("Failed to compile shaders");
      return;
    }

    const program = gl.createProgram();
    if (!program) return;

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("Program link error:", gl.getProgramInfoLog(program));
      return;
    }

    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );

    const positionLoc = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    const resolutionLoc = gl.getUniformLocation(program, "iResolution");
    const timeLoc = gl.getUniformLocation(program, "iTime");

    function resize() {
      const c = canvas!;
      const g = gl!;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.floor(window.innerWidth * dpr);
      const height = Math.floor(window.innerHeight * dpr);
      if (c.width !== width || c.height !== height) {
        c.width = width;
        c.height = height;
      }
      g.viewport(0, 0, c.width, c.height);
    }

    let start = performance.now();

    function render(now: number) {
      resize();
      const t = (now - start) * 0.001;
      const c = canvas!;
      const g = gl!;
      g.uniform2f(resolutionLoc, c.width, c.height);
      g.uniform1f(timeLoc, t);
      g.drawArrays(g.TRIANGLES, 0, 6);
      requestAnimationFrame(render);
    }

    window.addEventListener("resize", resize, { passive: true });
    resize();
    requestAnimationFrame(render);

    return () => {
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div className="not-found-page">
      <canvas ref={canvasRef} className="shader-canvas" />
      <div className="center">
        <div className="content">
          <h1>404</h1>
          <p>Page not found</p>
          <a href="/">← Back to Home</a>
        </div>
      </div>
      <style jsx global>{`
        html, body {
          margin: 0;
          width: 100%;
          height: 100%;
          overflow: hidden;
          background: #000;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
        }
        .not-found-page {
          position: relative;
          width: 100vw;
          height: 100vh;
        }
        .shader-canvas {
          position: fixed;
          inset: 0;
          width: 100vw;
          height: 100vh;
          display: block;
        }
        .center {
          position: fixed;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
          z-index: 2;
        }
        .content {
          text-align: center;
          color: rgba(255, 255, 255, 0.78);
          pointer-events: auto;
          padding: 24px;
        }
        .content h1 {
          margin: 0;
          font-size: clamp(84px, 14vw, 180px);
          line-height: 0.95;
          font-weight: 600;
          opacity: 0.34;
          letter-spacing: 0.02em;
        }
        .content p {
          margin: 18px 0 0;
          font-size: clamp(15px, 1.6vw, 22px);
          opacity: 0.72;
        }
        .content a {
          display: inline-block;
          margin-top: 28px;
          padding: 12px 22px;
          color: rgba(255, 255, 255, 0.92);
          text-decoration: none;
          border: 1px solid rgba(255, 255, 255, 0.35);
          border-radius: 8px;
          transition: background 0.25s ease, border-color 0.25s ease, transform 0.25s ease;
        }
        .content a:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.55);
          transform: translateY(-1px);
        }
      `}</style>
    </div>
  );
}
