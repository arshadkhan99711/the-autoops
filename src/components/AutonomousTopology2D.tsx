import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';

export interface TopologyNode {
  id: string;
  label: string;
  sublabel: string;
  x: number;
  y: number;
  kind: 'gateway' | 'service' | 'database' | 'ai';
  state: 'healthy' | 'fault' | 'healing' | 'ai';
  incidentCode?: string;
}

interface AutonomousTopology2DProps {
  activeStage?: number;
  mode?: 'hero' | 'dashboard';
  onNodeClick?: (node: TopologyNode) => void;
}

interface EdgeDef {
  from: string;
  to: string;
  packetColor: string;
  speed: number;
  alert?: boolean;
}

const BASE_NODES: TopologyNode[] = [
  {
    id: 'gateway',
    label: 'Edge Gateway',
    sublabel: '14.2k req/s',
    x: 92,
    y: 138,
    kind: 'gateway',
    state: 'healthy',
  },
  {
    id: 'checkout',
    label: 'checkout-gateway',
    sublabel: 'INC-4821 · Pool 20/20',
    x: 245,
    y: 72,
    kind: 'service',
    state: 'fault',
    incidentCode: 'INC-4821',
  },
  {
    id: 'auth',
    label: 'auth-edge-proxy',
    sublabel: 'INC-4820 · JWKS 429',
    x: 245,
    y: 204,
    kind: 'service',
    state: 'healthy',
    incidentCode: 'INC-4820',
  },
  {
    id: 'postgres',
    label: 'Primary Postgres',
    sublabel: '503 Lock Wait',
    x: 410,
    y: 72,
    kind: 'database',
    state: 'fault',
  },
  {
    id: 'redis',
    label: 'Redis & Queue',
    sublabel: '18ms · Nominal',
    x: 410,
    y: 204,
    kind: 'database',
    state: 'healthy',
  },
  {
    id: 'ai',
    label: 'The Autoops Core',
    sublabel: 'Autonomous SRE',
    x: 548,
    y: 138,
    kind: 'ai',
    state: 'ai',
  },
];

const EDGES: EdgeDef[] = [
  { from: 'gateway', to: 'checkout', packetColor: '#38BDF8', speed: 0.0085 },
  { from: 'gateway', to: 'auth', packetColor: '#60A5FA', speed: 0.007 },
  { from: 'checkout', to: 'postgres', packetColor: '#F43F5E', speed: 0.011, alert: true },
  { from: 'auth', to: 'redis', packetColor: '#34D399', speed: 0.0075 },
  { from: 'postgres', to: 'ai', packetColor: '#A78BFA', speed: 0.0095, alert: true },
  { from: 'redis', to: 'ai', packetColor: '#60A5FA', speed: 0.0065 },
  { from: 'ai', to: 'checkout', packetColor: '#34D399', speed: 0.008 },
];

