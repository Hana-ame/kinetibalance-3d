import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Compass,
  GitMerge,
  Layers,
  Navigation,
} from 'lucide-react';
import { TelemetrySnapshot, VectorComponentInfo } from '../physics/pendulumEngine';
import { LatexFormula } from './LatexFormula';

interface VectorDashboardProps {
  telemetry: TelemetrySnapshot;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

function formatCompassDirection(angleDeg: number, mag: number): string {
  if (mag < 0.015) return '静止平衡 (0.0°)';
  const norm = ((angleDeg % 360) + 360) % 360;
  const dirs = [
    '右 (+X)',
    '右前 (+X/+Z)',
    '前 (+Z)',
    '左前 (-X/+Z)',
    '左 (-X)',
    '左后 (-X/-Z)',
    '后 (-Z)',
    '右后 (+X/-Z)',
  ];
  const idx = Math.round(norm / 45) % 8;
  return `${dirs[idx]}`;
}

export const VectorDashboard: React.FC<VectorDashboardProps> = ({
  telemetry,
  isExpanded,
  onToggleExpand,
}) => {
  const [scopeMode, setScopeMode] = useState<'origin' | 'polygon'>('origin');
  const [showSubTerms, setShowSubTerms] = useState<boolean>(true);

  const { components, rawResultant, appliedResultant, supportForceN } = telemetry;

  // Dynamic radar auto-scaling so vectors are always clearly visible
  const maxCompMag = Math.max(
    ...components.map((c) => c.magnitude),
    appliedResultant.magnitude,
    0.8
  );
  const radarScaleRadius = Math.max(1.2, Math.ceil(maxCompMag * 1.25 * 10) / 10);
  const svgCenter = 105;
  const maxPixelRadius = 78;

  const toOriginSvgCoord = (vx: number, vz: number) => {
    const mag = Math.hypot(vx, vz);
    if (mag < 1e-5) return { x: svgCenter, y: svgCenter };
    const normMag = Math.min(1.15, Math.pow(mag / radarScaleRadius, 0.52));
    const pxLen = normMag * maxPixelRadius;
    return {
      x: svgCenter + (vx / mag) * pxLen,
      y: svgCenter + (vz / mag) * pxLen,
    };
  };

  let runningX = 0;
  let runningZ = 0;
  let maxPolygonExcursion = Math.max(appliedResultant.magnitude, 0.5);
  const rawChain: Array<{ comp: VectorComponentInfo; x1: number; z1: number; x2: number; z2: number }> = [];
  for (const comp of components) {
    const x1 = runningX;
    const z1 = runningZ;
    runningX += comp.vec.x;
    runningZ += comp.vec.z;
    maxPolygonExcursion = Math.max(maxPolygonExcursion, Math.hypot(runningX, runningZ));
    rawChain.push({ comp, x1, z1, x2: runningX, z2: runningZ });
  }
  const polyScale = maxPixelRadius / (maxPolygonExcursion * 1.15);
  const polygonSegments = rawChain.map((item) => ({
    comp: item.comp,
    x1: svgCenter + item.x1 * polyScale,
    y1: svgCenter + item.z1 * polyScale,
    x2: svgCenter + item.x2 * polyScale,
    y2: svgCenter + item.z2 * polyScale,
  }));

  const resultantTip =
    scopeMode === 'origin'
      ? toOriginSvgCoord(appliedResultant.vec.x, appliedResultant.vec.z)
      : {
          x: svgCenter + appliedResultant.vec.x * polyScale,
          y: svgCenter + appliedResultant.vec.z * polyScale,
        };

  const resAngleRad = (appliedResultant.angleDeg * Math.PI) / 180;
  const rimRayX = svgCenter + Math.cos(resAngleRad) * maxPixelRadius;
  const rimRayY = svgCenter + Math.sin(resAngleRad) * maxPixelRadius;

  const compassLabel = formatCompassDirection(
    appliedResultant.angleDeg,
    appliedResultant.magnitude
  );

  const isBlind = telemetry.sensorMode !== 'full_state';

  const algoLabel =
    telemetry.algorithm === 'blind_observer_lqg' || isBlind
      ? telemetry.sensorMode === 'blind_with_noise'
        ? '算法三: 盲测反力观测 LQG (仅支撑点+传感噪声)'
        : '算法三: 盲测反力观测 LQG (仅感知支撑点)'
      : telemetry.algorithm === 'energy_lqr'
        ? '算法一: 能量塑造起摆 + LQR'
        : '算法二: 同宿轨道 + 滑模 SMC';

  const phaseLabel = !telemetry.controllerEnabled
    ? '无算法 (鼠标直拖支撑点)'
    : telemetry.phase === 'swing_up'
      ? '起摆泵能 (180°→0°)'
      : telemetry.phase === 'stabilize'
        ? '倒立镇定锁死 (0°)'
        : '自由无控坠落';

  return (
    <aside
      aria-label="底部支撑点矢量分量与合成方向仪表盘"
      className="fixed top-16 right-4 z-20 w-[408px] max-w-[calc(100vw-2rem)] bg-[#0c1220] border border-slate-800 rounded-xl shadow-2xl text-slate-100 transition-transform duration-150"
    >
      {/* Dashboard Header & Collapse/Expand Control */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-800/90">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-cyan-400 shrink-0" />
            <h2 className="text-sm font-semibold tracking-tight text-slate-100 truncate">
              单点支撑矢量分解与合并方向
            </h2>
          </div>
          <div className="text-[11px] text-slate-300 mt-1 flex items-center gap-1.5 overflow-x-auto">
            <LatexFormula
              tex={`\\mathbf{u}_{\\text{total}} = \\mathbf{u}_{\\text{pos}} + \\mathbf{u}_{\\text{vel}} + \\sum_{i=1}^{${telemetry.segmentCount}} \\mathbf{u}_i`}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={onToggleExpand}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? '收起矢量分量仪表盘' : '展开矢量分量仪表盘'}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800/90 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <span>{isExpanded ? '收起仪表盘' : '展开仪表盘'}</span>
          {isExpanded ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* Compact Summary Bar (Always Visible so Combined Direction is readable even when collapsed) */}
      <div className="px-4 py-2.5 bg-[#0f172a] border-b border-slate-800/80 flex items-center justify-between gap-4">
        <div>
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <span>合并后总控制方向</span>
            <span className="text-cyan-400">· {phaseLabel}</span>
          </div>
          <div className="text-sm font-semibold font-mono tabular-nums text-emerald-400 flex items-center gap-1.5 mt-0.5">
            <Navigation
              className="w-3.5 h-3.5 shrink-0"
              style={{
                transform: `rotate(${appliedResultant.angleDeg + 90}deg)`,
              }}
            />
            <span>
              {appliedResultant.angleDeg >= 0 ? '+' : ''}
              {appliedResultant.angleDeg.toFixed(1)}°
            </span>
            <span className="text-xs font-sans font-normal text-slate-300">
              · {compassLabel}
            </span>
          </div>
        </div>

        <div className="text-right">
          <div className="text-[11px] text-slate-400">
            <LatexFormula tex="\|\mathbf{u}_{\text{total}}\|" /> 加速度
          </div>
          <div className="text-sm font-semibold font-mono tabular-nums text-slate-100 mt-0.5">
            {appliedResultant.magnitude.toFixed(2)}{' '}
            <span className="text-xs font-normal text-slate-400">m/s²</span>
          </div>
        </div>
      </div>

      {/* Expandable Detailed Vector Scope & Per-Component Breakdown */}
      {isExpanded && (
        <div className="p-4 space-y-3.5 max-h-[calc(100vh-10.5rem)] overflow-y-auto">
          {/* Active Algorithm & Blind Support-Only Observer Readout */}
          <div className="p-2.5 bg-[#080d18] border border-slate-800/90 rounded-lg space-y-1.5 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-cyan-300 font-medium truncate">{algoLabel}</span>
              <span className="font-mono tabular-nums text-slate-300 shrink-0 flex items-center gap-1">
                <LatexFormula tex="\tilde{E} =" />
                <span>{telemetry.normalizedEnergy.toFixed(3)}</span>
              </span>
            </div>
            {isBlind && (
              <div className="pt-1.5 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-[11px] font-mono tabular-nums text-purple-200/90">
                <div>
                  <span className="text-slate-400 font-sans">支撑点速度传感: </span>
                  <span>
                    ({telemetry.measuredSupportVel.x.toFixed(2)},{' '}
                    {telemetry.measuredSupportVel.z.toFixed(2)}) m/s
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 font-sans">反力观测误差: </span>
                  <span className="text-amber-300">
                    {telemetry.maxEstimationErrorDeg.toFixed(2)}°
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 1. 2D Vector Decomposition Compass & Polygon Scope */}
          <div className="bg-[#080d18] border border-slate-800/90 rounded-lg p-3">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-medium text-slate-300">
                单支撑平面 (X-Z) 矢量合成罗盘
              </span>
              <div className="flex items-center gap-1 p-0.5 bg-slate-900 border border-slate-800 rounded-md">
                <button
                  type="button"
                  onClick={() => setScopeMode('origin')}
                  className={`px-2 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                    scopeMode === 'origin'
                      ? 'bg-slate-800 text-cyan-300'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  同源放射
                </button>
                <button
                  type="button"
                  onClick={() => setScopeMode('polygon')}
                  className={`px-2 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                    scopeMode === 'polygon'
                      ? 'bg-slate-800 text-cyan-300'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  首尾相加多边形
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* SVG Polar Vector Scope */}
              <svg
                viewBox="0 0 210 210"
                className="w-[182px] h-[182px] shrink-0 bg-[#060a12] rounded-lg border border-slate-800/70"
                role="img"
                aria-label="各控制分量与合并方向二维矢量图"
              >
                <defs>
                  <marker
                    id="arrow-resultant"
                    viewBox="0 0 10 10"
                    refX="7"
                    refY="5"
                    markerWidth="5.5"
                    markerHeight="5.5"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#10b981" />
                  </marker>
                  {components.map((c) => (
                    <marker
                      key={c.id}
                      id={`arrow-${c.id}`}
                      viewBox="0 0 10 10"
                      refX="7"
                      refY="5"
                      markerWidth="4.5"
                      markerHeight="4.5"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill={c.color} />
                    </marker>
                  ))}
                </defs>

                <circle
                  cx={svgCenter}
                  cy={svgCenter}
                  r={maxPixelRadius * 0.33}
                  fill="none"
                  stroke="#1e293b"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                />
                <circle
                  cx={svgCenter}
                  cy={svgCenter}
                  r={maxPixelRadius * 0.66}
                  fill="none"
                  stroke="#1e293b"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
                <circle
                  cx={svgCenter}
                  cy={svgCenter}
                  r={maxPixelRadius}
                  fill="none"
                  stroke="#334155"
                  strokeWidth="1"
                />

                <line
                  x1={svgCenter - maxPixelRadius - 10}
                  y1={svgCenter}
                  x2={svgCenter + maxPixelRadius + 10}
                  y2={svgCenter}
                  stroke="#1e293b"
                  strokeWidth="1"
                />
                <line
                  x1={svgCenter}
                  y1={svgCenter - maxPixelRadius - 10}
                  x2={svgCenter}
                  y2={svgCenter + maxPixelRadius + 10}
                  stroke="#1e293b"
                  strokeWidth="1"
                />

                <text x="193" y="102" fill="#64748b" fontSize="9" textAnchor="end">
                  +X
                </text>
                <text x="16" y="102" fill="#64748b" fontSize="9" textAnchor="start">
                  -X
                </text>
                <text x="109" y="199" fill="#64748b" fontSize="9" textAnchor="start">
                  +Z(前)
                </text>
                <text x="109" y="16" fill="#64748b" fontSize="9" textAnchor="start">
                  -Z(后)
                </text>

                {appliedResultant.magnitude > 0.015 && (
                  <>
                    <line
                      x1={svgCenter}
                      y1={svgCenter}
                      x2={rimRayX}
                      y2={rimRayY}
                      stroke="#10b981"
                      strokeWidth="1.2"
                      strokeDasharray="3 3"
                      strokeOpacity="0.55"
                    />
                    <circle
                      cx={rimRayX}
                      cy={rimRayY}
                      r="3.5"
                      fill="#10b981"
                    />
                  </>
                )}

                {scopeMode === 'origin'
                  ? components.map((comp) => {
                      const tip = toOriginSvgCoord(comp.vec.x, comp.vec.z);
                      const lenPx = Math.hypot(tip.x - svgCenter, tip.y - svgCenter);
                      if (lenPx < 2) return null;
                      return (
                        <line
                          key={comp.id}
                          x1={svgCenter}
                          y1={svgCenter}
                          x2={tip.x}
                          y2={tip.y}
                          stroke={comp.color}
                          strokeWidth="2"
                          strokeOpacity="0.88"
                          markerEnd={`url(#arrow-${comp.id})`}
                        />
                      );
                    })
                  : polygonSegments.map(({ comp, x1, y1, x2, y2 }) => {
                      const lenPx = Math.hypot(x2 - x1, y2 - y1);
                      if (lenPx < 1.5) return null;
                      return (
                        <line
                          key={comp.id}
                          x1={x1}
                          y1={y1}
                          x2={x2}
                          y2={y2}
                          stroke={comp.color}
                          strokeWidth="2"
                          strokeOpacity="0.9"
                          markerEnd={`url(#arrow-${comp.id})`}
                        />
                      );
                    })}

                {Math.hypot(resultantTip.x - svgCenter, resultantTip.y - svgCenter) >= 2 && (
                  <line
                    x1={svgCenter}
                    y1={svgCenter}
                    x2={resultantTip.x}
                    y2={resultantTip.y}
                    stroke="#10b981"
                    strokeWidth="3.2"
                    markerEnd="url(#arrow-resultant)"
                  />
                )}

                <circle cx={svgCenter} cy={svgCenter} r="3" fill="#f8fafc" />
              </svg>

              {/* Right-side Legend & Orthogonal Resultant Readout */}
              <div className="flex-1 min-w-0 space-y-2 text-xs">
                <div className="p-2 bg-slate-900/90 border border-slate-800 rounded-md">
                  <div className="text-[11px] text-slate-400">
                    合成矢量 <LatexFormula tex="\mathbf{u}_{\text{total}}" />
                  </div>
                  <div className="font-mono tabular-nums text-emerald-400 font-semibold mt-0.5">
                    u_x: {appliedResultant.vec.x >= 0 ? '+' : ''}
                    {appliedResultant.vec.x.toFixed(2)} m/s²
                  </div>
                  <div className="font-mono tabular-nums text-emerald-400 font-semibold">
                    u_z: {appliedResultant.vec.z >= 0 ? '+' : ''}
                    {appliedResultant.vec.z.toFixed(2)} m/s²
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 pt-1 border-t border-slate-800 font-mono tabular-nums">
                    推力 |F|: {Math.hypot(supportForceN.x, supportForceN.z).toFixed(2)} N
                  </div>
                </div>

                {/* Color Legend */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                      <span className="w-3 h-0.5 bg-emerald-400 inline-block" />
                      合并总方向
                    </span>
                    <span className="font-mono tabular-nums text-slate-300">
                      {appliedResultant.magnitude.toFixed(2)}
                    </span>
                  </div>
                  {components.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between text-[11px] text-slate-300"
                    >
                      <span className="flex items-center gap-1.5 truncate">
                        <span
                          className="w-2.5 h-0.5 inline-block shrink-0"
                          style={{ backgroundColor: c.color }}
                        />
                        <span className="truncate">{c.shortLabel}</span>
                      </span>
                      <span className="font-mono tabular-nums text-slate-400">
                        {c.magnitude.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-mono tabular-nums">
              <span>罗盘满量程: ±{radarScaleRadius.toFixed(1)} m/s²</span>
              <span>
                单支撑点: ({telemetry.supportPos.x.toFixed(2)}m,{' '}
                {telemetry.supportPos.z.toFixed(2)}m)
              </span>
            </div>
          </div>

          {/* 2. Individual Component Breakdown Header & Sub-term Toggle */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <GitMerge className="w-3.5 h-3.5 text-cyan-400" />
                <h3 className="text-xs font-semibold text-slate-200">
                  各关节与支撑点分量明细 ({components.length} 项 LaTeX 矢量项)
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setShowSubTerms((v) => !v)}
                className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
              >
                <Layers className="w-3 h-3" />
                <span>{showSubTerms ? '隐藏 θ/ω 子项' : '展开 θ/ω 子项'}</span>
              </button>
            </div>

            {/* Component Cards List */}
            <div className="space-y-2">
              {components.map((comp) => {
                const sharePct = (comp.share * 100).toFixed(1);
                return (
                  <div
                    key={comp.id}
                    className="p-2.5 bg-[#090e1a] border border-slate-800/90 rounded-lg text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-sm shrink-0"
                          style={{ backgroundColor: comp.color }}
                        />
                        <span className="font-medium text-slate-100 truncate">
                          {comp.label}
                        </span>
                      </div>
                      <span className="font-mono tabular-nums text-slate-200 font-semibold shrink-0">
                        {comp.magnitude.toFixed(2)} m/s²
                      </span>
                    </div>

                    {/* LaTeX Formula for this Component */}
                    <div className="mt-1 text-[11px] text-cyan-200/90 overflow-x-auto py-0.5">
                      <LatexFormula tex={comp.latexFormula} />
                    </div>

                    {/* Magnitude Share Progress Bar */}
                    <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden my-1.5">
                      <div
                        className="h-full transition-all duration-100"
                        style={{
                          width: `${Math.min(100, Math.max(2, comp.share * 100))}%`,
                          backgroundColor: comp.color,
                        }}
                      />
                    </div>

                    {/* Vector Coordinates, Direction Angle & Weight Share */}
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono tabular-nums">
                      <span>
                        ({comp.vec.x >= 0 ? '+' : ''}
                        {comp.vec.x.toFixed(2)}, {comp.vec.z >= 0 ? '+' : ''}
                        {comp.vec.z.toFixed(2)})
                      </span>
                      <span>
                        方向: {comp.angleDeg >= 0 ? '+' : ''}
                        {comp.angleDeg.toFixed(1)}°
                      </span>
                      <span>占比: {sharePct}%</span>
                    </div>

                    {/* Granular Sub-components for Pendulum Segments */}
                    {showSubTerms &&
                      comp.category === 'segment' &&
                      comp.angleTerm &&
                      comp.rateTerm && (
                        <div className="mt-2 pt-2 border-t border-slate-800/70 grid grid-cols-2 gap-2 text-[11px] text-slate-400 font-mono tabular-nums">
                          <div>
                            <div className="text-slate-400 font-sans flex items-center gap-1">
                              <LatexFormula
                                tex={
                                  telemetry.phase === 'swing_up'
                                    ? `\\mathbf{u}_{\\text{pump},${(comp.segmentIndex ?? 0) + 1}}`
                                    : `-K_{\\theta_${(comp.segmentIndex ?? 0) + 1}}\\sin\\theta_${(comp.segmentIndex ?? 0) + 1}`
                                }
                              />
                              <span>({comp.stateAngleDeg?.toFixed(1)}°)</span>
                            </div>
                            <div className="text-slate-300 mt-0.5">
                              ({comp.angleTerm.x >= 0 ? '+' : ''}
                              {comp.angleTerm.x.toFixed(2)},{' '}
                              {comp.angleTerm.z >= 0 ? '+' : ''}
                              {comp.angleTerm.z.toFixed(2)}) m/s²
                            </div>
                          </div>
                          <div>
                            <div className="text-slate-400 font-sans flex items-center gap-1">
                              <LatexFormula
                                tex={
                                  telemetry.phase === 'swing_up'
                                    ? `\\mathbf{u}_{\\text{sync},${(comp.segmentIndex ?? 0) + 1}}`
                                    : `-K_{\\omega_${(comp.segmentIndex ?? 0) + 1}}\\omega_${(comp.segmentIndex ?? 0) + 1}`
                                }
                              />
                              <span>({comp.stateRateDegPerSec?.toFixed(0)}°/s)</span>
                            </div>
                            <div className="text-slate-300 mt-0.5">
                              ({comp.rateTerm.x >= 0 ? '+' : ''}
                              {comp.rateTerm.x.toFixed(2)},{' '}
                              {comp.rateTerm.z >= 0 ? '+' : ''}
                              {comp.rateTerm.z.toFixed(2)}) m/s²
                            </div>
                          </div>
                        </div>
                      )}
                  </div>
                );
              })}

              {/* Final Vector Sum Verification Row */}
              <div className="p-2.5 bg-emerald-950/25 border border-emerald-800/50 rounded-lg text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-emerald-300 flex items-center gap-1.5">
                    <span>合并后总控制矢量</span>
                    <LatexFormula tex="\mathbf{u}_{\text{total}} = \sum \mathbf{u}_k" />
                  </span>
                  <span className="font-mono tabular-nums font-bold text-emerald-400">
                    {appliedResultant.magnitude.toFixed(2)} m/s²
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-emerald-200/80 font-mono tabular-nums mt-1">
                  <span>
                    合成坐标: ({rawResultant.vec.x >= 0 ? '+' : ''}
                    {rawResultant.vec.x.toFixed(2)}, {rawResultant.vec.z >= 0 ? '+' : ''}
                    {rawResultant.vec.z.toFixed(2)})
                  </span>
                  <span>
                    合并方向: {appliedResultant.angleDeg >= 0 ? '+' : ''}
                    {appliedResultant.angleDeg.toFixed(1)}° ({compassLabel})
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
