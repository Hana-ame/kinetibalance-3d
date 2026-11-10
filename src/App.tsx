/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useRef, useState } from 'react';
import { AlgorithmModal } from './components/AlgorithmModal';
import { BottomControlDock } from './components/BottomControlDock';
import { LatexFormula } from './components/LatexFormula';
import { PendulumScene3D } from './components/PendulumScene3D';
import { VectorDashboard } from './components/VectorDashboard';
import {
  ControlAlgorithm,
  DEFAULT_SYSTEM_CONFIG,
  MultiSegmentPendulumEngine,
  PendulumSystemConfig,
  SensorMode,
  SensorNoiseType,
  TargetMotionMode,
  TelemetrySnapshot,
} from './physics/pendulumEngine';

export default function App() {
  const engineRef = useRef<MultiSegmentPendulumEngine | null>(null);
  if (!engineRef.current) {
    // Start hanging vertically downward (theta = 180 deg) and swing up to 0 deg upright!
    engineRef.current = new MultiSegmentPendulumEngine(
      { segmentCount: 3, algorithm: 'energy_lqr' },
      true
    );
  }

  const [telemetry, setTelemetry] = useState<TelemetrySnapshot>(() =>
    engineRef.current!.getTelemetrySnapshot()
  );
  const [systemConfig, setSystemConfig] = useState<PendulumSystemConfig>(() => ({
    ...DEFAULT_SYSTEM_CONFIG,
  }));

  const [isDashboardExpanded, setIsDashboardExpanded] = useState<boolean>(true);
  const [isDockExpanded, setIsDockExpanded] = useState<boolean>(true);
  const [isAlgorithmModalOpen, setIsAlgorithmModalOpen] = useState<boolean>(false);

  const [show3DVectors, setShow3DVectors] = useState<boolean>(true);
  const [showTrails, setShowTrails] = useState<boolean>(true);
  const [cameraPreset, setCameraPreset] = useState<'iso' | 'front' | 'top' | 'side'>('iso');
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [windEnabled, setWindEnabled] = useState<boolean>(false);

  const handleTelemetryUpdate = useCallback((snap: TelemetrySnapshot) => {
    setTelemetry(snap);
  }, []);

  const handleSelectAlgorithm = useCallback((algo: ControlAlgorithm) => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.setAlgorithm(algo);
    setSystemConfig({ ...eng.config });
    setTelemetry(eng.getTelemetrySnapshot());
  }, []);

  const handleSelectSensorMode = useCallback((mode: SensorMode) => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.setSensorMode(mode);
    setSystemConfig({ ...eng.config });
    setTelemetry(eng.getTelemetrySnapshot());
  }, []);

  const handleSelectSensorNoiseType = useCallback((noiseType: SensorNoiseType) => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.setSensorNoiseType(noiseType);
    setSystemConfig({ ...eng.config });
    setTelemetry(eng.getTelemetrySnapshot());
  }, []);

  const handleUpdateSensorNoiseSigma = useCallback((sigma: number) => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.setSensorNoiseSigma(sigma);
    setSystemConfig({ ...eng.config });
    setTelemetry(eng.getTelemetrySnapshot());
  }, []);

  const handleSelectDisturbanceJoint = useCallback((jointIndex: number) => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.setDisturbanceJointIndex(jointIndex);
    setSystemConfig({ ...eng.config });
    setTelemetry(eng.getTelemetrySnapshot());
  }, []);

  const handleStartSwingUp = useCallback(() => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.startSwingUpFromDownward();
    setTelemetry(eng.getTelemetrySnapshot());
  }, []);

  const handleSelectSegmentCount = useCallback((count: 2 | 3 | 4) => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.setSegmentCount(count, true);
    setSystemConfig({ ...eng.config });
    setTelemetry(eng.getTelemetrySnapshot());
  }, []);

  const handleSelectTargetMode = useCallback((mode: TargetMotionMode) => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.targetMode = mode;
    setTelemetry(eng.getTelemetrySnapshot());
  }, []);

  const handleApplyPush = useCallback((jointIndex?: number) => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.applyImpulseDisturbance(undefined, undefined, jointIndex, 1.0);
    setSystemConfig({ ...eng.config });
    setTelemetry(eng.getTelemetrySnapshot());
  }, []);

  const handleToggleWind = useCallback(() => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.windEnabled = !eng.windEnabled;
    setWindEnabled(eng.windEnabled);
  }, []);

  const handleToggleController = useCallback(() => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.controllerEnabled = !eng.controllerEnabled;
    if (!eng.controllerEnabled) {
      eng.setManualSupportDrag(false);
    }
    setTelemetry(eng.getTelemetrySnapshot());
  }, []);

  const handleReset = useCallback(() => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.controllerEnabled = true;
    eng.resetState(true);
    setTelemetry(eng.getTelemetrySnapshot());
  }, []);

  const handleUpdateLQRWeights = useCallback(
    (partial: Partial<Pick<PendulumSystemConfig, 'qPos' | 'qAngle' | 'rControl'>>) => {
      const eng = engineRef.current;
      if (!eng) return;
      eng.updateLQRWeights(partial);
      setSystemConfig({ ...eng.config });
      setTelemetry(eng.getTelemetrySnapshot());
    },
    []
  );

  const isBlind = telemetry.sensorMode !== 'full_state';

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#070b14] text-slate-100 flex flex-col select-none">
      {/* Top Bar Contract: 3 Zones separated by gap-8 */}
      <header className="relative z-30 flex items-center justify-between gap-8 px-6 py-3 bg-[#0a0f1c] border-b border-slate-800/90 shrink-0">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            handleStartSwingUp();
          }}
          className="text-base font-bold tracking-tight text-slate-100 whitespace-nowrap shrink-0"
        >
          KinetiBalance 3D
        </a>

        {/* Zone 2: 4 concise single-line navigation links */}
        <nav
          aria-label="主导航"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300"
        >
          <button
            type="button"
            onClick={handleStartSwingUp}
            className="hover:text-amber-300 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            垂直向下起摆 (180°→0°)
          </button>
          <button
            type="button"
            onClick={() => {
              if (telemetry.sensorMode !== 'full_state') {
                handleSelectSensorMode('full_state');
                handleSelectAlgorithm('energy_lqr');
              } else {
                handleSelectAlgorithm('blind_observer_lqg');
                handleSelectSensorMode('blind_with_noise');
              }
            }}
            className="hover:text-purple-300 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isBlind
              ? '当前: 盲测仅感知支撑点 (+传感扰动)'
              : '切换: 盲测仅感知支撑点算法'}
          </button>
          <button
            type="button"
            onClick={() => setIsDashboardExpanded((v) => !v)}
            className="hover:text-cyan-300 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            矢量分量仪表盘
          </button>
          <button
            type="button"
            onClick={() => setIsAlgorithmModalOpen(true)}
            className="hover:text-cyan-300 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            LaTeX 动力学方程
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleStartSwingUp}
            className="px-4 py-2 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            从垂直向下重新起摆
          </button>
        </div>
      </header>

      {/* Main 3D Simulation Workspace */}
      <main
        data-balanced={telemetry.isBalanced ? 'true' : 'false'}
        data-phase={telemetry.phase}
        data-algorithm={telemetry.algorithm}
        data-sensor-mode={telemetry.sensorMode}
        data-controller-enabled={telemetry.controllerEnabled ? 'true' : 'false'}
        data-disturbance-joint={telemetry.disturbanceJointIndex}
        data-segment-count={telemetry.segmentCount}
        className="relative flex-1 w-full h-full overflow-hidden"
      >
        {/* Top-Left Compact Passive Joint Attitude & Blind Support-Only Observer Monitor */}
        <section
          aria-label="各段被动关节实时倾角与盲测观测监测"
          className="fixed top-16 left-4 z-20 w-[332px] max-w-[calc(100vw-2rem)] bg-[#0c1220] border border-slate-800 rounded-xl p-3.5 shadow-xl pointer-events-auto"
        >
          <div className="flex items-center justify-between mb-1">
            <h1 className="text-xs font-semibold text-slate-100">
              {isBlind
                ? `盲测仅感知支撑点 (${telemetry.segmentCount}段摆反力观测)`
                : !telemetry.controllerEnabled
                  ? `无算法手动模式 (鼠标直接拖动支撑点)`
                  : `无桌面单点支撑 ${telemetry.segmentCount} 段摆起摆与镇定`}
            </h1>
            <span className="text-[11px] font-mono tabular-nums text-cyan-400">
              t = {telemetry.time.toFixed(1)}s
            </span>
          </div>
          <p className="text-[11px] text-slate-400 leading-snug mb-2">
            {isBlind ? (
              <>
                完全无法直接感知姿态 <LatexFormula tex="\theta_i" />，仅测量支撑点位置与速度{' '}
                <LatexFormula tex="(\tilde{\mathbf{r}}_0, \tilde{\mathbf{v}}_0)" />（含传感器噪声{' '}
                <LatexFormula tex={`\\sigma_n=${telemetry.sensorNoiseSigma.toFixed(2)}`} />
                ），由水平反作用力重构姿态。
              </>
            ) : !telemetry.controllerEnabled ? (
              <>
                当前已关闭自动控制算法，请直接用鼠标在 3D 视口中按住并拖动底部支撑点，观察纯被动无源关节的真实物理摆动。
              </>
            ) : (
              <>
                各段铰链无任何自驱推力，完全通过底部单点加减速从{' '}
                <LatexFormula tex="\theta = \pi" /> 摆起至{' '}
                <LatexFormula tex="\theta = 0" />。干扰力直接作用于关节连接处{' '}
                <LatexFormula tex={`J_{${telemetry.disturbanceJointIndex + 1}}`} />。
              </>
            )}
          </p>

          {/* Swing-up / Posture progress bar */}
          <div className="mb-2.5 p-2 bg-[#080d18] border border-slate-800/80 rounded-lg">
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="text-slate-300">
                姿态进度 (<LatexFormula tex="\pi \to 0" />)
              </span>
              <span
                className={`font-mono tabular-nums font-semibold ${
                  !telemetry.controllerEnabled
                    ? 'text-sky-400'
                    : telemetry.isBalanced
                      ? 'text-emerald-400'
                      : 'text-amber-400'
                }`}
              >
                {!telemetry.controllerEnabled
                  ? '手动拖拽支撑点'
                  : telemetry.phase === 'swing_up'
                    ? `起摆泵能 ${(telemetry.swingUpProgress * 100).toFixed(0)}%`
                    : telemetry.isBalanced
                      ? '已竖直倒立锁死 (100%)'
                      : '自由下垂'}
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
              <div
                className="h-full transition-all duration-100"
                style={{
                  width: `${Math.max(4, telemetry.swingUpProgress * 100)}%`,
                  backgroundColor: !telemetry.controllerEnabled
                    ? '#38bdf8'
                    : telemetry.isBalanced
                      ? '#10b981'
                      : '#f59e0b',
                }}
              />
            </div>
          </div>

          {/* Joint Angles & Blind Observer Reconstructed Angles + Joint Connection Selector */}
          <div className="space-y-1.5">
            {telemetry.joints.map((j) => {
              const isTargetJoint = telemetry.disturbanceJointIndex === j.index;
              return (
                <div
                  key={j.index}
                  onClick={() => handleSelectDisturbanceJoint(j.index)}
                  className={`flex items-center justify-between text-xs px-2.5 py-1.5 bg-[#080d18] border rounded-lg font-mono tabular-nums cursor-pointer transition-colors ${
                    isTargetJoint
                      ? 'border-orange-500/80 bg-orange-950/20'
                      : 'border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <span className="flex items-center gap-1.5 font-sans text-slate-200 truncate">
                    <span
                      className="w-2 h-2 rounded-sm shrink-0"
                      style={{ backgroundColor: j.color }}
                    />
                    <span className="truncate">{j.name}</span>
                    {isTargetJoint && (
                      <span className="text-[10px] text-orange-300 font-medium shrink-0">
                        [扰动点 J{j.index + 1}]
                      </span>
                    )}
                  </span>
                  <span className="text-slate-300 flex items-center gap-1.5 shrink-0">
                    <span>
                      <LatexFormula tex={`\\theta_${j.index + 1}:`} />{' '}
                      {j.tiltDeg.toFixed(1)}°
                    </span>
                    {isBlind && (
                      <span className="text-purple-300 text-[11px]">
                        (<LatexFormula tex={`\\hat{\\theta}_${j.index + 1}:`} />
                        {j.hatTiltDeg.toFixed(1)}°)
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-mono tabular-nums">
            <span>
              {isBlind ? '传感支撑点:' : '单支撑点:'} (
              {(isBlind ? telemetry.measuredSupportPos.x : telemetry.supportPos.x).toFixed(2)}
              m,{' '}
              {(isBlind ? telemetry.measuredSupportPos.z : telemetry.supportPos.z).toFixed(2)}
              m)
            </span>
            <span className="text-orange-300">
              目标关节: J{telemetry.disturbanceJointIndex + 1}
            </span>
          </div>
        </section>

        {/* Full-Viewport 3D WebGL Scene */}
        <PendulumScene3D
          engineRef={engineRef as React.MutableRefObject<MultiSegmentPendulumEngine>}
          onTelemetryUpdate={handleTelemetryUpdate}
          show3DVectors={show3DVectors}
          showTrails={showTrails}
          cameraPreset={cameraPreset}
          isPaused={isPaused}
        />

        {/* Expandable Vector Component & Combined Resultant Direction Dashboard */}
        <VectorDashboard
          telemetry={telemetry}
          isExpanded={isDashboardExpanded}
          onToggleExpand={() => setIsDashboardExpanded((v) => !v)}
        />

        {/* Unified Collapsible Bottom Control Dock */}
        <BottomControlDock
          telemetry={telemetry}
          isDockExpanded={isDockExpanded}
          onToggleDock={() => setIsDockExpanded((v) => !v)}
          onSelectAlgorithm={handleSelectAlgorithm}
          onSelectSensorMode={handleSelectSensorMode}
          onSelectSensorNoiseType={handleSelectSensorNoiseType}
          onUpdateSensorNoiseSigma={handleUpdateSensorNoiseSigma}
          onSelectDisturbanceJoint={handleSelectDisturbanceJoint}
          onStartSwingUp={handleStartSwingUp}
          onSelectSegmentCount={handleSelectSegmentCount}
          onSelectTargetMode={handleSelectTargetMode}
          onApplyPush={handleApplyPush}
          windEnabled={windEnabled}
          onToggleWind={handleToggleWind}
          controllerEnabled={telemetry.controllerEnabled}
          onToggleController={handleToggleController}
          isPaused={isPaused}
          onTogglePause={() => setIsPaused((v) => !v)}
          onReset={handleReset}
          show3DVectors={show3DVectors}
          onToggle3DVectors={() => setShow3DVectors((v) => !v)}
          showTrails={showTrails}
          onToggleTrails={() => setShowTrails((v) => !v)}
          cameraPreset={cameraPreset}
          onSelectCameraPreset={setCameraPreset}
          systemConfig={systemConfig}
          onUpdateLQRWeights={handleUpdateLQRWeights}
        />

        {/* Algorithm & Physics Equations Modal */}
        <AlgorithmModal
          isOpen={isAlgorithmModalOpen}
          onClose={() => setIsAlgorithmModalOpen(false)}
          telemetry={telemetry}
        />
      </main>
    </div>
  );
}
