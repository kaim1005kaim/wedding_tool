'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export type ParticleShape = 'circle' | 'square' | 'triangle';
export type ParticleColor = 'red' | 'blue' | 'yellow' | 'black' | 'white';

export interface ParticleConfig {
  x: number;
  y: number;
  count?: number;
  shape?: ParticleShape;
  color?: ParticleColor;
  size?: number;
  velocity?: number;
  spread?: number;
}

const BAUHAUS_COLORS = {
  red: new THREE.Color(0xff0000),
  blue: new THREE.Color(0x0000ff),
  yellow: new THREE.Color(0xffff00),
  black: new THREE.Color(0x000000),
  white: new THREE.Color(0xffffff)
};

class Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  rotation: number;
  rotationSpeed: number;
  life: number;
  maxLife: number;
  size: number;
  shape: ParticleShape;
  color: THREE.Color;
  mesh: THREE.Mesh;

  constructor(
    x: number,
    y: number,
    shape: ParticleShape,
    color: ParticleColor,
    size: number,
    velocity: number,
    spread: number
  ) {
    this.position = new THREE.Vector3(x, y, 0);

    const angle = Math.random() * Math.PI * 2;
    const speed = velocity * (0.5 + Math.random() * 0.5);
    const spreadFactor = spread * (0.5 + Math.random() * 0.5);

    this.velocity = new THREE.Vector3(
      Math.cos(angle) * speed * spreadFactor,
      Math.sin(angle) * speed * spreadFactor,
      0
    );

    this.rotation = Math.random() * Math.PI * 2;
    this.rotationSpeed = (Math.random() - 0.5) * 0.1;
    this.life = 1.0;
    this.maxLife = 1.0;
    this.size = size;
    this.shape = shape;
    this.color = BAUHAUS_COLORS[color].clone();

    // Create geometry based on shape
    let geometry: THREE.BufferGeometry;
    switch (shape) {
      case 'circle':
        geometry = new THREE.CircleGeometry(1, 16);
        break;
      case 'square':
        geometry = new THREE.PlaneGeometry(2, 2);
        break;
      case 'triangle':
        geometry = new THREE.BufferGeometry();
        const vertices = new Float32Array([
          0, 1, 0,
          -0.866, -0.5, 0,
          0.866, -0.5, 0
        ]);
        geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        break;
    }

    const material = new THREE.MeshBasicMaterial({
      color: this.color,
      transparent: true,
      opacity: 1,
      side: THREE.DoubleSide
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.copy(this.position);
    this.mesh.scale.setScalar(this.size);
  }

  update(deltaTime: number) {
    // Update position
    this.position.add(this.velocity.clone().multiplyScalar(deltaTime));
    this.mesh.position.copy(this.position);

    // Update rotation
    this.rotation += this.rotationSpeed;
    this.mesh.rotation.z = this.rotation;

    // Update life
    this.life -= deltaTime * 0.5;

    // Update opacity based on life
    const material = this.mesh.material as THREE.MeshBasicMaterial;
    material.opacity = Math.max(0, this.life);

    // Apply gravity
    this.velocity.y -= 0.2 * deltaTime;

    return this.life > 0;
  }
}

export default function ParticleEffect({ trigger }: { trigger: ParticleConfig | null }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Setup scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Setup camera (orthographic for 2D)
    const camera = new THREE.OrthographicCamera(
      0, width,
      0, height,
      -100, 100
    );
    camera.position.z = 10;
    cameraRef.current = camera;

    // Setup renderer
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Animation loop
    const animate = () => {
      const now = Date.now();
      const deltaTime = Math.min((now - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = now;

      // Update particles
      particlesRef.current = particlesRef.current.filter(particle => {
        const alive = particle.update(deltaTime);
        if (!alive) {
          scene.remove(particle.mesh);
          particle.mesh.geometry.dispose();
          (particle.mesh.material as THREE.Material).dispose();
        }
        return alive;
      });

      renderer.render(scene, camera);
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    // Handle resize
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;

      camera.left = 0;
      camera.right = width;
      camera.top = 0;
      camera.bottom = height;
      camera.updateProjectionMatrix();

      renderer.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameRef.current);

      // Cleanup particles
      particlesRef.current.forEach(particle => {
        scene.remove(particle.mesh);
        particle.mesh.geometry.dispose();
        (particle.mesh.material as THREE.Material).dispose();
      });

      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  useEffect(() => {
    if (!trigger || !sceneRef.current) return;

    const {
      x,
      y,
      count = 20,
      shape = 'circle',
      color = 'blue',
      size = 10,
      velocity = 100,
      spread = 1
    } = trigger;

    // Convert screen coordinates to scene coordinates
    const sceneX = x;
    const sceneY = window.innerHeight - y;

    // Create particles
    for (let i = 0; i < count; i++) {
      const shapes: ParticleShape[] = ['circle', 'square', 'triangle'];
      const colors: ParticleColor[] = ['red', 'blue', 'yellow'];

      const particleShape = shape === 'circle' && Math.random() > 0.7
        ? shapes[Math.floor(Math.random() * shapes.length)]
        : shape;

      const particleColor = color === 'blue' && Math.random() > 0.7
        ? colors[Math.floor(Math.random() * colors.length)]
        : color;

      const particle = new Particle(
        sceneX,
        sceneY,
        particleShape,
        particleColor,
        size,
        velocity,
        spread
      );

      sceneRef.current.add(particle.mesh);
      particlesRef.current.push(particle);
    }
  }, [trigger]);

  return (
    <div
      ref={containerRef}
      className="pointer-events-none fixed inset-0 z-50"
      style={{ mixBlendMode: 'normal' }}
    />
  );
}
