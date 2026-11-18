import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Cloud,
  CloudLightning,
  Eye,
  EyeOff,
  Layers,
  Moon,
  Pause,
  Play,
  RotateCcw,
  Sun,
  Sunset,
  Trees,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import {
  computeDiurnalLighting,
  ENVIRONMENT_MODE_PRESETS,
} from '../components/three/powerFlowMath';
import { SelectedZoneInspector } from '../components/three/SelectedZoneInspector';
import {
  SmartCityViewport,
  type CameraPresetId,
} from '../components/three/SmartCityViewport';
import { StormAudioEngine } from '../components/three/stormAudio';
import { CITY_NODE_CATALOG } from '../data/syntheticMicrogrid';
import { useSimulationStore } from '../store/useSimulationStore';
import type { CityZoneId, EnvironmentMode, PlaybackSpeed, RenderQuality } from '../types/grid';

const CAMERA_LABELS: { id: CameraPresetId; label: string }[] = [
  { id: 'isometric', label: 'Overview' },
  { id: 'topdown', label: 'Masterplan' },
  { id: 'generation', label: 'Generation' },
  { id: 'substation', label: 'Switchyard' },
  { id: 'commercial', label: 'CBD' },
  { id: 'residential', label: 'Residential' },
  { id: 'industrial', label: 'Industrial' },
];

const SPEED_OPTIONS: PlaybackSpeed[] = [0.5, 1, 2, 4];

const QUALITY_OPTIONS: { id: RenderQuality; label: string }[] = [
  { id: 'high', label: 'High' },
  { id: 'balanced', label: 'Bal' },
  { id: 'low', label: 'Low' },
];

const ENVIRONMENT_MODES: {
  id: EnvironmentMode;
  label: string;
  Icon: typeof Sun;
}[] = [
  { id: 'day', label: 'Day', Icon: Sun },
  { id: 'sunset', label: 'Sunset', Icon: Sunset },
  { id: 'night', label: 'Night', Icon: Moon },
  { id: 'cloudy', label: 'Cloudy', Icon: Cloud },
  { id: 'rainy', label: 'Rainy', Icon: CloudLightning },
];

function zoneToPreset(zone: CityZoneId): CameraPresetId {
  if (zone === 'solar' || zone === 'wind' || zone === 'thermal' || zone === 'bess') {
    return 'generation';
  }
  if (zone === 'substation') return 'substation';
  if (zone === 'residential') return 'residential';
  if (zone === 'industrial') return 'industrial';
  return 'commercial';
}

