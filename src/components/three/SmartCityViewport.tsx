import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, OrthographicCamera } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type {
  CityZoneId,
  DispatchResult,
  EnvironmentMode,
  HourlyDemand,
  RenderQuality,
} from '../../types/grid';
import { useSimulationStore } from '../../store/useSimulationStore';
import { ErrorBoundary } from '../ErrorBoundary';
import { computeDiurnalLighting } from './powerFlowMath';
import { detectSoftwareWebGL, isWebGLSupported, usePrefersReducedMotion } from './webglUtils';

const LazySmartCityScene = lazy(() => import('./SmartCityScene'));

export type CameraPresetId =
  | 'isometric'
  | 'topdown'
  | 'generation'
  | 'substation'
  | 'commercial'
  | 'residential'
  | 'industrial';

const ORTHO_PRESETS: Record<
  CameraPresetId,
  { position: [number, number, number]; target: [number, number, number]; zoomScale: number }
> = {
  isometric: { position: [92, 68, 96], target: [0, 2.0, 4.0], zoomScale: 1.0 },
  topdown: { position: [0.01, 140, 0.01], target: [0, 0, 2.0], zoomScale: 0.96 },
  generation: { position: [62, 46, -74], target: [0, 3.0, -20.0], zoomScale: 1.32 },
  substation: { position: [30, 24, 30], target: [0, 2.0, 0], zoomScale: 2.35 },
  commercial: { position: [44, 34, 62], target: [0, 6.8, 27.5], zoomScale: 1.72 },
  residential: { position: [-68, 34, 62], target: [-34.2, 3.2, 27.5], zoomScale: 1.65 },
  industrial: { position: [68, 34, 62], target: [34.2, 3.2, 27.5], zoomScale: 1.65 },
};

interface OrthoCameraRigProps {
  preset: CameraPresetId;
  presetVersion: number;
  isSoftwareGl: boolean;
  reducedMotion: boolean;
}

function OrthoCameraRig({
  preset,
  presetVersion,
  isSoftwareGl,
  reducedMotion,
}: OrthoCameraRigProps) {
  const { camera, size } = useThree();
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const animatingRef = useRef(false);
  const targetPos = useMemo(() => new THREE.Vector3(), []);
  const targetLook = useMemo(() => new THREE.Vector3(), []);
  const targetZoomRef = useRef(7.5);

  const baseZoom = useMemo(() => {
    const minDim = Math.max(320, Math.min(size.width, size.height));
    return Math.max(4.4, Math.min(10.5, minDim / 82));
  }, [size.width, size.height]);

  useEffect(() => {
    const cfg = ORTHO_PRESETS[preset];
    targetPos.set(...cfg.position);
    targetLook.set(...cfg.target);
    targetZoomRef.current = baseZoom * cfg.zoomScale;

    if (reducedMotion && controlsRef.current) {
      camera.position.copy(targetPos);
      controlsRef.current.target.copy(targetLook);
      if (camera instanceof THREE.OrthographicCamera) {
        camera.zoom = targetZoomRef.current;
        camera.updateProjectionMatrix();
      }
      controlsRef.current.update();
      animatingRef.current = false;
    } else {
      animatingRef.current = true;
    }
  }, [preset, presetVersion, baseZoom, targetPos, targetLook, reducedMotion, camera]);

  useFrame((_, delta) => {
    if (!animatingRef.current || !controlsRef.current) return;
    const dt = Math.min(delta, 0.05);
    const lambda = 6.0;

    camera.position.x = THREE.MathUtils.damp(camera.position.x, targetPos.x, lambda, dt);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, targetPos.y, lambda, dt);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, targetPos.z, lambda, dt);

    controlsRef.current.target.x = THREE.MathUtils.damp(
      controlsRef.current.target.x,
      targetLook.x,
      lambda,
      dt,
    );
    controlsRef.current.target.y = THREE.MathUtils.damp(
      controlsRef.current.target.y,
      targetLook.y,
      lambda,
      dt,
    );
    controlsRef.current.target.z = THREE.MathUtils.damp(
      controlsRef.current.target.z,
      targetLook.z,
      lambda,
      dt,
    );

    if (camera instanceof THREE.OrthographicCamera) {
      camera.zoom = THREE.MathUtils.damp(camera.zoom, targetZoomRef.current, lambda, dt);
      camera.updateProjectionMatrix();
    }

    controlsRef.current.update();

    const zoomSettled =
      !(camera instanceof THREE.OrthographicCamera) ||
      Math.abs(camera.zoom - targetZoomRef.current) < 0.05;

    if (
      zoomSettled &&
      camera.position.distanceTo(targetPos) < 0.08 &&
      controlsRef.current.target.distanceTo(targetLook) < 0.08
    ) {
      animatingRef.current = false;
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableRotate
      enablePan
      enableZoom
      enableDamping={!isSoftwareGl && !reducedMotion}
      dampingFactor={0.07}
      minZoom={3}
      maxZoom={48}
      maxPolarAngle={Math.PI / 2 - 0.05}
      onStart={() => {
        animatingRef.current = false;
      }}
    />
  );
}

