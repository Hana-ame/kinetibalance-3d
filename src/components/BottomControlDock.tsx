import React, { useState } from 'react';
import {
  ArrowUpCircle,
  ChevronDown,
  ChevronUp,
  Cpu,
  Crosshair,
  Eye,
  Hand,
  Pause,
  Play,
  Radio,
  RotateCcw,
  ShieldCheck,
  Sliders,
  Wind,
  Zap,
} from 'lucide-react';
import {
  ControlAlgorithm,
  PendulumSystemConfig,
  SensorMode,
  SensorNoiseType,
  TargetMotionMode,
  TelemetrySnapshot,
} from '../physics/pendulumEngine';
import { LatexFormula } from './LatexFormula';

interface BottomControlDockProps {
  telemetry: TelemetrySnapshot;
  isDockExpanded: boolean;
  onToggleDock: () => void;
  onSelectAlgorithm: (algo: ControlAlgorithm) => void;
  onSelectSensorMode: (mode: SensorMode) => void;
  onSelectSensorNoiseType: (noiseType: SensorNoiseType) => void;
  onUpdateSensorNoiseSigma: (sigma: number) => void;
  onSelectDisturbanceJoint: (jointIndex: number) => void;
  onStartSwingUp: () => void;
  onSelectSegmentCount: (count: 2 | 3 | 4) => void;
  onSelectTargetMode: (mode: TargetMotionMode) => void;
  onApplyPush: (jointIndex?: number) => void;
  windEnabled: boolean;
  onToggleWind: () => void;
  controllerEnabled: boolean;
  onToggleController: () => void;
  isPaused: boolean;
  onTogglePause: () => void;
  onReset: () => void;
  show3DVectors: boolean;
  onToggle3DVectors: () => void;
  showTrails: boolean;
  onToggleTrails: () => void;
  cameraPreset: 'iso' | 'front' | 'top' | 'side';
  onSelectCameraPreset: (preset: 'iso' | 'front' | 'top' | 'side') => void;
  systemConfig: PendulumSystemConfig;
  onUpdateLQRWeights: (
    partial: Partial<Pick<PendulumSystemConfig, 'qPos' | 'qAngle' | 'rControl'>>
  ) => void;
}

