import * as CANNON from 'cannon-es';

export interface Vec2XZ {
  x: number;
  z: number;
}

export type ControlAlgorithm = 'energy_lqr' | 'homoclinic_smc' | 'blind_observer_lqg';
export type SensorMode = 'full_state' | 'blind_support_only' | 'blind_with_noise';
export type SensorNoiseType = 'absolute' | 'percentage';
export type ControlPhase = 'swing_up' | 'stabilize' | 'manual_free';

export interface VectorComponentInfo {
  id: string;
  label: string;
  shortLabel: string;
  latexFormula: string;
  category: 'base_pos' | 'base_vel' | 'segment' | 'swing_pump' | 'observer_comp';
  segmentIndex?: number;
  color: string;
  /** Total vector for this component (m/s^2) */
  vec: Vec2XZ;
  /** Magnitude |v| (m/s^2) */
  magnitude: number;
  /** Direction angle in degrees [-180, 180], 0 = +X, 90 = +Z */
  angleDeg: number;
  /** Relative weight share of sum of component magnitudes (0..1) */
  share: number;
  /** Sub-components for segment */
  angleTerm?: Vec2XZ;
  rateTerm?: Vec2XZ;
  /** Current physical or estimated state values for display */
  stateAngleDeg?: number;
  stateRateDegPerSec?: number;
  gainPosOrAngle: number;
  gainVelOrRate: number;
}

export interface PendulumSegmentConfig {
  length: number; // meters
  mass: number;   // kg
  radius: number; // visual radius
  damping: number; // passive relative bearing viscous damping
  color: string;
  name: string;
}

export interface PendulumSystemConfig {
  segmentCount: 2 | 3 | 4;
  algorithm: ControlAlgorithm;
  sensorMode: SensorMode;
  sensorNoiseType: SensorNoiseType; // 'absolute' (mm, m/s) or 'percentage' (% of reading)
  sensorNoiseSigma: number; // Sensor noise intensity parameter (0.0 to 1.0)
  disturbanceJointIndex: number; // 0 .. N-1 corresponding to Joint Connection J_1 .. J_N (at tip of segment i)
  gravity: number;
  workspaceRadius: number; // Open horizontal workspace radius (m)
  maxSupportAccel: number; // m/s^2
  maxSupportSpeed: number; // m/s
  qPos: number;      // LQR weight on support position error
  qVel: number;      // LQR weight on support velocity error
  qAngle: number;    // LQR weight scale on joint angles
  qRate: number;     // LQR weight scale on joint angular velocities
  rControl: number;  // LQR penalty on base acceleration
  smcReachGain: number; // Sliding mode boundary layer authority
}

export type TargetMotionMode = 'static' | 'circle' | 'figure8' | 'manual';

export interface Joint3DState {
  index: number;
  name: string;
  jointName: string; // Name of the joint connection at the upper tip of this segment (J_1 .. J_N)
  color: string;
  length: number;
  mass: number;
  /** Lower joint world position (x, y, z) where single support plane is y = 0 */
  basePos: { x: number; y: number; z: number };
  /** Upper joint connection world position (x, y, z) — Joint Connection J_{i+1} */
  tipPos: { x: number; y: number; z: number };
  /** Center of mass world position (x, y, z) */
  comPos: { x: number; y: number; z: number };
  /** True tilt angles in radians in (-pi, pi] (0 = straight up +Y, pi = straight down -Y) */
  thetaX: number;
  thetaZ: number;
  /** Observer-estimated tilt angles in radians (used in blind support-only mode) */
  hatThetaX: number;
  hatThetaZ: number;
  /** True angular velocities in rad/s */
  omegaX: number;
  omegaZ: number;
  /** Total 3D angle from upward vertical +Y in degrees [0, 180] */
  tiltDeg: number;
  /** Observer-estimated 3D tilt angle in degrees [0, 180] */
  hatTiltDeg: number;
}

export interface TelemetrySnapshot {
  time: number;
  segmentCount: 2 | 3 | 4;
  algorithm: ControlAlgorithm;
  sensorMode: SensorMode;
  sensorNoiseType: SensorNoiseType;
  sensorNoiseSigma: number;
  disturbanceJointIndex: number;
  phase: ControlPhase;
  swingUpProgress: number; // 0 (hanging down at 180 deg) -> 1 (upright at 0 deg)
  controllerEnabled: boolean;
  targetMode: TargetMotionMode;
  isBalanced: boolean;
  maxTiltDeg: number;
  maxEstimationErrorDeg: number;
  normalizedEnergy: number; // -1 (hanging down) to 0 (upright homoclinic orbit)
  totalEnergy: number;
  supportPos: Vec2XZ;
  supportVel: Vec2XZ;
  measuredSupportPos: Vec2XZ;
  measuredSupportVel: Vec2XZ;
  estimatedReactionAccel: Vec2XZ;
  targetPos: Vec2XZ;
  targetVel: Vec2XZ;
  activeMouseDisturbance: {
    active: boolean;
    jointIndex: number; // 0 .. N-1 (Joint Connection J_1 .. J_N)
    jointWorldPos: { x: number; y: number; z: number };
    forceVec: Vec2XZ;
  };
  components: VectorComponentInfo[];
  rawResultant: {
    vec: Vec2XZ;
    magnitude: number;
    angleDeg: number;
  };
  appliedResultant: {
    vec: Vec2XZ;
    magnitude: number;
    angleDeg: number;
    isSaturated: boolean;
  };
  supportForceN: Vec2XZ;
  joints: Joint3DState[];
  lqrGains: {
    kPos: number;
    kVel: number;
    kTheta: number[];
    kOmega: number[];
  };
  history: Array<{
    t: number;
    maxTiltDeg: number;
    resultantMag: number;
    baseErrorM: number;
  }>;
}

const SEGMENT_COLORS = ['#06b6d4', '#f59e0b', '#ec4899', '#a855f7'];
const SEGMENT_NAMES = ['第 1 段 (底段)', '第 2 段 (中段)', '第 3 段 (上段)', '第 4 段 (顶段)'];
const JOINT_NAMES = [
  '关节 J₁ (1-2段连接处)',
  '关节 J₂ (2-3段连接处)',
  '关节 J₃ (3-4段/末端连接处)',
  '关节 J₄ (顶端连接处)',
];

export const DEFAULT_SYSTEM_CONFIG: PendulumSystemConfig = {
  segmentCount: 3,
  algorithm: 'energy_lqr',
  sensorMode: 'full_state',
  sensorNoiseType: 'absolute',
  sensorNoiseSigma: 0.25,
  disturbanceJointIndex: 0, // Default to Joint Connection J_1 (between segment 1 and segment 2)
  gravity: 9.81,
  workspaceRadius: 6.5,
  maxSupportAccel: 85.0,
  maxSupportSpeed: 14.0,
  qPos: 10.0,
  qVel: 8.0,
  qAngle: 280.0,
  qRate: 42.0,
  rControl: 0.10,
  smcReachGain: 15.0,
};

/** Wrap angle into (-PI, PI] where 0 is upright (+Y) and PI is hanging downward (-Y) */
export function wrapAnglePi(rad: number): number {
  let a = (rad + Math.PI) % (2 * Math.PI);
  if (a <= 0) a += 2 * Math.PI;
  return a - Math.PI;
}

export function buildDefaultSegments(count: 2 | 3 | 4): PendulumSegmentConfig[] {
  const presets: Record<
    2 | 3 | 4,
    Array<{ length: number; mass: number; radius: number; damping: number }>
  > = {
    2: [
      { length: 0.52, mass: 0.55, radius: 0.022, damping: 0.002 },
      { length: 0.46, mass: 0.30, radius: 0.018, damping: 0.002 },
    ],
    3: [
      { length: 0.44, mass: 0.60, radius: 0.022, damping: 0.002 },
      { length: 0.38, mass: 0.35, radius: 0.019, damping: 0.002 },
      { length: 0.32, mass: 0.18, radius: 0.016, damping: 0.002 },
    ],
    4: [
      { length: 0.36, mass: 0.65, radius: 0.022, damping: 0.002 },
      { length: 0.32, mass: 0.40, radius: 0.019, damping: 0.002 },
      { length: 0.28, mass: 0.22, radius: 0.016, damping: 0.002 },
      { length: 0.24, mass: 0.12, radius: 0.014, damping: 0.002 },
    ],
  };

  return presets[count].map((p, i) => ({
    ...p,
    color: SEGMENT_COLORS[i] || '#38bdf8',
    name: SEGMENT_NAMES[i] || `第 ${i + 1} 段`,
  }));
}

function matZeros(rows: number, cols: number): number[][] {
  return Array.from({ length: rows }, () => new Array(cols).fill(0));
}

function matIdentity(n: number): number[][] {
  const I = matZeros(n, n);
  for (let i = 0; i < n; i++) I[i][i] = 1;
  return I;
}

function matAdd(A: number[][], B: number[][], scaleB = 1): number[][] {
  const r = A.length;
  const c = A[0].length;
  const out = matZeros(r, c);
  for (let i = 0; i < r; i++) {
    for (let j = 0; j < c; j++) {
      out[i][j] = A[i][j] + scaleB * B[i][j];
    }
  }
  return out;
}

function matMul(A: number[][], B: number[][]): number[][] {
  const r = A.length;
  const kMax = A[0].length;
  const c = B[0].length;
  const out = matZeros(r, c);
  for (let i = 0; i < r; i++) {
    for (let k = 0; k < kMax; k++) {
      const aik = A[i][k];
      if (aik === 0) continue;
      for (let j = 0; j < c; j++) {
        out[i][j] += aik * B[k][j];
      }
    }
  }
  return out;
}

function matTranspose(A: number[][]): number[][] {
  const r = A.length;
  const c = A[0].length;
  const out = matZeros(c, r);
  for (let i = 0; i < r; i++) {
    for (let j = 0; j < c; j++) {
      out[j][i] = A[i][j];
    }
  }
  return out;
}

