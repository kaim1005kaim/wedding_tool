'use client';

import { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Mobile用のグラデーションBackground
 * より軽量なCSS-onlyグラデーション
 */
export function MobileGradientBackground() {
  return (
    <>
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes gradientShift {
            0%, 100% {
              filter: hue-rotate(0deg) brightness(1);
            }
            50% {
              filter: hue-rotate(10deg) brightness(1.05);
            }
          }
        `
      }} />
      <div
        className="fixed inset-0 -z-10"
        style={{
          background: 'linear-gradient(135deg, #F7F3EA 0%, #E8DFD6 20%, #BFB2A0 40%, #8196A9 60%, #4F6C8A 80%, #313559 100%)',
          animation: 'gradientShift 15s ease infinite'
        }}
      />
    </>
  );
}

/**
 * Three.js用のノイズグラデーションシェーダー
 * スペクトラルでスムーズなグラデーションを生成
 */
const NoiseGradientMaterial = () => {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  // シェーダーコード
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
    uniform vec3 uColor1;
    uniform vec3 uColor2;
    uniform vec3 uColor3;
    uniform vec3 uColor4;
    uniform float uNoiseScale;
    uniform float uNoiseIntensity;

    varying vec2 vUv;

    // 3D Simplex noise
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

    float snoise(vec3 v) {
      const vec2 C = vec2(1.0/6.0, 1.0/3.0);
      const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

      vec3 i  = floor(v + dot(v, C.yyy));
      vec3 x0 = v - i + dot(i, C.xxx);

      vec3 g = step(x0.yzx, x0.xyz);
      vec3 l = 1.0 - g;
      vec3 i1 = min(g.xyz, l.zxy);
      vec3 i2 = max(g.xyz, l.zxy);

      vec3 x1 = x0 - i1 + C.xxx;
      vec3 x2 = x0 - i2 + C.yyy;
      vec3 x3 = x0 - D.yyy;

      i = mod289(i);
      vec4 p = permute(permute(permute(
                i.z + vec4(0.0, i1.z, i2.z, 1.0))
              + i.y + vec4(0.0, i1.y, i2.y, 1.0))
              + i.x + vec4(0.0, i1.x, i2.x, 1.0));

      float n_ = 0.142857142857;
      vec3 ns = n_ * D.wyz - D.xzx;

      vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

      vec4 x_ = floor(j * ns.z);
      vec4 y_ = floor(j - 7.0 * x_);

      vec4 x = x_ *ns.x + ns.yyyy;
      vec4 y = y_ *ns.x + ns.yyyy;
      vec4 h = 1.0 - abs(x) - abs(y);

      vec4 b0 = vec4(x.xy, y.xy);
      vec4 b1 = vec4(x.zw, y.zw);

      vec4 s0 = floor(b0)*2.0 + 1.0;
      vec4 s1 = floor(b1)*2.0 + 1.0;
      vec4 sh = -step(h, vec4(0.0));

      vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
      vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;

      vec3 p0 = vec3(a0.xy, h.x);
      vec3 p1 = vec3(a0.zw, h.y);
      vec3 p2 = vec3(a1.xy, h.z);
      vec3 p3 = vec3(a1.zw, h.w);

      vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
      p0 *= norm.x;
      p1 *= norm.y;
      p2 *= norm.z;
      p3 *= norm.w;

      vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
      m = m * m;
      return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
    }

    // Fractal Brownian Motion
    float fbm(vec3 p) {
      float value = 0.0;
      float amplitude = 0.5;
      float frequency = 1.0;

      for(int i = 0; i < 5; i++) {
        value += amplitude * snoise(p * frequency);
        frequency *= 2.0;
        amplitude *= 0.5;
      }

      return value;
    }

    void main() {
      vec2 uv = vUv;

      // ノイズ座標（時間でスクロール）
      vec3 noiseCoord = vec3(
        uv.x * uNoiseScale,
        uv.y * uNoiseScale,
        uTime * 0.1
      );

      // ノイズ値を取得
      float noise = fbm(noiseCoord) * uNoiseIntensity;

      // UV座標を歪める
      vec2 distortedUV = uv + vec2(noise * 0.1);

      // 4色のスペクトラルグラデーション
      vec3 color;
      float mixValue = distortedUV.x + distortedUV.y * 0.5;

      if (mixValue < 0.33) {
        color = mix(uColor1, uColor2, mixValue / 0.33);
      } else if (mixValue < 0.66) {
        color = mix(uColor2, uColor3, (mixValue - 0.33) / 0.33);
      } else {
        color = mix(uColor3, uColor4, (mixValue - 0.66) / 0.34);
      }

      // ノイズをブレンド
      color += vec3(noise * 0.05);

      gl_FragColor = vec4(color, 1.0);
    }
  `;

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
      uColor1: { value: new THREE.Color('#FF1744') },      // ビブラントレッド
      uColor2: { value: new THREE.Color('#FF6B35') },      // オレンジ
      uColor3: { value: new THREE.Color('#00BCD4') },      // シアン
      uColor4: { value: new THREE.Color('#1A237E') },      // ディープブルー
      uNoiseScale: { value: 2.0 },
      uNoiseIntensity: { value: 0.5 }
    }),
    []
  );

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = clock.getElapsedTime();
    }
  });

  return (
    <shaderMaterial
      ref={materialRef}
      vertexShader={vertexShader}
      fragmentShader={fragmentShader}
      uniforms={uniforms}
    />
  );
};

