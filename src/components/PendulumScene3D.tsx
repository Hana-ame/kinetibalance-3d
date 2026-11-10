import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  MultiSegmentPendulumEngine,
  TelemetrySnapshot,
} from '../physics/pendulumEngine';

interface PendulumScene3DProps {
  engineRef: React.MutableRefObject<MultiSegmentPendulumEngine>;
  onTelemetryUpdate: (snapshot: TelemetrySnapshot) => void;
  show3DVectors: boolean;
  showTrails: boolean;
  cameraPreset: 'iso' | 'front' | 'top' | 'side';
  isPaused: boolean;
}

/** Detect software WebGL (SwiftShader / llvmpipe) per Three.js skill guidelines */
export const isSoftwareGl = (() => {
  if (typeof document === 'undefined') return false;
  const gl = document.createElement('canvas').getContext('webgl2');
  if (!gl) return true;
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
  const gpu = String(gl.getParameter(param));
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
})();

/** Create a soft radial glow / shadow texture */
function createRadialGlowTexture(colorRgba = 'rgba(6, 182, 212, 0.38)'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(128, 128, 6, 128, 128, 124);
  grad.addColorStop(0, colorRgba);
  grad.addColorStop(0.45, 'rgba(15, 23, 42, 0.18)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Pre-allocated math helpers outside render loop (zero GC)
const _vStart = new THREE.Vector3();
const _vEnd = new THREE.Vector3();
const _vDir = new THREE.Vector3();
const _vUp = new THREE.Vector3(0, 1, 0);
const _quat = new THREE.Quaternion();
const _camTargetPos = new THREE.Vector3();
const _camTargetLook = new THREE.Vector3();
const _dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _intersectPt = new THREE.Vector3();

interface ArrowVisual {
  group: THREE.Group;
  shaft: THREE.Mesh;
  head: THREE.Mesh;
  mat: THREE.MeshStandardMaterial;
}

function createArrowVisual(colorHex: string, radius = 0.009, headRadius = 0.024): ArrowVisual {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(colorHex),
    emissive: new THREE.Color(colorHex),
    emissiveIntensity: 0.4,
    roughness: 0.25,
    metalness: 0.4,
  });

  // Shaft pivoted at bottom (y = 0 to y = 1)
  const shaftGeo = new THREE.CylinderGeometry(radius, radius, 1, 12);
  shaftGeo.translate(0, 0.5, 0);
  const shaft = new THREE.Mesh(shaftGeo, mat);

  // Cone head pivoted at base (y = 0 to y = headLength)
  const headLength = headRadius * 2.6;
  const headGeo = new THREE.ConeGeometry(headRadius, headLength, 14);
  headGeo.translate(0, headLength * 0.5, 0);
  const head = new THREE.Mesh(headGeo, mat);

  group.add(shaft);
  group.add(head);
  return { group, shaft, head, mat };
}

function updateArrowVisual(
  arrow: ArrowVisual,
  originX: number,
  originY: number,
  originZ: number,
  vecX: number,
  vecZ: number,
  scale = 0.045,
  maxLen = 0.85
) {
  const mag = Math.hypot(vecX, vecZ);
  if (mag < 0.02) {
    arrow.group.visible = false;
    return;
  }
  arrow.group.visible = true;
  const visualLen = Math.min(maxLen, Math.max(0.05, mag * scale));
  const headLen = 0.055;
  const shaftLen = Math.max(0.02, visualLen - headLen);

  arrow.group.position.set(originX, originY, originZ);
  _vDir.set(vecX / mag, 0, vecZ / mag);
  _quat.setFromUnitVectors(_vUp, _vDir);
  arrow.group.quaternion.copy(_quat);

  arrow.shaft.scale.set(1, shaftLen, 1);
  arrow.head.position.set(0, shaftLen, 0);
}