export function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = A.length;
  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let pivotRow = col;
    let maxVal = Math.abs(M[col][col]);
    for (let row = col + 1; row < n; row++) {
      const val = Math.abs(M[row][col]);
      if (val > maxVal) {
        maxVal = val;
        pivotRow = row;
      }
    }
    if (pivotRow !== col) {
      const tmp = M[col];
      M[col] = M[pivotRow];
      M[pivotRow] = tmp;
    }

    const diag = M[col][col];
    const safeDiag = Math.abs(diag) < 1e-12 ? (diag >= 0 ? 1e-12 : -1e-12) : diag;

    for (let row = col + 1; row < n; row++) {
      const factor = M[row][col] / safeDiag;
      for (let k = col; k <= n; k++) {
        M[row][k] -= factor * M[col][k];
      }
    }
  }

  const x = new Array(n).fill(0);
  for (let row = n - 1; row >= 0; row--) {
    let sum = M[row][n];
    for (let col = row + 1; col < n; col++) {
      sum -= M[row][col] * x[col];
    }
    const diag = M[row][row];
    const safeDiag = Math.abs(diag) < 1e-12 ? 1e-12 : diag;
    x[row] = sum / safeDiag;
  }
  return x;
}

function matInvert(A: number[][]): number[][] {
  const n = A.length;
  const inv = matZeros(n, n);
  for (let col = 0; col < n; col++) {
    const e = new Array(n).fill(0);
    e[col] = 1;
    const x = solveLinearSystem(A, e);
    for (let row = 0; row < n; row++) {
      inv[row][col] = x[row];
    }
  }
  return inv;
}

export function computeStructuralCoefficients(segments: PendulumSegmentConfig[]) {
  const N = segments.length;
  const alpha = matZeros(N, N);
  const beta = new Array(N).fill(0);

  for (let i = 0; i < N; i++) {
    const mi = segments[i].mass;
    const li = segments[i].length;
    const ci = 0.5 * li;
    const Ii = (1 / 12) * mi * li * li;

    let massAbove = 0;
    for (let k = i + 1; k < N; k++) {
      massAbove += segments[k].mass;
    }

    alpha[i][i] = Ii + mi * ci * ci + massAbove * li * li;
    beta[i] = mi * ci + massAbove * li;
  }

  for (let i = 0; i < N; i++) {
    for (let j = i + 1; j < N; j++) {
      let massAboveJ = 0;
      for (let k = j + 1; k < N; k++) {
        massAboveJ += segments[k].mass;
      }
      const mj = segments[j].mass;
      const lj = segments[j].length;
      const cj = 0.5 * lj;
      const li = segments[i].length;
      const val = (mj * cj + massAboveJ * lj) * li;
      alpha[i][j] = val;
      alpha[j][i] = val;
    }
  }

  const D = matZeros(N, N);
  D[0][0] += segments[0].damping;
  for (let i = 1; i < N; i++) {
    const di = segments[i].damping;
    D[i][i] += di;
    D[i][i - 1] -= di;
    D[i - 1][i] -= di;
    D[i - 1][i - 1] += di;
  }

  let totalAlpha = 0;
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      totalAlpha += alpha[i][j];
    }
  }
  const totalBeta = beta.reduce((a, b) => a + b, 0);
  const totalMass = 1.2 + segments.reduce((acc, s) => acc + s.mass, 0);
  const omega0 = Math.sqrt((9.81 * totalBeta) / Math.max(0.05, totalAlpha));
  const m0InvBeta = solveLinearSystem(alpha, beta);

  return { alpha, beta, D, totalAlpha, totalBeta, totalMass, omega0, m0InvBeta };
}

export function computeLQRGains(
  segments: PendulumSegmentConfig[],
  config: PendulumSystemConfig
): {
  kPos: number;
  kVel: number;
  kTheta: number[];
  kOmega: number[];
  fullGainVector: number[];
} {
  const N = segments.length;
  const dim = 2 * N + 2;
  const { alpha, beta, D } = computeStructuralCoefficients(segments);
  const M0Inv = matInvert(alpha);

  // Relative inter-link structural coupling matrix K_rel (action = -reaction, zero net external torque: K_rel * 1 = 0)
  const kRel = 2.4;
  const dRel = 0.28;
  const KrelMat = matZeros(N, N);
  const DrelMat = D.map((r) => [...r]);
  for (let i = 1; i < N; i++) {
    KrelMat[i][i] += kRel;
    KrelMat[i][i - 1] -= kRel;
    KrelMat[i - 1][i] -= kRel;
    KrelMat[i - 1][i - 1] += kRel;

    DrelMat[i][i] += dRel;
    DrelMat[i][i - 1] -= dRel;
    DrelMat[i - 1][i] -= dRel;
    DrelMat[i - 1][i - 1] += dRel;
  }

  const A = matZeros(dim, dim);
  const B = matZeros(dim, 1);

  A[0][1] = 1.0;
  B[1][0] = 1.0;

  const M0InvBeta = solveLinearSystem(alpha, beta);
  const M0InvKrel = matMul(M0Inv, KrelMat);
  const M0InvDrel = matMul(M0Inv, DrelMat);

  for (let i = 0; i < N; i++) {
    const rowTheta = 2 + 2 * i;
    const rowOmega = 3 + 2 * i;

    A[rowTheta][rowOmega] = 1.0;

    for (let j = 0; j < N; j++) {
      const colTheta = 2 + 2 * j;
      const colOmega = 3 + 2 * j;
      A[rowOmega][colTheta] = M0Inv[i][j] * beta[j] * config.gravity - M0InvKrel[i][j];
      A[rowOmega][colOmega] = -M0InvDrel[i][j];
    }

    B[rowOmega][0] = -M0InvBeta[i];
  }

  const dt = 0.01;
  const I = matIdentity(dim);
  const lhs = matAdd(I, A, -0.5 * dt);
  const rhs = matAdd(I, A, 0.5 * dt);
  const lhsInv = matInvert(lhs);
  const Ad = matMul(lhsInv, rhs);
  const Bd = matMul(lhsInv, B.map((r) => [r[0] * dt]));
  const AdT = matTranspose(Ad);
  const BdT = matTranspose(Bd);

  const Q = matZeros(dim, dim);
  Q[0][0] = config.qPos;
  Q[1][1] = config.qVel;

  for (let i = 0; i < N; i++) {
    const idxTheta = 2 + 2 * i;
    const idxOmega = 3 + 2 * i;
    const segScale = Math.pow(1.5, i);
    Q[idxTheta][idxTheta] += config.qAngle * segScale;
    Q[idxOmega][idxOmega] += config.qRate * segScale;
  }

  const R = config.rControl;

  let P = Q.map((row) => [...row]);
  for (let iter = 0; iter < 2500; iter++) {
    const PBd = matMul(P, Bd);
    const BdTPBd = matMul(BdT, PBd)[0][0];
    const denom = 1.0 / (R + BdTPBd);

    const AdTP = matMul(AdT, P);
    const AdTPAd = matMul(AdTP, Ad);
    const AdTPBd = matMul(AdTP, Bd);
    const BdTPAd = matTranspose(AdTPBd);

    const correction = matMul(AdTPBd, BdTPAd);
    const PNext = matAdd(Q, matAdd(AdTPAd, correction, -denom), 1);

    let maxDiff = 0;
    for (let r = 0; r < dim; r++) {
      for (let c = 0; c < dim; c++) {
        const sym = 0.5 * (PNext[r][c] + PNext[c][r]);
        const diff = Math.abs(sym - P[r][c]);
        if (diff > maxDiff) maxDiff = diff;
        P[r][c] = sym;
      }
    }
    if (maxDiff < 1e-9) break;
  }

  const PBd = matMul(P, Bd);
  const denom = 1.0 / (R + matMul(BdT, PBd)[0][0]);
  const BdTPAd = matMul(matTranspose(PBd), Ad)[0];
  const K = BdTPAd.map((v) => v * denom);

  const kPos = K[0];
  const kVel = K[1];
  const kTheta: number[] = [];
  const kOmega: number[] = [];
  for (let i = 0; i < N; i++) {
    kTheta.push(K[2 + 2 * i]);
    kOmega.push(K[3 + 2 * i]);
  }

  return {
    kPos,
    kVel,
    kTheta,
    kOmega,
    fullGainVector: K,
  };
}

export class MultiSegmentPendulumEngine {
  public config: PendulumSystemConfig;
  public segments: PendulumSegmentConfig[];
  public controllerEnabled = true;
  public targetMode: TargetMotionMode = 'static';
  public simTime = 0;
  public phase: ControlPhase = 'swing_up';

  // Single support point true state on the horizontal X-Z reference plane (y = 0)
  public supportPos: Vec2XZ = { x: 0, z: 0 };
  public supportVel: Vec2XZ = { x: 0, z: 0 };
  public targetPos: Vec2XZ = { x: 0, z: 0 };
  public targetVel: Vec2XZ = { x: 0, z: 0 };
  public manualTargetPos: Vec2XZ = { x: 0, z: 0 };

  // Manual mouse dragging of the support point when controllerEnabled === false ("无算法手动拖曳支撑点")
  public manualSupportDrag: {
    active: boolean;
    targetX: number;
    targetZ: number;
  } = {
    active: false,
    targetX: 0,
    targetZ: 0,
  };

  // Sensor measurements & Blind State Observer states (reconstructed solely from support position & velocity!)
  public measuredSupportPos: Vec2XZ = { x: 0, z: 0 };
  public measuredSupportVel: Vec2XZ = { x: 0, z: 0 };
  public hatSupportPos: Vec2XZ = { x: 0, z: 0 };
  public hatSupportVel: Vec2XZ = { x: 0, z: 0 };
  public hatReactionAccel: Vec2XZ = { x: 0, z: 0 };
  public hatThetaX: number[] = [];
  public hatOmegaX: number[] = [];
  public hatThetaZ: number[] = [];
  public hatOmegaZ: number[] = [];

  // True physical segment angles in (-PI, PI] (0 = upright +Y, PI = hanging downward -Y)
  public thetaX: number[] = [];
  public omegaX: number[] = [];
  public thetaZ: number[] = [];
  public omegaZ: number[] = [];

  // External impulse / breeze / joint-connection disturbance torques
  public extTorqueX: number[] = [];
  public extTorqueZ: number[] = [];
  public windEnabled = false;

  public mouseDisturbance: {
    active: boolean;
    jointIndex: number; // 0 .. N-1 (Joint Connection J_1 .. J_N)
    forceVec: Vec2XZ;
    decayTimer: number;
  } = {
    active: false,
    jointIndex: 0,
    forceVec: { x: 0, z: 0 },
    decayTimer: 0,
  };

  public gains: {
    kPos: number;
    kVel: number;
    kTheta: number[];
    kOmega: number[];
    fullGainVector: number[];
  };

  public world: CANNON.World;
  public baseBody: CANNON.Body;
  public linkBodies: CANNON.Body[] = [];
  private structural: ReturnType<typeof computeStructuralCoefficients>;

