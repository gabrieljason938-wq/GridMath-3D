import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { RotateCcw } from 'lucide-react';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useSimulationStore } from '../../store/useSimulationStore';
import { ErrorBoundary } from '../ErrorBoundary';
import {
  detectSoftwareWebGL,
  isWebGLSupported,
  usePrefersReducedMotion,
} from '../three/webglUtils';

interface MathLabViewportProps {
  children: React.ReactNode;
  cameraPosition?: [number, number, number];
  cameraTarget?: [number, number, number];
  fov?: number;
  caption?: string;
  heightClass?: string;
  showResetCamera?: boolean;
}

export function MathLabViewport({
  children,
  cameraPosition = [10, 7.5, 11],
  cameraTarget = [0, 2.2, 0],
  fov = 40,
  caption,
  heightClass = 'h-[420px]',
  showResetCamera = false,
}: MathLabViewportProps) {
  const renderQuality = useSimulationStore((s) => s.renderQuality);
  const reducedMotion = usePrefersReducedMotion();
  const webglSupported = useMemo(() => isWebGLSupported(), []);
  const isSoftwareGl = useMemo(() => detectSoftwareWebGL(), []);
  const [contextLost, setContextLost] = useState(false);
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const cameraRef = useRef<THREE.Camera | null>(null);

  const effectiveDpr: number | [number, number] =
    isSoftwareGl || renderQuality === 'low'
      ? 1
      : renderQuality === 'balanced'
        ? [1, 1.5]
        : [1, 2];

  const enableShadows = renderQuality !== 'low' && !isSoftwareGl;

  const handleResetCamera = () => {
    if (cameraRef.current) {
      cameraRef.current.position.set(...cameraPosition);
      if (cameraRef.current instanceof THREE.PerspectiveCamera) {
        cameraRef.current.updateProjectionMatrix();
      }
    }
    if (controlsRef.current) {
      controlsRef.current.target.set(...cameraTarget);
      controlsRef.current.update();
    }
  };

  useEffect(() => {
    handleResetCamera();
  }, [cameraPosition[0], cameraPosition[1], cameraPosition[2], cameraTarget[0], cameraTarget[1], cameraTarget[2]]);

  return (
    <ErrorBoundary
      title="3D Mathematical Viewport Recovery"
      fallbackDescription="WebGL visualization encountered an interruption. Click Retry View to reinitialize."
    >
      <div
        role="region"
        aria-label={caption ?? 'Interactive 3D Mathematical Plot'}
        className={`relative w-full overflow-hidden rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] dark:border-[#334155] dark:bg-[#172033] ${heightClass}`}
      >
        {!webglSupported || contextLost ? (
          <div className="flex h-full flex-col items-center justify-center p-6 text-center">
            <p className="text-sm font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
              3D Mathematical Canvas Unavailable
            </p>
            <p className="mt-1 max-w-sm text-xs text-[#64748B] dark:text-[#94A3B8]">
              Numerical tables, KaTeX equations, and accuracy diagnostics remain active.
            </p>
            {contextLost ? (
              <button
                type="button"
                onClick={() => setContextLost(false)}
                className="mt-3 rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] px-3 py-1.5 text-xs font-medium text-[#0F172A] dark:border-[#334155] dark:bg-[#0B1220] dark:text-[#F8FAFC]"
              >
                Restore 3D Canvas
              </button>
            ) : null}
          </div>
        ) : (
          <Canvas
            shadows={enableShadows}
            dpr={effectiveDpr}
            camera={{ position: cameraPosition, fov, near: 0.1, far: 150 }}
            gl={{
              antialias: !isSoftwareGl,
              powerPreference: 'high-performance',
              toneMapping: THREE.ACESFilmicToneMapping,
            }}
            onCreated={({ gl, camera }) => {
              cameraRef.current = camera;
              gl.outputColorSpace = THREE.SRGBColorSpace;
              const dom = gl.domElement;
              const onLost = (e: Event) => {
                e.preventDefault();
                setContextLost(true);
              };
              const onRestored = () => setContextLost(false);
              dom.addEventListener('webglcontextlost', onLost, false);
              dom.addEventListener('webglcontextrestored', onRestored, false);
            }}
          >
            <color attach="background" args={['#F8FAFC']} />
            <hemisphereLight args={['#FFFFFF', '#E2E8F0', 1.0]} />
            <directionalLight
              position={[12, 18, 12]}
              intensity={1.2}
              color="#FFFFFF"
              castShadow={enableShadows}
            />
            <directionalLight position={[-10, 10, -10]} intensity={0.45} color="#DBEAFE" />

            {children}

            <OrbitControls
              ref={controlsRef}
              makeDefault
              target={cameraTarget}
              enableDamping={!isSoftwareGl && !reducedMotion}
              dampingFactor={0.07}
              minDistance={4}
              maxDistance={32}
            />
          </Canvas>
        )}

        {showResetCamera && webglSupported && !contextLost ? (
          <button
            type="button"
            onClick={handleResetCamera}
            aria-label="Reset 3D mathematical camera position"
            className="absolute top-3 right-3 z-10 inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] px-2.5 py-1.5 text-xs font-medium text-[#0F172A] shadow-xs hover:bg-[#F8FAFC] whitespace-nowrap dark:border-[#334155] dark:bg-[#172033] dark:text-[#F8FAFC] dark:hover:bg-[#1E293B]"
          >
            <RotateCcw className="h-3.5 w-3.5 text-[#2563EB] dark:text-[#60A5FA]" />
            Reset Camera
          </button>
        ) : null}

        {caption ? (
          <div className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-md border border-[#E2E8F0] bg-[#FFFFFF]/95 px-2.5 py-1 text-[11px] font-medium text-[#64748B] dark:border-[#334155] dark:bg-[#172033]/95 dark:text-[#94A3B8]">
            {caption}
          </div>
        ) : null}
      </div>
    </ErrorBoundary>
  );
}