function StaticCityFallback({
  dispatch,
  reason,
  onRetry,
}: {
  dispatch: DispatchResult;
  reason: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center bg-[#F8FAFC] p-6 text-center">
      <svg
        viewBox="0 0 360 150"
        className="mb-4 h-32 w-full max-w-sm"
        role="img"
        aria-label="2D Smart City Architectural Schematic Fallback"
      >
        <rect x="10" y="10" width="340" height="130" rx="10" fill="#FFFFFF" stroke="#E2E8F0" />
        <rect x="35" y="24" width="70" height="32" rx="4" fill="#ECFDF5" stroke="#10B981" />
        <text x="70" y="44" textAnchor="middle" className="fill-[#0F172A] text-[10px] font-semibold">
          Solar / Wind
        </text>
        <rect x="255" y="24" width="70" height="32" rx="4" fill="#EFF6FF" stroke="#2563EB" />
        <text x="290" y="44" textAnchor="middle" className="fill-[#0F172A] text-[10px] font-semibold">
          Thermal / BESS
        </text>
        <rect x="145" y="58" width="70" height="32" rx="4" fill="#F8FAFC" stroke="#06B6D4" />
        <text x="180" y="78" textAnchor="middle" className="fill-[#0F172A] text-[10px] font-semibold">
          Substation
        </text>
        <line x1="105" y1="40" x2="145" y2="70" stroke="#10B981" strokeWidth="2" />
        <line x1="255" y1="40" x2="215" y2="70" stroke="#2563EB" strokeWidth="2" />
        <rect x="55" y="102" width="250" height="26" rx="4" fill="#F1F5F9" stroke="#CBD5E1" />
        <text x="180" y="119" textAnchor="middle" className="fill-[#0F172A] text-[10px] font-mono">
          Load: {dispatch.totalDemandMW.toFixed(1)} MW · RE: {dispatch.renewableContributionPercent.toFixed(1)}%
        </text>
      </svg>
      <p className="text-sm font-semibold text-[#0F172A]">Architectural 2D Schematic Fallback</p>
      <p className="mt-1 max-w-md text-xs text-[#64748B]">{reason}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] px-3 py-1.5 text-xs font-medium text-[#0F172A] hover:bg-[#F8FAFC]"
        >
          Restore 3D Viewport
        </button>
      ) : null}
    </div>
  );
}

interface SmartCityViewportProps {
  dispatch: DispatchResult;
  hourlyDemand: HourlyDemand;
  environmentMode?: EnvironmentMode;
  selectedZone: CityZoneId | null;
  onSelectZone: (zone: CityZoneId) => void;
  cameraPreset?: CameraPresetId;
  presetVersion?: number;
  showFlowVectors?: boolean;
  showLabels?: boolean;
  showLandscaping?: boolean;
  renderQuality?: RenderQuality;
  onLightningStrike?: (info: { distanceNorm: number; pan: number }) => void;
  className?: string;
}