export const BottomControlDock: React.FC<BottomControlDockProps> = ({
  telemetry,
  isDockExpanded,
  onToggleDock,
  onSelectAlgorithm,
  onSelectSensorMode,
  onSelectSensorNoiseType,
  onUpdateSensorNoiseSigma,
  onSelectDisturbanceJoint,
  onStartSwingUp,
  onSelectSegmentCount,
  onSelectTargetMode,
  onApplyPush,
  windEnabled,
  onToggleWind,
  controllerEnabled,
  onToggleController,
  isPaused,
  onTogglePause,
  onReset,
  show3DVectors,
  onToggle3DVectors,
  showTrails,
  onToggleTrails,
  cameraPreset,
  onSelectCameraPreset,
  systemConfig,
  onUpdateLQRWeights,
}) => {
  const [activeTab, setActiveTab] = useState<'controls' | 'lqr'>('controls');

  const isBlind = telemetry.sensorMode !== 'full_state';

  const statusText = !controllerEnabled
    ? '无算法模式 (鼠标直接拖动支撑点)'
    : telemetry.phase === 'swing_up'
      ? `起摆阶段 (${(telemetry.swingUpProgress * 100).toFixed(0)}%)`
      : telemetry.isBalanced
        ? '稳定倒立支撑 (0°)'
        : '自由摆动中';

  return (
    <div
      aria-label="仿真参数与扰动实验控制台"
      className="fixed bottom-4 left-4 right-4 lg:right-auto lg:left-4 z-20 lg:w-[min(890px,calc(100vw-436px))] flex flex-col items-center pointer-events-none"
    >
      {/* Top Collapse/Expand Tab */}
      <button
        type="button"
        onClick={onToggleDock}
        aria-expanded={isDockExpanded}
        aria-label={isDockExpanded ? '隐藏底部控制台' : '展开底部控制台'}
        className="pointer-events-auto flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-slate-200 bg-[#0c1220] hover:bg-slate-800 border border-b-0 border-slate-800 rounded-t-lg shadow-lg transition-colors whitespace-nowrap cursor-pointer"
      >
        <span>{isDockExpanded ? '隐藏实验控制台' : '展开实验控制台'}</span>
        {isDockExpanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-cyan-400" />
        ) : (
          <ChevronUp className="w-3.5 h-3.5 text-cyan-400" />
        )}
      </button>

      {isDockExpanded && (
        <div className="pointer-events-auto w-full bg-[#0c1220] border border-slate-800 rounded-xl shadow-2xl p-3.5 text-slate-100">
          {/* Top Row: Mode Switcher Tabs + Quick Status Telemetry + Primary Transport Actions */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-slate-800/80">
            <div className="flex items-center gap-1 p-1 bg-[#070b14] border border-slate-800 rounded-lg">
              <button
                type="button"
                onClick={() => setActiveTab('controls')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  activeTab === 'controls'
                    ? 'bg-slate-800 text-cyan-300'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>算法/盲测传感与关节扰动</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('lqr')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  activeTab === 'lqr'
                    ? 'bg-slate-800 text-cyan-300'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>权重参数与轨迹/视图</span>
              </button>
            </div>

            {/* Clean Unboxed Status Metrics */}
            <div className="flex items-center gap-2 text-xs text-slate-400 font-mono tabular-nums">
              <span
                className={
                  !controllerEnabled
                    ? 'text-sky-400'
                    : telemetry.phase === 'swing_up'
                      ? 'text-amber-400'
                      : telemetry.isBalanced
                        ? 'text-emerald-400'
                        : 'text-rose-400'
                }
              >
                {statusText}
              </span>
              <span aria-hidden="true">·</span>
              <span>倾角: {telemetry.maxTiltDeg.toFixed(1)}°</span>
              {isBlind && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-purple-300">
                    观测误差: {telemetry.maxEstimationErrorDeg.toFixed(2)}°
                  </span>
                </>
              )}
            </div>

            {/* Primary Simulation Transport Actions */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onStartSwingUp}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                <ArrowUpCircle className="w-3.5 h-3.5" />
                <span>垂直向下起摆 (180°→0°)</span>
              </button>

              <button
                type="button"
                onClick={onToggleController}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
                  controllerEnabled
                    ? 'bg-emerald-950/60 border-emerald-700/70 text-emerald-300 hover:bg-emerald-900/60'
                    : 'bg-sky-950/80 border-sky-500/80 text-sky-200 hover:bg-sky-900/70'
                }`}
              >
                {controllerEnabled ? (
                  <ShieldCheck className="w-3.5 h-3.5" />
                ) : (
                  <Hand className="w-3.5 h-3.5" />
                )}
                <span>
                  {controllerEnabled ? '算法控制: 开启' : '无算法: 鼠标拖动支撑点'}
                </span>
              </button>

              <button
                type="button"
                onClick={onTogglePause}
                aria-label={isPaused ? '继续仿真' : '暂停仿真'}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                <span>{isPaused ? '继续' : '暂停'}</span>
              </button>

              <button
                type="button"
                onClick={onReset}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>倒立重置 (0°)</span>
              </button>
            </div>
          </div>

          {activeTab === 'controls' ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Group 1: 3 Control Algorithms + Segment Count */}
              <div className="p-2.5 bg-[#080d18] border border-slate-800/90 rounded-lg flex flex-col justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-medium text-slate-300 mb-1.5">
                    <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                    <span>控制算法选择 (含无姿态盲测算法)</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        onSelectSensorMode('full_state');
                        onSelectAlgorithm('energy_lqr');
                      }}
                      className={`px-2 py-1 text-[11px] font-medium rounded-md border transition-colors whitespace-nowrap cursor-pointer ${
                        telemetry.algorithm === 'energy_lqr' && telemetry.sensorMode === 'full_state'
                          ? 'bg-cyan-950/80 border-cyan-500/80 text-cyan-200'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      算法一: 能量塑造+LQR
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectSensorMode('full_state');
                        onSelectAlgorithm('homoclinic_smc');
                      }}
                      className={`px-2 py-1 text-[11px] font-medium rounded-md border transition-colors whitespace-nowrap cursor-pointer ${
                        telemetry.algorithm === 'homoclinic_smc' &&
                        telemetry.sensorMode === 'full_state'
                          ? 'bg-amber-950/80 border-amber-500/80 text-amber-200'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      算法二: 同宿轨道+SMC
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectAlgorithm('blind_observer_lqg');
                        if (telemetry.sensorMode === 'full_state') {
                          onSelectSensorMode('blind_with_noise');
                        }
                      }}
                      className={`col-span-2 px-2 py-1 text-[11px] font-medium rounded-md border transition-colors whitespace-nowrap cursor-pointer ${
                        telemetry.algorithm === 'blind_observer_lqg' || isBlind
                          ? 'bg-purple-950/80 border-purple-500/80 text-purple-200'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      算法三: 无姿态盲测反力观测 LQG (仅感知支撑点位置/速度)
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
                  <span className="text-[11px] text-slate-400 whitespace-nowrap">摆段数:</span>
                  <div className="grid grid-cols-3 gap-1 flex-1">
                    {([2, 3, 4] as const).map((cnt) => (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => onSelectSegmentCount(cnt)}
                        className={`px-2 py-1 text-[11px] font-medium rounded border transition-colors whitespace-nowrap cursor-pointer ${
                          telemetry.segmentCount === cnt
                            ? 'bg-cyan-950/80 border-cyan-500/80 text-cyan-200'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {cnt === 2 ? '二段摆' : cnt === 3 ? '三段摆' : '四段摆'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Group 2: Blind Support-Only Sensing & Sensor Measurement Disturbance (Absolute vs Percentage) */}
              <div className="p-2.5 bg-[#080d18] border border-slate-800/90 rounded-lg flex flex-col justify-between gap-1.5">
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1 text-xs font-medium text-slate-300 truncate">
                    <Radio className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    <span className="truncate">传感扰动 (绝对值 / 百分比)</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => onSelectSensorNoiseType('absolute')}
                      className={`px-1.5 py-0.5 text-[10px] font-medium rounded border transition-colors cursor-pointer ${
                        telemetry.sensorNoiseType === 'absolute'
                          ? 'bg-purple-950/90 border-purple-500/80 text-purple-200'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      绝对值(mm,m/s)
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectSensorNoiseType('percentage')}
                      className={`px-1.5 py-0.5 text-[10px] font-medium rounded border transition-colors cursor-pointer ${
                        telemetry.sensorNoiseType === 'percentage'
                          ? 'bg-amber-950/90 border-amber-500/80 text-amber-200'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      百分比(%)
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1">
                  <button
                    type="button"
                    onClick={() => onSelectSensorMode('full_state')}
                    className={`px-1.5 py-1 text-[11px] font-medium rounded border transition-colors whitespace-nowrap cursor-pointer ${
                      telemetry.sensorMode === 'full_state'
                        ? 'bg-cyan-950/80 border-cyan-500/80 text-cyan-200'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    全状态传感
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectSensorMode('blind_support_only')}
                    className={`px-1.5 py-1 text-[11px] font-medium rounded border transition-colors whitespace-nowrap cursor-pointer ${
                      telemetry.sensorMode === 'blind_support_only'
                        ? 'bg-purple-950/80 border-purple-500/80 text-purple-200'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    盲测仅支撑点
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectSensorMode('blind_with_noise')}
                    className={`px-1.5 py-1 text-[11px] font-medium rounded border transition-colors whitespace-nowrap cursor-pointer ${
                      telemetry.sensorMode === 'blind_with_noise'
                        ? 'bg-amber-950/80 border-amber-500/80 text-amber-200'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    盲测+测量扰动
                  </button>
                </div>

                {/* Sensor Noise Intensity Slider with Exact Physical Readout */}
                <div className="pt-0.5">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-0.5">
                    <span>
                      {telemetry.sensorNoiseType === 'absolute'
                        ? '绝对本底噪声幅值:'
                        : '相对当前读数比例:'}
                    </span>
                    <span className="font-mono tabular-nums text-amber-300">
                      {telemetry.sensorNoiseType === 'absolute'
                        ? `±${(telemetry.sensorNoiseSigma * 40).toFixed(1)}mm / ±${(telemetry.sensorNoiseSigma * 0.28).toFixed(2)}m/s`
                        : `±${(telemetry.sensorNoiseSigma * 100).toFixed(0)}% · (|r₀|, |v₀|)`}
                    </span>
                  </div>
                  <input
                    type="range"
                    aria-label="传感器测量噪声扰动强度"
                    min={0}
                    max={0.85}
                    step={0.05}
                    value={telemetry.sensorNoiseSigma}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (val > 0 && telemetry.sensorMode !== 'blind_with_noise') {
                        onSelectSensorMode('blind_with_noise');
                      }
                      onUpdateSensorNoiseSigma(val);
                    }}
                    className="w-full accent-purple-400 cursor-pointer"
                  />
                </div>
              </div>

              {/* Group 3: Joint Connection Disturbance Location Selector & Force Application */}
              <div className="p-2.5 bg-[#080d18] border border-slate-800/90 rounded-lg flex flex-col justify-between gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1 text-xs font-medium text-slate-300 truncate">
                    <Crosshair className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                    <span className="truncate">干扰施加位置: 关节连接处</span>
                  </span>
                  <button
                    type="button"
                    onClick={onToggleWind}
                    className={`flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      windEnabled
                        ? 'bg-amber-950/80 border-amber-500/80 text-amber-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Wind className="w-3 h-3" />
                    <span>{windEnabled ? '微风: 开' : '微风: 关'}</span>
                  </button>
                </div>

                {/* Select which Joint Connection J_1 .. J_N receives the disturbance */}
                <div
                  className={`grid gap-1 ${
                    telemetry.joints.length === 4
                      ? 'grid-cols-4'
                      : telemetry.joints.length === 3
                        ? 'grid-cols-3'
                        : 'grid-cols-2'
                  }`}
                >
                  {telemetry.joints.map((j) => {
                    const isSelected = telemetry.disturbanceJointIndex === j.index;
                    const jointTag =
                      j.index < telemetry.joints.length - 1
                        ? `关节 J${j.index + 1} (${j.index + 1}-${j.index + 2}处)`
                        : `关节 J${j.index + 1} (顶端处)`;
                    return (
                      <button
                        key={j.index}
                        type="button"
                        onClick={() => {
                          onSelectDisturbanceJoint(j.index);
                          onApplyPush(j.index);
                        }}
                        className={`px-1.5 py-1 text-[11px] font-medium rounded border transition-colors whitespace-nowrap cursor-pointer ${
                          isSelected
                            ? 'bg-orange-950/80 border-orange-500/80 text-orange-200'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {jointTag}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => onApplyPush(telemetry.disturbanceJointIndex)}
                  className="w-full px-3 py-1.5 text-xs font-semibold text-slate-950 bg-orange-400 hover:bg-orange-300 rounded-md transition-colors whitespace-nowrap cursor-pointer"
                >
                  在关节 J{telemetry.disturbanceJointIndex + 1} 施加绝对冲量 (0.85 N·s / 4.8 N)
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* LQR State Weighting Sliders with LaTeX */}
              <div className="md:col-span-2 p-2.5 bg-[#080d18] border border-slate-800/90 rounded-lg grid grid-cols-3 gap-4">
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-300">
                      倾角权重 <LatexFormula tex="Q_\theta" />
                    </span>
                    <span className="font-mono tabular-nums text-cyan-300">
                      {systemConfig.qAngle.toFixed(0)}
                    </span>
                  </div>
                  <input
                    type="range"
                    aria-label="关节倾角权重 Q_θ"
                    min={80}
                    max={600}
                    step={10}
                    value={systemConfig.qAngle}
                    onChange={(e) =>
                      onUpdateLQRWeights({ qAngle: Number(e.target.value) })
                    }
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                  <div className="text-[11px] text-slate-400 font-mono tabular-nums mt-1 truncate">
                    K_θ: [{telemetry.lqrGains.kTheta.map((k) => k.toFixed(0)).join(', ')}]
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-300">
                      位置权重 <LatexFormula tex="Q_{\text{pos}}" />
                    </span>
                    <span className="font-mono tabular-nums text-cyan-300">
                      {systemConfig.qPos.toFixed(1)}
                    </span>
                  </div>
                  <input
                    type="range"
                    aria-label="支撑点回归权重 Q_pos"
                    min={2}
                    max={40}
                    step={1}
                    value={systemConfig.qPos}
                    onChange={(e) =>
                      onUpdateLQRWeights({ qPos: Number(e.target.value) })
                    }
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                  <div className="text-[11px] text-slate-400 font-mono tabular-nums mt-1">
                    K_pos: {telemetry.lqrGains.kPos.toFixed(1)} · K_vel:{' '}
                    {telemetry.lqrGains.kVel.toFixed(1)}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-300">
                      能耗惩罚 <LatexFormula tex="R" />
                    </span>
                    <span className="font-mono tabular-nums text-cyan-300">
                      {systemConfig.rControl.toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    aria-label="控制能耗惩罚 R"
                    min={0.04}
                    max={0.6}
                    step={0.02}
                    value={systemConfig.rControl}
                    onChange={(e) =>
                      onUpdateLQRWeights({ rControl: Number(e.target.value) })
                    }
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                  <div className="text-[11px] text-slate-400 font-mono tabular-nums mt-1 truncate">
                    K_ω: [{telemetry.lqrGains.kOmega.map((k) => k.toFixed(0)).join(', ')}]
                  </div>
                </div>
              </div>

              {/* Trajectory Mode & 3D Visual Overlays */}
              <div className="p-2.5 bg-[#080d18] border border-slate-800/90 rounded-lg flex flex-col justify-between gap-2">
                <div className="grid grid-cols-4 gap-1">
                  {(
                    [
                      { id: 'static', label: '原点支撑' },
                      { id: 'circle', label: '圆周轨迹' },
                      { id: 'figure8', label: '8字轨迹' },
                      { id: 'manual', label: '平面定点' },
                    ] as const
                  ).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => onSelectTargetMode(m.id)}
                      className={`px-1.5 py-1 text-[11px] font-medium rounded border transition-colors whitespace-nowrap cursor-pointer ${
                        telemetry.targetMode === m.id
                          ? 'bg-cyan-950/80 border-cyan-500/80 text-cyan-200'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center justify-between gap-1.5">
                  <button
                    type="button"
                    onClick={onToggle3DVectors}
                    className={`flex-1 flex items-center justify-center gap-1 px-2 py-1 text-[11px] font-medium rounded border transition-colors whitespace-nowrap cursor-pointer ${
                      show3DVectors
                        ? 'bg-emerald-950/70 border-emerald-600/80 text-emerald-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    <Eye className="w-3 h-3" />
                    <span>3D 矢量箭头</span>
                  </button>
                  <button
                    type="button"
                    onClick={onToggleTrails}
                    className={`flex-1 flex items-center justify-center gap-1 px-2 py-1 text-[11px] font-medium rounded border transition-colors whitespace-nowrap cursor-pointer ${
                      showTrails
                        ? 'bg-cyan-950/70 border-cyan-600/80 text-cyan-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    <span>起摆尾迹</span>
                  </button>
                  {(['iso', 'front', 'side', 'top'] as const).map((cam) => (
                    <button
                      key={cam}
                      type="button"
                      onClick={() => onSelectCameraPreset(cam)}
                      className={`px-1.5 py-1 text-[11px] font-medium rounded border transition-colors whitespace-nowrap cursor-pointer ${
                        cameraPreset === cam
                          ? 'bg-slate-800 border-cyan-500/70 text-cyan-300'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {cam === 'iso' ? '等轴' : cam === 'front' ? '正视' : cam === 'side' ? '侧视' : '俯视'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