export function AutonomousTopology2D({
  activeStage = 0,
  mode = 'hero',
  onNodeClick,
}: AutonomousTopology2DProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Derive animated node state from activeStage (0=detect, 1=diagnose, 2=patch, 3=verify/healed)
  const nodes: TopologyNode[] = BASE_NODES.map((node) => {
    if (node.id === 'checkout' || node.id === 'postgres') {
      if (activeStage === 2) return { ...node, state: 'healing', sublabel: 'Applying try/finally patch' };
      if (activeStage === 3) return { ...node, state: 'healthy', sublabel: 'Verified · 0.12% err' };
      return { ...node, state: 'fault' };
    }
    if (node.id === 'auth' && activeStage === 1) {
      return { ...node, state: 'healing', sublabel: 'Correlating JWKS logs' };
    }
    return node;
  });

  // High-FPS 2D Canvas Particle, Radar & Telemetry Wave Engine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let animId = 0;
    const width = 640;
    const height = 276;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Pre-seed particles traveling along edges
    const particles = EDGES.flatMap((edge, eIdx) =>
      [0, 0.34, 0.68].map((offset, pIdx) => ({
        edge,
        t: (offset + eIdx * 0.13 + pIdx * 0.07) % 1,
      }))
    );

    let tick = 0;

    const drawFrame = () => {
      tick += 0.025;
      ctx.clearRect(0, 0, width, height);

      // Subtle 2D coordinate grid
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.055)';
      ctx.lineWidth = 1;
      for (let gx = 20; gx < width; gx += 32) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, height);
        ctx.stroke();
      }
      for (let gy = 20; gy < height; gy += 32) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(width, gy);
        ctx.stroke();
      }

      // Draw animated telemetry sine wave along bottom canvas floor
      ctx.beginPath();
      for (let x = 0; x <= width; x += 6) {
        const spike =
          activeStage <= 1 && x > 200 && x < 430
            ? Math.sin(x * 0.14 - tick * 5) * 8
            : Math.sin(x * 0.05 - tick * 2.5) * 3;
        const y = 252 + spike;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle =
        activeStage <= 1 ? 'rgba(244, 63, 94, 0.35)' : 'rgba(56, 189, 248, 0.32)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Draw radar pulse waves around AI Core and fault node
      const aiNode = nodes.find((n) => n.id === 'ai');
      if (aiNode) {
        const radius = 28 + ((tick * 18) % 44);
        const alpha = Math.max(0, 0.38 - ((tick * 18) % 44) / 115);
        ctx.beginPath();
        ctx.arc(aiNode.x, aiNode.y, radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(139, 92, 246, ${alpha.toFixed(2)})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      const faultNode = nodes.find((n) => n.state === 'fault');
      if (faultNode) {
        const radius = 22 + ((tick * 24) % 38);
        const alpha = Math.max(0, 0.48 - ((tick * 24) % 38) / 80);
        ctx.beginPath();
        ctx.arc(faultNode.x, faultNode.y, radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(244, 63, 94, ${alpha.toFixed(2)})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Draw quadratic Bezier edges & moving 2D data packets
      const nodeMap = new Map(nodes.map((n) => [n.id, n]));

      for (const edge of EDGES) {
        const a = nodeMap.get(edge.from);
        const b = nodeMap.get(edge.to);
        if (!a || !b) continue;

        const isReverseHeal = edge.from === 'ai' && edge.to === 'checkout';
        const cx = (a.x + b.x) / 2;
        const cy = isReverseHeal ? 22 : (a.y + b.y) / 2;

        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.quadraticCurveTo(cx, cy, b.x, b.y);

        if (isReverseHeal) {
          ctx.strokeStyle =
            activeStage >= 2 ? 'rgba(52, 211, 153, 0.55)' : 'rgba(52, 211, 153, 0.14)';
        } else if (edge.alert && activeStage <= 1) {
          ctx.strokeStyle = 'rgba(244, 63, 94, 0.45)';
        } else {
          ctx.strokeStyle = 'rgba(59, 130, 246, 0.28)';
        }
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Advance & draw glowing 2D packets
      for (const p of particles) {
        if (!prefersReduced) {
          p.t = (p.t + p.edge.speed) % 1;
        }
        const a = nodeMap.get(p.edge.from);
        const b = nodeMap.get(p.edge.to);
        if (!a || !b) continue;

        const isReverseHeal = p.edge.from === 'ai' && p.edge.to === 'checkout';
        if (isReverseHeal && activeStage < 2) continue;

        const cx = (a.x + b.x) / 2;
        const cy = isReverseHeal ? 22 : (a.y + b.y) / 2;
        const t = p.t;
        const oneMinusT = 1 - t;

        const px = oneMinusT * oneMinusT * a.x + 2 * oneMinusT * t * cx + t * t * b.x;
        const py = oneMinusT * oneMinusT * a.y + 2 * oneMinusT * t * cy + t * t * b.y;

        const color =
          p.edge.alert && activeStage >= 2
            ? '#34D399'
            : p.edge.packetColor;

        // Soft 2D halo
        ctx.beginPath();
        ctx.arc(px, py, 5.5, 0, Math.PI * 2);
        ctx.fillStyle = `${color}33`;
        ctx.fill();

        // Crisp packet core
        ctx.beginPath();
        ctx.arc(px, py, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      }

      if (!prefersReduced) {
        animId = requestAnimationFrame(drawFrame);
      }
    };

    drawFrame();
    return () => cancelAnimationFrame(animId);
  }, [activeStage]);

  return (
    <div className="relative w-full bg-[#060B18] border border-slate-800/80 rounded-xl overflow-hidden">
      {/* Subtle 2D Horizontal Scan Line */}
      <div className="absolute inset-x-0 h-14 bg-gradient-to-b from-transparent via-blue-500/12 to-transparent animate-scan-beam pointer-events-none" />

      <div className="relative w-full aspect-[640/276]">
        <canvas
          ref={canvasRef}
          className="w-full h-full block"
          aria-label="2D animated service topology showing live request packets, fault detection, and autonomous patch dispatch"
        />

        {/* Interactive 2D Overlay Nodes */}
        <svg
          viewBox="0 0 640 276"
          className="absolute inset-0 w-full h-full"
          role="img"
          aria-label="Interactive 2D cluster nodes"
        >
          {nodes.map((node) => {
            const isHovered = hoveredId === node.id;
            const ringColor =
              node.state === 'fault'
                ? '#F43F5E'
                : node.state === 'healing'
                ? '#F59E0B'
                : node.state === 'ai'
                ? '#8B5CF6'
                : '#3B82F6';
            const fillColor =
              node.state === 'fault'
                ? '#1F0C18'
                : node.state === 'healing'
                ? '#1E1608'
                : node.state === 'ai'
                ? '#140E2E'
                : '#0A1328';

            return (
              <g
                key={node.id}
                onMouseEnter={() => setHoveredId(node.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => onNodeClick?.(node)}
                className={onNodeClick ? 'cursor-pointer' : 'cursor-default'}
              >
                {/* Rotating 2D dashed orbital ring around AI Core */}
                {node.kind === 'ai' && (
                  <g style={{ transformOrigin: `${node.x}px ${node.y}px` }} className="animate-orbit-slow">
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={28}
                      fill="none"
                      stroke="#8B5CF6"
                      strokeOpacity={0.55}
                      strokeWidth={1.3}
                      strokeDasharray="5 5"
                    />
                  </g>
                )}

                {/* Counter-rotating inner ring on AI or active fault */}
                {(node.kind === 'ai' || node.state === 'fault') && (
                  <g
                    style={{ transformOrigin: `${node.x}px ${node.y}px` }}
                    className="animate-orbit-reverse"
                  >
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={22}
                      fill="none"
                      stroke={ringColor}
                      strokeOpacity={0.45}
                      strokeWidth={1}
                      strokeDasharray="3 4"
                    />
                  </g>
                )}

                <motion.circle
                  cx={node.x}
                  cy={node.y}
                  r={isHovered ? 20 : 17}
                  fill={fillColor}
                  stroke={ringColor}
                  strokeWidth={isHovered ? 2.4 : 1.7}
                  animate={{ scale: isHovered ? 1.06 : 1 }}
                  transition={{ duration: 0.18 }}
                  style={{ transformOrigin: `${node.x}px ${node.y}px` }}
                />

                {/* Minimal 2D Glyph Inside Node */}
                {node.kind === 'ai' ? (
                  <path
                    d={`M ${node.x - 6} ${node.y} L ${node.x} ${node.y - 6} L ${node.x + 6} ${node.y} L ${node.x} ${node.y + 6} Z`}
                    fill="none"
                    stroke="#C4B5FD"
                    strokeWidth={1.6}
                  />
                ) : node.kind === 'database' ? (
                  <g stroke={ringColor} strokeWidth={1.5} fill="none">
                    <ellipse cx={node.x} cy={node.y - 4} rx={6} ry={2.4} />
                    <path d={`M ${node.x - 6} ${node.y - 4} v 8 c 0 1.4 2.7 2.4 6 2.4 s 6 -1 6 -2.4 v -8`} />
                  </g>
                ) : (
                  <rect
                    x={node.x - 5.5}
                    y={node.y - 5.5}
                    width={11}
                    height={11}
                    rx={2.5}
                    fill="none"
                    stroke={ringColor}
                    strokeWidth={1.6}
                  />
                )}

                {/* Node Labels */}
                <text
                  x={node.x}
                  y={node.y + 32}
                  textAnchor="middle"
                  className="fill-slate-100 text-[10px] font-semibold"
                >
                  {node.label}
                </text>
                <text
                  x={node.x}
                  y={node.y + 44}
                  textAnchor="middle"
                  className={`text-[8.5px] font-mono ${
                    node.state === 'fault'
                      ? 'fill-rose-400'
                      : node.state === 'healing'
                      ? 'fill-amber-300'
                      : node.state === 'ai'
                      ? 'fill-violet-300'
                      : 'fill-slate-400'
                  }`}
                >
                  {node.sublabel}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Mode caption bar */}
      <div className="px-4 py-2.5 border-t border-slate-800/80 bg-[#050814]/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
        <span>
          {mode === 'hero'
            ? 'Live 2D autonomous telemetry simulation · Packets, fault shockwaves & patch dispatch'
            : 'Click a failing or healing service node to open AI Root Cause Analysis'}
        </span>
        <span className="font-mono text-slate-300 tabular-nums">
          {activeStage === 0 && 'Detecting anomaly spike'}
          {activeStage === 1 && 'Isolating root cause'}
          {activeStage === 2 && 'Synthesizing & testing patch'}
          {activeStage === 3 && 'Verified healthy rollout'}
        </span>
      </div>
    </div>
  );
}
