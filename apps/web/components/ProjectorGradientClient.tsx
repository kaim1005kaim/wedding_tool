'use client';

import { useRef, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

function ProjectorGradientMesh({ params }: { params: { zoom: number; speed: number; grainAmount: number; grainSpeed: number } }) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const vertexShader = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const fragmentShader = `
    uniform float uTime;
    uniform vec2 uResolution;
    uniform float uZoom;
    uniform float uSpeed;
    uniform float uGrainAmount;
    uniform float uGrainSpeed;
    varying vec2 vUv;

    // Simplex Noise
    vec3 mod289(vec3 x) {
      return x - floor(x * (1.0 / 289.0)) * 289.0;
    }

    vec2 mod289(vec2 x) {
      return x - floor(x * (1.0 / 289.0)) * 289.0;
    }

    vec3 permute(vec3 x) {
      return mod289(((x * 34.0) + 1.0) * x);
    }

    float snoise(vec2 v) {
      const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
      vec2 i = floor(v + dot(v, C.yy));
      vec2 x0 = v - i + dot(i, C.xx);
      vec2 i1;
      i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
      vec4 x12 = x0.xyxy + C.xxzz;
      x12.xy -= i1;
      i = mod289(i);
      vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
      vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
      m = m * m;
      m = m * m;
      vec3 x = 2.0 * fract(p * C.www) - 1.0;
      vec3 h = abs(x) - 0.5;
      vec3 ox = floor(x + 0.5);
      vec3 a0 = x - ox;
      m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
      vec3 g;
      g.x = a0.x * x0.x + h.x * x0.y;
      g.yz = a0.yz * x12.xz + h.yz * x12.yw;
      return 130.0 * dot(m, g);
    }

    // Rotate UV
    vec2 rotateUV(vec2 uv, float rotation) {
      float mid = 0.5;
      return vec2(
        cos(rotation) * (uv.x - mid) + sin(rotation) * (uv.y - mid) + mid,
        cos(rotation) * (uv.y - mid) - sin(rotation) * (uv.x - mid) + mid
      );
    }

    // FBM with simplex noise
    float gradientShaderFbm(vec2 pos, float time, float speed) {
      float a = sin(time * speed);
      float b = cos(time * speed);
      float total = 0.0;
      total += 0.25 * snoise(pos) * b;
      return total;
    }

    vec4 gradientShader(vec2 uv, float time, float speed, float multiplier) {
      vec2 pos = uv.xy * 0.05;
      vec2 q = vec2(
        gradientShaderFbm(pos + vec2(0.0), time, speed),
        gradientShaderFbm(pos + vec2(0.0), time, speed)
      );
      float c = gradientShaderFbm(pos + sin(time * speed) * multiplier * q, time, speed);
      return vec4(vec3(c), 1.0);
    }

    float random(vec2 st) {
      return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec2 uv = vUv;

      // Parameters from uniforms
      float zoom = uZoom;
      float speed = uSpeed;
      float grainAmount = uGrainAmount;
      float grainSpeed = uGrainSpeed;

      // Adjust UV for 16:9 aspect ratio
      vec2 aspectUv = uv;
      aspectUv.x *= 16.0 / 9.0;

      // First layer - generates distortion pattern (scaled down for visibility)
      vec2 gradientShaderUv2 = aspectUv * zoom;
      gradientShaderUv2.xy *= 6.0;  // Reduced from 10.0 for smaller noise pattern
      gradientShaderUv2.xy += uTime * 0.05;
      gradientShaderUv2 = rotateUV(gradientShaderUv2, uTime * 0.05);

      vec4 gradientShader2 = gradientShader(gradientShaderUv2, uTime, 0.0, 1.0);
      gradientShader2 /= 0.25;

      // Apply distortion to UV coordinates
      vec2 gradientUV = uv;
      gradientUV = rotateUV(gradientUV, uTime * speed);
      gradientUV.xy -= 0.5;
      gradientUV.xy += 0.5;
      gradientUV.xy -= 0.5;
      gradientUV.y *= gradientShader2.r * 3.0;  // Reduced from 4.0 for gentler distortion
      gradientUV.xy += 0.5;

      // 時間経過で色変化: オレンジ(#f98d28) → ティールブルー(#3ba1b7)
      float colorCycle = sin(uTime * 0.1) * 0.5 + 0.5;
      vec3 colorOrange = vec3(0.976, 0.553, 0.157);  // #f98d28
      vec3 colorTeal = vec3(0.231, 0.631, 0.718);     // #3ba1b7

      // Create smooth gradient base
      vec3 color1 = colorOrange;
      vec3 color2 = colorTeal;

      // Mix colors based on distorted UV
      float gradientMix = smoothstep(0.0, 1.0, gradientUV.y);
      vec3 gradientColor = mix(color1, color2, gradientMix);

      // Add temporal color cycle
      vec3 color = mix(gradientColor, mix(color2, color1, gradientMix), colorCycle * 0.3);

      // Grain effect (subtle)
      vec2 grainedUv = uv + snoise(uv * 400.0);
      float grain = snoise(grainedUv + uTime * random(grainedUv) * grainSpeed);
      vec3 bg = vec3(grain) * grainAmount;

      gl_FragColor = vec4(color + bg, 1.0);
    }
  `;

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
      materialRef.current.uniforms.uZoom.value = params.zoom;
      materialRef.current.uniforms.uSpeed.value = params.speed;
      materialRef.current.uniforms.uGrainAmount.value = params.grainAmount;
      materialRef.current.uniforms.uGrainSpeed.value = params.grainSpeed;
    }
  });

  return (
    <mesh>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={{
          uTime: { value: 0 },
          uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
          uZoom: { value: params.zoom },
          uSpeed: { value: params.speed },
          uGrainAmount: { value: params.grainAmount },
          uGrainSpeed: { value: params.grainSpeed }
        }}
      />
    </mesh>
  );
}

