import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface OrientalThreeCanvasProps {
  className?: string;
  intensity?: 'hero' | 'ambient';
}

export default function OrientalThreeCanvas({ className = '', intensity = 'hero' }: OrientalThreeCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene & Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 0, 18);

    // Renderer with transparency
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xfff3e0, 1.2);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffdfba, 1.5);
    dirLight.position.set(5, 10, 7);
    scene.add(dirLight);

    // ── 1. PROCEDURAL 3D CHINESE LANTERNS ────────────────────────
    const lanternGroup = new THREE.Group();
    scene.add(lanternGroup);

    interface LanternData {
      group: THREE.Group;
      initialX: number;
      initialY: number;
      initialZ: number;
      swingSpeed: number;
      swingPhase: number;
      maxSwingAngle: number;
    }

    const lanterns: LanternData[] = [];

    function createLantern(x: number, y: number, z: number, scale = 1, phase = 0): LanternData {
      const singleLantern = new THREE.Group();

      // Hanging string
      const stringGeo = new THREE.CylinderGeometry(0.015 * scale, 0.015 * scale, 3 * scale, 8);
      const stringMat = new THREE.MeshBasicMaterial({ color: 0x8b5a2b });
      const stringMesh = new THREE.Mesh(stringGeo, stringMat);
      stringMesh.position.y = 1.5 * scale;
      singleLantern.add(stringMesh);

      // Top cap (Gold/Dark wood)
      const capGeo = new THREE.CylinderGeometry(0.55 * scale, 0.65 * scale, 0.15 * scale, 16);
      const goldMat = new THREE.MeshStandardMaterial({
        color: 0xe7a92f,
        metalness: 0.8,
        roughness: 0.25,
      });
      const topCap = new THREE.Mesh(capGeo, goldMat);
      topCap.position.y = 0.85 * scale;
      singleLantern.add(topCap);

      // Main Lantern Body (Squashed Sphere with Crimson Silk Texture/Glow)
      const bodyGeo = new THREE.SphereGeometry(1 * scale, 24, 20);
      bodyGeo.scale(1, 1.15, 1);
      const bodyMat = new THREE.MeshStandardMaterial({
        color: 0xb91b1c,
        emissive: 0xd32f2f,
        emissiveIntensity: 0.45,
        roughness: 0.4,
        metalness: 0.1,
      });
      const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
      bodyMesh.position.y = 0;
      singleLantern.add(bodyMesh);

      // Lantern Ribs (Golden Rings)
      const ringGeo = new THREE.TorusGeometry(0.98 * scale, 0.02 * scale, 8, 24);
      ringGeo.rotateX(Math.PI / 2);
      const ringMesh = new THREE.Mesh(ringGeo, goldMat);
      singleLantern.add(ringMesh);

      // Bottom cap
      const botCap = new THREE.Mesh(capGeo, goldMat);
      botCap.position.y = -0.85 * scale;
      singleLantern.add(botCap);

      // Bottom golden tassel
      const tasselGeo = new THREE.ConeGeometry(0.2 * scale, 1.2 * scale, 12);
      tasselGeo.rotateX(Math.PI);
      const tasselMat = new THREE.MeshStandardMaterial({
        color: 0xf5b041,
        emissive: 0xe7a92f,
        emissiveIntensity: 0.2,
      });
      const tasselMesh = new THREE.Mesh(tasselGeo, tasselMat);
      tasselMesh.position.y = -1.5 * scale;
      singleLantern.add(tasselMesh);

      // Soft point light inside the lantern
      const pointLight = new THREE.PointLight(0xff7744, 2.0, 8);
      pointLight.position.set(0, 0, 0);
      singleLantern.add(pointLight);

      singleLantern.position.set(x, y, z);
      lanternGroup.add(singleLantern);

      return {
        group: singleLantern,
        initialX: x,
        initialY: y,
        initialZ: z,
        swingSpeed: 1.2 + Math.random() * 0.4,
        swingPhase: phase,
        maxSwingAngle: 0.08 + Math.random() * 0.05,
      };
    }

    if (intensity === 'hero') {
      // Top Right background lantern (deep)
      lanterns.push(createLantern(8.5, 5.5, -3, 1.1, 0.4));
      // Far right accent lantern
      lanterns.push(createLantern(10.2, 4.0, 1.5, 0.9, 1.2));
      // Top Left ambient lantern
      lanterns.push(createLantern(-9.2, 5.8, -2, 0.95, 2.1));
      // Subtle mid-left lantern
      lanterns.push(createLantern(-10.8, 3.8, 1, 0.8, 0.9));
    } else {
      lanterns.push(createLantern(7.5, 4.5, -2, 0.8, 0.5));
      lanterns.push(createLantern(-7.5, 4.5, -2, 0.8, 1.8));
    }

    // ── 2. FALLING PETALS / GOLDEN BLOSSOMS ────────────────────────
    const petalCount = intensity === 'hero' ? 65 : 30;
    const petalGeometry = new THREE.PlaneGeometry(0.35, 0.22);
    const petalMaterial = new THREE.MeshStandardMaterial({
      color: 0xf48fb1, // Blossom pink
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.82,
      roughness: 0.5,
    });

    const petalGroup = new THREE.Group();
    scene.add(petalGroup);

    interface PetalData {
      mesh: THREE.Mesh;
      speedY: number;
      speedRotX: number;
      speedRotY: number;
      swaySpeed: number;
      swayRadius: number;
      initialX: number;
    }

    const petals: PetalData[] = [];
    for (let i = 0; i < petalCount; i++) {
      const mesh = new THREE.Mesh(petalGeometry, petalMaterial);
      const px = (Math.random() - 0.5) * 32;
      const py = (Math.random() - 0.5) * 20;
      const pz = (Math.random() - 0.5) * 12;
      mesh.position.set(px, py, pz);
      mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      petalGroup.add(mesh);

      petals.push({
        mesh,
        speedY: 0.015 + Math.random() * 0.025,
        speedRotX: (Math.random() - 0.5) * 0.04,
        speedRotY: (Math.random() - 0.5) * 0.04,
        swaySpeed: 1 + Math.random() * 2,
        swayRadius: 0.02 + Math.random() * 0.03,
        initialX: px,
      });
    }

    // ── 3. GOLDEN FIREFLIES / EMBERS ──────────────────────────────
    const emberCount = intensity === 'hero' ? 80 : 35;
    const emberGeo = new THREE.BufferGeometry();
    const emberPositions = new Float32Array(emberCount * 3);
    const emberOffsets = new Float32Array(emberCount);

    for (let i = 0; i < emberCount; i++) {
      emberPositions[i * 3] = (Math.random() - 0.5) * 30;
      emberPositions[i * 3 + 1] = (Math.random() - 0.5) * 18;
      emberPositions[i * 3 + 2] = (Math.random() - 0.5) * 10;
      emberOffsets[i] = Math.random() * Math.PI * 2;
    }

    emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPositions, 3));

    // Create custom canvas texture for circular glowing embers
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
      grad.addColorStop(0, 'rgba(255, 220, 130, 1)');
      grad.addColorStop(0.4, 'rgba(231, 169, 47, 0.8)');
      grad.addColorStop(1, 'rgba(231, 169, 47, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 32, 32);
    }
    const emberTexture = new THREE.CanvasTexture(canvas);

    const emberMat = new THREE.PointsMaterial({
      size: 0.45,
      map: emberTexture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.85,
    });

    const emberPoints = new THREE.Points(emberGeo, emberMat);
    scene.add(emberPoints);

    // ── 4. MOUSE PARALLAX TRACKING ────────────────────────────────
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      targetX = x * 1.2;
      targetY = y * 0.8;
    };

    window.addEventListener('mousemove', handleMouseMove);

    // ── 5. ANIMATION LOOP ─────────────────────────────────────────
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const time = clock.getElapsedTime();

      // Smooth camera parallax
      mouseX += (targetX - mouseX) * 0.05;
      mouseY += (targetY - mouseY) * 0.05;
      camera.position.x = mouseX * 1.5;
      camera.position.y = mouseY * 1.0;
      camera.lookAt(0, 0, 0);

      // Animate Lanterns (Gentle pendulum swaying)
      lanterns.forEach((lantern) => {
        const swing = Math.sin(time * lantern.swingSpeed + lantern.swingPhase) * lantern.maxSwingAngle;
        const crossSwing = Math.cos(time * lantern.swingSpeed * 0.8 + lantern.swingPhase) * (lantern.maxSwingAngle * 0.5);
        lantern.group.rotation.z = swing + mouseX * 0.05;
        lantern.group.rotation.x = crossSwing - mouseY * 0.04;
        lantern.group.position.y = lantern.initialY + Math.sin(time * 1.5 + lantern.swingPhase) * 0.08;
      });

      // Animate Falling Petals
      petals.forEach((p) => {
        p.mesh.position.y -= p.speedY;
        p.mesh.position.x = p.initialX + Math.sin(time * p.swaySpeed) * p.swayRadius * 8;
        p.mesh.rotation.x += p.speedRotX;
        p.mesh.rotation.y += p.speedRotY;

        // Wrap around when falling below viewport
        if (p.mesh.position.y < -10) {
          p.mesh.position.y = 10;
          p.mesh.position.x = (Math.random() - 0.5) * 32;
          p.initialX = p.mesh.position.x;
        }
      });

      // Animate Embers (gentle float upward)
      const posAttr = emberGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < emberCount; i++) {
        let y = posAttr.getY(i) + 0.012;
        let x = posAttr.getX(i) + Math.sin(time + emberOffsets[i]) * 0.008;
        if (y > 9) {
          y = -9;
          x = (Math.random() - 0.5) * 30;
        }
        posAttr.setY(i, y);
        posAttr.setX(i, x);
      }
      posAttr.needsUpdate = true;

      renderer.render(scene, camera);
    };

    animate();

    // ── 6. RESIZE HANDLER ─────────────────────────────────────────
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    // ── 7. CLEANUP ────────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);

      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }

      // Dispose Three.js objects
      renderer.dispose();
      ambientLight.dispose();
      dirLight.dispose();
      petalGeometry.dispose();
      petalMaterial.dispose();
      emberGeo.dispose();
      emberMat.dispose();
      emberTexture.dispose();
    };
  }, [intensity]);

  return (
    <div
      ref={containerRef}
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      style={{ zIndex: 1 }}
      aria-hidden="true"
    />
  );
}
