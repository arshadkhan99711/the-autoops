import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RotateCcw } from 'lucide-react';
import { AutonomousTopology2D } from './AutonomousTopology2D';

export interface AutonomousOps3DProps {
  activeStage: number;
  onSelectNode?: (nodeId: string) => void;
}

interface NodeMeta {
  id: string;
  label: string;
  sublabelByStage: [string, string, string, string];
  position: [number, number, number];
  kind: 'gateway' | 'service' | 'database' | 'ai';
}

interface ConduitDef {
  from: string;
  to: string;
  arcHeight: number;
  speed: number;
  isAlertPath?: boolean;
  isPatchPath?: boolean;
}

const NODE_META: NodeMeta[] = [
  {
    id: 'ai',
    label: 'The Autoops Core',
    sublabelByStage: [
      'Ingesting 14.2k telemetry events/s',
      'Correlating pgPool stack trace & AST',
      'Synthesizing try/finally patch diff',
      'Verification suite passed · Ready',
    ],
    position: [0, 0, -0.7],
    kind: 'ai',
  },
  {
    id: 'gateway',
    label: 'Edge Gateway',
    sublabelByStage: [
      '14.2k req/s · Ingress nominal',
      '14.2k req/s · Tracing request IDs',
      '14.2k req/s · Canary traffic routed',
      '14.2k req/s · Nominal',
    ],
    position: [-3.35, 0, 1.35],
    kind: 'gateway',
  },
  {
    id: 'checkout',
    label: 'checkout-gateway',
    sublabelByStage: [
      'INC-4821 · Pool exhausted (20/20)',
      'INC-4821 · Leak at checkout.ts:142',
      'Applying connection release guard',
      'Verified · 0.12% error rate',
    ],
    position: [-1.45, 0, 2.25],
    kind: 'service',
  },
  {
    id: 'auth',
    label: 'auth-edge-proxy',
    sublabelByStage: [
      'INC-4820 · JWKS 429 cache miss',
      'Correlating upstream token latency',
      'Cache-control fallback staged',
      'Nominal · 11ms P95',
    ],
    position: [1.65, 0, 2.15],
    kind: 'service',
  },
  {
    id: 'postgres',
    label: 'Primary Postgres',
    sublabelByStage: [
      '503 Lock Wait · Idle connections',
      'Lock tree pinned to checkout-gateway',
      'Active connections draining safely',
      'Pool healthy · 4/20 active',
    ],
    position: [-2.65, 0, -1.75],
    kind: 'database',
  },
  {
    id: 'redis',
    label: 'Redis & Queue',
    sublabelByStage: [
      '18ms · Stream healthy',
      '18ms · Telemetry buffered',
      '16ms · Regression events clear',
      '14ms · Nominal',
    ],
    position: [2.95, 0, -1.05],
    kind: 'database',
  },
];

const CONDUITS: ConduitDef[] = [
  { from: 'gateway', to: 'checkout', arcHeight: 0.72, speed: 0.36 },
  { from: 'gateway', to: 'auth', arcHeight: 0.88, speed: 0.31 },
  { from: 'checkout', to: 'postgres', arcHeight: 0.92, speed: 0.44, isAlertPath: true },
  { from: 'auth', to: 'redis', arcHeight: 0.85, speed: 0.34 },
  { from: 'postgres', to: 'ai', arcHeight: 0.95, speed: 0.42, isAlertPath: true },
  { from: 'redis', to: 'ai', arcHeight: 0.82, speed: 0.3 },
  { from: 'ai', to: 'checkout', arcHeight: 1.55, speed: 0.48, isPatchPath: true },
];

const PACKETS_PER_CONDUIT = 3;

const STAGE_CAPTIONS = [
  'Detecting anomaly spike',
  'Isolating root cause',
  'Synthesizing & testing patch',
  'Verified healthy rollout',
];

// Pre-allocated scratch math objects (zero allocations inside RAF loop)
const _vec3 = new THREE.Vector3();
const _vec3Next = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _mat4 = new THREE.Matrix4();
const _up = new THREE.Vector3(0, 1, 0);
const _color = new THREE.Color();

const COLOR_FAULT = new THREE.Color(0xf43f5e);
const COLOR_HEALING = new THREE.Color(0xf59e0b);
const COLOR_VERIFIED = new THREE.Color(0x34d399);
const COLOR_BLUE = new THREE.Color(0x38bdf8);
const COLOR_VIOLET = new THREE.Color(0x8b5cf6);

function detectSoftwareWebGL(): boolean {
  try {
    const probe = document.createElement('canvas');
    const gl =
      (probe.getContext('webgl2') as WebGL2RenderingContext | null) ||
      (probe.getContext('webgl') as WebGLRenderingContext | null);
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const rendererName = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) ?? '') : '';
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(rendererName);
  } catch {
    return true;
  }
}

function createFloorGridTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#070D1D';
    ctx.fillRect(0, 0, size, size);

    // Subtle radial gradient darkening outer rim
    const grad = ctx.createRadialGradient(size / 2, size / 2, 20, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(30, 58, 138, 0.20)');
    grad.addColorStop(0.55, 'rgba(15, 23, 42, 0.12)');
    grad.addColorStop(1, 'rgba(5, 8, 20, 0.85)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    // Crisp micro circuit grid
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.11)';
    ctx.lineWidth = 1;
    const step = 32;
    for (let i = 0; i <= size; i += step) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(size, i);
      ctx.stroke();
    }

    // Precision crosshairs at major intersections
    ctx.strokeStyle = 'rgba(139, 92, 246, 0.26)';
    ctx.lineWidth = 1.2;
    for (let x = 64; x < size; x += 128) {
      for (let y = 64; y < size; y += 128) {
        ctx.beginPath();
        ctx.moveTo(x - 5, y);
        ctx.lineTo(x + 5, y);
        ctx.moveTo(x, y - 5);
        ctx.lineTo(x, y + 5);
        ctx.stroke();
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

export function AutonomousOps3D({ activeStage, onSelectNode }: AutonomousOps3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<number>(activeStage);
  const selectCallbackRef = useRef(onSelectNode);
  const resetCameraFnRef = useRef<(() => void) | null>(null);

  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [webglFallback, setWebglFallback] = useState(false);

  stageRef.current = activeStage;
  selectCallbackRef.current = onSelectNode;

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const isSoftwareGl = detectSoftwareWebGL();

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        alpha: false,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglFallback(true);
      return;
    }

    const initialWidth = container.clientWidth || 640;
    const initialHeight = container.clientHeight || 350;

    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(initialWidth, initialHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.setAttribute(
      'aria-label',
      'Interactive 3D autonomous software operations topology'
    );

    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060b18);
    scene.fog = new THREE.FogExp2(0x060b18, 0.036);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmrem.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    scene.environmentIntensity = 0.72;

    const camera = new THREE.PerspectiveCamera(40, initialWidth / initialHeight, 0.1, 80);
    const defaultCameraPos = new THREE.Vector3(0.3, 4.95, 8.2);
    const defaultTargetPos = new THREE.Vector3(0, 0.72, 0.25);
    camera.position.copy(defaultCameraPos);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(defaultTargetPos);
    controls.enableZoom = false; // Preserve smooth page scrolling on landing page
    controls.enablePan = false;
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.minPolarAngle = 0.45;
    controls.maxPolarAngle = 1.24;
    controls.autoRotate = !prefersReduced;
    controls.autoRotateSpeed = 0.48;

    let userInteracting = false;
    const handleControlStart = () => {
      userInteracting = true;
      controls.autoRotate = false;
    };
    const handleControlChange = () => {
      if (prefersReduced && !contextLost && !disposed) {
        renderer.render(scene, camera);
      }
    };
    controls.addEventListener('start', handleControlStart);
    controls.addEventListener('change', handleControlChange);

    resetCameraFnRef.current = () => {
      userInteracting = false;
      camera.position.copy(defaultCameraPos);
      controls.target.copy(defaultTargetPos);
      controls.autoRotate = !prefersReduced;
      controls.update();
      if (prefersReduced && !contextLost && !disposed) {
        renderer.render(scene, camera);
      }
    };

    // Three-point lighting + dynamic AI Core illumination
    const hemiLight = new THREE.HemisphereLight(0x9ec5ff, 0x0b1224, 0.58);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff1dc, 2.0);
    keyLight.position.set(5.5, 9.5, 6.5);
    if (!isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.camera.near = 1;
      keyLight.shadow.camera.far = 26;
      keyLight.shadow.camera.left = -7;
      keyLight.shadow.camera.right = 7;
      keyLight.shadow.camera.top = 7;
      keyLight.shadow.camera.bottom = -7;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.03;
    }
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x6d5dfc, 1.35);
    rimLight.position.set(-6.5, 5.2, -6.0);
    scene.add(rimLight);

    const aiCoreLight = new THREE.PointLight(0x8b5cf6, 2.6, 8.5, 1.4);
    aiCoreLight.position.set(0, 1.85, -0.7);
    scene.add(aiCoreLight);

    // Track disposable resources
    const texturesToDispose: THREE.Texture[] = [];
    const materialsToDispose: THREE.Material[] = [];
    const geometriesToDispose: THREE.BufferGeometry[] = [];

    const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
      geometriesToDispose.push(g);
      return g;
    };
    const trackMat = <T extends THREE.Material>(m: T): T => {
      materialsToDispose.push(m);
      return m;
    };

    // Grounded Circular Operations Stage
    const gridTexture = createFloorGridTexture();
    gridTexture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    texturesToDispose.push(gridTexture);

    const floorDeck = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(6.8, 7.1, 0.26, 64)),
      trackMat(
        new THREE.MeshStandardMaterial({
          map: gridTexture,
          roughness: 0.78,
          metalness: 0.25,
        })
      )
    );
    floorDeck.position.set(0, -0.13, 0);
    floorDeck.receiveShadow = !isSoftwareGl;
    scene.add(floorDeck);

    // Brushed outer metallic bezel ring around stage deck
    const deckRim = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(6.82, 0.055, 12, 96)),
      trackMat(
        new THREE.MeshStandardMaterial({
          color: 0x334155,
          roughness: 0.28,
          metalness: 0.88,
        })
      )
    );
    deckRim.rotation.x = Math.PI / 2;
    deckRim.position.y = 0.01;
    scene.add(deckRim);

    // Concentric subtle telemetry rings flush above floor (polygonOffset prevents z-fighting)
    for (const radius of [2.1, 3.85, 5.4]) {
      const ring = new THREE.Mesh(
        trackGeo(new THREE.RingGeometry(radius - 0.018, radius + 0.018, 84)),
        trackMat(
          new THREE.MeshBasicMaterial({
            color: 0x38bdf8,
            transparent: true,
            opacity: 0.16,
            side: THREE.DoubleSide,
            polygonOffset: true,
            polygonOffsetFactor: -1,
            polygonOffsetUnits: -1,
          })
        )
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.008;
      scene.add(ring);
    }

    // Shared architectural materials with strong roughness contrast (>= 0.25 delta)
    const darkChassisMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x111a30,
        roughness: 0.72,
        metalness: 0.35,
      })
    );
    const brushedMetalMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x64748b,
        roughness: 0.26,
        metalness: 0.88,
      })
    );
    const plinthMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x0b1224,
        roughness: 0.82,
        metalness: 0.25,
      })
    );

    // Per-node dynamic references for animation & raycasting
    interface NodeRig {
      meta: NodeMeta;
      group: THREE.Group;
      hitMesh: THREE.Mesh;
      statusMat: THREE.MeshStandardMaterial;
      beaconMesh: THREE.Mesh;
      basePosition: THREE.Vector3;
    }

    const nodeRigs = new Map<string, NodeRig>();
    const pickableMeshes: THREE.Object3D[] = [];

    // References specific to AI Core animation
    let aiCrystal: THREE.Mesh | null = null;
    let aiWireCage: THREE.Mesh | null = null;
    let aiOuterGimbal: THREE.Mesh | null = null;
    let aiInnerGimbal: THREE.Mesh | null = null;
    let aiCoreMat: THREE.MeshStandardMaterial | null = null;
    let aiHaloMat: THREE.MeshStandardMaterial | null = null;

    for (const meta of NODE_META) {
      const group = new THREE.Group();
      group.position.set(...meta.position);
      group.userData.nodeId = meta.id;

      const statusMat = trackMat(
        new THREE.MeshStandardMaterial({
          color: meta.kind === 'ai' ? 0x8b5cf6 : 0x38bdf8,
          emissive: meta.kind === 'ai' ? 0x8b5cf6 : 0x38bdf8,
          emissiveIntensity: 0.85,
          roughness: 0.22,
          metalness: 0.5,
        })
      );

      let hitMesh: THREE.Mesh;
      let beaconMesh: THREE.Mesh;

      if (meta.kind === 'ai') {
        // Composite 8-part AutoOps AI Core
        const base = new THREE.Mesh(
          trackGeo(new THREE.CylinderGeometry(1.06, 1.24, 0.22, 8)),
          plinthMat
        );
        base.position.y = 0.11;
        base.castShadow = !isSoftwareGl;
        base.receiveShadow = !isSoftwareGl;
        group.add(base);

        const collar = new THREE.Mesh(
          trackGeo(new THREE.CylinderGeometry(0.8, 0.92, 0.14, 16)),
          brushedMetalMat
        );
        collar.position.y = 0.29;
        collar.castShadow = !isSoftwareGl;
        group.add(collar);

        aiHaloMat = trackMat(
          new THREE.MeshStandardMaterial({
            color: 0x8b5cf6,
            emissive: 0x7c3aed,
            emissiveIntensity: 1.15,
            roughness: 0.2,
            metalness: 0.4,
          })
        );
        const pedestalRing = new THREE.Mesh(
          trackGeo(new THREE.TorusGeometry(0.76, 0.036, 12, 48)),
          aiHaloMat
        );
        pedestalRing.rotation.x = Math.PI / 2;
        pedestalRing.position.y = 0.38;
        group.add(pedestalRing);

        aiCoreMat = statusMat;
        aiCrystal = new THREE.Mesh(
          trackGeo(new THREE.OctahedronGeometry(0.54, 0)),
          aiCoreMat
        );
        aiCrystal.position.y = 1.48;
        aiCrystal.castShadow = !isSoftwareGl;
        group.add(aiCrystal);

        aiWireCage = new THREE.Mesh(
          trackGeo(new THREE.OctahedronGeometry(0.68, 0)),
          trackMat(
            new THREE.MeshBasicMaterial({
              color: 0xc4b5fd,
              wireframe: true,
              transparent: true,
              opacity: 0.45,
            })
          )
        );
        aiWireCage.position.y = 1.48;
        group.add(aiWireCage);

        aiInnerGimbal = new THREE.Mesh(
          trackGeo(new THREE.TorusGeometry(0.88, 0.03, 12, 48)),
          brushedMetalMat
        );
        aiInnerGimbal.position.y = 1.48;
        group.add(aiInnerGimbal);

        aiOuterGimbal = new THREE.Mesh(
          trackGeo(new THREE.TorusGeometry(1.08, 0.028, 12, 56)),
          brushedMetalMat
        );
        aiOuterGimbal.position.y = 1.48;
        group.add(aiOuterGimbal);

        const capSpire = new THREE.Mesh(
          trackGeo(new THREE.ConeGeometry(0.14, 0.28, 6)),
          brushedMetalMat
        );
        capSpire.position.y = 2.66;
        group.add(capSpire);

        beaconMesh = aiCrystal;

        hitMesh = new THREE.Mesh(
          trackGeo(new THREE.CylinderGeometry(1.15, 1.15, 2.7, 12)),
          trackMat(new THREE.MeshBasicMaterial({ visible: false }))
        );
        hitMesh.position.y = 1.35;
        hitMesh.userData.nodeId = meta.id;
        group.add(hitMesh);
      } else if (meta.kind === 'database') {
        // Composite 7-part Database / Cache Silo
        const plinth = new THREE.Mesh(
          trackGeo(new THREE.CylinderGeometry(0.72, 0.8, 0.14, 24)),
          plinthMat
        );
        plinth.position.y = 0.07;
        plinth.receiveShadow = !isSoftwareGl;
        plinth.castShadow = !isSoftwareGl;
        group.add(plinth);

        for (let i = 0; i < 3; i++) {
          const tier = new THREE.Mesh(
            trackGeo(new THREE.CylinderGeometry(0.56, 0.58, 0.28, 24)),
            darkChassisMat
          );
          tier.position.y = 0.29 + i * 0.38;
          tier.castShadow = !isSoftwareGl;
          tier.receiveShadow = !isSoftwareGl;
          group.add(tier);

          if (i < 2) {
            const band = new THREE.Mesh(
              trackGeo(new THREE.CylinderGeometry(0.57, 0.57, 0.06, 24)),
              statusMat
            );
            band.position.y = 0.47 + i * 0.38;
            group.add(band);
          }
        }

        // Brushed vertical structural ribs
        for (const angle of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
          const rib = new THREE.Mesh(
            trackGeo(new THREE.BoxGeometry(0.07, 1.04, 0.1)),
            brushedMetalMat
          );
          rib.position.set(Math.cos(angle) * 0.56, 0.67, Math.sin(angle) * 0.56);
          rib.rotation.y = -angle;
          group.add(rib);
        }

        const domeCap = new THREE.Mesh(
          trackGeo(new THREE.CylinderGeometry(0.42, 0.56, 0.14, 24)),
          brushedMetalMat
        );
        domeCap.position.y = 1.24;
        group.add(domeCap);

        beaconMesh = new THREE.Mesh(
          trackGeo(new THREE.SphereGeometry(0.11, 16, 12)),
          statusMat
        );
        beaconMesh.position.y = 1.38;
        group.add(beaconMesh);

        hitMesh = new THREE.Mesh(
          trackGeo(new THREE.CylinderGeometry(0.76, 0.76, 1.5, 12)),
          trackMat(new THREE.MeshBasicMaterial({ visible: false }))
        );
        hitMesh.position.y = 0.75;
        hitMesh.userData.nodeId = meta.id;
        group.add(hitMesh);
      } else if (meta.kind === 'gateway') {
        // Composite 6-part Edge Gateway Router Monolith
        const plinth = new THREE.Mesh(
          trackGeo(new THREE.BoxGeometry(1.18, 0.14, 0.94)),
          plinthMat
        );
        plinth.position.y = 0.07;
        plinth.castShadow = !isSoftwareGl;
        plinth.receiveShadow = !isSoftwareGl;
        group.add(plinth);

        const body = new THREE.Mesh(
          trackGeo(new THREE.BoxGeometry(0.96, 0.96, 0.72)),
          darkChassisMat
        );
        body.position.y = 0.62;
        body.castShadow = !isSoftwareGl;
        body.receiveShadow = !isSoftwareGl;
        group.add(body);

        const bezel = new THREE.Mesh(
          trackGeo(new THREE.BoxGeometry(1.02, 0.12, 0.78)),
          brushedMetalMat
        );
        bezel.position.y = 1.12;
        group.add(bezel);

        const visor = new THREE.Mesh(
          trackGeo(new THREE.BoxGeometry(0.72, 0.12, 0.76)),
          statusMat
        );
        visor.position.y = 0.88;
        group.add(visor);

        for (const sx of [-0.28, 0.28]) {
          const mast = new THREE.Mesh(
            trackGeo(new THREE.CylinderGeometry(0.025, 0.032, 0.42, 8)),
            brushedMetalMat
          );
          mast.position.set(sx, 1.36, -0.18);
          group.add(mast);
        }

        beaconMesh = visor;
        hitMesh = new THREE.Mesh(
          trackGeo(new THREE.BoxGeometry(1.25, 1.65, 1.0)),
          trackMat(new THREE.MeshBasicMaterial({ visible: false }))
        );
        hitMesh.position.y = 0.82;
        hitMesh.userData.nodeId = meta.id;
        group.add(hitMesh);
      } else {
        // Composite 7-part Application Service Rack (checkout-gateway / auth-edge-proxy)
        const plinth = new THREE.Mesh(
          trackGeo(new THREE.BoxGeometry(1.12, 0.14, 0.96)),
          plinthMat
        );
        plinth.position.y = 0.07;
        plinth.castShadow = !isSoftwareGl;
        plinth.receiveShadow = !isSoftwareGl;
        group.add(plinth);

        const tower = new THREE.Mesh(
          trackGeo(new THREE.BoxGeometry(0.92, 1.24, 0.76)),
          darkChassisMat
        );
        tower.position.y = 0.76;
        tower.castShadow = !isSoftwareGl;
        tower.receiveShadow = !isSoftwareGl;
        group.add(tower);

        // Side metallic rack rails
        for (const sx of [-0.46, 0.46]) {
          const rail = new THREE.Mesh(
            trackGeo(new THREE.BoxGeometry(0.06, 1.28, 0.8)),
            brushedMetalMat
          );
          rail.position.set(sx, 0.76, 0);
          group.add(rail);
        }

        // 3 compute blades with front glowing telemetry slot
        for (let b = 0; b < 3; b++) {
          const blade = new THREE.Mesh(
            trackGeo(new THREE.BoxGeometry(0.76, 0.2, 0.8)),
            brushedMetalMat
          );
          blade.position.y = 0.4 + b * 0.34;
          group.add(blade);
        }

        const statusBar = new THREE.Mesh(
          trackGeo(new THREE.BoxGeometry(0.68, 0.1, 0.82)),
          statusMat
        );
        statusBar.position.y = 1.25;
        group.add(statusBar);

        beaconMesh = new THREE.Mesh(
          trackGeo(new THREE.CylinderGeometry(0.11, 0.14, 0.1, 16)),
          statusMat
        );
        beaconMesh.position.y = 1.44;
        group.add(beaconMesh);

        hitMesh = new THREE.Mesh(
          trackGeo(new THREE.BoxGeometry(1.16, 1.6, 1.0)),
          trackMat(new THREE.MeshBasicMaterial({ visible: false }))
        );
        hitMesh.position.y = 0.8;
        hitMesh.userData.nodeId = meta.id;
        group.add(hitMesh);
      }

      scene.add(group);
      pickableMeshes.push(hitMesh);
      nodeRigs.set(meta.id, {
        meta,
        group,
        hitMesh,
        statusMat,
        beaconMesh,
        basePosition: new THREE.Vector3(...meta.position),
      });
    }

    // Build Curved 3D Conduits + InstancedMesh Packets
    interface ConduitState {
      def: ConduitDef;
      curve: THREE.CatmullRomCurve3;
      tubeMat: THREE.MeshStandardMaterial;
    }

    const conduitStates: ConduitState[] = [];
    for (const def of CONDUITS) {
      const fromRig = nodeRigs.get(def.from);
      const toRig = nodeRigs.get(def.to);
      if (!fromRig || !toRig) continue;

      const start = fromRig.basePosition.clone().add(new THREE.Vector3(0, 0.65, 0));
      const end = toRig.basePosition.clone().add(new THREE.Vector3(0, 0.65, 0));
      const mid = start.clone().lerp(end, 0.5);
      mid.y += def.arcHeight;

      const curve = new THREE.CatmullRomCurve3([start, mid, end]);
      const tubeGeo = trackGeo(new THREE.TubeGeometry(curve, 36, 0.026, 8, false));
      const tubeMat = trackMat(
        new THREE.MeshStandardMaterial({
          color: def.isPatchPath ? 0x34d399 : def.isAlertPath ? 0xf43f5e : 0x38bdf8,
          emissive: def.isPatchPath ? 0x10b981 : def.isAlertPath ? 0xe11d48 : 0x0284c7,
          emissiveIntensity: 0.65,
          roughness: 0.35,
          metalness: 0.25,
          transparent: true,
          opacity: 0.72,
        })
      );
      const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
      scene.add(tubeMesh);
      conduitStates.push({ def, curve, tubeMat });
    }

    const totalPackets = conduitStates.length * PACKETS_PER_CONDUIT;
    const packetGeo = trackGeo(new THREE.SphereGeometry(0.068, 12, 10));
    const packetMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
      })
    );
    const packetInstanced = new THREE.InstancedMesh(packetGeo, packetMat, totalPackets);
    packetInstanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(packetInstanced);

    const packetProgress = new Float32Array(totalPackets);
    for (let i = 0; i < totalPackets; i++) {
      packetProgress[i] = ((i % PACKETS_PER_CONDUIT) / PACKETS_PER_CONDUIT + (i * 0.11)) % 1;
      packetInstanced.setColorAt(i, COLOR_BLUE);
    }
    if (packetInstanced.instanceColor) {
      packetInstanced.instanceColor.needsUpdate = true;
    }

    // Expanding 3D Shockwave Torus Rings (Fault wave around checkout-gateway, Heal wave around AI Core)
    const faultWaveMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: 0xf43f5e,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide,
      })
    );
    const faultWaveMesh = new THREE.Mesh(
      trackGeo(new THREE.RingGeometry(0.75, 0.84, 48)),
      faultWaveMat
    );
    faultWaveMesh.rotation.x = -Math.PI / 2;
    faultWaveMesh.position.set(-1.45, 0.04, 2.25);
    scene.add(faultWaveMesh);

    const healWaveMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: 0x8b5cf6,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
      })
    );
    const healWaveMesh = new THREE.Mesh(
      trackGeo(new THREE.RingGeometry(1.18, 1.27, 56)),
      healWaveMat
    );
    healWaveMesh.rotation.x = -Math.PI / 2;
    healWaveMesh.position.set(0, 0.04, -0.7);
    scene.add(healWaveMesh);

    // Raycaster & Pointer Interaction
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    let activeHoverId: string | null = null;
    let pointerDownPos: { x: number; y: number } | null = null;

    const updatePointerNdc = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const handlePointerMove = (e: PointerEvent) => {
      updatePointerNdc(e);
      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObjects(pickableMeshes, false);
      const hitId = hits.length > 0 ? String(hits[0].object.userData.nodeId || '') : null;
      if (hitId !== activeHoverId) {
        activeHoverId = hitId;
        setHoveredNodeId(hitId);
        renderer.domElement.style.cursor = hitId ? 'pointer' : 'grab';
      }
    };

    const handlePointerLeave = () => {
      activeHoverId = null;
      setHoveredNodeId(null);
      renderer.domElement.style.cursor = 'grab';
    };

    const handlePointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (!pointerDownPos) return;
      const dx = e.clientX - pointerDownPos.x;
      const dy = e.clientY - pointerDownPos.y;
      pointerDownPos = null;
      // Only treat as click if pointer didn't drag camera
      if (dx * dx + dy * dy > 36) return;
      updatePointerNdc(e);
      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObjects(pickableMeshes, false);
      if (hits.length > 0) {
        const nodeId = String(hits[0].object.userData.nodeId || '');
        if (nodeId) {
          selectCallbackRef.current?.(nodeId);
        }
      }
    };

    renderer.domElement.style.cursor = 'grab';
    renderer.domElement.addEventListener('pointermove', handlePointerMove);
    renderer.domElement.addEventListener('pointerleave', handlePointerLeave);
    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointerup', handlePointerUp);

    // ResizeObserver for crisp responsive viewport
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(240, Math.floor(entry.contentRect.width));
        const h = Math.max(220, Math.floor(entry.contentRect.height));
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    });
    resizeObserver.observe(container);

    // WebGL Context Loss Recovery
    let contextLost = false;
    const handleContextLost = (e: Event) => {
      e.preventDefault();
      contextLost = true;
    };
    const handleContextRestored = () => {
      contextLost = false;
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

    // Animation loop + Software WebGL afterDraw pacing
    let rafId = 0;
    let timeoutId = 0;
    let disposed = false;
    let lastTime = performance.now();
    let elapsed = 0;

    const rawGl = renderer.getContext() as WebGL2RenderingContext;

    const afterDraw = (next: () => void) => {
      if (disposed) return;
      if (isSoftwareGl && typeof rawGl.fenceSync === 'function') {
        const sync = rawGl.fenceSync(rawGl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        if (sync) {
          rawGl.flush();
          rawGl.deleteSync(sync);
        }
        timeoutId = window.setTimeout(() => {
          rafId = requestAnimationFrame(next);
        }, 80);
      } else {
        rafId = requestAnimationFrame(next);
      }
    };

    const renderTick = () => {
      if (disposed) return;
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.08);
      lastTime = now;

      if (!prefersReduced) {
        elapsed += dt;
      }

      const stage = stageRef.current;

      if (!contextLost) {
        // Animate AI Core crystal & counter-rotating gimbals
        if (aiCrystal && aiWireCage && aiInnerGimbal && aiOuterGimbal && aiCoreMat && aiHaloMat) {
          aiCrystal.position.y = 1.48 + Math.sin(elapsed * 2.1) * 0.08;
          aiCrystal.rotation.y = elapsed * 0.72;
          aiWireCage.position.y = aiCrystal.position.y;
          aiWireCage.rotation.y = -elapsed * 0.45;
          aiInnerGimbal.rotation.x = Math.PI * 0.35 + elapsed * 0.65;
          aiInnerGimbal.rotation.y = elapsed * 0.42;
          aiOuterGimbal.rotation.z = elapsed * 0.38;
          aiOuterGimbal.rotation.x = Math.PI * 0.22 - elapsed * 0.3;

          if (stage === 0) _color.copy(COLOR_BLUE);
          else if (stage === 1) _color.copy(COLOR_VIOLET);
          else if (stage === 2) _color.copy(COLOR_HEALING);
          else _color.copy(COLOR_VERIFIED);

          aiCoreMat.color.lerp(_color, 0.12);
          aiCoreMat.emissive.lerp(_color, 0.12);
          aiHaloMat.color.lerp(_color, 0.12);
          aiHaloMat.emissive.lerp(_color, 0.12);
          aiCoreLight.color.lerp(_color, 0.12);
          aiCoreLight.intensity = 2.4 + Math.sin(elapsed * 3.2) * 0.35;
        }

        // Update infrastructure node status emissives & subtle hover scale
        nodeRigs.forEach((rig, id) => {
          const isHovered = id === activeHoverId;
          const targetScale = isHovered ? 1.07 : 1.0;
          rig.group.scale.lerp(_scale.set(targetScale, targetScale, targetScale), 0.16);

          if (id === 'ai') return;

          if (id === 'checkout' || id === 'postgres') {
            if (stage <= 1) _color.copy(COLOR_FAULT);
            else if (stage === 2) _color.copy(COLOR_HEALING);
            else _color.copy(COLOR_VERIFIED);
          } else if (id === 'auth' && stage === 1) {
            _color.copy(COLOR_HEALING);
          } else {
            _color.copy(stage === 3 ? COLOR_VERIFIED : COLOR_BLUE);
          }

          rig.statusMat.color.lerp(_color, 0.12);
          rig.statusMat.emissive.lerp(_color, 0.12);
          rig.statusMat.emissiveIntensity =
            (id === 'checkout' || id === 'postgres') && stage <= 1
              ? 1.0 + Math.sin(elapsed * 7.5) * 0.45
              : isHovered
              ? 1.35
              : 0.85;
        });

        // Animate conduits & instanced packets
        let packetIdx = 0;
        for (let c = 0; c < conduitStates.length; c++) {
          const conduit = conduitStates[c];
          const { def, curve, tubeMat } = conduit;

          let activeConduit = true;
          if (def.isPatchPath) {
            activeConduit = stage >= 2;
            tubeMat.opacity = stage >= 2 ? 0.88 : 0.14;
            _color.copy(stage === 2 ? COLOR_HEALING : COLOR_VERIFIED);
          } else if (def.isAlertPath) {
            tubeMat.opacity = 0.78;
            _color.copy(stage <= 1 ? COLOR_FAULT : stage === 2 ? COLOR_HEALING : COLOR_VERIFIED);
          } else {
            tubeMat.opacity = 0.62;
            _color.copy(stage === 3 ? COLOR_VERIFIED : COLOR_BLUE);
          }
          tubeMat.color.lerp(_color, 0.12);
          tubeMat.emissive.lerp(_color, 0.12);

          for (let p = 0; p < PACKETS_PER_CONDUIT; p++) {
            if (!prefersReduced) {
              packetProgress[packetIdx] = (packetProgress[packetIdx] + dt * def.speed) % 1;
            }
            const t = packetProgress[packetIdx];
            curve.getPointAt(t, _vec3);
            curve.getPointAt((t + 0.01) % 1, _vec3Next);

            const s = activeConduit ? (def.isPatchPath ? 1.22 : 1.0) : 0.001;
            _quat.setFromUnitVectors(_up, _vec3Next.sub(_vec3).normalize());
            _scale.set(s, s, s);
            _mat4.compose(_vec3, _quat, _scale);
            packetInstanced.setMatrixAt(packetIdx, _mat4);
            packetInstanced.setColorAt(packetIdx, _color);
            packetIdx++;
          }
        }
        packetInstanced.instanceMatrix.needsUpdate = true;
        if (packetInstanced.instanceColor) {
          packetInstanced.instanceColor.needsUpdate = true;
        }

        // Expanding 3D radar/fault shockwaves
        const faultPhase = (elapsed * 0.75) % 1;
        const faultScale = 1 + faultPhase * 1.45;
        faultWaveMesh.scale.set(faultScale, faultScale, 1);
        faultWaveMat.opacity = stage <= 1 ? (1 - faultPhase) * 0.65 : 0;

        const healPhase = (elapsed * 0.55) % 1;
        const healScale = 1 + healPhase * 1.65;
        healWaveMesh.scale.set(healScale, healScale, 1);
        healWaveMat.color.copy(stage === 2 ? COLOR_HEALING : stage === 3 ? COLOR_VERIFIED : COLOR_VIOLET);
        healWaveMat.opacity = (1 - healPhase) * 0.45;

        if (controls.autoRotate && !userInteracting) {
          controls.update();
        } else if (controls.enableDamping) {
          controls.update();
        }

        renderer.render(scene, camera);
      }

      if (!prefersReduced) {
        afterDraw(renderTick);
      }
    };

    renderTick();

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      clearTimeout(timeoutId);
      resizeObserver.disconnect();
      controls.removeEventListener('start', handleControlStart);
      controls.removeEventListener('change', handleControlChange);
      controls.dispose();

      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener('pointerleave', handlePointerLeave);
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointerup', handlePointerUp);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);

      for (const tex of texturesToDispose) tex.dispose();
      for (const mat of materialsToDispose) mat.dispose();
      for (const geo of geometriesToDispose) geo.dispose();

      envTarget.dispose();
      roomEnv.dispose();
      pmrem.dispose();
      renderer.dispose();

      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  if (webglFallback) {
    return (
      <AutonomousTopology2D
        activeStage={activeStage}
        mode="hero"
        onNodeClick={(node) => onSelectNode?.(node.id)}
      />
    );
  }

  const hoveredMeta = NODE_META.find((n) => n.id === hoveredNodeId) || null;
  const stageIdx = Math.min(Math.max(activeStage, 0), 3) as 0 | 1 | 2 | 3;

  return (
    <div className="relative w-full bg-[#060B18] border border-slate-800/80 rounded-xl overflow-hidden">
      {/* Unobstructed 3D WebGL Viewport */}
      <div className="relative w-full h-[300px] sm:h-[340px]">
        <div ref={mountRef} className="w-full h-full" />

        {/* Subtle non-blurred reset camera control in top-right corner */}
        <button
          type="button"
          onClick={() => resetCameraFnRef.current?.()}
          title="Reset 3D camera"
          className="absolute top-3 right-3 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#050814]/90 hover:bg-[#0D152E] border border-slate-700/80 text-[11px] font-medium text-slate-300 transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3 h-3 text-blue-400" />
          Reset View
        </button>

        {/* Clean node hover readout (solid semi-opaque background, zero backdrop-blur) */}
        {hoveredMeta && (
          <div className="absolute bottom-3 left-3 max-w-[260px] px-3 py-2 rounded-lg bg-[#050814]/95 border border-slate-700/90 pointer-events-none">
            <div className="text-xs font-semibold text-white">{hoveredMeta.label}</div>
            <div className="text-[11px] font-mono text-blue-300 mt-0.5">
              {hoveredMeta.sublabelByStage[stageIdx]}
            </div>
          </div>
        )}
      </div>

      {/* Mode & stage caption bar below the WebGL canvas */}
      <div className="px-4 py-2.5 border-t border-slate-800/80 bg-[#050814] flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
        <span>Drag to orbit 3D cluster · Click any service tower to inspect</span>
        <span className="font-mono text-slate-300 tabular-nums">{STAGE_CAPTIONS[stageIdx]}</span>
      </div>
    </div>
  );
}