export default function ProjectorGradientClient({ className }: { className?: string }) {
  const [hasError, setHasError] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showControls, setShowControls] = useState(true);
  const [params, setParams] = useState({
    zoom: 0.8,
    speed: 0.5,
    grainAmount: 0.07,
    grainSpeed: 5.0
  });

  useEffect(() => {
    const handleContextLost = (event: Event) => {
      event.preventDefault();
      console.warn('WebGL context lost, attempting to restore...');
    };

    const handleContextRestored = () => {
      console.log('WebGL context restored');
      setHasError(false);
    };

    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener('webglcontextlost', handleContextLost);
      canvas.addEventListener('webglcontextrestored', handleContextRestored);

      return () => {
        canvas.removeEventListener('webglcontextlost', handleContextLost);
        canvas.removeEventListener('webglcontextrestored', handleContextRestored);
      };
    }
  }, []);

  if (hasError) {
    return (
      <div className={`fixed inset-0 -z-10 bg-gradient-earth ${className}`} />
    );
  }

  return (
    <>
      <div className={`fixed inset-0 -z-10 w-screen h-screen ${className}`} style={{ margin: 0, padding: 0 }}>
        <Canvas
          ref={canvasRef}
          camera={{ position: [0, 0, 1], fov: 75 }}
          gl={{
            antialias: false,
            alpha: false,
            powerPreference: 'high-performance'
          }}
          dpr={[1, 1]}
          style={{ display: 'block', width: '100vw', height: '100vh' }}
          onCreated={(state) => {
            console.log('Three.js Canvas created successfully');
          }}
          onError={(error) => {
            console.error('Three.js Canvas error:', error);
            setHasError(true);
          }}
        >
          <ProjectorGradientMesh params={params} />
        </Canvas>
      </div>

      {/* Parameter Controls */}
      {showControls && (
        <div className="fixed top-4 right-4 z-[100] glass-panel-strong rounded-2xl p-6 shadow-xl border border-white/30 w-80">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white">Gradient Controls</h3>
            <button
              onClick={() => setShowControls(false)}
              className="text-white hover:text-red-400 text-xl font-bold"
            >
              ✕
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-white mb-2">
                uZoom: {params.zoom.toFixed(2)}
              </label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.01"
                value={params.zoom}
                onChange={(e) => setParams({ ...params, zoom: parseFloat(e.target.value) })}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-white mb-2">
                uSpeed: {params.speed.toFixed(2)}
              </label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.01"
                value={params.speed}
                onChange={(e) => setParams({ ...params, speed: parseFloat(e.target.value) })}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-white mb-2">
                uGrainAmount: {params.grainAmount.toFixed(3)}
              </label>
              <input
                type="range"
                min="0"
                max="0.5"
                step="0.001"
                value={params.grainAmount}
                onChange={(e) => setParams({ ...params, grainAmount: parseFloat(e.target.value) })}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-white mb-2">
                uGrainSpeed: {params.grainSpeed.toFixed(1)}
              </label>
              <input
                type="range"
                min="0"
                max="20"
                step="0.1"
                value={params.grainSpeed}
                onChange={(e) => setParams({ ...params, grainSpeed: parseFloat(e.target.value) })}
                className="w-full"
              />
            </div>

            <div className="pt-4 border-t border-white/20">
              <p className="text-xs text-white/70 mb-2">Current values:</p>
              <pre className="text-xs text-white/90 bg-black/20 p-2 rounded">
                {JSON.stringify(params, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Toggle button when hidden */}
      {!showControls && (
        <button
          onClick={() => setShowControls(true)}
          className="fixed top-4 right-4 z-[100] glass-panel-strong rounded-xl px-4 py-2 shadow-lg border border-white/30 text-white font-bold hover:bg-white/20"
        >
          ⚙️ Controls
        </button>
      )}
    </>
  );
}