export const PendulumScene3D: React.FC<PendulumScene3DProps> = ({
  engineRef,
  onTelemetryUpdate,
  show3DVectors,
  showTrails,
  cameraPreset,
  isPaused,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  // Store latest props in refs so WebGL canvas is never torn down on React HUD updates
  const propsRef = useRef({
    onTelemetryUpdate,
    show3DVectors,
    showTrails,
    cameraPreset,
    isPaused,
  });
  useEffect(() => {
    propsRef.current = {
      onTelemetryUpdate,
      show3DVectors,
      showTrails,
      cameraPreset,
      isPaused,
    };
  }, [onTelemetryUpdate, show3DVectors, showTrails, cameraPreset, isPaused]);

  const activeCameraPresetRef = useRef<string | null>(null);

  useEffect(() => {
    activeCameraPresetRef.current = cameraPreset;
  }, [cameraPreset]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070b14);
    scene.fog = new THREE.FogExp2(0x070b14, 0.055);

    const camera = new THREE.PerspectiveCamera(46, width / height, 0.05, 55);
    camera.position.set(2.35, 0.95, 2.95);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(renderer.domElement);

    // Studio Environment Reflection Map (RoomEnvironment)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // 3-Point Warm/Cool Studio Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x334155, 1.05);
    hemiLight.position.set(0, 6, 0);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff7ed, 2.2);
    keyLight.position.set(3.2, 5.0, 3.0);
    keyLight.castShadow = !isSoftwareGl;
    if (!isSoftwareGl) {
      keyLight.shadow.mapSize.width = 1024;
      keyLight.shadow.mapSize.height = 1024;
      keyLight.shadow.camera.near = 0.5;
      keyLight.shadow.camera.far = 15;
      const d = 3.2;
      keyLight.shadow.camera.left = -d;
      keyLight.shadow.camera.right = d;
      keyLight.shadow.camera.top = d;
      keyLight.shadow.camera.bottom = -d;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.25);
    rimLight.position.set(-3.2, -1.8, -2.6);
    scene.add(rimLight);

    // OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0.22, -0.05, 0);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI * 0.82;
    controls.minDistance = 1.2;
    controls.maxDistance = 9.5;
    controls.update();

    controls.addEventListener('start', () => {
      activeCameraPresetRef.current = null;
    });

    // =========================================================================
    // 1. Open Single-Point Support Workspace (NO solid tabletop slab blocking Y < 0!)
    // =========================================================================
    const workspaceGroup = new THREE.Group();

    const primaryGrid = new THREE.GridHelper(10, 20, 0x06b6d4, 0x1e293b);
    const gridMat = primaryGrid.material as THREE.Material;
    gridMat.transparent = true;
    gridMat.opacity = 0.42;
    workspaceGroup.add(primaryGrid);

    const ringRadii = [0.5, 1.2, 2.2, 3.5];
    const polarRingMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.24,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    for (const r of ringRadii) {
      const ringMesh = new THREE.Mesh(
        new THREE.RingGeometry(r - 0.008, r + 0.008, 64),
        polarRingMat
      );
      ringMesh.rotation.x = -Math.PI * 0.5;
      ringMesh.position.y = 0.001;
      workspaceGroup.add(ringMesh);
    }

    // Invisible horizontal interaction plane at Y = 0 for clicking manual target positions OR dragging support in No-Algorithm mode
    const workspacePickPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 14),
      new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide })
    );
    workspacePickPlane.rotation.x = -Math.PI * 0.5;
    workspaceGroup.add(workspacePickPlane);

    const floorGrid = new THREE.GridHelper(12, 24, 0x1e293b, 0x0f172a);
    floorGrid.position.y = -1.48;
    const floorGridMat = floorGrid.material as THREE.Material;
    floorGridMat.transparent = true;
    floorGridMat.opacity = 0.35;
    workspaceGroup.add(floorGrid);

    scene.add(workspaceGroup);

    // Target Reticle Ring on Y = 0 Plane
    const targetReticleGroup = new THREE.Group();
    const reticleOuterMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const reticleRing = new THREE.Mesh(
      new THREE.RingGeometry(0.11, 0.13, 36),
      reticleOuterMat
    );
    reticleRing.rotation.x = -Math.PI * 0.5;
    reticleRing.position.y = 0.002;
    targetReticleGroup.add(reticleRing);

    const reticleInner = new THREE.Mesh(
      new THREE.RingGeometry(0.022, 0.034, 24),
      reticleOuterMat
    );
    reticleInner.rotation.x = -Math.PI * 0.5;
    reticleInner.position.y = 0.0025;
    targetReticleGroup.add(reticleInner);
    scene.add(targetReticleGroup);

    // Dynamic laser tether line on Y = 0 from Origin (0,0,0) to Current Support Point (x0, 0, z0)
    const tetherPoints = new Float32Array(6);
    const tetherGeo = new THREE.BufferGeometry();
    tetherGeo.setAttribute('position', new THREE.BufferAttribute(tetherPoints, 3));
    const tetherLine = new THREE.Line(
      tetherGeo,
      new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.45 })
    );
    scene.add(tetherLine);

    // =========================================================================
    // 2. Pure Single-Point 3D Magnetic Gimbal Support Hub (Draggable in No-Algorithm Mode!)
    // =========================================================================
    const supportGroup = new THREE.Group();

    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.15,
      metalness: 0.92,
    });

    const haloTex = createRadialGlowTexture('rgba(6, 182, 212, 0.42)');
    const haloDisc = new THREE.Mesh(
      new THREE.PlaneGeometry(0.34, 0.34),
      new THREE.MeshBasicMaterial({
        map: haloTex,
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    haloDisc.rotation.x = -Math.PI * 0.5;
    supportGroup.add(haloDisc);

    const puckRingMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x10b981,
      emissiveIntensity: 0.65,
      roughness: 0.2,
      metalness: 0.6,
    });
    const puckRingMesh = new THREE.Mesh(
      new THREE.TorusGeometry(0.072, 0.006, 14, 36),
      puckRingMat
    );
    puckRingMesh.rotation.x = Math.PI * 0.5;
    supportGroup.add(puckRingMesh);

    const innerGimbalMesh = new THREE.Mesh(
      new THREE.TorusGeometry(0.044, 0.004, 12, 28),
      chromeMat
    );
    innerGimbalMesh.rotation.x = Math.PI * 0.5;
    supportGroup.add(innerGimbalMesh);

    const pivotSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.026, 22, 18),
      chromeMat
    );
    supportGroup.add(pivotSphere);

    // Generous invisible hit-target sphere around the support point so users can grab and drag the support hub directly!
    const supportHitCollider = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 16, 14),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    supportHitCollider.userData.isSupportHub = true;
    supportGroup.add(supportHitCollider);

    scene.add(supportGroup);

    // =========================================================================
    // 3. Multi-Segment Inverted Pendulum Links + Joint Connection Hit Targets
    // =========================================================================
    const MAX_SEGMENTS = 4;
    const segmentVisuals: Array<{
      group: THREE.Group;
      rodMesh: THREE.Mesh;
      hitColliderMesh: THREE.Mesh;
      jointTipHitCollider: THREE.Mesh;
      lowerCollar: THREE.Mesh;
      upperCollar: THREE.Mesh;
      comRing: THREE.Mesh;
      jointBall: THREE.Mesh;
      tipCap: THREE.Mesh;
      colorMat: THREE.MeshStandardMaterial;
    }> = [];

    const interactableMeshes: THREE.Mesh[] = [supportHitCollider];

    const darkCarbonMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.35,
      metalness: 0.72,
    });
    const brassMassMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      roughness: 0.22,
      metalness: 0.88,
    });

    for (let i = 0; i < MAX_SEGMENTS; i++) {
      const group = new THREE.Group();

      const colorMat = new THREE.MeshStandardMaterial({
        color: 0x06b6d4,
        roughness: 0.22,
        metalness: 0.65,
      });

      const jointBall = new THREE.Mesh(
        new THREE.SphereGeometry(0.026, 20, 16),
        chromeMat
      );
      group.add(jointBall);

      const rodGeo = new THREE.CylinderGeometry(0.015, 0.017, 1.0, 18);
      rodGeo.translate(0, 0.5, 0);
      const rodMesh = new THREE.Mesh(rodGeo, colorMat);
      rodMesh.castShadow = !isSoftwareGl;
      rodMesh.userData.jointIndex = i;
      group.add(rodMesh);

      // Hit-target cylinder along segment i (maps to Joint Connection J_{i+1} at the upper end of segment i)
      const hitGeo = new THREE.CylinderGeometry(0.062, 0.062, 1.0, 10);
      hitGeo.translate(0, 0.5, 0);
      const hitColliderMesh = new THREE.Mesh(
        hitGeo,
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hitColliderMesh.userData.jointIndex = i;
      interactableMeshes.push(hitColliderMesh);
      group.add(hitColliderMesh);

      // Dedicated spherical hit-target directly at Joint Connection J_{i+1} (top of segment i)
      const jointTipHitCollider = new THREE.Mesh(
        new THREE.SphereGeometry(0.085, 14, 12),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      jointTipHitCollider.userData.jointIndex = i;
      interactableMeshes.push(jointTipHitCollider);
      group.add(jointTipHitCollider);

      const collarGeo = new THREE.CylinderGeometry(0.021, 0.023, 0.055, 18);
      collarGeo.translate(0, 0.032, 0);
      const lowerCollar = new THREE.Mesh(collarGeo, darkCarbonMat);
      group.add(lowerCollar);

      const comRing = new THREE.Mesh(
        new THREE.CylinderGeometry(0.024, 0.024, 0.028, 20),
        brassMassMat
      );
      group.add(comRing);

      const upperCollarGeo = new THREE.CylinderGeometry(0.021, 0.020, 0.045, 18);
      const upperCollar = new THREE.Mesh(upperCollarGeo, darkCarbonMat);
      group.add(upperCollar);

      const tipCap = new THREE.Mesh(
        new THREE.SphereGeometry(0.030, 22, 18),
        colorMat
      );
      tipCap.castShadow = !isSoftwareGl;
      group.add(tipCap);

      scene.add(group);
      segmentVisuals.push({
        group,
        rodMesh,
        hitColliderMesh,
        jointTipHitCollider,
        lowerCollar,
        upperCollar,
        comRing,
        jointBall,
        tipCap,
        colorMat,
      });
    }

    // =========================================================================
    // 3b. Active Target Joint Connection Halo Ring (Shows which Joint Connection J_k receives disturbance!)
    // =========================================================================
    const jointTargetRingGroup = new THREE.Group();
    const jointRingMat = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xf97316,
      emissiveIntensity: 0.85,
      roughness: 0.2,
      metalness: 0.5,
    });
    const jointTargetTorus = new THREE.Mesh(
      new THREE.TorusGeometry(0.052, 0.0045, 12, 32),
      jointRingMat
    );
    jointTargetTorus.rotation.x = Math.PI * 0.5;
    jointTargetRingGroup.add(jointTargetTorus);
    scene.add(jointTargetRingGroup);

    // =========================================================================
    // 4. 3D Vector Arrows at Support Point + Joint Connection Disturbance Force Arrow
    // =========================================================================
    const vectorArrowsGroup = new THREE.Group();
    const componentArrows: ArrowVisual[] = [
      createArrowVisual('#38bdf8', 0.006, 0.016), // base_pos
      createArrowVisual('#818cf8', 0.006, 0.016), // base_vel
      createArrowVisual('#06b6d4', 0.007, 0.018), // seg_1
      createArrowVisual('#f59e0b', 0.007, 0.018), // seg_2
      createArrowVisual('#ec4899', 0.007, 0.018), // seg_3
      createArrowVisual('#a855f7', 0.007, 0.018), // seg_4
    ];
    for (const a of componentArrows) {
      vectorArrowsGroup.add(a.group);
    }

    const resultantArrow = createArrowVisual('#10b981', 0.012, 0.030);
    vectorArrowsGroup.add(resultantArrow.group);
    scene.add(vectorArrowsGroup);

    // Live 3D Disturbance Force Arrow (#f97316 Bright Orange) anchored directly at Joint Connection J_k!
    const mouseForceArrow = createArrowVisual('#f97316', 0.011, 0.028);
    mouseForceArrow.group.visible = false;
    scene.add(mouseForceArrow.group);

    // =========================================================================
    // 5. Trajectory Trails (Single Support Point Path + Top Tip 360° Swing Path)
    // =========================================================================
    const TRAIL_LEN = 120;
    const baseTrailPositions = new Float32Array(TRAIL_LEN * 3);
    const baseTrailGeo = new THREE.BufferGeometry();
    baseTrailGeo.setAttribute('position', new THREE.BufferAttribute(baseTrailPositions, 3));
    const baseTrailLine = new THREE.Line(
      baseTrailGeo,
      new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.58 })
    );
    baseTrailLine.frustumCulled = false;
    scene.add(baseTrailLine);

    const tipTrailPositions = new Float32Array(TRAIL_LEN * 3);
    const tipTrailGeo = new THREE.BufferGeometry();
    tipTrailGeo.setAttribute('position', new THREE.BufferAttribute(tipTrailPositions, 3));
    const tipTrailLine = new THREE.Line(
      tipTrailGeo,
      new THREE.LineBasicMaterial({ color: 0xf43f5e, transparent: true, opacity: 0.72 })
    );
    tipTrailLine.frustumCulled = false;
    scene.add(tipTrailLine);

    let trailInitialized = false;

    // =========================================================================
    // 6. Interactive 3D Mouse Perturbation at Joint Connections + Support Dragging in No-Algorithm Mode!
    // =========================================================================
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0 };
    let draggedJointIndex: number | null = null;
    let isDraggingSupportHub = false;
    let lastDragWorldPt = new THREE.Vector3();

    const updateRaycasterFromEvent = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);
    };

    const handlePointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
      updateRaycasterFromEvent(e);

      const hits = raycaster.intersectObjects(interactableMeshes, false);
      if (hits.length > 0) {
        const hitObj = hits[0].object;

        // Case 1: User grabbed the Support Point Hub
        if (hitObj.userData.isSupportHub) {
          isDraggingSupportHub = true;
          controls.enabled = false;
          _dragPlane.setFromNormalAndCoplanarPoint(
            new THREE.Vector3(0, 1, 0),
            new THREE.Vector3(0, 0, 0)
          );
          if (raycaster.ray.intersectPlane(_dragPlane, _intersectPt)) {
            if (!engineRef.current.controllerEnabled) {
              engineRef.current.setManualSupportDrag(true, _intersectPt.x, _intersectPt.z);
            } else {
              engineRef.current.targetMode = 'manual';
              engineRef.current.setManualTarget(_intersectPt.x, _intersectPt.z);
            }
          }
          renderer.domElement.style.cursor = 'grabbing';
          return;
        }

        // Case 2: User grabbed a Joint Connection J_{k+1} or segment
        if (hitObj.userData.jointIndex !== undefined) {
          const hitJointIdx = hitObj.userData.jointIndex as number;
          draggedJointIndex = hitJointIdx;
          engineRef.current.setDisturbanceJointIndex(hitJointIdx);
          controls.enabled = false;
          const hitPt = hits[0].point;
          _dragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), hitPt);
          lastDragWorldPt.copy(hitPt);
          renderer.domElement.style.cursor = 'grabbing';
          return;
        }
      }

      // Case 3: In No-Algorithm Mode (!controllerEnabled), clicking & dragging near the Y=0 support plane also drags the support point!
      if (!engineRef.current.controllerEnabled) {
        const planeHits = raycaster.intersectObject(workspacePickPlane, false);
        if (planeHits.length > 0) {
          const pt = planeHits[0].point;
          const distToSupport = Math.hypot(
            pt.x - engineRef.current.supportPos.x,
            pt.z - engineRef.current.supportPos.z
          );
          if (distToSupport < 1.2 || e.shiftKey) {
            isDraggingSupportHub = true;
            controls.enabled = false;
            _dragPlane.setFromNormalAndCoplanarPoint(
              new THREE.Vector3(0, 1, 0),
              new THREE.Vector3(0, 0, 0)
            );
            engineRef.current.setManualSupportDrag(true, pt.x, pt.z);
            renderer.domElement.style.cursor = 'grabbing';
          }
        }
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      updateRaycasterFromEvent(e);

      if (isDraggingSupportHub) {
        if (raycaster.ray.intersectPlane(_dragPlane, _intersectPt)) {
          if (!engineRef.current.controllerEnabled) {
            engineRef.current.setManualSupportDrag(true, _intersectPt.x, _intersectPt.z);
          } else {
            engineRef.current.targetMode = 'manual';
            engineRef.current.setManualTarget(_intersectPt.x, _intersectPt.z);
          }
        }
        return;
      }

      if (draggedJointIndex !== null) {
        if (raycaster.ray.intersectPlane(_dragPlane, _intersectPt)) {
          const dx = (_intersectPt.x - lastDragWorldPt.x) * 4.2;
          const dz = (_intersectPt.z - lastDragWorldPt.z) * 4.2;
          if (Math.hypot(dx, dz) > 0.01) {
            engineRef.current.applyMouseDragDisturbance(draggedJointIndex, dx, dz);
            lastDragWorldPt.copy(_intersectPt);
          }
        }
        return;
      }

      const hits = raycaster.intersectObjects(interactableMeshes, false);
      renderer.domElement.style.cursor = hits.length > 0 ? 'grab' : 'default';
    };

    const handlePointerUp = (e: PointerEvent) => {
      const moveDist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);

      if (isDraggingSupportHub) {
        isDraggingSupportHub = false;
        engineRef.current.setManualSupportDrag(false);
        controls.enabled = true;
        renderer.domElement.style.cursor = 'default';
        return;
      }

      if (draggedJointIndex !== null) {
        if (moveDist <= 6) {
          updateRaycasterFromEvent(e);
          engineRef.current.applyImpulseDisturbance(
            raycaster.ray.direction.x,
            raycaster.ray.direction.z,
            draggedJointIndex,
            0.95
          );
        }
        draggedJointIndex = null;
        controls.enabled = true;
        renderer.domElement.style.cursor = 'default';
        return;
      }

      if (moveDist > 6) return;

      updateRaycasterFromEvent(e);
      const planeHits = raycaster.intersectObject(workspacePickPlane, false);
      if (planeHits.length > 0) {
        const pt = planeHits[0].point;
        if (!engineRef.current.controllerEnabled) {
          engineRef.current.setManualSupportDrag(true, pt.x, pt.z);
          window.setTimeout(() => {
            engineRef.current.setManualSupportDrag(false);
          }, 220);
        } else if (engineRef.current.targetMode === 'manual' || e.shiftKey) {
          engineRef.current.targetMode = 'manual';
          engineRef.current.setManualTarget(pt.x, pt.z);
        }
      }
    };

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // =========================================================================
    // 7. Render & Physics Loop (with Software-WebGL fenceSync Pacing)
    // =========================================================================
    let frameId = 0;
    let lastTime = performance.now();
    let lastHudUpdate = 0;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      gl.flush();
      const poll = () => {
        if (!sync) {
          frameId = window.setTimeout(cb, 80);
          return;
        }
        const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function updateSceneVisuals(dt: number) {
      const engine = engineRef.current;
      const { show3DVectors: showVecs, showTrails: trailsOn, isPaused: paused } = propsRef.current;

      if (!paused) {
        engine.step(dt);
      }

      const snap = engine.getTelemetrySnapshot();

      // Update single-point gimbal support position & status ring color
      supportGroup.position.set(snap.supportPos.x, 0, snap.supportPos.z);
      const statusHex = !snap.controllerEnabled
        ? 0x38bdf8
        : snap.phase === 'swing_up'
          ? 0xf59e0b
          : snap.isBalanced
            ? 0x10b981
            : 0xf43f5e;
      puckRingMat.color.setHex(statusHex);
      puckRingMat.emissive.setHex(statusHex);

      // Update origin-to-support laser tether line
      tetherPoints[0] = 0;
      tetherPoints[1] = 0.002;
      tetherPoints[2] = 0;
      tetherPoints[3] = snap.supportPos.x;
      tetherPoints[4] = 0.002;
      tetherPoints[5] = snap.supportPos.z;
      tetherGeo.attributes.position.needsUpdate = true;

      // Update target reticle position
      targetReticleGroup.position.set(snap.targetPos.x, 0, snap.targetPos.z);
      reticleRing.rotation.z = snap.time * 0.8;

      // Update each segment's full 360-degree 3D pose
      const activeCount = snap.joints.length;
      for (let i = 0; i < MAX_SEGMENTS; i++) {
        const vis = segmentVisuals[i];
        if (i >= activeCount) {
          vis.group.visible = false;
          vis.hitColliderMesh.visible = false;
          vis.jointTipHitCollider.visible = false;
          continue;
        }
        vis.group.visible = true;
        const jState = snap.joints[i];

        vis.colorMat.color.set(jState.color);
        vis.colorMat.emissive.set(
          draggedJointIndex === i ? 0xf97316 : 0x000000
        );
        vis.colorMat.emissiveIntensity = draggedJointIndex === i ? 0.45 : 0.0;

        _vStart.set(jState.basePos.x, jState.basePos.y, jState.basePos.z);
        _vEnd.set(jState.tipPos.x, jState.tipPos.y, jState.tipPos.z);
        _vDir.subVectors(_vEnd, _vStart);
        const segLen = _vDir.length() || jState.length;
        _vDir.normalize();

        vis.group.position.copy(_vStart);
        _quat.setFromUnitVectors(_vUp, _vDir);
        vis.group.quaternion.copy(_quat);

        vis.rodMesh.scale.set(1, segLen, 1);
        vis.hitColliderMesh.scale.set(1, segLen, 1);
        vis.jointTipHitCollider.position.set(0, segLen, 0);
        vis.comRing.position.set(0, segLen * 0.5, 0);
        vis.upperCollar.position.set(0, segLen - 0.03, 0);
        vis.tipCap.position.set(0, segLen, 0);
        vis.tipCap.visible = i === activeCount - 1;
      }

      // Position the 3D Target Joint Connection Indicator Ring at the selected Joint Connection J_{k+1}
      const targetJointIdx = Math.min(activeCount - 1, Math.max(0, snap.disturbanceJointIndex));
      const targetJointState = snap.joints[targetJointIdx];
      if (targetJointState) {
        jointTargetRingGroup.visible = true;
        jointTargetRingGroup.position.set(
          targetJointState.tipPos.x,
          targetJointState.tipPos.y,
          targetJointState.tipPos.z
        );
        jointTargetTorus.rotation.z = snap.time * 2.2;
      } else {
        jointTargetRingGroup.visible = false;
      }

      // Update live 3D Disturbance Force Arrow anchored directly at Joint Connection J_k!
      if (snap.activeMouseDisturbance.active) {
        const jPos = snap.activeMouseDisturbance.jointWorldPos;
        updateArrowVisual(
          mouseForceArrow,
          jPos.x,
          jPos.y,
          jPos.z,
          snap.activeMouseDisturbance.forceVec.x,
          snap.activeMouseDisturbance.forceVec.z,
          0.08,
          0.58
        );
      } else {
        mouseForceArrow.group.visible = false;
      }

      // Update 3D Vector Arrows at the single support point
      vectorArrowsGroup.visible = showVecs;
      if (showVecs) {
        const ox = snap.supportPos.x;
        const oz = snap.supportPos.z;
        for (let cIdx = 0; cIdx < componentArrows.length; cIdx++) {
          const arrow = componentArrows[cIdx];
          const comp = snap.components[cIdx];
          if (!comp) {
            arrow.group.visible = false;
            continue;
          }
          arrow.mat.color.set(comp.color);
          arrow.mat.emissive.set(comp.color);
          updateArrowVisual(
            arrow,
            ox,
            0.008 + cIdx * 0.002,
            oz,
            comp.vec.x,
            comp.vec.z,
            0.022,
            0.65
          );
        }

        updateArrowVisual(
          resultantArrow,
          ox,
          0.024,
          oz,
          snap.appliedResultant.vec.x,
          snap.appliedResultant.vec.z,
          0.032,
          0.85
        );
      }

      // Update motion trails
      baseTrailLine.visible = trailsOn;
      tipTrailLine.visible = trailsOn;
      if (trailsOn && activeCount > 0) {
        const topJoint = snap.joints[activeCount - 1];
        if (!trailInitialized) {
          for (let k = 0; k < TRAIL_LEN; k++) {
            baseTrailPositions[k * 3] = snap.supportPos.x;
            baseTrailPositions[k * 3 + 1] = 0.004;
            baseTrailPositions[k * 3 + 2] = snap.supportPos.z;

            tipTrailPositions[k * 3] = topJoint.tipPos.x;
            tipTrailPositions[k * 3 + 1] = topJoint.tipPos.y;
            tipTrailPositions[k * 3 + 2] = topJoint.tipPos.z;
          }
          trailInitialized = true;
        } else if (!paused) {
          baseTrailPositions.copyWithin(0, 3);
          const lastIdx = (TRAIL_LEN - 1) * 3;
          baseTrailPositions[lastIdx] = snap.supportPos.x;
          baseTrailPositions[lastIdx + 1] = 0.004;
          baseTrailPositions[lastIdx + 2] = snap.supportPos.z;
          baseTrailGeo.attributes.position.needsUpdate = true;

          tipTrailPositions.copyWithin(0, 3);
          tipTrailPositions[lastIdx] = topJoint.tipPos.x;
          tipTrailPositions[lastIdx + 1] = topJoint.tipPos.y;
          tipTrailPositions[lastIdx + 2] = topJoint.tipPos.z;
          tipTrailGeo.attributes.position.needsUpdate = true;
        }
      }

      // Smooth camera preset transition
      const preset = activeCameraPresetRef.current;
      if (preset) {
        if (preset === 'iso') {
          _camTargetPos.set(2.35, 0.95, 2.95);
          _camTargetLook.set(0.22, -0.05, 0);
        } else if (preset === 'front') {
          _camTargetPos.set(0, 0.25, 3.25);
          _camTargetLook.set(0, 0.0, 0);
        } else if (preset === 'side') {
          _camTargetPos.set(3.25, 0.25, 0);
          _camTargetLook.set(0, 0.0, 0);
        } else if (preset === 'top') {
          _camTargetPos.set(0, 3.6, 0.01);
          _camTargetLook.set(0, 0, 0);
        }
        const alpha = 1 - Math.exp(-6.5 * dt);
        camera.position.lerp(_camTargetPos, alpha);
        controls.target.lerp(_camTargetLook, alpha);
        if (camera.position.distanceTo(_camTargetPos) < 0.015) {
          activeCameraPresetRef.current = null;
        }
      }

      controls.update();

      const now = performance.now();
      if (now - lastHudUpdate >= 95) {
        lastHudUpdate = now;
        propsRef.current.onTelemetryUpdate(snap);
      }
    }

    function tick() {
      const now = performance.now();
      const dt = isSoftwareGl ? 1 / 30 : Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      updateSceneVisuals(dt);
      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    updateSceneVisuals(1 / 60);
    renderer.render(scene, camera);
    if (isSoftwareGl) {
      afterDraw(tick);
    } else {
      frameId = requestAnimationFrame(tick);
    }

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [engineRef]);

  return (
    <div
      ref={mountRef}
      data-testid="pendulum-3d-canvas"
      className="relative w-full h-full select-none overflow-hidden"
      aria-label="三维多段单点支撑倒立摆起摆与平衡仿真视口"
    />
  );
};
