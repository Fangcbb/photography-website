"use client";

import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";

function MobileToggle({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="fixed top-3 right-3 z-[110] bg-black/80 rounded-full size-10 flex items-center justify-center cursor-pointer select-none lg:hidden backdrop-blur-sm"
      aria-label={open ? "Close menu" : "Open menu"}
    >
      {open ? <X size={20} color="white" /> : <Menu size={20} color="white" />}
    </button>
  );
}

export default function NotFoundClient() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const toggleMenu = () => setMenuOpen(!menuOpen);

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

    if (!vertexShader || !fragmentShader) return;

    const program = gl.createProgram();
    if (!program) return;

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;

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

      {/* Mobile toggle */}
      <MobileToggle open={menuOpen} onToggle={toggleMenu} />

      {/* Navigation */}
      <header className="nf-header">
        <nav className="nf-nav container">
          <a href="/" className="nf-nav__logo">
            <img src="/121.svg" alt="Photography" className="nf-logo-img" />
          </a>
          <div
            className={`nf-nav__menu${menuOpen ? " show-menu" : ""}`}
            id="nav-menu"
          >
            <ul className="nf-nav__list">
              {[
                { label: "Home", href: "/" },
                { label: "Travel", href: "/travel" },
                { label: "Discover", href: "/discover" },
                { label: "Music", href: "/music" },
                { label: "Blog", href: "/blog" },
                { label: "About", href: "/about" },
              ].map((item) => (
                <li key={item.href} className="nf-nav__item">
                  <a
                    href={item.href}
                    className="nf-nav__link"
                    onClick={() => setMenuOpen(false)}
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </nav>
      </header>

      {/* 404 Content — Bedimcode ghost style */}
      <div className="nf-container">
        <div className="nf-content">
          <span className="nf-subtitle">Error 404</span>
          <h1 className="nf-title">Hey Buddy</h1>
          <p className="nf-desc">
            We can&apos;t seem to find the page you are looking for.
          </p>
          <a href="/" className="nf-button">
            Go Home
          </a>
        </div>

        <div className="nf-ghost-wrapper">
          <img
            src="/404-ghost.png"
            alt="Ghost"
            className="nf-ghost-img"
          />
          <div className="nf-ghost-shadow" />
        </div>
      </div>

      <style jsx global>{`
        @import url("https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&display=swap");

        html, body {
          margin: 0;
          width: 100%;
          height: 100%;
          overflow: hidden;
          background: #000;
          font-family: "Space Grotesk", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
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

        .nf-container {
          position: fixed;
          inset: 0;
          z-index: 2;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6rem 4rem 2rem;
          gap: 3rem;
        }

        .nf-content {
          text-align: left;
          color: #fff;
          flex: 1 1 0;
          min-width: 0;
        }

        .nf-subtitle {
          font-size: 1rem;
          font-weight: 500;
          opacity: 0.7;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .nf-title {
          font-size: clamp(3rem, 8vw, 5.5rem);
          font-weight: 700;
          margin: 0.5rem 0;
          line-height: 1;
          letter-spacing: -0.02em;
        }

        .nf-desc {
          font-size: clamp(0.9rem, 1.5vw, 1.1rem);
          opacity: 0.75;
          line-height: 1.6;
          margin-top: 0.5rem;
        }

        .nf-button {
          display: inline-block;
          margin-top: 2rem;
          padding: 0.8rem 2rem;
          background-color: #fff;
          color: #1a1a2e;
          font-weight: 600;
          font-size: 1rem;
          border-radius: 3rem;
          text-decoration: none;
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }

        .nf-button:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
        }

        /* ===== Header ===== */
        .nf-header {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          z-index: 100;
        }

        .nf-nav {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.2rem 6rem;
        }

        .nf-nav__menu {
          margin-left: auto;
          margin-right: 0;
        }

        .nf-nav__logo {
          display: flex;
          align-items: center;
          text-decoration: none;
          transition: opacity 0.2s;
          margin-left: 1rem;
        }

        .nf-nav__logo:hover {
          opacity: 0.7;
        }

        .nf-logo-img {
          height: clamp(18px, 2.2vw, 28px);
          width: auto;
        }

        .nf-nav__list {
          display: flex;
          align-items: center;
          gap: 2rem;
          list-style: none;
          margin: 0;
          padding: 0;
        }

        .nf-nav__link {
          color: rgba(255, 255, 255, 0.65);
          text-decoration: none;
          font-size: 0.9rem;
          font-weight: 500;
          transition: color 0.2s;
          letter-spacing: 0.03em;
        }

        .nf-nav__link:hover {
          color: rgba(255, 255, 255, 1);
        }

        /* Mobile (< 1024px): hide desktop nav, show hamburger */
        @media (max-width: 1023px) {
          .nf-nav {
            padding: 1rem 1.5rem;
          }
          .nf-nav__menu {
            display: none;
          }
          .nf-nav__list {
            gap: 1.5rem;
          }
          .nf-nav__link {
            font-size: 0.85rem;
          }
          .nf-container {
            padding-top: 5rem;
          }
        }

        /* Show mobile menu */
        .show-menu {
          display: flex !important;
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          padding: 5rem 2rem 3rem;
          flex-direction: column;
          align-items: center;
          gap: 1.8rem;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(12px);
        }
        .show-menu .nf-nav__list {
          flex-direction: column;
          gap: 1.8rem;
        }
        .show-menu .nf-nav__link {
          font-size: 1.1rem;
        }

        .nf-ghost-wrapper {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-top: 2rem;
          flex: 0 0 auto;
        }

        .nf-ghost-img {
          width: clamp(160px, 22vw, 320px);
          height: auto;
          animation: floaty 2s infinite ease-in-out alternate;
          filter: drop-shadow(0 12px 24px rgba(0, 0, 0, 0.25));
        }

        .nf-ghost-shadow {
          width: clamp(100px, 14vw, 200px);
          height: 16px;
          background: rgba(0, 0, 0, 0.2);
          border-radius: 50%;
          margin-top: 8px;
          animation: shadow 2s infinite ease-in-out alternate;
          filter: blur(6px);
        }

        @keyframes floaty {
          0% { transform: translateY(0px); }
          100% { transform: translateY(18px); }
        }

        @keyframes shadow {
          0% { transform: scale(1, 1); opacity: 0.2; }
          100% { transform: scale(0.8, 0.8); opacity: 0.12; }
        }

        /* Mobile: keep side-by-side, compact */
        @media (max-width: 767px) {
          .nf-container {
            flex-direction: row;
            align-items: center;
            justify-content: space-between;
            gap: 1.25rem;
            padding: 4rem 1.5rem 1.5rem;
          }
          .nf-content {
            flex: 1 1 0;
            min-width: 0;
          }
          .nf-title {
            font-size: clamp(2rem, 10vw, 3rem);
            margin: 0.25rem 0;
          }
          .nf-subtitle {
            font-size: 0.75rem;
          }
          .nf-desc {
            font-size: 0.8rem;
            line-height: 1.5;
            margin-top: 0.25rem;
          }
          .nf-button {
            margin-top: 1rem;
            padding: 0.6rem 1.5rem;
            font-size: 0.85rem;
          }
          .nf-ghost-wrapper {
            flex: 0 0 auto;
            margin-top: 0;
          }
          .nf-ghost-img {
            width: clamp(110px, 28vw, 150px);
          }
          .nf-ghost-shadow {
            width: clamp(72px, 18vw, 100px);
          }
        }
      `}</style>
    </div>
  );
}