/**
 * ノイズグラデーション背景コンポーネント
 */
interface NoiseGradientBackgroundProps {
  className?: string;
  colors?: [string, string, string, string];
  noiseScale?: number;
  noiseIntensity?: number;
}

export function NoiseGradientBackground({
  className = '',
  colors,
  noiseScale = 2.0,
  noiseIntensity = 0.5
}: NoiseGradientBackgroundProps) {
  return (
    <div className={`fixed inset-0 -z-10 ${className}`}>
      <Canvas
        camera={{ position: [0, 0, 1], fov: 75 }}
        gl={{ antialias: true, alpha: false }}
      >
        <mesh>
          <planeGeometry args={[2, 2]} />
          <NoiseGradientMaterial />
        </mesh>
      </Canvas>
    </div>
  );
}

/**
 * プリセット: 投影画面用（ビブラントなスペクトラル）
 */
export function ProjectorGradientBackground({ className }: { className?: string }) {
  const [hasError, setHasError] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // クライアントサイドでのみレンダリング
  if (!isClient) {
    return (
      <div
        className={`fixed inset-0 -z-10 ${className}`}
        style={{
          background: 'linear-gradient(135deg, #F7F3EA 0%, #E8DFD6 20%, #BFB2A0 40%, #8196A9 60%, #4F6C8A 80%, #313559 100%)'
        }}
      />
    );
  }

  // エラーが発生した場合はフォールバック
  if (hasError) {
    return (
      <div
        className={`fixed inset-0 -z-10 ${className}`}
        style={{
          background: 'linear-gradient(135deg, #F7F3EA 0%, #E8DFD6 20%, #BFB2A0 40%, #8196A9 60%, #4F6C8A 80%, #313559 100%)'
        }}
      />
    );
  }

  return (
    <div className={`fixed inset-0 -z-10 ${className}`}>
      <Canvas
        camera={{ position: [0, 0, 1], fov: 75 }}
        gl={{ antialias: true, alpha: false }}
        onCreated={(state) => {
          // Three.jsの初期化成功
          console.log('Three.js initialized successfully');
        }}
        onError={(error) => {
          console.error('Three.js error:', error);
          setHasError(true);
        }}
      >
        <ProjectorGradientMesh />
      </Canvas>
    </div>
  );
}

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
    varying vec2 vUv;

    // Hash関数（ノイズ生成用）
    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    // バリューノイズ
    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);

      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));

      return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }

    // FBM
    float fbm(vec2 p) {
      float value = 0.0;
      float amplitude = 0.5;
      for(int i = 0; i < 6; i++) {
        value += amplitude * noise(p);
        p *= 2.0;
        amplitude *= 0.5;
      }
      return value;
    }

    void main() {
      vec2 uv = vUv;

      // アニメーションするノイズ
      float t = uTime * 0.05;
      vec2 noiseCoord = uv * 3.0 + vec2(t, t * 0.5);
      float n = fbm(noiseCoord);

      // スペクトラルグラデーション（赤→オレンジ→ティール→ブルー）
      vec3 color1 = vec3(0.9, 0.1, 0.2);  // 赤
      vec3 color2 = vec3(1.0, 0.4, 0.2);  // オレンジ
      vec3 color3 = vec3(0.0, 0.7, 0.8);  // ティール
      vec3 color4 = vec3(0.1, 0.1, 0.5);  // ディープブルー

      float mixVal = uv.x * 0.7 + uv.y * 0.3 + n * 0.2;

      vec3 color;
      if (mixVal < 0.33) {
        color = mix(color1, color2, mixVal / 0.33);
      } else if (mixVal < 0.66) {
        color = mix(color2, color3, (mixVal - 0.33) / 0.33);
      } else {
        color = mix(color3, color4, (mixVal - 0.66) / 0.34);
      }

      // ノイズテクスチャを追加
      color += vec3(n * 0.08);

      gl_FragColor = vec4(color, 1.0);
    }
  `;

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 }
    }),
    []
  );

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = clock.getElapsedTime();
    }
  });

  return (
    <mesh>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
      />
    </mesh>
  );
}
