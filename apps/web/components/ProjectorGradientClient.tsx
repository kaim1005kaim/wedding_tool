'use client';

import { useRef, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

function ProjectorGradientMesh({ params }: { params: { zoom: number; speed: number; grainAmount: number; grainSpeed: number } }) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const [textures, setTextures] = useState<{ gradientOrange: THREE.Texture | null; gradientBlue: THREE.Texture | null; noise: THREE.Texture | null }>({
    gradientOrange: null,
    gradientBlue: null,
    noise: null
  });

  useEffect(() => {
    const textureLoader = new THREE.TextureLoader();
    const gradientOrangeTexture = textureLoader.load('/textures/gradient.jpg');
    const gradientBlueTexture = textureLoader.load('/textures/gradient_blue.png');
    const noiseTexture = textureLoader.load('/textures/perlin.png');

    gradientOrangeTexture.wrapS = gradientOrangeTexture.wrapT = THREE.RepeatWrapping;
    gradientBlueTexture.wrapS = gradientBlueTexture.wrapT = THREE.RepeatWrapping;
    noiseTexture.wrapS = noiseTexture.wrapT = THREE.RepeatWrapping;

    setTextures({ gradientOrange: gradientOrangeTexture, gradientBlue: gradientBlueTexture, noise: noiseTexture });
  }, []);

  const uniformsRef = useRef<{
    uTime: { value: number };
    uResolution: { value: THREE.Vector2 };
    uZoom: { value: number };
    uSpeed: { value: number };
    uGrainAmount: { value: number };
    uGrainSpeed: { value: number };
    uNoise: { value: THREE.Texture | null };
    uGradientOrange: { value: THREE.Texture | null };
    uGradientBlue: { value: THREE.Texture | null };
    uCursorTexture: { value: THREE.Texture | null };
  }>({
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(typeof window !== 'undefined' ? window.innerWidth : 1920, typeof window !== 'undefined' ? window.innerHeight : 1080) },
    uZoom: { value: params.zoom },
    uSpeed: { value: params.speed },
    uGrainAmount: { value: params.grainAmount },
    uGrainSpeed: { value: params.grainSpeed },
    uNoise: { value: null },
    uGradientOrange: { value: null },
    uGradientBlue: { value: null },
    uCursorTexture: { value: null }
  });

  useEffect(() => {
    if (textures.gradientOrange && textures.gradientBlue && textures.noise && uniformsRef.current) {
      uniformsRef.current.uGradientOrange.value = textures.gradientOrange;
      uniformsRef.current.uGradientBlue.value = textures.gradientBlue;
      uniformsRef.current.uNoise.value = textures.noise;
    }
  }, [textures]);

  const vertexShader = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const fragmentShader = `
    uniform float uTime;
    uniform float uSpeed;
    uniform float uZoom;
    uniform float uGrainAmount;
    uniform float uGrainSpeed;
    uniform vec2 uResolution;
    uniform sampler2D uNoise;
    uniform sampler2D uGradientOrange;
    uniform sampler2D uGradientBlue;
    uniform sampler2D uCursorTexture;
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
      mat2 m = mat2(-0.80, 0.36, -0.60, -0.48);
      float total;
      total = 0.2500 * snoise(pos) * b;
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
      vec3 color = vec3(0.2);

      vec4 noiseTex = texture2D(uNoise, uv);
      vec4 mouseTex = texture2D(uCursorTexture, uv);
      float amplitude = 0.3;

      // Convert normalized values into regular unit vector
      float vx = -(mouseTex.r * 2. - 1.);
      float vy = (mouseTex.g * 2. - 1.);

      uv.x += noiseTex.r * vx * amplitude * mouseTex.b;
      uv.y += noiseTex.r * vy * amplitude * mouseTex.b;

      vec2 gradientUV = uv;

      vec2 gradientShaderUv2 = uv * uZoom;

      gradientShaderUv2.xy *= (uResolution.x / uResolution.y) * 10.;
      gradientShaderUv2.y *= uResolution.y / uResolution.x;
      gradientShaderUv2.xy += uTime * .05;
      gradientShaderUv2 = rotateUV(gradientShaderUv2, uTime * .05);

      vec4 gradientShader2 = gradientShader(gradientShaderUv2, uTime, 0.0, 1.);
      gradientShader2 /= .25;

      gradientUV = rotateUV(gradientUV, uTime * uSpeed);
      gradientUV.xy -= .5;
      gradientUV.y *= uResolution.y / uResolution.x;
      gradientUV.xy += .5;
      gradientUV.xy -= .5;
      gradientUV.y *= gradientShader2.r * 4.;
      gradientUV.xy += .5;

      // テクスチャを時間経過で交互に切り替え（20秒サイクル）
      float colorCycle = sin(uTime * 0.15) * 0.5 + 0.5;  // 0.0 - 1.0 の範囲で変化

      vec4 gradientOrange = texture(uGradientOrange, gradientUV);
      vec4 gradientBlue = texture(uGradientBlue, gradientUV);

      // smoothstep で美しく補間
      float mixFactor = smoothstep(0.3, 0.7, colorCycle);
      vec4 gradientTexture = mix(gradientOrange, gradientBlue, mixFactor);

      vec2 grainedUv = uv + snoise(uv * 400.0);
      float grainSpeed = uGrainSpeed;
      float grain = snoise(grainedUv + uTime * random(grainedUv) * grainSpeed);
      vec3 bg = vec3(grain) * uGrainAmount;

      gl_FragColor = vec4(gradientTexture.rgb + bg, 1.);
    }
  `;

  useFrame((state) => {
    if (uniformsRef.current) {
      uniformsRef.current.uTime.value = state.clock.elapsedTime;
      uniformsRef.current.uZoom.value = params.zoom;
      uniformsRef.current.uSpeed.value = params.speed;
      uniformsRef.current.uGrainAmount.value = params.grainAmount;
      uniformsRef.current.uGrainSpeed.value = params.grainSpeed;
    }
  });

  return (
    <mesh scale={[2, 2, 1]}>
      <planeGeometry args={[2, 2, 1, 1]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniformsRef.current}
      />
    </mesh>
  );
}

export default function ProjectorGradientClient({ className }: { className?: string }) {
  const [hasError, setHasError] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const params = {
    zoom: 0.3,
    speed: 0.12,
    grainAmount: 0.018,
    grainSpeed: 5.0
  };

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
          orthographic
          camera={{ position: [0, 0, 1], zoom: 1, left: -1, right: 1, top: 1, bottom: -1, near: 0.1, far: 1000 }}
          gl={{
            antialias: false,
            alpha: false,
            powerPreference: 'high-performance'
          }}
          dpr={[1, 2]}
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
    </>
  );
}
