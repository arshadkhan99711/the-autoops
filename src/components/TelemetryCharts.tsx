import { useState } from 'react';
import { motion } from 'motion/react';
import type { TelemetryPoint } from '../types/ops';

interface TelemetryChartsProps {
  series: TelemetryPoint[];
  timeframe: '15m' | '1h' | '6h' | '24h';
  onTimeframeChange: (tf: '15m' | '1h' | '6h' | '24h') => void;
}

export function TelemetryCharts({ series, timeframe, onTimeframeChange }: TelemetryChartsProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const width = 560;
  const height = 190;
  const padL = 38;
  const padR = 14;
  const padT = 16;
  const padB = 28;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  const activeIndex = hoverIdx !== null && hoverIdx < series.length ? hoverIdx : series.length - 1;
  const activePoint = series[activeIndex] ?? series[0];

  const getX = (idx: number) =>
    series.length <= 1 ? padL : padL + (idx / (series.length - 1)) * innerW;

  const buildPath = (values: number[], maxVal: number) =>
    values
      .map((v, i) => {
        const x = getX(i);
        const y = padT + innerH - (Math.min(v, maxVal) / maxVal) * innerH;
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');

  const buildArea = (values: number[], maxVal: number) => {
    const line = buildPath(values, maxVal);
    const lastX = getX(values.length - 1);
    const firstX = getX(0);
    const baseY = padT + innerH;
    return `${line} L ${lastX.toFixed(1)} ${baseY} L ${firstX.toFixed(1)} ${baseY} Z`;
  };

  const cpuVals = series.map((p) => p.cpu);
  const memVals = series.map((p) => p.memory);
  const latVals = series.map((p) => p.latencyMs);
  const maxLat = Math.max(500, ...latVals);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-slate-100">Cluster Performance Telemetry</h3>
          <p className="text-xs text-slate-400">
            Sample cluster metrics · Hover chart points to inspect exact values
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-[#070C1B] border border-slate-800/90 rounded-lg">
          {(['15m', '1h', '6h', '24h'] as const).map((tf) => (
            <button
              key={tf}
              type="button"
              onClick={() => onTimeframeChange(tf)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                timeframe === tf
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Chart 1: CPU & Memory */}
        <div className="bg-[#0A1022] border border-slate-800/80 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-slate-200">CPU &amp; Memory Utilization</span>
            <div className="flex items-center gap-4 text-xs tabular-nums">
              <span className="text-blue-400">CPU {activePoint?.cpu ?? 0}%</span>
              <span className="text-violet-400">Mem {activePoint?.memory ?? 0}%</span>
              <span className="text-slate-500 font-mono">{activePoint?.time}</span>
            </div>
          </div>

          <svg
            key={`cpu-chart-${timeframe}`}
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-48 overflow-visible select-none"
            onMouseLeave={() => setHoverIdx(null)}
          >
            <defs>
              <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.30" />
                <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="memGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
              </linearGradient>
            </defs>

            {[0, 25, 50, 75, 100].map((tick) => {
              const y = padT + innerH - (tick / 100) * innerH;
              return (
                <g key={tick}>
                  <line
                    x1={padL}
                    x2={width - padR}
                    y1={y}
                    y2={y}
                    stroke="rgba(148,163,184,0.12)"
                    strokeDasharray="3 3"
                  />
                  <text
                    x={padL - 8}
                    y={y + 4}
                    textAnchor="end"
                    className="fill-slate-500 text-[10px] font-mono tabular-nums"
                  >
                    {tick}%
                  </text>
                </g>
              );
            })}

            <motion.path
              d={buildArea(memVals, 100)}
              fill="url(#memGrad)"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
            />
            <motion.path
              d={buildArea(cpuVals, 100)}
              fill="url(#cpuGrad)"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
            />
            <motion.path
              d={buildPath(memVals, 100)}
              fill="none"
              stroke="#8B5CF6"
              strokeWidth="2"
              initial={{ pathLength: 0.15, opacity: 0.5 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            />
            <motion.path
              d={buildPath(cpuVals, 100)}
              fill="none"
              stroke="#3B82F6"
              strokeWidth="2.3"
              initial={{ pathLength: 0.15, opacity: 0.5 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
            />

            {series.map((pt, i) => {
              const x = getX(i);
              const cpuY = padT + innerH - (pt.cpu / 100) * innerH;
              const memY = padT + innerH - (pt.memory / 100) * innerH;
              const isSelected = activeIndex === i;
              return (
                <g key={pt.time}>
                  <text
                    x={x}
                    y={height - 6}
                    textAnchor="middle"
                    className="fill-slate-500 text-[10px] font-mono"
                  >
                    {pt.time}
                  </text>
                  {isSelected && (
                    <>
                      <line
                        x1={x}
                        x2={x}
                        y1={padT}
                        y2={padT + innerH}
                        stroke="rgba(148,163,184,0.35)"
                      />
                      <circle
                        cx={x}
                        cy={cpuY}
                        r="8"
                        fill="rgba(59,130,246,0.22)"
                        className="animate-pulse-expand"
                        style={{ transformOrigin: `${x}px ${cpuY}px` }}
                      />
                      <circle cx={x} cy={memY} r="4" fill="#8B5CF6" />
                      <circle cx={x} cy={cpuY} r="4.5" fill="#3B82F6" stroke="#0A1022" strokeWidth="1.5" />
                    </>
                  )}
                  <rect
                    x={x - innerW / Math.max(series.length * 2, 2)}
                    y={padT}
                    width={innerW / Math.max(series.length, 1)}
                    height={innerH}
                    fill="transparent"
                    className="cursor-crosshair"
                    onMouseEnter={() => setHoverIdx(i)}
                  />
                </g>
              );
            })}
          </svg>
        </div>

        {/* Chart 2: API Latency & Error Rate */}
        <div className="bg-[#0A1022] border border-slate-800/80 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-slate-200">API Response Time &amp; Error Rate</span>
            <div className="flex items-center gap-4 text-xs tabular-nums">
              <span className="text-sky-400">P95 {activePoint?.latencyMs ?? 0}ms</span>
              <span className="text-rose-400">Err {activePoint?.errorRate ?? 0}%</span>
              <span className="text-slate-500 font-mono">{activePoint?.time}</span>
            </div>
          </div>

          <svg
            key={`lat-chart-${timeframe}`}
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-48 overflow-visible select-none"
            onMouseLeave={() => setHoverIdx(null)}
          >
            <defs>
              <linearGradient id="latGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#38BDF8" stopOpacity="0" />
              </linearGradient>
            </defs>

            {[0, 125, 250, 375, 500].map((tick) => {
              const y = padT + innerH - (tick / maxLat) * innerH;
              return (
                <g key={tick}>
                  <line
                    x1={padL}
                    x2={width - padR}
                    y1={y}
                    y2={y}
                    stroke="rgba(148,163,184,0.12)"
                    strokeDasharray="3 3"
                  />
                  <text
                    x={padL - 8}
                    y={y + 4}
                    textAnchor="end"
                    className="fill-slate-500 text-[10px] font-mono tabular-nums"
                  >
                    {tick}
                  </text>
                </g>
              );
            })}

            <motion.path
              d={buildArea(latVals, maxLat)}
              fill="url(#latGrad)"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
            />
            <motion.path
              d={buildPath(latVals, maxLat)}
              fill="none"
              stroke="#38BDF8"
              strokeWidth="2.3"
              initial={{ pathLength: 0.15, opacity: 0.5 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
            />

            {/* Error rate bars normalized to 6% scale */}
            {series.map((pt, i) => {
              const x = getX(i);
              const barH = Math.min(innerH, (pt.errorRate / 6) * innerH);
              const barY = padT + innerH - barH;
              const latY = padT + innerH - (pt.latencyMs / maxLat) * innerH;
              const isSelected = activeIndex === i;

              return (
                <g key={pt.time}>
                  <motion.rect
                    x={x - 6}
                    y={barY}
                    width={12}
                    height={Math.max(2, barH)}
                    rx={2}
                    initial={{ scaleY: 0.2, opacity: 0 }}
                    animate={{ scaleY: 1, opacity: 1 }}
                    transition={{ duration: 0.35, delay: i * 0.03 }}
                    style={{ transformOrigin: `${x}px ${padT + innerH}px` }}
                    fill={pt.errorRate > 2 ? 'rgba(244, 63, 94, 0.55)' : 'rgba(244, 63, 94, 0.25)'}
                  />
                  <text
                    x={x}
                    y={height - 6}
                    textAnchor="middle"
                    className="fill-slate-500 text-[10px] font-mono"
                  >
                    {pt.time}
                  </text>
                  {isSelected && (
                    <>
                      <line
                        x1={x}
                        x2={x}
                        y1={padT}
                        y2={padT + innerH}
                        stroke="rgba(148,163,184,0.35)"
                      />
                      <circle
                        cx={x}
                        cy={latY}
                        r="8"
                        fill="rgba(56,189,248,0.22)"
                        className="animate-pulse-expand"
                        style={{ transformOrigin: `${x}px ${latY}px` }}
                      />
                      <circle cx={x} cy={latY} r="4.5" fill="#38BDF8" stroke="#0A1022" strokeWidth="1.5" />
                    </>
                  )}
                  <rect
                    x={x - innerW / Math.max(series.length * 2, 2)}
                    y={padT}
                    width={innerW / Math.max(series.length, 1)}
                    height={innerH}
                    fill="transparent"
                    className="cursor-crosshair"
                    onMouseEnter={() => setHoverIdx(i)}
                  />
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
}