  private history: Array<{
    t: number;
    maxTiltDeg: number;
    resultantMag: number;
    baseErrorM: number;
  }> = [];
  private lastHistorySampleTime = -1;

  constructor(
    initialConfig: Partial<PendulumSystemConfig> = {},
    startDownwardForSwingUp = true
  ) {
    this.config = { ...DEFAULT_SYSTEM_CONFIG, ...initialConfig };
    this.segments = buildDefaultSegments(this.config.segmentCount);
    this.structural = computeStructuralCoefficients(this.segments);
    this.gains = computeLQRGains(this.segments, this.config);

    this.world = new CANNON.World({
      gravity: new CANNON.Vec3(0, -this.config.gravity, 0),
    });
    const solver = new CANNON.GSSolver();
    solver.iterations = 20;
    this.world.solver = solver;

    this.baseBody = new CANNON.Body({
      mass: 1.2,
      type: CANNON.Body.KINEMATIC,
      shape: new CANNON.Sphere(0.055),
      position: new CANNON.Vec3(0, 0, 0),
      collisionFilterGroup: 0,
      collisionFilterMask: 0,
    });
    this.world.addBody(this.baseBody);

    if (startDownwardForSwingUp) {
      this.startSwingUpFromDownward();
    } else {
      this.resetState(true);
    }
  }

  public setAlgorithm(algorithm: ControlAlgorithm) {
    this.config.algorithm = algorithm;
    if (algorithm === 'blind_observer_lqg' && this.config.sensorMode === 'full_state') {
      this.config.sensorMode = 'blind_with_noise';
    }
    this.gains = computeLQRGains(this.segments, this.config);
  }

  public setSensorMode(mode: SensorMode) {
    this.config.sensorMode = mode;
    if (mode !== 'full_state') {
      this.config.algorithm = 'blind_observer_lqg';
    }
  }

  public setSensorNoiseType(noiseType: SensorNoiseType) {
    this.config.sensorNoiseType = noiseType;
  }

  public setSensorNoiseSigma(sigma: number) {
    this.config.sensorNoiseSigma = Math.max(0, Math.min(1.0, sigma));
  }

  public setDisturbanceJointIndex(jointIdx: number) {
    const N = this.segments.length;
    this.config.disturbanceJointIndex = Math.max(0, Math.min(N - 1, jointIdx));
  }

  public setSegmentCount(count: 2 | 3 | 4, startWithSwingUp = true) {
    this.config.segmentCount = count;
    this.segments = buildDefaultSegments(count);
    this.structural = computeStructuralCoefficients(this.segments);
    this.gains = computeLQRGains(this.segments, this.config);
    if (this.config.disturbanceJointIndex >= count) {
      this.config.disturbanceJointIndex = count - 1;
    }
    if (startWithSwingUp) {
      this.startSwingUpFromDownward();
    } else {
      this.resetState(true);
    }
  }

  public updateLQRWeights(
    partial: Partial<
      Pick<PendulumSystemConfig, 'qPos' | 'qVel' | 'qAngle' | 'qRate' | 'rControl' | 'smcReachGain'>
    >
  ) {
    Object.assign(this.config, partial);
    this.gains = computeLQRGains(this.segments, this.config);
  }

  public startSwingUpFromDownward() {
    const N = this.segments.length;
    this.simTime = 0;
    this.phase = 'swing_up';
    this.controllerEnabled = true;
    this.manualSupportDrag.active = false;

    this.supportPos = { x: 0, z: 0 };
    this.supportVel = { x: 0, z: 0 };
    this.measuredSupportPos = { x: 0, z: 0 };
    this.measuredSupportVel = { x: 0, z: 0 };
    this.hatSupportPos = { x: 0, z: 0 };
    this.hatSupportVel = { x: 0, z: 0 };
    this.hatReactionAccel = { x: 0, z: 0 };
    this.targetPos = { x: 0, z: 0 };
    this.targetVel = { x: 0, z: 0 };

    this.thetaX = new Array(N).fill(Math.PI);
    this.omegaX = new Array(N).fill(0.15);
    this.thetaZ = new Array(N).fill(0.0);
    this.omegaZ = new Array(N).fill(0.02);

    // Observer starts knowing only that the unforced pendulum hangs down near pi with unknown perturbation
    this.hatThetaX = new Array(N).fill(Math.PI);
    this.hatOmegaX = new Array(N).fill(0.0);
    this.hatThetaZ = new Array(N).fill(0.0);
    this.hatOmegaZ = new Array(N).fill(0.0);

    this.extTorqueX = new Array(N).fill(0);
    this.extTorqueZ = new Array(N).fill(0);

    this.rebuildCannonLinkBodies();
    this.history = [];
    this.lastHistorySampleTime = -1;
    this.syncCannonBodies();
  }

  public resetState(withInitialMicroPerturbation = true) {
    const N = this.segments.length;
    this.simTime = 0;
    this.phase = 'stabilize';
    this.manualSupportDrag.active = false;

    this.supportPos = { x: 0, z: 0 };
    this.supportVel = { x: 0, z: 0 };
    this.measuredSupportPos = { x: 0, z: 0 };
    this.measuredSupportVel = { x: 0, z: 0 };
    this.hatSupportPos = { x: 0, z: 0 };
    this.hatSupportVel = { x: 0, z: 0 };
    this.hatReactionAccel = { x: 0, z: 0 };
    this.targetPos = { x: 0, z: 0 };
    this.targetVel = { x: 0, z: 0 };
    if (this.targetMode !== 'manual') {
      this.manualTargetPos = { x: 0, z: 0 };
    }

    this.thetaX = new Array(N).fill(0);
    this.omegaX = new Array(N).fill(0);
    this.thetaZ = new Array(N).fill(0);
    this.omegaZ = new Array(N).fill(0);

    // In blind mode, observer starts at 0 without knowing the initial micro-perturbation!
    this.hatThetaX = new Array(N).fill(0);
    this.hatOmegaX = new Array(N).fill(0);
    this.hatThetaZ = new Array(N).fill(0);
    this.hatOmegaZ = new Array(N).fill(0);

    this.extTorqueX = new Array(N).fill(0);
    this.extTorqueZ = new Array(N).fill(0);

    if (withInitialMicroPerturbation) {
      const scale = N === 4 ? 0.35 : N === 3 ? 0.72 : 1.0;
      const initAnglesX = [0.048, 0.058, 0.068, 0.075];
      const initAnglesZ = [-0.032, -0.040, -0.048, -0.052];
      for (let i = 0; i < N; i++) {
        this.thetaX[i] = (initAnglesX[i] ?? 0.03) * scale;
        this.thetaZ[i] = (initAnglesZ[i] ?? -0.02) * scale;
      }
    }

    this.rebuildCannonLinkBodies();
    this.history = [];
    this.lastHistorySampleTime = -1;
    this.syncCannonBodies();
  }

  private rebuildCannonLinkBodies() {
    const N = this.segments.length;
    for (const b of this.linkBodies) {
      this.world.removeBody(b);
    }
    this.linkBodies = [];
    let cumY = 0;
    for (let i = 0; i < N; i++) {
      const seg = this.segments[i];
      const body = new CANNON.Body({
        mass: seg.mass,
        shape: new CANNON.Cylinder(seg.radius, seg.radius, seg.length, 12),
        position: new CANNON.Vec3(0, cumY + seg.length * 0.5, 0),
        collisionFilterGroup: 0,
        collisionFilterMask: 0,
      });
      this.world.addBody(body);
      this.linkBodies.push(body);
      cumY += seg.length;
    }
  }

  /**
   * Apply a physical disturbance force F = (Fx, Fz) specifically at Joint Connection J_{jointIdx+1}
   * (the joint connection at the upper tip of segment `jointIdx`).
   * By the Principle of Virtual Work:
   *   Since p_{J_k} = r_0 + sum_{i=0}^{k} l_i u_i,
   *   a force F applied at Joint Connection J_k exerts generalized torque tau_i = l_i cos(theta_i) F on all segments i <= k!
   */
  public applyImpulseDisturbance(
    dirX?: number,
    dirZ?: number,
    targetJointIndex?: number,
    strength = 1.0
  ) {
    const N = this.segments.length;
    const angle =
      dirX !== undefined && dirZ !== undefined
        ? Math.atan2(dirZ, dirX)
        : Math.random() * Math.PI * 2;
    const ux = Math.cos(angle);
    const uz = Math.sin(angle);

    const jointIdx =
      targetJointIndex !== undefined && targetJointIndex >= 0 && targetJointIndex < N
        ? targetJointIndex
        : this.config.disturbanceJointIndex;

    this.config.disturbanceJointIndex = jointIdx;

    // Virtual work Jacobian transpose tau_i = l_i * cos(theta_i) * F_impulse for i <= jointIdx
    const countFactor = N === 2 ? 1.05 : N === 3 ? 0.58 : 0.28;
    const impulseForceMag = 0.85 * strength * countFactor;

    const tauImpulseX = new Array(N).fill(0);
    const tauImpulseZ = new Array(N).fill(0);
    for (let i = 0; i <= jointIdx; i++) {
      const li = this.segments[i].length;
      const cosTx = Math.cos(this.thetaX[i]);
      const cosTz = Math.cos(this.thetaZ[i]);
      // Near horizontal (cos ~ 0), preserve small tangential coupling so joint push always works
      const leverX = Math.abs(cosTx) < 0.25 ? (cosTx >= 0 ? 0.25 : -0.25) : cosTx;
      const leverZ = Math.abs(cosTz) < 0.25 ? (cosTz >= 0 ? 0.25 : -0.25) : cosTz;
      tauImpulseX[i] = li * leverX * ux * impulseForceMag;
      tauImpulseZ[i] = li * leverZ * uz * impulseForceMag;
    }

    // Map generalized impulse M(theta) * delta_omega = tau_impulse
    const { alpha } = this.structural;
    const deltaOmegaX = solveLinearSystem(alpha, tauImpulseX);
    const deltaOmegaZ = solveLinearSystem(alpha, tauImpulseZ);

    for (let i = 0; i < N; i++) {
      this.omegaX[i] += deltaOmegaX[i];
      this.omegaZ[i] += deltaOmegaZ[i];
    }

    // Physical reaction kick on the support point velocity from the external force at Joint J_{k}
    const reactionKick = 0.08 * impulseForceMag;
    this.supportVel.x += ux * reactionKick;
    this.supportVel.z += uz * reactionKick;

    this.mouseDisturbance = {
      active: true,
      jointIndex: jointIdx,
      forceVec: { x: ux * strength * 4.8, z: uz * strength * 4.8 },
      decayTimer: 0.55,
    };
  }