export function SmartCityPage() {
  const activeHour = useSimulationStore((s) => s.activeHour);
  const environmentMode = useSimulationStore((s) => s.environmentMode);
  const activeScenario = useSimulationStore((s) => s.activeScenario);
  const activeDispatch = useSimulationStore((s) => s.activeDispatch);
  const activeHourlyDemand = useSimulationStore((s) => s.activeHourlyDemand);
  const selectedNodeId = useSimulationStore((s) => s.selectedNodeId);
  const isPlaying = useSimulationStore((s) => s.isPlaying);
  const playbackSpeed = useSimulationStore((s) => s.playbackSpeed);
  const renderQuality = useSimulationStore((s) => s.renderQuality);
  const weatherControls = useSimulationStore((s) => s.weatherControls);

  const setActiveHour = useSimulationStore((s) => s.setActiveHour);
  const setEnvironmentMode = useSimulationStore((s) => s.setEnvironmentMode);
  const playSimulation = useSimulationStore((s) => s.playSimulation);
  const pauseSimulation = useSimulationStore((s) => s.pauseSimulation);
  const resetSimulation = useSimulationStore((s) => s.resetSimulation);
  const setPlaybackSpeed = useSimulationStore((s) => s.setPlaybackSpeed);
  const setRenderQuality = useSimulationStore((s) => s.setRenderQuality);
  const setSelectedNode = useSimulationStore((s) => s.setSelectedNode);

  const [cameraPreset, setCameraPreset] = useState<CameraPresetId>('isometric');
  const [presetVersion, setPresetVersion] = useState(0);
  const [showFlowVectors, setShowFlowVectors] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [showLandscaping, setShowLandscaping] = useState(true);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [zonesMenuOpen, setZonesMenuOpen] = useState(false);
  const [stormAudioEnabled, setStormAudioEnabled] = useState(false);
  const stormAudioRef = useRef<StormAudioEngine | null>(null);

  useEffect(() => {
    const engine = stormAudioRef.current;
    if (engine) {
      engine.setRainActive(environmentMode === 'rainy');
      engine.setEnabled(stormAudioEnabled);
    }
  }, [environmentMode, stormAudioEnabled]);

  useEffect(() => {
    return () => {
      stormAudioRef.current?.dispose();
      stormAudioRef.current = null;
    };
  }, []);

  const handleToggleStormAudio = () => {
    const next = !stormAudioEnabled;
    if (next && !stormAudioRef.current) {
      stormAudioRef.current = new StormAudioEngine();
    }
    if (stormAudioRef.current) {
      stormAudioRef.current.setRainActive(environmentMode === 'rainy');
      stormAudioRef.current.setEnabled(next);
    }
    setStormAudioEnabled(next);
  };

  const handleLightningStrike = useCallback((info: { distanceNorm: number; pan: number }) => {
    stormAudioRef.current?.triggerThunder(info);
  }, []);

  const triggerPreset = (preset: CameraPresetId) => {
    setCameraPreset(preset);
    setPresetVersion((v) => v + 1);
    setZonesMenuOpen(false);
  };

  const activeModeMeta = ENVIRONMENT_MODE_PRESETS[environmentMode];
  const activeLighting = computeDiurnalLighting(activeHour, environmentMode);
  const solarElevationDeg = Math.round(
    (Math.asin(Math.max(-1, Math.min(1, activeLighting.skySunPosition[1]))) * 180) / Math.PI,
  );
  const shortage =
    activeDispatch.unservedEnergyMW > 0.5 || activeDispatch.balanceStatus === 'Deficit';

  const weatherPerturbed =
    weatherControls.temperatureDeltaDegC !== 0 ||
    weatherControls.solarIrradianceScale !== 1 ||
    weatherControls.windResourceScale !== 1;

  return (
    <div className="mx-auto max-w-[1440px]">
      <div className="relative h-[calc(100vh-9.5rem)] min-h-[600px] w-full overflow-hidden rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]">
        {/* Full-Viewport Orthographic Isometric 3D Scene */}
        <SmartCityViewport
          dispatch={activeDispatch}
          hourlyDemand={activeHourlyDemand}
          environmentMode={environmentMode}
          selectedZone={selectedNodeId}
          onSelectZone={setSelectedNode}
          cameraPreset={cameraPreset}
          presetVersion={presetVersion}
          showFlowVectors={showFlowVectors}
          showLabels={showLabels}
          showLandscaping={showLandscaping}
          onLightningStrike={handleLightningStrike}
          className="h-full w-full rounded-none border-0"
        />

        {/* Compact Top-Left Telemetry Strip + Dynamic Weather & Time Selector */}
        <div className="pointer-events-auto absolute top-3 left-3 z-20 flex max-w-[calc(100%-1.5rem)] flex-col items-start gap-1.5">
          <div className="rounded-xl border border-[#E2E8F0] bg-[#FFFFFF]/95 px-3 py-1.5 shadow-[0_6px_20px_-6px_rgba(15,23,42,0.10)]">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
              <span className="font-semibold text-[#0F172A]">{activeScenario.name}</span>
              <span aria-hidden="true" className="text-[#CBD5E1]">
                ·
              </span>
              <span className="font-mono-tabular font-semibold text-[#2563EB]">
                {activeDispatch.timestampLabel}
              </span>
              <span className="text-[#64748B]">
                (
                {activeModeMeta.label}
                {(environmentMode === 'cloudy' || environmentMode === 'rainy') &&
                (activeHour >= 19 || activeHour <= 5)
                  ? ' · Night'
                  : (environmentMode === 'cloudy' || environmentMode === 'rainy') &&
                      (activeHour === 6 || activeHour === 17 || activeHour === 18)
                    ? ' · Dusk'
                    : ''}
                {solarElevationDeg > 0 ? ` · ${solarElevationDeg}° Sun` : ' · Moonlit'}
                )
              </span>
              <span aria-hidden="true" className="text-[#CBD5E1]">
                ·
              </span>
              <span className="font-mono-tabular text-[#334155]">
                Load {activeDispatch.totalDemandMW.toFixed(1)} MW
              </span>
              <span aria-hidden="true" className="text-[#CBD5E1]">
                ·
              </span>
              <span className="font-mono-tabular text-[#334155]">
                BESS {activeDispatch.batterySocPercent.toFixed(0)}%
              </span>
              <span aria-hidden="true" className="text-[#CBD5E1]">
                ·
              </span>
              <span className="font-mono-tabular text-[#334155]">
                {activeHourlyDemand.temperatureDegC.toFixed(1)}°C
              </span>
              <span aria-hidden="true" className="text-[#CBD5E1]">
                ·
              </span>
              <StatusBadge
                tone={shortage ? 'deficit' : 'nominal'}
                label={
                  shortage
                    ? `Deficit ${activeDispatch.unservedEnergyMW.toFixed(1)} MW`
                    : `${activeDispatch.renewableContributionPercent.toFixed(1)}% RE`
                }
              />
              {weatherPerturbed ? (
                <>
                  <span aria-hidden="true" className="text-[#CBD5E1]">
                    ·
                  </span>
                  <span className="font-medium text-[#2563EB]">Weather Perturbed</span>
                </>
              ) : null}
            </div>
          </div>

          {/* 5-Mode Weather & Time-of-Day Control Bar */}
          <div
            role="group"
            aria-label="Weather and Time of Day Simulation Mode"
            className="flex flex-wrap items-center gap-1 rounded-xl border border-[#E2E8F0] bg-[#FFFFFF]/95 p-1 shadow-[0_6px_20px_-6px_rgba(15,23,42,0.10)]"
          >
            {ENVIRONMENT_MODES.map(({ id, label, Icon }) => {
              const active = environmentMode === id;
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setEnvironmentMode(id)}
                  title={ENVIRONMENT_MODE_PRESETS[id].summary}
                  className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-[#2563EB] text-white shadow-xs'
                      : 'text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A]'
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  <span>{label}</span>
                </button>
              );
            })}

            {environmentMode === 'rainy' ? (
              <>
                <span aria-hidden="true" className="mx-0.5 h-3.5 w-px bg-[#E2E8F0]" />
                <button
                  type="button"
                  aria-pressed={stormAudioEnabled}
                  aria-label={stormAudioEnabled ? 'Mute storm thunder and rain audio' : 'Enable storm thunder and rain audio'}
                  onClick={handleToggleStormAudio}
                  title={stormAudioEnabled ? 'Mute rain & thunder audio' : 'Enable Web Audio rain & thunder'}
                  className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                    stormAudioEnabled
                      ? 'bg-[#0F172A] text-white shadow-xs'
                      : 'text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A]'
                  }`}
                >
                  {stormAudioEnabled ? (
                    <Volume2 className="h-3 w-3 text-[#38BDF8]" />
                  ) : (
                    <VolumeX className="h-3 w-3" />
                  )}
                  <span>{stormAudioEnabled ? 'Audio On' : 'Audio Off'}</span>
                </button>
              </>
            ) : null}
          </div>
        </div>

        {/* Dedicated Right-Hand Selected-Object Detail Side Panel */}
        {selectedNodeId ? (
          <div className="pointer-events-auto absolute top-3 right-3 z-20 w-[312px] max-w-[calc(100%-1.5rem)] max-h-[calc(100%-5.25rem)] overflow-y-auto">
            <SelectedZoneInspector
              zoneId={selectedNodeId}
              dispatch={activeDispatch}
              hourlyDemand={activeHourlyDemand}
              onClose={() => setSelectedNode(null)}
              onFocusCamera={() => triggerPreset(zoneToPreset(selectedNodeId))}
            />
          </div>
        ) : null}

        {/* Streamlined Single-Row Bottom Control Toolbar */}
        <div className="pointer-events-none absolute inset-x-3 bottom-3 z-20 flex flex-col items-center">
          {dockCollapsed ? (
            <button
              type="button"
              onClick={() => setDockCollapsed(false)}
              className="pointer-events-auto inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-[#FFFFFF]/95 px-3 py-1.5 text-xs font-medium text-[#0F172A] shadow-[0_6px_20px_-6px_rgba(15,23,42,0.12)] transition-colors hover:border-[#2563EB]"
            >
              <ChevronUp className="h-3.5 w-3.5 text-[#2563EB]" />
              Controls
            </button>
          ) : (
            <div className="pointer-events-auto relative flex max-w-full flex-wrap items-center justify-center gap-2 rounded-xl border border-[#E2E8F0] bg-[#FFFFFF]/95 px-2.5 py-1.5 shadow-[0_8px_24px_-6px_rgba(15,23,42,0.10)]">
              {/* Camera Viewpoints */}
              <div className="flex flex-wrap items-center gap-0.5">
                {CAMERA_LABELS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => triggerPreset(item.id)}
                    className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                      cameraPreset === item.id
                        ? 'bg-[#2563EB] text-white'
                        : 'text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A]'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <span aria-hidden="true" className="hidden h-4 w-px bg-[#E2E8F0] xl:block" />

              {/* Playback, Speed & Timeline Scrubber */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => (isPlaying ? pauseSimulation() : playSimulation())}
                  aria-label={isPlaying ? 'Pause simulation' : 'Play simulation'}
                  className={`inline-flex h-6 items-center gap-1 rounded-md border px-2 text-[11px] font-medium whitespace-nowrap shrink-0 ${
                    isPlaying
                      ? 'border-[#2563EB] bg-[#EFF6FF] text-[#2563EB]'
                      : 'border-[#E2E8F0] bg-[#F8FAFC] text-[#0F172A] hover:bg-slate-100'
                  }`}
                >
                  {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                  {isPlaying ? 'Pause' : 'Play'}
                </button>

                <div className="flex items-center rounded-md border border-[#E2E8F0] bg-[#F8FAFC] p-0.5 text-[10px]">
                  {SPEED_OPTIONS.map((spd) => (
                    <button
                      key={spd}
                      type="button"
                      onClick={() => setPlaybackSpeed(spd)}
                      className={`rounded px-1.5 py-0.5 font-mono-tabular transition-colors ${
                        playbackSpeed === spd
                          ? 'bg-[#FFFFFF] font-semibold text-[#2563EB] shadow-xs'
                          : 'text-[#64748B] hover:text-[#0F172A]'
                      }`}
                    >
                      {spd}×
                    </button>
                  ))}
                </div>

                <span className="font-mono-tabular text-[11px] font-medium text-[#0F172A] whitespace-nowrap">
                  {activeDispatch.timestampLabel}
                </span>
                <input
                  type="range"
                  min={0}
                  max={23}
                  value={activeHour}
                  onChange={(e) => {
                    pauseSimulation();
                    setActiveHour(Number(e.target.value));
                  }}
                  aria-label="3D Twin simulation hour"
                  className="h-1.5 w-20 cursor-pointer accent-[#2563EB] sm:w-24"
                />
              </div>

              <span aria-hidden="true" className="hidden h-4 w-px bg-[#E2E8F0] xl:block" />

              {/* Compact Layer Toggles, Zone Picker Popover, Quality & Reset */}
              <div className="flex flex-wrap items-center gap-1">
                <div className="relative">
                  <button
                    type="button"
                    aria-expanded={zonesMenuOpen}
                    onClick={() => setZonesMenuOpen((v) => !v)}
                    className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                      selectedNodeId || zonesMenuOpen
                        ? 'border-[#2563EB]/40 bg-[#EFF6FF] text-[#2563EB]'
                        : 'border-[#E2E8F0] bg-[#FFFFFF] text-[#475569] hover:text-[#0F172A]'
                    }`}
                  >
                    <Layers className="h-3 w-3" />
                    Zones
                  </button>

                  {zonesMenuOpen ? (
                    <div
                      role="menu"
                      aria-label="Select 3D Infrastructure Zone"
                      className="absolute right-0 bottom-9 z-30 w-56 rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-1.5 shadow-[0_12px_32px_-8px_rgba(15,23,42,0.16)]"
                    >
                      {CITY_NODE_CATALOG.map((node) => {
                        const isActive = selectedNodeId === node.id;
                        return (
                          <button
                            key={node.id}
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setSelectedNode(isActive ? null : node.id);
                              setZonesMenuOpen(false);
                            }}
                            className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[11px] transition-colors ${
                              isActive
                                ? 'bg-[#2563EB] font-medium text-white'
                                : 'text-[#334155] hover:bg-[#F8FAFC] hover:text-[#0F172A]'
                            }`}
                          >
                            <span className="truncate">{node.label.split(' (')[0]}</span>
                            <span
                              className={`ml-2 shrink-0 text-[10px] ${
                                isActive ? 'text-blue-100' : 'text-[#94A3B8]'
                              }`}
                            >
                              {node.category}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>

                <button
                  type="button"
                  aria-pressed={showFlowVectors}
                  onClick={() => setShowFlowVectors((v) => !v)}
                  className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                    showFlowVectors
                      ? 'border-[#06B6D4]/40 bg-[#06B6D4]/10 text-[#0F172A]'
                      : 'border-[#E2E8F0] bg-[#FFFFFF] text-[#64748B]'
                  }`}
                >
                  {showFlowVectors ? (
                    <Eye className="h-3 w-3" />
                  ) : (
                    <EyeOff className="h-3 w-3" />
                  )}
                  Flows
                </button>

                <button
                  type="button"
                  aria-pressed={showLabels}
                  onClick={() => setShowLabels((v) => !v)}
                  className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                    showLabels
                      ? 'border-[#2563EB]/40 bg-[#2563EB]/10 text-[#0F172A]'
                      : 'border-[#E2E8F0] bg-[#FFFFFF] text-[#64748B]'
                  }`}
                >
                  Labels
                </button>

                <button
                  type="button"
                  aria-pressed={showLandscaping}
                  onClick={() => setShowLandscaping((v) => !v)}
                  className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                    showLandscaping
                      ? 'border-[#10B981]/40 bg-[#10B981]/10 text-[#0F172A]'
                      : 'border-[#E2E8F0] bg-[#FFFFFF] text-[#64748B]'
                  }`}
                >
                  <Trees className="h-3 w-3" />
                  Scenery
                </button>

                <div
                  role="group"
                  aria-label="3D Rendering Quality"
                  className="flex items-center rounded-md border border-[#E2E8F0] bg-[#F8FAFC] p-0.5 text-[10px]"
                >
                  {QUALITY_OPTIONS.map((q) => (
                    <button
                      key={q.id}
                      type="button"
                      aria-pressed={renderQuality === q.id}
                      onClick={() => setRenderQuality(q.id)}
                      className={`rounded px-1.5 py-0.5 font-medium transition-colors whitespace-nowrap shrink-0 ${
                        renderQuality === q.id
                          ? 'bg-[#FFFFFF] font-semibold text-[#2563EB] shadow-xs'
                          : 'text-[#64748B] hover:text-[#0F172A]'
                      }`}
                    >
                      {q.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    resetSimulation();
                    triggerPreset('isometric');
                    setZonesMenuOpen(false);
                  }}
                  aria-label="Reset digital twin and camera view"
                  className="inline-flex items-center gap-1 rounded-md border border-[#E2E8F0] bg-[#FFFFFF] px-2 py-1 text-[11px] font-medium text-[#64748B] hover:text-[#0F172A] whitespace-nowrap shrink-0"
                >
                  <RotateCcw className="h-3 w-3" />
                  Reset
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setZonesMenuOpen(false);
                    setDockCollapsed(true);
                  }}
                  aria-label="Hide control toolbar"
                  className="inline-flex items-center rounded-md border border-[#E2E8F0] bg-[#FFFFFF] p-1 text-[#64748B] hover:text-[#0F172A]"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
