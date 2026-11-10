import React from 'react';
import { X } from 'lucide-react';
import { TelemetrySnapshot } from '../physics/pendulumEngine';
import { LatexFormula } from './LatexFormula';

interface AlgorithmModalProps {
  isOpen: boolean;
  onClose: () => void;
  telemetry: TelemetrySnapshot;
}

export const AlgorithmModal: React.FC<AlgorithmModalProps> = ({
  isOpen,
  onClose,
  telemetry,
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="algo-modal-title"
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/75"
    >
      <div className="w-full max-w-3xl bg-[#0c1220] border border-slate-800 rounded-xl shadow-2xl text-slate-100 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 id="algo-modal-title" className="text-base font-bold text-slate-100">
            单点支撑多段倒立摆起摆 (180° → 0°) 与双算法控制原理 (LaTeX)
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭算法说明弹窗"
            className="p-1.5 text-slate-400 hover:text-slate-100 bg-slate-800/80 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[76vh] overflow-y-auto text-sm leading-relaxed text-slate-300">
          <section>
            <h3 className="text-sm font-semibold text-cyan-300 mb-1.5">
              01. 欠驱动单支撑点多体欧拉-拉格朗日动力学方程 (无源被动关节)
            </h3>
            <p className="text-xs text-slate-400 mb-2">
              系统去除桌面碰撞限制，完全由原点水平面上的单一支撑点{' '}
              <LatexFormula tex="\mathbf{r}_0 = (x_0, 0, z_0)" />{' '}
              运动提供惯性反作用力矩。各摆段铰链均为无电机驱动的纯被动关节，由四阶龙格-库塔法 (RK4) 严格求解真实非线性微分方程：
            </p>
            <div className="p-3.5 bg-[#070b14] border border-slate-800 rounded-lg text-slate-100 overflow-x-auto">
              <LatexFormula
                block
                tex="\sum_{j=1}^{N} \alpha_{ij}\cos(\theta_i - \theta_j)\ddot{\theta}_j + \sum_{j=1}^{N} \alpha_{ij}\sin(\theta_i - \theta_j)\dot{\theta}_j^2 + \sum_{j=1}^{N} D_{ij}\dot{\theta}_j - \beta_i g\sin\theta_i = -\beta_i\cos\theta_i \, a_{\text{base,actual}}"
              />
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-cyan-300 mb-1.5">
              02. 算法一：李雅普诺夫能量塑造起摆 + 离散黎卡提 LQR 镇定 (Energy-Shaping + LQR)
            </h3>
            <p className="text-xs text-slate-400 mb-2">
              从垂直向下悬垂状态 (<LatexFormula tex="\theta_i = \pi" />) 出发，定义相对于竖直向上倒立平衡态的机械能误差{' '}
              <LatexFormula tex="\tilde{E} = E(\boldsymbol{\theta}, \dot{\boldsymbol{\theta}}) - E^*" />，利用无源性共置速率信号{' '}
              <LatexFormula tex="S = \sum_{i=1}^N \beta_i \dot{\theta}_i \cos\theta_i" />{' '}
              泵入能量，进入捕获锥后切换至全状态 LQR 最优反馈：
            </p>
            <div className="p-3.5 bg-[#070b14] border border-slate-800 rounded-lg text-emerald-300 overflow-x-auto space-y-2">
              <LatexFormula
                block
                tex="\mathbf{u}_{\text{swing}}^{(1)} = -k_p(\mathbf{r}_0 - \mathbf{r}_{\text{ref}}) - k_v\dot{\mathbf{r}}_0 + \sum_{i=1}^{N} k_E w_i |\tilde{E}|^{0.6}\operatorname{sgn}(\tilde{E})\tanh\left(\gamma \sum_{j=1}^N \beta_j\dot{\theta}_j\cos\theta_j\right)"
              />
              <LatexFormula
                block
                tex="\mathbf{u}_{\text{LQR}}^{(1)} = \mathbf{u}_{\text{pos}} + \mathbf{u}_{\text{vel}} + \sum_{i=1}^{N}\left(-K_{\theta_i}\sin\boldsymbol{\theta}_i - K_{\omega_i}\boldsymbol{\omega}_i\right)"
              />
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-cyan-300 mb-1.5">
              03. 算法二：同宿轨道流形起摆 + 耦合滑模变结构控制 (Homoclinic Orbit + Coupled SMC)
            </h3>
            <p className="text-xs text-slate-400 mb-2">
              在上半球追踪倒立摆同宿轨道相位关系{' '}
              <LatexFormula tex="\dot{\theta}_{\text{hom}}(\theta) = -2\omega_0\sin(\theta/2)" />，并在镇定阶段引入耦合滑模面{' '}
              <LatexFormula tex="\mathbf{s}_i = \sin\boldsymbol{\theta}_i + \lambda\boldsymbol{\omega}_i" />{' '}
              以增强对微风及鼠标拖拽扰动的鲁棒性：
            </p>
            <div className="p-3.5 bg-[#070b14] border border-slate-800 rounded-lg text-amber-300 overflow-x-auto">
              <LatexFormula
                block
                tex="\mathbf{u}_{\text{SMC}}^{(2)} = \mathbf{u}_{\text{pos}} + \mathbf{u}_{\text{vel}} + \sum_{i=1}^{N}\left(-K_{\theta_i}\sin\boldsymbol{\theta}_i - K_{\omega_i}\boldsymbol{\omega}_i - \eta_i\tanh\left(\frac{\sin\boldsymbol{\theta}_i + \lambda\boldsymbol{\omega}_i}{\phi}\right)\right)"
              />
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-purple-300 mb-1.5">
              04. 算法三：无姿态传感器盲测反力卡尔曼观测器 (仅感知支撑点位置/速度 + 传感器噪声扰动)
            </h3>
            <p className="text-xs text-slate-400 mb-2">
              在完全无法直接测量任何关节倾角 <LatexFormula tex="\theta_i" /> 与角速度 <LatexFormula tex="\dot{\theta}_i" /> 的盲测工况下，控制器仅能读取受测量噪声{' '}
              <LatexFormula tex="\mathbf{w}_p(t), \mathbf{w}_v(t)" /> 污染的底部支撑点位置与速度传感器{' '}
              <LatexFormula tex="\tilde{\mathbf{y}}_0 = [\mathbf{r}_0 + \mathbf{w}_p,\; \dot{\mathbf{r}}_0 + \mathbf{w}_v]^T" />。利用多段摆对底部支撑点施加的水平惯性反作用力新息{' '}
              <LatexFormula tex="a_{\text{react}}" /> 重构隐含姿态 <LatexFormula tex="\hat{\boldsymbol{\theta}}, \hat{\boldsymbol{\omega}}" />，同时通过虚功原理雅可比转置精确计算施加在关节连接处{' '}
              <LatexFormula tex="J_k" /> 的外部扰动力矩：
            </p>
            <div className="p-3.5 bg-[#070b14] border border-slate-800 rounded-lg text-purple-200 overflow-x-auto space-y-2">
              <LatexFormula
                block
                tex="a_{\text{react}} = -\frac{1}{M_{\text{total}}}\sum_{i=1}^{N}\beta_i\left(\ddot{\theta}_i\cos\theta_i - \dot{\theta}_i^2\sin\theta_i\right), \quad \dot{\hat{\mathbf{x}}} = f(\hat{\mathbf{x}}, u) + \mathbf{L}(\sigma_n)\left(\tilde{\mathbf{y}}_0 - \hat{\mathbf{y}}_0\right)"
              />
              <LatexFormula
                block
                tex="\tau_{i,\text{ext}}^{(J_k)} = \left(\frac{\partial \mathbf{p}_{J_k}}{\partial \theta_i}\right)^T \mathbf{F}_{J_k} = \begin{cases} l_i\cos\theta_i \, F_{J_k}, & i \le k \\ 0, & i > k \end{cases}"
              />
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-cyan-300 mb-2">
              05. 当前 {telemetry.segmentCount} 段倒立摆实时最优反馈增益矩阵 <LatexFormula tex="\mathbf{K}" />
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono tabular-nums text-xs">
              <div className="p-2.5 bg-[#070b14] border border-slate-800 rounded-lg">
                <div className="text-slate-400 text-[11px]">
                  位置增益 <LatexFormula tex="K_{\text{pos}}" />
                </div>
                <div className="text-sky-400 font-semibold mt-0.5">
                  {telemetry.lqrGains.kPos.toFixed(2)} s⁻²
                </div>
              </div>
              <div className="p-2.5 bg-[#070b14] border border-slate-800 rounded-lg">
                <div className="text-slate-400 text-[11px]">
                  速度增益 <LatexFormula tex="K_{\text{vel}}" />
                </div>
                <div className="text-indigo-400 font-semibold mt-0.5">
                  {telemetry.lqrGains.kVel.toFixed(2)} s⁻¹
                </div>
              </div>
              {telemetry.lqrGains.kTheta.map((kt, idx) => (
                <div
                  key={idx}
                  className="p-2.5 bg-[#070b14] border border-slate-800 rounded-lg"
                >
                  <div className="text-slate-400 text-[11px]">
                    第 {idx + 1} 段 (<LatexFormula tex={`K_{\\theta_${idx + 1}} / K_{\\omega_${idx + 1}}`} />)
                  </div>
                  <div className="text-slate-100 font-semibold mt-0.5">
                    {kt.toFixed(1)} / {telemetry.lqrGains.kOmega[idx].toFixed(1)}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="px-6 py-3 bg-[#090e1a] border-t border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors cursor-pointer"
          >
            返回三维仿真实验台
          </button>
        </div>
      </div>
    </div>
  );
};