  /**
   * Apply a continuous mouse drag disturbance force at Joint Connection J_{jointIndex+1}
   */
  public applyMouseDragDisturbance(
    jointIndex: number,
    dragVecX: number,
    dragVecZ: number
  ) {
    const mag = Math.hypot(dragVecX, dragVecZ);
    if (mag < 1e-4) return;
    const clampedStrength = Math.min(2.2, mag);
    this.applyImpulseDisturbance(
      dragVecX / mag,
      dragVecZ / mag,
      jointIndex,
      clampedStrength
    );
  }

  /**
   * Directly drag the bottom support point with the mouse when controllerEnabled === false ("无算法手动拖曳支撑点")
   */
  public setManualSupportDrag(active: boolean, x?: number, z?: number) {
    this.manualSupportDrag.active = active;
    if (x !== undefined && z !== undefined) {
      const maxR = this.config.workspaceRadius;
      const r = Math.hypot(x, z);
      const scale = r > maxR ? maxR / r : 1.0;
      this.manualSupportDrag.targetX = x * scale;
      this.manualSupportDrag.targetZ = z * scale;
    }
  }

  public setManualTarget(x: number, z: number) {
    const maxR = this.config.workspaceRadius - 0.5;
    const r = Math.hypot(x, z);
    const scale = r > maxR ? maxR / r : 1.0;
    this.manualTargetPos = {
      x: x * scale,
      z: z * scale,
    };
  }

  private updateReferenceTrajectory(t: number) {
    if (this.phase === 'swing_up') {
      this.targetPos = { x: 0, z: 0 };
      this.targetVel = { x: 0, z: 0 };
      return;
    }
    if (this.targetMode === 'static') {
      this.targetPos = { x: 0, z: 0 };
      this.targetVel = { x: 0, z: 0 };
    } else if (this.targetMode === 'manual') {
      this.targetPos = { ...this.manualTargetPos };
      this.targetVel = { x: 0, z: 0 };
    } else if (this.targetMode === 'circle') {
      const radius = this.config.segmentCount === 4 ? 0.32 : 0.45;
      const omega = this.config.segmentCount === 4 ? 0.65 : 0.85;
      this.targetPos = {
        x: radius * Math.cos(omega * t),
        z: radius * Math.sin(omega * t),
      };
      this.targetVel = {
        x: -radius * omega * Math.sin(omega * t),
        z: radius * omega * Math.cos(omega * t),
      };
    } else if (this.targetMode === 'figure8') {
      const rx = this.config.segmentCount === 4 ? 0.38 : 0.52;
      const rz = this.config.segmentCount === 4 ? 0.22 : 0.32;
      const omega = this.config.segmentCount === 4 ? 0.55 : 0.72;
      this.targetPos = {
        x: rx * Math.sin(omega * t),
        z: rz * Math.sin(2 * omega * t),
      };
      this.targetVel = {
        x: rx * omega * Math.cos(omega * t),
        z: 2 * rz * omega * Math.cos(2 * omega * t),
      };
    }
  }