export function SmartCityViewport({
  dispatch,
  hourlyDemand,
  environmentMode: environmentModeOverride,
  selectedZone,
  onSelectZone,
  cameraPreset = 'isometric',
  presetVersion = 0,
  showFlowVectors = true,
  showLabels = true,
  showLandscaping = true,
  renderQuality: qualityOverride,
  onLightningStrike,
  className = 'h-[460px] w-full',
}: SmartCityViewportProps) {
  const storeQuality = useSimulationStore((s) => s.renderQuality);
  const storeEnvironmentMode = useSimulationStore((s) => s.environmentMode);
  const renderQuality = qualityOverride ?? storeQuality;
  const environmentMode = environmentModeOverride ?? storeEnvironmentMode;
  const lighting = useMemo(
    () => computeDiurnalLighting(hourlyDemand.hour, environmentMode),
    [hourlyDemand.hour, environmentMode],
  );
  const reducedMotion = usePrefersReducedMotion();
  const webglSupported = useMemo(() => isWebGLSupported(), []);
  const isSoftwareGl = useMemo(() => detectSoftwareWebGL(), []);
  const [contextLost, setContextLost] = useState(false);

  const effectiveDpr: number | [number, number] =
    isSoftwareGl || renderQuality === 'low'
      ? 1
      : renderQuality === 'balanced'
        ? [1, 1.5]
        : [1, 2];

  const enableShadows = renderQuality !== 'low' && !isSoftwareGl;

  return (
    <ErrorBoundary
      title="3D Digital Twin Viewport Recovery"
      fallbackDescription="WebGL rendering encountered an error. Restore the architectural viewport or continue in schematic mode."
    >
      <div
        role="region"
        aria-label="Interactive 3D Smart City Digital Twin Viewport"
        style={{ backgroundColor: lighting.backgroundHex }}
        className={`relative overflow-hidden rounded-xl border border-[#E2E8F0] transition-colors duration-700 ${className}`}
      >
        {!webglSupported ? (
          <StaticCityFallback
            dispatch={dispatch}
            reason="WebGL is unavailable in this browser environment. Displaying live grid schematic."
          />
        ) : contextLost ? (
          <StaticCityFallback
            dispatch={dispatch}
            reason="WebGL context was interrupted. Click restore to reinitialize the 3D digital twin."
            onRetry={() => setContextLost(false)}
          />
        ) : (
          <Canvas
            shadows={enableShadows}
            dpr={effectiveDpr}
            gl={{
              antialias: !isSoftwareGl,
              powerPreference: 'high-performance',
              toneMapping: THREE.ACESFilmicToneMapping,
              toneMappingExposure: 1.05,
            }}
            onCreated={({ gl }) => {
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
            <OrthographicCamera
              makeDefault
              position={ORTHO_PRESETS.isometric.position}
              zoom={7.5}
              near={0.1}
              far={1200}
            />

            <Suspense fallback={null}>
              <LazySmartCityScene
                dispatch={dispatch}
                hourlyDemand={hourlyDemand}
                environmentMode={environmentMode}
                selectedZone={selectedZone}
                onSelectZone={onSelectZone}
                showFlowVectors={showFlowVectors}
                showLabels={showLabels}
                showLandscaping={showLandscaping}
                isSoftwareGl={isSoftwareGl}
                renderQuality={renderQuality}
                reducedMotion={reducedMotion}
                onLightningStrike={onLightningStrike}
              />
            </Suspense>

            <OrthoCameraRig
              preset={cameraPreset}
              presetVersion={presetVersion}
              isSoftwareGl={isSoftwareGl}
              reducedMotion={reducedMotion}
            />
          </Canvas>
        )}
      </div>
    </ErrorBoundary>
  );
}
