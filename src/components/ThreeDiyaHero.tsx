/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface ThreeDiyaHeroProps {
  title?: string;
  subtitle?: string;
}

export const ThreeDiyaHero: React.FC<ThreeDiyaHeroProps> = ({
  title = 'Jaikrishna Planning Hub',
  subtitle = 'Meta Ads Optimization, Wholesale Outreach & Manufacturing Goals',
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [useFallback, setUseFallback] = useState(false);

  useEffect(() => {
    // 1. Check prefers-reduced-motion
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setUseFallback(true);
      return;
    }

    const currentMount = mountRef.current;
    if (!currentMount) return;

    let renderer: THREE.WebGLRenderer | null = null;
    let animationFrameId: number;

    try {
      // 2. Setup Three.js Scene, Camera, and WebGLRenderer
      const scene = new THREE.Scene();
      const width = currentMount.clientWidth || 300;
      const height = currentMount.clientHeight || 200;

      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
      camera.position.set(0, 1.2, 3.5);
      camera.lookAt(0, 0.2, 0);

      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      currentMount.appendChild(renderer.domElement);

      // 3. Lighting
      const ambientLight = new THREE.AmbientLight(0xffedd5, 0.8);
      scene.add(ambientLight);

      const pointLight = new THREE.PointLight(0xf59e0b, 2.5, 10);
      pointLight.position.set(0, 1.5, 0.5);
      scene.add(pointLight);

      // 4. Diya Brass Bowl Geometry
      const diyaGroup = new THREE.Group();

      const bowlGeometry = new THREE.CylinderGeometry(0.9, 0.4, 0.35, 32);
      const bowlMaterial = new THREE.MeshStandardMaterial({
        color: 0xb45309,
        metalness: 0.8,
        roughness: 0.3,
      });
      const bowl = new THREE.Mesh(bowlGeometry, bowlMaterial);
      bowl.position.y = 0.1;
      diyaGroup.add(bowl);

      // 5. Camphor Tablet Geometry (White crystalline cube inside diya)
      const camphorGeo = new THREE.BoxGeometry(0.35, 0.15, 0.35);
      const camphorMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.9,
      });
      const camphor = new THREE.Mesh(camphorGeo, camphorMat);
      camphor.position.y = 0.3;
      diyaGroup.add(camphor);

      // 6. Camphor Flame Geometry (Cone with glowing emissive flame color)
      const flameGeo = new THREE.ConeGeometry(0.2, 0.65, 24);
      const flameMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xef4444,
        emissiveIntensity: 0.8,
        roughness: 0.1,
      });
      const flame = new THREE.Mesh(flameGeo, flameMat);
      flame.position.y = 0.72;
      diyaGroup.add(flame);

      scene.add(diyaGroup);

      // 7. Render Loop with gentle oscillation
      let clock = 0;
      const animate = () => {
        clock += 0.02;
        diyaGroup.rotation.y = Math.sin(clock * 0.5) * 0.25;
        // Flame flicker
        const flicker = 1 + Math.sin(clock * 8) * 0.05;
        flame.scale.set(flicker, flicker, flicker);

        if (renderer) renderer.render(scene, camera);
        animationFrameId = requestAnimationFrame(animate);
      };

      animate();

      const handleResize = () => {
        if (!currentMount || !renderer) return;
        const newW = currentMount.clientWidth;
        const newH = currentMount.clientHeight;
        camera.aspect = newW / newH;
        camera.updateProjectionMatrix();
        renderer.setSize(newW, newH);
      };

      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        cancelAnimationFrame(animationFrameId);
        if (renderer && renderer.domElement && currentMount.contains(renderer.domElement)) {
          currentMount.removeChild(renderer.domElement);
          renderer.dispose();
        }
      };
    } catch (err) {
      console.warn('Three.js initialization fallback triggered:', err);
      setUseFallback(true);
    }
  }, []);

  return (
    <div className="relative bg-gradient-to-r from-[#881337] via-[#701A24] to-[#4C0519] rounded-2xl p-6 sm:p-8 text-white shadow-lg overflow-hidden border border-amber-300/20">
      <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="max-w-xl">
          <span className="text-[10px] font-mono uppercase bg-amber-400/20 text-amber-300 px-2.5 py-0.5 rounded-full font-semibold border border-amber-400/30">
            Strategic Operations
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-2 font-display">{title}</h1>
          <p className="mt-2 text-xs sm:text-sm text-stone-200 leading-relaxed">{subtitle}</p>
        </div>

        {/* 3D Diya Canvas or 2D Accessible Fallback */}
        <div className="w-48 h-36 relative flex items-center justify-center shrink-0">
          {useFallback ? (
            <div className="w-28 h-28 p-2 rounded-2xl bg-white/10 backdrop-blur-xs flex items-center justify-center border border-white/20">
              <img src="/icon.svg" alt="Pooja Diya" className="w-full h-full object-contain" />
            </div>
          ) : (
            <div ref={mountRef} className="w-full h-full" />
          )}
        </div>
      </div>
    </div>
  );
};
