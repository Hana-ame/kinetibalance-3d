# KinetiBalance 3D — 多段倒立摆物理平衡与矢量分解实验台

基于 **Three.js** 与刚体动力学 / **LQR 最优控制** 的桌面 **多段（2–4 节）倒立摆**稳定支撑仿真系统。

系统只通过移动**底部支撑点**（底座平移）来稳定全关节平衡，内置可展开的**矢量分量与合成方向仪表盘**，实时展示每个关节的受力分解与合成方向。

## Features

- **多段倒立摆（2 / 3 / 4 节）** — 刚体动力学建模，仅靠底座平移实现全关节稳定
- **多种控制算法**
  - `energy_lqr` — 能量泵浦摆起 + LQR 最优稳定
  - `homoclinic_smc` — 同宿轨道 / 滑模控制
  - `blind_observer_lqg` — 仅支撑点量测的盲观测器 + LQG 估计
- **矢量分解仪表盘** — 实时展示各关节加速度 / 力分量与合成方向（含角度、幅值、占比）
- **扰动注入** — 随机冲量扰动、风力、鼠标拖拽关节力，验证鲁棒性
- **目标运动模式** — 静止 / 圆周 / 8 字 / 手动拖拽，底座可主动跟踪目标轨迹
- **传感器噪声** — 全状态 / 仅支撑 / 带噪声三种传感模式，评估观测器性能
- **Three.js 3D 场景** — 等轴 / 前 / 顶 / 侧相机预设，轨迹拖尾，3D 矢量叠加

## Play Online

Live: **https://hana-ame.github.io/kinetibalance-3d/**

## Run Locally

**Prerequisites:** Node.js 20+

```bash
npm install
npm run dev        # http://localhost:3000
```

## Build & Test

```bash
npm run lint       # TypeScript type check
npm run test       # engine test suite (node:test)
npm run build      # production build to dist/
npm run build:pages  # build to docs/ for GitHub Pages
```

## Deploy

The repository uses **GitHub Actions** to build and deploy to GitHub Pages automatically on every push to `main`. The workflow:

1. Installs dependencies
2. Runs lint + tests
3. Builds the app into `docs/`
4. Uploads `docs/` as a Pages artifact and deploys it

The built site is a fully static single-page app — no backend or API keys required. The physics engine (`MultiSegmentPendulumEngine`) runs entirely in the browser.
