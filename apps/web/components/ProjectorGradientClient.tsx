'use client';

import { useRef, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

function ProjectorGradientMesh() {
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

      // 16:9 projector optimized parameters
      float zoom = 0.8;  // Increased from 0.5 for tighter gradient
      float speed = 0.5;
      float grainAmount = 0.07;
      float grainSpeed = 5.0;

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
          uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
        }}
      />
    </mesh>
  );
}

export default function ProjectorGradientClient({ className }: { className?: string }) {
  const [hasError, setHasError] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
    <div className={`fixed inset-0 -z-10 ${className}`}>
      <Canvas
        ref={canvasRef}
        camera={{ position: [0, 0, 1], fov: 75 }}
        gl={{
          antialias: false,
          alpha: false,
          powerPreference: 'high-performance'
        }}
        dpr={[1, 1]}
        onCreated={(state) => {
          console.log('Three.js Canvas created successfully');
        }}
        onError={(error) => {
          console.error('Three.js Canvas error:', error);
          setHasError(true);
        }}
      >
        <ProjectorGradientMesh />
      </Canvas>
    </div>
  );
}
