'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { getPalette } from 'colorthief'

interface Props {
  coverUrl: string
  playing: boolean
}

export default function AuraShaderBackground({ coverUrl, playing }: Props) {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!mountRef.current) return

    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))

    mountRef.current.appendChild(renderer.domElement)

    // 柔和的蓝紫默认渐变
    const defaultPalette = [
      [0.6, 0.7, 0.9],
      [0.5, 0.6, 0.8],
      [0.7, 0.6, 0.9],
      [0.6, 0.8, 0.9],
      [0.5, 0.7, 0.6],
      [0.6, 0.5, 0.7],
      [0.7, 0.7, 0.8],
      [0.5, 0.6, 0.7],
    ]

    const colors = defaultPalette.map(c => new THREE.Color(...c))
    const targetColors = defaultPalette.map(c => new THREE.Color(...c))

    const uniforms = {
      iTime: { value: 0 },
      iResolution: {
        value: new THREE.Vector2(window.innerWidth, window.innerHeight)
      },
      uColors: { value: colors },
      uPlaying: { value: playing ? 1 : 0 }
    }

    const material = new THREE.ShaderMaterial({
      uniforms,
      fragmentShader: `
      precision mediump float;

      uniform float iTime;
      uniform vec2 iResolution;
      uniform vec3 uColors[8];
      uniform float uPlaying;

      #define S(a,b,t) smoothstep(a,b,t)

      mat2 Rot(float a){
          float s = sin(a);
          float c = cos(a);
          return mat2(c,-s,s,c);
      }

      vec2 hash(vec2 p){
          p = vec2(dot(p,vec2(2127.1,81.17)), dot(p,vec2(1269.5,283.37)));
          return fract(sin(p)*43758.5453);
      }

      float noise(vec2 p){
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f*f*(3.0-2.0*f);

          float n = mix(
              mix(dot(-1.0+2.0*hash(i+vec2(0.0)), f),
                  dot(-1.0+2.0*hash(i+vec2(1.0,0.0)), f-vec2(1.0,0.0)), u.x),
              mix(dot(-1.0+2.0*hash(i+vec2(0.0,1.0)), f-vec2(0.0,1.0)),
                  dot(-1.0+2.0*hash(i+vec2(1.0)), f-vec2(1.0)), u.x), u.y);

          return 0.5 + 0.5*n;
      }

      vec3 getGradient(float t){
          float scaled = clamp(t, 0.0, 0.999) * 7.0;
          int i = int(floor(scaled));
          float f = fract(scaled);
          return mix(uColors[i], uColors[min(i+1,7)], f);
      }

      vec3 screen(vec3 a, vec3 b){
          return 1.0 - (1.0 - a)*(1.0 - b);
      }

      void main(){
          vec2 uv = gl_FragCoord.xy / iResolution.xy;
          float ratio = iResolution.x / iResolution.y;

          vec2 tuv = uv;
          tuv -= 0.5;

          // rotate with Noise (原版参数)
          float degree = noise(vec2(iTime*0.1, tuv.x*tuv.y));

          tuv.y *= 1.0/ratio;
          tuv *= Rot(radians((degree-0.5)*720.0+180.0));
          tuv.y *= ratio;

          // Wave warp with sin (原版参数)
          float frequency = 5.0;
          float amplitude = 30.0;
          float speed = iTime * 2.0;
          tuv.x += sin(tuv.y*frequency+speed)/amplitude;
          tuv.y += sin(tuv.x*frequency*1.5+speed)/(amplitude*0.5);

          // draw the image (原版逻辑)
          vec3 layer1 = mix(uColors[0], uColors[1], S(-0.3, 0.2, (tuv*Rot(radians(-5.0))).x));
          vec3 layer2 = mix(uColors[2], uColors[3], S(-0.3, 0.2, (tuv*Rot(radians(-5.0))).x));

          vec3 finalComp = mix(layer1, layer2, S(0.5, -0.3, tuv.y));

          vec3 finalColor = finalComp;

          float vignette = smoothstep(0.8, 0.2, length(uv - 0.5));
          finalColor *= mix(1.0, vignette, 0.15);

          // Playing transition
          vec3 idleColor = uColors[4];
          finalColor = mix(idleColor, finalColor, uPlaying);

          gl_FragColor = vec4(finalColor, 1.0);
      }
      `
    })

    const geometry = new THREE.PlaneGeometry(2, 2)
    const mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)

    const loadColors = async () => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.src = coverUrl

      img.onload = async () => {
        try {
          // 新版 colorthief v3 API: getPalette(img, { colorCount: N })
          const palette = await getPalette(img, { colorCount: 20 })

          for (let i = 0; i < 8; i++) {
            const c = palette?.[i]
            if (!c) continue
            // 新版 Color 对象: c.rgb().r / c.rgb().g / c.rgb().b
            const rgb = c.rgb()
            targetColors[i].setRGB(rgb.r / 255, rgb.g / 255, rgb.b / 255)
          }
        } catch (e) {
          console.error('Color extraction failed:', e)
        }
      }
    }

    loadColors()

    let start = performance.now()

    const animate = () => {
      requestAnimationFrame(animate)

      uniforms.iTime.value = (performance.now() - start) / 1000
      uniforms.uPlaying.value = playing ? 1 : 0

      for (let i = 0; i < 8; i++) {
        colors[i].lerp(targetColors[i], 0.08)
      }

      renderer.render(scene, camera)
    }

    animate()

    const handleResize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight)
      uniforms.iResolution.value.set(window.innerWidth, window.innerHeight)
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      renderer.dispose()
      geometry.dispose()
      material.dispose()
      mountRef.current?.removeChild(renderer.domElement)
    }
  }, [coverUrl, playing])

  return <div ref={mountRef} className="fixed inset-0 -z-10" />
}