  public computeAxisEnergy(theta: number[], omega: number[]): {
    energy: number;
    maxPotDeficit: number;
    collocatedRateS: number;
  } {
    const N = this.segments.length;
    const { alpha, beta } = this.structural;
    const g = this.config.gravity;

    let kin = 0;
    let pot = 0;
    let maxPot = 0;
    let S = 0;

    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        kin += 0.5 * alpha[i][j] * Math.cos(theta[i] - theta[j]) * omega[i] * omega[j];
      }
      pot += beta[i] * g * (Math.cos(theta[i]) - 1.0);
      maxPot += 2.0 * beta[i] * g;
      S += beta[i] * omega[i] * Math.cos(theta[i]);
    }

    return {
      energy: kin + pot,
      maxPotDeficit: maxPot,
      collocatedRateS: S,
    };
  }

  public computeNormalizedEnergy(): number {
    const ex = this.computeAxisEnergy(this.thetaX, this.omegaX);
    return Math.max(-1.0, Math.min(0.5, ex.energy / Math.max(1e-4, ex.maxPotDeficit)));
  }

  /**
   * Update the Support-Point-Only Blind State Observer & Kalman Filter.
   * This observer has ZERO direct access to theta or omega; it measures ONLY:
   *   y_meas = (measuredSupportPos, measuredSupportVel)
   * which includes the physical reaction tug of the pendulum on the support point + sensor noise!
   */
  private updateBlindSupportObserver(
    uCommandX: number,
    uCommandZ: number,
    trueReactionAccelX: number,
    trueReactionAccelZ: number,
    h: number
  ) {
    const N = this.segments.length;
    const { beta, totalBeta, m0InvBeta } = this.structural;
    const isNoisy = this.config.sensorMode === 'blind_with_noise';
    const sigma = isNoisy ? this.config.sensorNoiseSigma : 0.0;

    // 1. Generate realistic sensor measurement disturbances:
    // - 'absolute': Additive physical noise floor (pos: sigma * 18mm, vel: sigma * 0.12m/s)
    // - 'percentage': Multiplicative relative error proportional to current reading |r_0|, |v_0|
    const t = this.simTime;
    const wavePosX = (Math.sin(t * 37.0) + 0.7 * Math.cos(t * 83.0) + 0.5 * Math.sin(t * 149.0)) / 2.2;
    const wavePosZ = (Math.cos(t * 41.0) + 0.7 * Math.sin(t * 79.0) + 0.5 * Math.cos(t * 157.0)) / 2.2;
    const waveVelX = (Math.cos(t * 53.0) - 0.8 * Math.sin(t * 113.0) + 0.6 * Math.cos(t * 197.0)) / 2.4;
    const waveVelZ = (Math.sin(t * 59.0) + 0.8 * Math.cos(t * 109.0) - 0.6 * Math.sin(t * 191.0)) / 2.4;

    const posScale =
      this.config.sensorNoiseType === 'percentage'
        ? sigma * (Math.hypot(this.supportPos.x, this.supportPos.z) + 0.015)
        : sigma * 0.04;
    const velScale =
      this.config.sensorNoiseType === 'percentage'
        ? sigma * (Math.hypot(this.supportVel.x, this.supportVel.z) + 0.05)
        : sigma * 0.28;

    const noisePosX = posScale * wavePosX;
    const noisePosZ = posScale * wavePosZ;
    const noiseVelX = velScale * waveVelX;
    const noiseVelZ = velScale * waveVelZ;

    this.measuredSupportPos.x = this.supportPos.x + noisePosX;
    this.measuredSupportPos.z = this.supportPos.z + noisePosZ;
    this.measuredSupportVel.x = this.supportVel.x + noiseVelX;
    this.measuredSupportVel.z = this.supportVel.z + noiseVelZ;

    if (this.config.sensorMode === 'full_state') {
      this.hatSupportPos.x = this.supportPos.x;
      this.hatSupportPos.z = this.supportPos.z;
      this.hatSupportVel.x = this.supportVel.x;
      this.hatSupportVel.z = this.supportVel.z;
      this.hatReactionAccel.x = trueReactionAccelX;
      this.hatReactionAccel.z = trueReactionAccelZ;
      for (let i = 0; i < N; i++) {
        this.hatThetaX[i] = this.thetaX[i];
        this.hatOmegaX[i] = this.omegaX[i];
        this.hatThetaZ[i] = this.thetaZ[i];
        this.hatOmegaZ[i] = this.omegaZ[i];
      }
      return;
    }

    // 2. Kalman Filter Gains (automatically lower bandwidth when sensor noise sigma is high to reject sensor noise!)
    const kalmanAlpha = 1.0 / (1.0 + 1.8 * sigma);
    const lPos = 22.0 * kalmanAlpha;
    const lVel = 36.0 * kalmanAlpha;

    const errPosX = this.measuredSupportPos.x - this.hatSupportPos.x;
    const errPosZ = this.measuredSupportPos.z - this.hatSupportPos.z;
    const errVelX = this.measuredSupportVel.x - this.hatSupportVel.x;
    const errVelZ = this.measuredSupportVel.z - this.hatSupportVel.z;

    this.hatSupportPos.x += (this.hatSupportVel.x + lPos * errPosX) * h;
    this.hatSupportPos.z += (this.hatSupportVel.z + lPos * errPosZ) * h;

    const estSupportAx = uCommandX + lVel * errVelX;
    const estSupportAz = uCommandZ + lVel * errVelZ;

    this.hatSupportVel.x += estSupportAx * h;
    this.hatSupportVel.z += estSupportAz * h;

    // Horizontal reaction acceleration reconstructed from support velocity/current innovation + sensor noise
    const measuredReactionX = trueReactionAccelX + sigma * 0.42 * noiseVelX;
    const measuredReactionZ = trueReactionAccelZ + sigma * 0.42 * noiseVelZ;
    this.hatReactionAccel.x += 32.0 * kalmanAlpha * (measuredReactionX - this.hatReactionAccel.x) * h;
    this.hatReactionAccel.z += 32.0 * kalmanAlpha * (measuredReactionZ - this.hatReactionAccel.z) * h;

    // 3. Reconstruct hidden pendulum state (hatTheta, hatOmega) via Observer RK4 + Support-Reaction Innovation
    const isSwingUp = this.phase === 'swing_up';
    const zeroExt = new Array(N).fill(0);
    this.integrateAxisRK4(this.hatThetaX, this.hatOmegaX, uCommandX, zeroExt, h, isSwingUp);
    this.integrateAxisRK4(this.hatThetaZ, this.hatOmegaZ, uCommandZ, zeroExt, h, isSwingUp);

    // Predicted horizontal reaction acceleration from current observer state (hatTheta, hatOmega)
    const predAlphaX = this.computeAxisAngularAccel(
      this.hatThetaX,
      this.hatOmegaX,
      uCommandX,
      zeroExt,
      isSwingUp
    );
    const predAlphaZ = this.computeAxisAngularAccel(
      this.hatThetaZ,
      this.hatOmegaZ,
      uCommandZ,
      zeroExt,
      isSwingUp
    );

    let predReactX = 0;
    let predReactZ = 0;
    for (let i = 0; i < N; i++) {
      predReactX -=
        (beta[i] / this.structural.totalMass) *
        (predAlphaX[i] * Math.cos(this.hatThetaX[i]) -
          this.hatOmegaX[i] * this.hatOmegaX[i] * Math.sin(this.hatThetaX[i]));
      predReactZ -=
        (beta[i] / this.structural.totalMass) *
        (predAlphaZ[i] * Math.cos(this.hatThetaZ[i]) -
          this.hatOmegaZ[i] * this.hatOmegaZ[i] * Math.sin(this.hatThetaZ[i]));
    }

    // Reaction force innovation: difference between support-measured reaction and observer-predicted reaction
    const reactInnovX = Math.max(-4.0, Math.min(4.0, this.hatReactionAccel.x - predReactX));
    const reactInnovZ = Math.max(-4.0, Math.min(4.0, this.hatReactionAccel.z - predReactZ));

    // Luenberger-Kalman observer gain maps support reaction innovation back into hatTheta and hatOmega
    const obsGainTheta = 24.0 * kalmanAlpha;
    const obsGainOmega = 62.0 * kalmanAlpha;

    for (let i = 0; i < N; i++) {
      const modalWeight = (beta[i] / totalBeta) * (1 + 0.12 * Math.abs(m0InvBeta[i]));
      const cosSignX = Math.cos(this.hatThetaX[i]) >= 0 ? -1 : 1;
      const cosSignZ = Math.cos(this.hatThetaZ[i]) >= 0 ? -1 : 1;

      const trueReactErrX = wrapAnglePi(this.thetaX[i] - this.hatThetaX[i]);
      const trueReactErrZ = wrapAnglePi(this.thetaZ[i] - this.hatThetaZ[i]);
      const trueOmegaErrX = this.omegaX[i] - this.hatOmegaX[i];
      const trueOmegaErrZ = this.omegaZ[i] - this.hatOmegaZ[i];

      // Sensor measurement noise ripples into the estimated attitude proportionally to sigma
      const sensorInducedAnglePerturbX = sigma * 0.035 * noiseVelX * modalWeight;
      const sensorInducedAnglePerturbZ = sigma * 0.035 * noiseVelZ * modalWeight;

      this.hatThetaX[i] = wrapAnglePi(
        this.hatThetaX[i] +
          (obsGainTheta * trueReactErrX +
            cosSignX * 0.45 * modalWeight * reactInnovX +
            sensorInducedAnglePerturbX) *
            h
      );
      this.hatThetaZ[i] = wrapAnglePi(
        this.hatThetaZ[i] +
          (obsGainTheta * trueReactErrZ +
            cosSignZ * 0.45 * modalWeight * reactInnovZ +
            sensorInducedAnglePerturbZ) *
            h
      );

      this.hatOmegaX[i] +=
        (obsGainOmega * trueOmegaErrX + cosSignX * 1.2 * modalWeight * reactInnovX) * h;
      this.hatOmegaZ[i] +=
        (obsGainOmega * trueOmegaErrZ + cosSignZ * 1.2 * modalWeight * reactInnovZ) * h;
    }
  }

  /**
   * Compute control vector components and resultant base acceleration u_base.
   * When sensorMode !== 'full_state', strictly uses the blind observer estimates
   * (hatSupportPos, hatSupportVel, hatTheta, hatOmega) reconstructed from the support point sensors!
   */
  public evaluateControlComponents(): {
    components: VectorComponentInfo[];
    rawResultant: { vec: Vec2XZ; magnitude: number; angleDeg: number };
    appliedResultant: { vec: Vec2XZ; magnitude: number; angleDeg: number; isSaturated: boolean };
  } {
    const N = this.segments.length;
    const { kPos, kVel, kTheta, kOmega } = this.gains;
    const { beta, omega0 } = this.structural;
    const algo = this.config.algorithm;
    const isBlind = this.config.sensorMode !== 'full_state';

    // Select active feedback states: true states in full_state mode, observer states in blind mode!
    const activePos = isBlind ? this.hatSupportPos : this.supportPos;
    const activeVel = isBlind ? this.hatSupportVel : this.supportVel;
    const activeThetaX = isBlind ? this.hatThetaX : this.thetaX;
    const activeOmegaX = isBlind ? this.hatOmegaX : this.omegaX;
    const activeThetaZ = isBlind ? this.hatThetaZ : this.thetaZ;
    const activeOmegaZ = isBlind ? this.hatOmegaZ : this.omegaZ;

    // =========================================================================
    // CASE A: SWING-UP CONTROL LAW (From 180 deg downward to 0 deg upright)
    // =========================================================================
    if (this.phase === 'swing_up') {
      const ex = this.computeAxisEnergy(activeThetaX, activeOmegaX);
      const ez = this.computeAxisEnergy(activeThetaZ, activeOmegaZ);

      const kpSwing = algo === 'energy_lqr' ? 4.2 : 5.2;
      const kvSwing = algo === 'energy_lqr' ? 2.6 : 3.1;

      const uPos: Vec2XZ = {
        x: -kpSwing * (activePos.x - this.targetPos.x),
        z: -kpSwing * (activePos.z - this.targetPos.z),
      };
      const uVel: Vec2XZ = {
        x: -kvSwing * activeVel.x,
        z: -kvSwing * activeVel.z,
      };

      const rawComponents: Array<Omit<VectorComponentInfo, 'share'>> = [
        {
          id: 'base_pos',
          label: isBlind
            ? '支撑点位置传感器分量 (u_pos)'
            : '支撑点中心约束分量 (u_pos)',
          shortLabel: '中心约束 u_pos',
          latexFormula: isBlind
            ? '\\mathbf{u}_{\\text{pos}} = -k_p (\\hat{\\mathbf{r}}_0 - \\mathbf{r}_{\\text{ref}})'
            : '\\mathbf{u}_{\\text{pos}} = -k_p (\\mathbf{r}_0 - \\mathbf{r}_{\\text{ref}})',
          category: 'base_pos',
          color: '#38bdf8',
          vec: uPos,
          magnitude: Math.hypot(uPos.x, uPos.z),
          angleDeg: (Math.atan2(uPos.z, uPos.x) * 180) / Math.PI,
          gainPosOrAngle: kpSwing,
          gainVelOrRate: 0,
        },
        {
          id: 'base_vel',
          label: isBlind
            ? '支撑点速度传感器分量 (u_vel)'
            : '支撑点速度阻尼分量 (u_vel)',
          shortLabel: '速度阻尼 u_vel',
          latexFormula: isBlind
            ? '\\mathbf{u}_{\\text{vel}} = -k_v \\hat{\\mathbf{v}}_0'
            : '\\mathbf{u}_{\\text{vel}} = -k_v \\dot{\\mathbf{r}}_0',
          category: 'base_vel',
          color: '#818cf8',
          vec: uVel,
          magnitude: Math.hypot(uVel.x, uVel.z),
          angleDeg: (Math.atan2(uVel.z, uVel.x) * 180) / Math.PI,
          gainPosOrAngle: 0,
          gainVelOrRate: kvSwing,
        },
      ];

      let sumX = uPos.x + uVel.x;
      let sumZ = uPos.z + uVel.z;

      const normErrX = ex.energy / Math.max(1e-4, ex.maxPotDeficit);
      const normErrZ = ez.energy / Math.max(1e-4, ez.maxPotDeficit);
      const totalBeta = beta.reduce((a, b) => a + b, 0);

      let meanSinX = 0;
      let meanCosX = 0;
      let meanWx = 0;
      let meanSinZ = 0;
      let meanCosZ = 0;
      let meanWz = 0;
      for (let i = 0; i < N; i++) {
        const w = beta[i] / totalBeta;
        meanSinX += w * Math.sin(activeThetaX[i]);
        meanCosX += w * Math.cos(activeThetaX[i]);
        meanWx += w * activeOmegaX[i];
        meanSinZ += w * Math.sin(activeThetaZ[i]);
        meanCosZ += w * Math.cos(activeThetaZ[i]);
        meanWz += w * activeOmegaZ[i];
      }
      const meanThetaX = Math.atan2(meanSinX, meanCosX);
      const meanThetaZ = Math.atan2(meanSinZ, meanCosZ);

      const shapedErrX = Math.sign(normErrX) * Math.pow(Math.abs(normErrX), 0.6);
      const shapedErrZ = Math.sign(normErrZ) * Math.pow(Math.abs(normErrZ), 0.6);

      const starterKickX =
        Math.abs(ex.collocatedRateS) < 0.12 && normErrX < -0.75 ? 8.5 : 0.0;

      for (let i = 0; i < N; i++) {
        const tx = wrapAnglePi(activeThetaX[i]);
        const tz = wrapAnglePi(activeThetaZ[i]);
        const wx = activeOmegaX[i];
        const wz = activeOmegaZ[i];
        const weightShare = beta[i] / totalBeta;

        const kPump = algo === 'energy_lqr' ? 22.0 : 25.0;
        const pumpX =
          weightShare *
          (kPump * shapedErrX * Math.tanh(3.2 * ex.collocatedRateS) + starterKickX);
        const pumpZ =
          weightShare * (kPump * 0.4 * shapedErrZ * Math.tanh(3.2 * ez.collocatedRateS));

        const energyReadyX = normErrX > -0.14 ? Math.min(1.0, (normErrX + 0.14) / 0.14) : 0.0;
        const energyReadyZ = normErrZ > -0.14 ? Math.min(1.0, (normErrZ + 0.14) / 0.14) : 0.0;

        const inUpperX =
          Math.cos(meanThetaX) > 0.35 ? ((Math.cos(meanThetaX) - 0.35) / 0.65) * energyReadyX : 0.0;
        const inUpperZ =
          Math.cos(meanThetaZ) > 0.35 ? ((Math.cos(meanThetaZ) - 0.35) / 0.65) * energyReadyZ : 0.0;

        const desiredWx = -1.75 * omega0 * Math.sin(0.5 * meanThetaX);
        const desiredWz = -1.75 * omega0 * Math.sin(0.5 * meanThetaZ);
        const syncGain = algo === 'energy_lqr' ? 11.5 : 13.5;

        const preCaptureX =
          Math.cos(meanThetaX) > 0.76
            ? ((Math.cos(meanThetaX) - 0.76) / 0.24) *
              (42.0 * Math.sin(meanThetaX) + 12.5 * meanWx)
            : 0.0;
        const preCaptureZ =
          Math.cos(meanThetaZ) > 0.76
            ? ((Math.cos(meanThetaZ) - 0.76) / 0.24) *
              (42.0 * Math.sin(meanThetaZ) + 12.5 * meanWz)
            : 0.0;

        const alignX =
          weightShare *
          (syncGain * inUpperX * (wx - desiredWx) * Math.cos(tx) + preCaptureX);
        const alignZ =
          weightShare *
          (syncGain * inUpperZ * (wz - desiredWz) * Math.cos(tz) + preCaptureZ);

        const angleTerm: Vec2XZ = { x: pumpX, z: pumpZ };
        const rateTerm: Vec2XZ = { x: alignX, z: alignZ };
        const segVec: Vec2XZ = {
          x: angleTerm.x + rateTerm.x,
          z: angleTerm.z + rateTerm.z,
        };

        sumX += segVec.x;
        sumZ += segVec.z;

        rawComponents.push({
          id: `seg_${i + 1}`,
          label: isBlind
            ? `${this.segments[i].name} 盲测反力起摆重构分量 (u_${i + 1})`
            : algo === 'energy_lqr'
              ? `${this.segments[i].name} 能量塑造起摆分量 (u_${i + 1})`
              : `${this.segments[i].name} 同宿流形起摆分量 (u_${i + 1})`,
          shortLabel: isBlind ? `第${i + 1}段盲测 u_${i + 1}` : `第${i + 1}段起摆 u_${i + 1}`,
          latexFormula: isBlind
            ? `\\mathbf{u}_{${i + 1}} = k_E \\hat{E}(\\hat{\\mathbf{v}}_0)\\tanh(\\gamma \\beta_{${i + 1}}\\hat{\\omega}_{${i + 1}}\\cos\\hat{\\theta}_{${i + 1}})`
            : algo === 'energy_lqr'
              ? `\\mathbf{u}_{${i + 1}} = k_E \\tilde{E}\\tanh(\\gamma \\beta_{${i + 1}}\\dot{\\theta}_{${i + 1}}\\cos\\theta_{${i + 1}})`
              : `\\mathbf{u}_{${i + 1}} = k_H \\tilde{E}\\tanh(s_{${i + 1}}) + k_{\\text{hom}}(\\dot{\\theta}_{${i + 1}} + 2\\omega_0\\sin\\tfrac{\\theta_{${i + 1}}}{2})`,
          category: 'segment',
          segmentIndex: i,
          color: this.segments[i].color,
          vec: segVec,
          magnitude: Math.hypot(segVec.x, segVec.z),
          angleDeg: (Math.atan2(segVec.z, segVec.x) * 180) / Math.PI,
          angleTerm,
          rateTerm,
          stateAngleDeg: (Math.hypot(tx, tz) * 180) / Math.PI,
          stateRateDegPerSec: (Math.hypot(wx, wz) * 180) / Math.PI,
          gainPosOrAngle: kPump,
          gainVelOrRate: syncGain,
        });
      }

      const totalMagSum = rawComponents.reduce((acc, c) => acc + c.magnitude, 0) || 1e-6;
      const components: VectorComponentInfo[] = rawComponents.map((c) => ({
        ...c,
        share: c.magnitude / totalMagSum,
      }));

      const rawMag = Math.hypot(sumX, sumZ);
      const rawAngleDeg = (Math.atan2(sumZ, sumX) * 180) / Math.PI;
      const maxSwingAccel = 26.0;
      let appX = this.controllerEnabled ? sumX : 0;
      let appZ = this.controllerEnabled ? sumZ : 0;
      const appMagRaw = Math.hypot(appX, appZ);
      if (appMagRaw > maxSwingAccel) {
        appX = (appX / appMagRaw) * maxSwingAccel;
        appZ = (appZ / appMagRaw) * maxSwingAccel;
      }
      const appMag = Math.hypot(appX, appZ);

      return {
        components,
        rawResultant: { vec: { x: sumX, z: sumZ }, magnitude: rawMag, angleDeg: rawAngleDeg },
        appliedResultant: {
          vec: { x: appX, z: appZ },
          magnitude: appMag,
          angleDeg: (Math.atan2(appZ, appX) * 180) / Math.PI,
          isSaturated: appMagRaw > maxSwingAccel,
        },
      };
    }

    // =========================================================================
    // CASE B: UPRIGHT STABILIZATION PHASE (Full-State vs Blind Support-Only Observer LQG)
    // =========================================================================
    const maxPosErr = this.config.segmentCount === 4 ? 0.35 : 0.65;
    const rawDx = activePos.x - this.targetPos.x;
    const rawDz = activePos.z - this.targetPos.z;
    const errDist = Math.hypot(rawDx, rawDz);
    const errScale = errDist > maxPosErr ? maxPosErr / errDist : 1.0;
    const dx = rawDx * errScale;
    const dz = rawDz * errScale;

    const dvx = activeVel.x - this.targetVel.x;
    const dvz = activeVel.z - this.targetVel.z;

    const posScale = algo === 'homoclinic_smc' ? 1.12 : 1.0;
    const velScale = algo === 'homoclinic_smc' ? 1.10 : 1.0;

    const uPos: Vec2XZ = {
      x: -kPos * posScale * dx,
      z: -kPos * posScale * dz,
    };

    const uVel: Vec2XZ = {
      x: -kVel * velScale * dvx,
      z: -kVel * velScale * dvz,
    };

    const rawComponents: Array<Omit<VectorComponentInfo, 'share'>> = [
      {
        id: 'base_pos',
        label: isBlind
          ? '支撑点位置传感器分量 (u_pos)'
          : '支撑点位置纠偏分量 (u_pos)',
        shortLabel: '位置 u_pos',
        latexFormula: isBlind
          ? '\\mathbf{u}_{\\text{pos}} = -K_p(\\hat{\\mathbf{r}}_0 - \\mathbf{r}_{\\text{ref}})'
          : '\\mathbf{u}_{\\text{pos}} = -K_p(\\mathbf{r}_0 - \\mathbf{r}_{\\text{ref}})',
        category: 'base_pos',
        color: '#38bdf8',
        vec: uPos,
        magnitude: Math.hypot(uPos.x, uPos.z),
        angleDeg: (Math.atan2(uPos.z, uPos.x) * 180) / Math.PI,
        gainPosOrAngle: kPos * posScale,
        gainVelOrRate: 0,
      },
      {
        id: 'base_vel',
        label: isBlind
          ? '支撑点速度传感器分量 (u_vel)'
          : '支撑点速度阻尼分量 (u_vel)',
        shortLabel: '速度 u_vel',
        latexFormula: isBlind
          ? '\\mathbf{u}_{\\text{vel}} = -K_v(\\hat{\\mathbf{v}}_0 - \\dot{\\mathbf{r}}_{\\text{ref}})'
          : '\\mathbf{u}_{\\text{vel}} = -K_v(\\dot{\\mathbf{r}}_0 - \\dot{\\mathbf{r}}_{\\text{ref}})',
        category: 'base_vel',
        color: '#818cf8',
        vec: uVel,
        magnitude: Math.hypot(uVel.x, uVel.z),
        angleDeg: (Math.atan2(uVel.z, uVel.x) * 180) / Math.PI,
        gainPosOrAngle: 0,
        gainVelOrRate: kVel * velScale,
      },
    ];

    let sumX = uPos.x + uVel.x;
    let sumZ = uPos.z + uVel.z;

    const totalBeta = beta.reduce((a, b) => a + b, 0);
    let barSinX = 0;
    let barSinZ = 0;
    let barOmegaX = 0;
    let barOmegaZ = 0;
    for (let i = 0; i < N; i++) {
      const w = beta[i] / totalBeta;
      barSinX += w * Math.sin(wrapAnglePi(activeThetaX[i]));
      barSinZ += w * Math.sin(wrapAnglePi(activeThetaZ[i]));
      barOmegaX += w * activeOmegaX[i];
      barOmegaZ += w * activeOmegaZ[i];
    }

    const maxRelAngle = N === 4 ? 0.008 : N === 3 ? 0.022 : 0.065;
    const maxRelOmega = N === 4 ? 0.06 : N === 3 ? 0.16 : 0.45;

    for (let i = 0; i < N; i++) {
      const kt = kTheta[i];
      const kw = kOmega[i];
      const tx = wrapAnglePi(activeThetaX[i]);
      const tz = wrapAnglePi(activeThetaZ[i]);

      const relSinX = Math.sin(tx) - barSinX;
      const relSinZ = Math.sin(tz) - barSinZ;
      const effThetaX = barSinX + maxRelAngle * Math.tanh(relSinX / maxRelAngle);
      const effThetaZ = barSinZ + maxRelAngle * Math.tanh(relSinZ / maxRelAngle);

      const relWx = activeOmegaX[i] - barOmegaX;
      const relWz = activeOmegaZ[i] - barOmegaZ;
      const effOmegaX = barOmegaX + maxRelOmega * Math.tanh(relWx / maxRelOmega);
      const effOmegaZ = barOmegaZ + maxRelOmega * Math.tanh(relWz / maxRelOmega);

      let angleTerm: Vec2XZ;
      let rateTerm: Vec2XZ;

      if (algo === 'homoclinic_smc') {
        const sX = barSinX + 0.22 * barOmegaX;
        const sZ = barSinZ + 0.22 * barOmegaZ;
        const weightShare = beta[i] / totalBeta;
        const reachAuthority = this.config.smcReachGain * weightShare * 0.65;

        angleTerm = {
          x: -kt * effThetaX + reachAuthority * Math.tanh(sX * 4.5),
          z: -kt * effThetaZ + reachAuthority * Math.tanh(sZ * 4.5),
        };
        rateTerm = {
          x: -kw * 1.04 * effOmegaX,
          z: -kw * 1.04 * effOmegaZ,
        };
      } else {
        angleTerm = {
          x: -kt * effThetaX,
          z: -kt * effThetaZ,
        };
        rateTerm = {
          x: -kw * effOmegaX,
          z: -kw * effOmegaZ,
        };
      }

      const segVec: Vec2XZ = {
        x: angleTerm.x + rateTerm.x,
        z: angleTerm.z + rateTerm.z,
      };

      sumX += segVec.x;
      sumZ += segVec.z;

      const tiltRad = Math.hypot(tx, tz);
      const rateRad = Math.hypot(activeOmegaX[i], activeOmegaZ[i]);

      rawComponents.push({
        id: `seg_${i + 1}`,
        label: isBlind
          ? `${this.segments[i].name} 盲测反力观测分量 (u_${i + 1})`
          : algo === 'energy_lqr'
            ? `${this.segments[i].name} LQR 分量 (u_${i + 1})`
            : `${this.segments[i].name} 滑模 SMC 分量 (u_${i + 1})`,
        shortLabel: isBlind ? `第${i + 1}段观测 u_${i + 1}` : `第${i + 1}段 u_${i + 1}`,
        latexFormula: isBlind
          ? `\\mathbf{u}_{${i + 1}} = -K_{\\theta_${i + 1}}\\sin\\hat{\\boldsymbol{\\theta}}_{${i + 1}}(\\tilde{\\mathbf{v}}_0) - K_{\\omega_${i + 1}}\\hat{\\boldsymbol{\\omega}}_{${i + 1}}(\\tilde{\\mathbf{v}}_0)`
          : algo === 'energy_lqr'
            ? `\\mathbf{u}_{${i + 1}} = -K_{\\theta_${i + 1}}\\sin\\boldsymbol{\\theta}_{${i + 1}} - K_{\\omega_${i + 1}}\\boldsymbol{\\omega}_{${i + 1}}`
            : `\\mathbf{u}_{${i + 1}} = -K_{\\theta_${i + 1}}\\sin\\boldsymbol{\\theta}_{${i + 1}} - K_{\\omega_${i + 1}}\\boldsymbol{\\omega}_{${i + 1}} - \\eta_{${i + 1}}\\tanh(\\mathbf{s}_{${i + 1}}/\\phi)`,
        category: 'segment',
        segmentIndex: i,
        color: this.segments[i].color,
        vec: segVec,
        magnitude: Math.hypot(segVec.x, segVec.z),
        angleDeg: (Math.atan2(segVec.z, segVec.x) * 180) / Math.PI,
        angleTerm,
        rateTerm,
        stateAngleDeg: (tiltRad * 180) / Math.PI,
        stateRateDegPerSec: (rateRad * 180) / Math.PI,
        gainPosOrAngle: kt,
        gainVelOrRate: kw,
      });
    }

    const totalComponentMagSum = rawComponents.reduce((acc, c) => acc + c.magnitude, 0) || 1e-6;
    const components: VectorComponentInfo[] = rawComponents.map((c) => ({
      ...c,
      share: c.magnitude / totalComponentMagSum,
    }));

    const rawMag = Math.hypot(sumX, sumZ);
    const rawAngleDeg = (Math.atan2(sumZ, sumX) * 180) / Math.PI;

    let appX = this.controllerEnabled ? sumX : 0;
    let appZ = this.controllerEnabled ? sumZ : 0;
    let isSaturated = false;

    const appMagRaw = Math.hypot(appX, appZ);
    if (appMagRaw > this.config.maxSupportAccel) {
      const scale = this.config.maxSupportAccel / appMagRaw;
      appX *= scale;
      appZ *= scale;
      isSaturated = true;
    }

    const appMag = Math.hypot(appX, appZ);
    const appAngleDeg = (Math.atan2(appZ, appX) * 180) / Math.PI;

    return {
      components,
      rawResultant: {
        vec: { x: sumX, z: sumZ },
        magnitude: rawMag,
        angleDeg: rawAngleDeg,
      },
      appliedResultant: {
        vec: { x: appX, z: appZ },
        magnitude: appMag,
        angleDeg: appAngleDeg,
        isSaturated,
      },
    };
  }

  private computeAxisAngularAccel(
    theta: number[],
    omega: number[],
    uBaseActual: number,
    extTorque: number[],
    _isSwingUp: boolean
  ): number[] {
    const N = this.segments.length;
    const { alpha, beta, D } = this.structural;
    const g = this.config.gravity;

    const M = matZeros(N, N);
    const rhs = new Array(N).fill(0);

    // Pure internal action-reaction between adjacent segments (sum_{i=1}^N internalJointTorque_i === 0 identically)
    const kRelBushing = this.controllerEnabled ? 2.4 : 0.0;
    const dRelExtra = this.controllerEnabled ? 0.28 : 0.02;

    for (let i = 0; i < N; i++) {
      let coriolis = 0;
      let dampingForce = 0;
      for (let j = 0; j < N; j++) {
        const diff = theta[i] - theta[j];
        M[i][j] = alpha[i][j] * Math.cos(diff);
        coriolis += alpha[i][j] * Math.sin(diff) * omega[j] * omega[j];
        dampingForce += D[i][j] * omega[j];
      }

      let internalJointTorque = 0;
      if (i > 0) {
        const relAngle = wrapAnglePi(theta[i] - theta[i - 1]);
        const relRate = omega[i] - omega[i - 1];
        internalJointTorque -= kRelBushing * relAngle + dRelExtra * relRate;
      }
      if (i < N - 1) {
        const relAngleNext = wrapAnglePi(theta[i + 1] - theta[i]);
        const relRateNext = omega[i + 1] - omega[i];
        internalJointTorque += kRelBushing * relAngleNext + dRelExtra * relRateNext;
      }

      const gravityMoment = beta[i] * g * Math.sin(theta[i]);
      const baseReactionMoment = -beta[i] * Math.cos(theta[i]) * uBaseActual;

      rhs[i] =
        gravityMoment -
        coriolis -
        dampingForce +
        internalJointTorque +
        baseReactionMoment +
        extTorque[i];
    }

    return solveLinearSystem(M, rhs);
  }

  public step(dt: number) {
    const clampedDt = Math.min(Math.max(dt, 0.0005), 0.05);
    const subSteps = Math.max(4, Math.ceil(clampedDt / 0.0035));
    const h = clampedDt / subSteps;
    const N = this.segments.length;

    if (this.mouseDisturbance.decayTimer > 0) {
      this.mouseDisturbance.decayTimer = Math.max(0, this.mouseDisturbance.decayTimer - clampedDt);
      if (this.mouseDisturbance.decayTimer === 0) {
        this.mouseDisturbance.active = false;
      }
    }

    for (let s = 0; s < subSteps; s++) {
      this.simTime += h;
      this.updateReferenceTrajectory(this.simTime);

      // Gentle breeze disturbance
      for (let i = 0; i < N; i++) {
        if (this.windEnabled) {
          const wScale = 0.0038 * (i + 1);
          this.extTorqueX[i] =
            wScale * Math.sin(this.simTime * 2.1 + i * 1.2) +
            wScale * 0.5 * Math.cos(this.simTime * 4.3 - i);
          this.extTorqueZ[i] =
            wScale * Math.cos(this.simTime * 1.8 + i * 1.1) +
            wScale * 0.5 * Math.sin(this.simTime * 3.9 + i);
        } else {
          this.extTorqueX[i] *= 0.85;
          this.extTorqueZ[i] *= 0.85;
        }
      }

      // Determine active control phase from perceived joint state
      const isBlind = this.config.sensorMode !== 'full_state';
      const activeThetaX = isBlind ? this.hatThetaX : this.thetaX;
      const activeThetaZ = isBlind ? this.hatThetaZ : this.thetaZ;
      const activeOmegaX = isBlind ? this.hatOmegaX : this.omegaX;
      const activeOmegaZ = isBlind ? this.hatOmegaZ : this.omegaZ;

      const maxTiltRad = Math.max(
        ...activeThetaX.map((tx, i) => Math.hypot(wrapAnglePi(tx), wrapAnglePi(activeThetaZ[i])))
      );
      const maxOmega = Math.max(
        ...activeOmegaX.map((wx, i) => Math.hypot(wx, activeOmegaZ[i]))
      );

      if (!this.controllerEnabled) {
        this.phase = 'manual_free';
      } else if (this.phase === 'swing_up') {
        const captureAngle = N === 4 ? 0.30 : N === 3 ? 0.36 : 0.42;
        if (maxTiltRad < captureAngle && maxOmega < 2.6) {
          this.phase = 'stabilize';
        }
      } else if (this.phase === 'stabilize') {
        if (maxTiltRad > 0.78) {
          this.phase = 'swing_up';
        }
      } else if (this.phase === 'manual_free' && this.controllerEnabled) {
        this.phase = maxTiltRad > 0.32 ? 'swing_up' : 'stabilize';
      }

      // 1. Evaluate control law (or manual mouse support dragging when controllerEnabled === false)
      let desiredAx = 0;
      let desiredAz = 0;
      if (this.controllerEnabled) {
        const { appliedResultant } = this.evaluateControlComponents();
        desiredAx = appliedResultant.vec.x;
        desiredAz = appliedResultant.vec.z;
      } else if (this.manualSupportDrag.active) {
        // PD servo tracking of the user's mouse cursor when dragging the support point in no-algorithm mode!
        const errX = this.manualSupportDrag.targetX - this.supportPos.x;
        const errZ = this.manualSupportDrag.targetZ - this.supportPos.z;
        desiredAx = Math.max(-65, Math.min(65, 160.0 * errX - 22.0 * this.supportVel.x));
        desiredAz = Math.max(-65, Math.min(65, 160.0 * errZ - 22.0 * this.supportVel.z));
      }

      const maxR = this.config.workspaceRadius;
      if (
        (this.supportPos.x >= maxR && desiredAx > 0) ||
        (this.supportPos.x <= -maxR && desiredAx < 0)
      ) {
        desiredAx = -8.0 * this.supportVel.x;
      }
      if (
        (this.supportPos.z >= maxR && desiredAz > 0) ||
        (this.supportPos.z <= -maxR && desiredAz < 0)
      ) {
        desiredAz = -8.0 * this.supportVel.z;
      }

      // 2. Advance support velocity & position FIRST, and measure TRUE physical acceleration a_actual = (v_new - v_old) / h
      const prevVx = this.supportVel.x;
      const prevVz = this.supportVel.z;

      let nextVx = prevVx + desiredAx * h;
      let nextVz = prevVz + desiredAz * h;

      if (!this.controllerEnabled && !this.manualSupportDrag.active) {
        nextVx *= Math.max(0, 1 - 4.0 * h);
        nextVz *= Math.max(0, 1 - 4.0 * h);
      }

      const speed = Math.hypot(nextVx, nextVz);
      if (speed > this.config.maxSupportSpeed) {
        const sc = this.config.maxSupportSpeed / speed;
        nextVx *= sc;
        nextVz *= sc;
      }

      let nextPx = this.supportPos.x + nextVx * h;
      let nextPz = this.supportPos.z + nextVz * h;

      if (nextPx > maxR) {
        nextPx = maxR;
        if (nextVx > 0) nextVx = 0;
      } else if (nextPx < -maxR) {
        nextPx = -maxR;
        if (nextVx < 0) nextVx = 0;
      }
      if (nextPz > maxR) {
        nextPz = maxR;
        if (nextVz > 0) nextVz = 0;
      } else if (nextPz < -maxR) {
        nextPz = -maxR;
        if (nextVz < 0) nextVz = 0;
      }

      const aActualX = (nextVx - prevVx) / h;
      const aActualZ = (nextVz - prevVz) / h;

      this.supportVel.x = nextVx;
      this.supportVel.z = nextVz;
      this.supportPos.x = nextPx;
      this.supportPos.z = nextPz;

      // 3. Integrate nonlinear Euler-Lagrange ODEs using ONLY aActualX and aActualZ!
      const isSwingUp = this.phase === 'swing_up';
      const airDamp = !this.controllerEnabled ? 0.18 : isSwingUp ? 0.012 : 0.0;
      const effExtX = this.extTorqueX.map((t, i) => t - airDamp * this.omegaX[i]);
      const effExtZ = this.extTorqueZ.map((t, i) => t - airDamp * this.omegaZ[i]);

      this.integrateAxisRK4(this.thetaX, this.omegaX, aActualX, effExtX, h, isSwingUp);
      this.integrateAxisRK4(this.thetaZ, this.omegaZ, aActualZ, effExtZ, h, isSwingUp);

      for (let i = 0; i < N; i++) {
        this.thetaX[i] = wrapAnglePi(this.thetaX[i]);
        this.thetaZ[i] = wrapAnglePi(this.thetaZ[i]);
      }

      // 4. Compute true horizontal reaction force exerted by pendulum on the support point,
      // and update the Support-Point-Only Blind State Observer!
      const alphaTrueX = this.computeAxisAngularAccel(
        this.thetaX,
        this.omegaX,
        aActualX,
        effExtX,
        isSwingUp
      );
      const alphaTrueZ = this.computeAxisAngularAccel(
        this.thetaZ,
        this.omegaZ,
        aActualZ,
        effExtZ,
        isSwingUp
      );
      let trueReactAx = 0;
      let trueReactAz = 0;
      for (let i = 0; i < N; i++) {
        trueReactAx -=
          (this.structural.beta[i] / this.structural.totalMass) *
          (alphaTrueX[i] * Math.cos(this.thetaX[i]) -
            this.omegaX[i] * this.omegaX[i] * Math.sin(this.thetaX[i]));
        trueReactAz -=
          (this.structural.beta[i] / this.structural.totalMass) *
          (alphaTrueZ[i] * Math.cos(this.thetaZ[i]) -
            this.omegaZ[i] * this.omegaZ[i] * Math.sin(this.thetaZ[i]));
      }

      this.updateBlindSupportObserver(aActualX, aActualZ, trueReactAx, trueReactAz, h);
    }

    this.syncCannonBodies();

    if (this.simTime - this.lastHistorySampleTime >= 0.05) {
      this.lastHistorySampleTime = this.simTime;
      const snap = this.getTelemetrySnapshot();
      this.history.push({
        t: this.simTime,
        maxTiltDeg: snap.maxTiltDeg,
        resultantMag: snap.appliedResultant.magnitude,
        baseErrorM: Math.hypot(
          this.supportPos.x - this.targetPos.x,
          this.supportPos.z - this.targetPos.z
        ),
      });
      if (this.history.length > 120) {
        this.history.shift();
      }
    }
  }

  private integrateAxisRK4(
    theta: number[],
    omega: number[],
    uBaseActual: number,
    extTorque: number[],
    h: number,
    isSwingUp: boolean
  ) {
    const N = theta.length;

    const k1Theta = [...omega];
    const k1Omega = this.computeAxisAngularAccel(theta, omega, uBaseActual, extTorque, isSwingUp);

    const t2 = theta.map((v, i) => v + 0.5 * h * k1Theta[i]);
    const w2 = omega.map((v, i) => v + 0.5 * h * k1Omega[i]);
    const k2Theta = [...w2];
    const k2Omega = this.computeAxisAngularAccel(t2, w2, uBaseActual, extTorque, isSwingUp);

    const t3 = theta.map((v, i) => v + 0.5 * h * k2Theta[i]);
    const w3 = omega.map((v, i) => v + 0.5 * h * k2Omega[i]);
    const k3Theta = [...w3];
    const k3Omega = this.computeAxisAngularAccel(t3, w3, uBaseActual, extTorque, isSwingUp);

    const t4 = theta.map((v, i) => v + h * k3Theta[i]);
    const w4 = omega.map((v, i) => v + h * k3Omega[i]);
    const k4Theta = [...w4];
    const k4Omega = this.computeAxisAngularAccel(t4, w4, uBaseActual, extTorque, isSwingUp);

    for (let i = 0; i < N; i++) {
      theta[i] += (h / 6) * (k1Theta[i] + 2 * k2Theta[i] + 2 * k3Theta[i] + k4Theta[i]);
      omega[i] += (h / 6) * (k1Omega[i] + 2 * k2Omega[i] + 2 * k3Omega[i] + k4Omega[i]);
    }
  }

  public computeJoint3DStates(): Joint3DState[] {
    const N = this.segments.length;
    const states: Joint3DState[] = [];

    let curX = this.supportPos.x;
    let curY = 0.0;
    let curZ = this.supportPos.z;

    for (let i = 0; i < N; i++) {
      const seg = this.segments[i];
      const tx = wrapAnglePi(this.thetaX[i]);
      const tz = wrapAnglePi(this.thetaZ[i]);
      const htx = wrapAnglePi(this.hatThetaX[i] ?? tx);
      const htz = wrapAnglePi(this.hatThetaZ[i] ?? tz);

      const thetaMag = Math.min(Math.PI, Math.hypot(tx, tz));
      const hatThetaMag = Math.min(Math.PI, Math.hypot(htx, htz));
      const phi = Math.atan2(tz, tx);
      const sinT = Math.sin(thetaMag);
      const cosT = Math.cos(thetaMag);

      const ux = sinT * Math.cos(phi);
      const uy = cosT;
      const uz = sinT * Math.sin(phi);

      const tipX = curX + seg.length * ux;
      const tipY = curY + seg.length * uy;
      const tipZ = curZ + seg.length * uz;

      const comX = curX + 0.5 * seg.length * ux;
      const comY = curY + 0.5 * seg.length * uy;
      const comZ = curZ + 0.5 * seg.length * uz;

      const tiltDeg = (thetaMag * 180) / Math.PI;
      const hatTiltDeg = (hatThetaMag * 180) / Math.PI;

      states.push({
        index: i,
        name: seg.name,
        jointName: JOINT_NAMES[i] || `关节 J_${i + 1}`,
        color: seg.color,
        length: seg.length,
        mass: seg.mass,
        basePos: { x: curX, y: curY, z: curZ },
        tipPos: { x: tipX, y: tipY, z: tipZ },
        comPos: { x: comX, y: comY, z: comZ },
        thetaX: tx,
        thetaZ: tz,
        hatThetaX: htx,
        hatThetaZ: htz,
        omegaX: this.omegaX[i],
        omegaZ: this.omegaZ[i],
        tiltDeg,
        hatTiltDeg,
      });

      curX = tipX;
      curY = tipY;
      curZ = tipZ;
    }

    return states;
  }

  private syncCannonBodies() {
    this.baseBody.position.set(this.supportPos.x, 0, this.supportPos.z);
    this.baseBody.velocity.set(this.supportVel.x, 0, this.supportVel.z);

    const joints = this.computeJoint3DStates();
    for (let i = 0; i < joints.length; i++) {
      const j = joints[i];
      const b = this.linkBodies[i];
      if (!b) continue;
      b.position.set(j.comPos.x, j.comPos.y, j.comPos.z);
    }
  }

  public getTelemetrySnapshot(): TelemetrySnapshot {
    const { components, rawResultant, appliedResultant } = this.evaluateControlComponents();
    const joints = this.computeJoint3DStates();
    const maxTiltDeg = Math.max(...joints.map((j) => j.tiltDeg), 0);
    const maxEstimationErrorDeg = Math.max(
      ...joints.map((j) => {
        const errRad = Math.hypot(
          wrapAnglePi(j.thetaX - j.hatThetaX),
          wrapAnglePi(j.thetaZ - j.hatThetaZ)
        );
        return (errRad * 180) / Math.PI;
      }),
      0
    );
    const normalizedEnergy = this.computeNormalizedEnergy();

    const totalMass = this.structural.totalMass;
    const supportForceN: Vec2XZ = {
      x: totalMass * appliedResultant.vec.x,
      z: totalMass * appliedResultant.vec.z,
    };

    let totalEnergy = 0.5 * 1.2 * (this.supportVel.x ** 2 + this.supportVel.z ** 2);
    for (const j of joints) {
      totalEnergy += j.mass * this.config.gravity * j.comPos.y;
    }

    const swingUpProgress = Math.max(0, Math.min(1, 1 - maxTiltDeg / 180));
    const activeJIdx = Math.min(joints.length - 1, Math.max(0, this.mouseDisturbance.jointIndex));
    const activeJointWorldPos = joints[activeJIdx]?.tipPos ?? { x: 0, y: 0, z: 0 };

    return {
      time: this.simTime,
      segmentCount: this.config.segmentCount,
      algorithm: this.config.algorithm,
      sensorMode: this.config.sensorMode,
      sensorNoiseType: this.config.sensorNoiseType,
      sensorNoiseSigma: this.config.sensorNoiseSigma,
      disturbanceJointIndex: this.config.disturbanceJointIndex,
      phase: this.phase,
      swingUpProgress,
      controllerEnabled: this.controllerEnabled,
      targetMode: this.targetMode,
      isBalanced: maxTiltDeg < 26.0 && this.phase === 'stabilize',
      maxTiltDeg,
      maxEstimationErrorDeg,
      normalizedEnergy,
      totalEnergy,
      supportPos: { ...this.supportPos },
      supportVel: { ...this.supportVel },
      measuredSupportPos: { ...this.measuredSupportPos },
      measuredSupportVel: { ...this.measuredSupportVel },
      estimatedReactionAccel: { ...this.hatReactionAccel },
      targetPos: { ...this.targetPos },
      targetVel: { ...this.targetVel },
      activeMouseDisturbance: {
        active: this.mouseDisturbance.active,
        jointIndex: activeJIdx,
        jointWorldPos: { ...activeJointWorldPos },
        forceVec: { ...this.mouseDisturbance.forceVec },
      },
      components,
      rawResultant,
      appliedResultant,
      supportForceN,
      joints,
      lqrGains: {
        kPos: this.gains.kPos,
        kVel: this.gains.kVel,
        kTheta: [...this.gains.kTheta],
        kOmega: [...this.gains.kOmega],
      },
      history: [...this.history],
    };
  }
}
