"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence, useInView } from "framer-motion";

// ─── Easing ───────────────────────────────────────────────────────────────────
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

// ─── Types ────────────────────────────────────────────────────────────────────
type RiskLevel = "Safe" | "Low" | "Medium" | "High" | "Critical";
type AlertSeverity = "info" | "warning" | "danger" | "success";
type SortKey = "allocation" | "riskScore" | "valueUsd" | "priceChange24h";

interface Asset {
  id: string;
  symbol: string;
  name: string;
  chain: string;
  allocation: number;
  valueUsd: number;
  priceChange24h: number;
  riskLevel: RiskLevel;
  riskScore: number;
  liquidity: number;
  volume24h: number;
  isVerified: boolean;
  trend: number[];
}

interface Alert {
  id: string;
  severity: AlertSeverity;
  title: string;
  body: string;
  action?: { label: string; href: string };
}

// ─── Portfolio Data ────────────────────────────────────────────────────────────
const PORTFOLIO: Asset[] = [
  {
    id: "btc", symbol: "BTC", name: "Bitcoin", chain: "Bitcoin",
    allocation: 38, valueUsd: 16842, priceChange24h: 2.4,
    riskLevel: "Safe", riskScore: 6,
    liquidity: 42100000000, volume24h: 28300000000,
    isVerified: true,
    trend: [61200, 62400, 63100, 65800, 64200, 66900, 67420],
  },
  {
    id: "eth", symbol: "ETH", name: "Ethereum", chain: "Ethereum",
    allocation: 27, valueUsd: 11971, priceChange24h: 1.1,
    riskLevel: "Low", riskScore: 14,
    liquidity: 18600000000, volume24h: 14100000000,
    isVerified: true,
    trend: [3020, 3080, 3140, 3210, 3190, 3250, 3280],
  },
  {
    id: "sol", symbol: "SOL", name: "Solana", chain: "Solana",
    allocation: 16, valueUsd: 7092, priceChange24h: 5.7,
    riskLevel: "Medium", riskScore: 38,
    liquidity: 3800000000, volume24h: 2900000000,
    isVerified: true,
    trend: [148, 152, 159, 163, 170, 174, 178],
  },
  {
    id: "pepe", symbol: "PEPE", name: "Pepe Coin", chain: "Ethereum",
    allocation: 11, valueUsd: 4878, priceChange24h: -8.2,
    riskLevel: "High", riskScore: 74,
    liquidity: 122000000, volume24h: 680000000,
    isVerified: false,
    trend: [0.0000189, 0.0000171, 0.0000162, 0.0000178, 0.0000155, 0.0000141, 0.0000134],
  },
  {
    id: "wif", symbol: "WIF", name: "dogwifhat", chain: "Solana",
    allocation: 5, valueUsd: 2217, priceChange24h: -12.4,
    riskLevel: "High", riskScore: 68,
    liquidity: 45000000, volume24h: 320000000,
    isVerified: false,
    trend: [3.12, 2.98, 2.87, 2.74, 2.61, 2.49, 2.31],
  },
  {
    id: "sfm", symbol: "SAFEMOON", name: "SafeMoon", chain: "BSC",
    allocation: 3, valueUsd: 1330, priceChange24h: -34.1,
    riskLevel: "Critical", riskScore: 96,
    liquidity: 198000, volume24h: 1200000,
    isVerified: false,
    trend: [0.00000048, 0.00000041, 0.00000035, 0.00000030, 0.00000026, 0.00000023, 0.00000021],
  },
];

const TOTAL_VALUE = PORTFOLIO.reduce((s, a) => s + a.valueUsd, 0);

const ALERTS: Alert[] = [
  {
    id: "a1", severity: "danger",
    title: "Critical asset in portfolio",
    body: "SafeMoon (3% of holdings) shows honeypot signals and has active SEC charges. Consider exiting this position.",
    action: { label: "Scan SafeMoon", href: "/analyse" },
  },
  {
    id: "a2", severity: "warning",
    title: "High concentration risk",
    body: "BTC and ETH make up 65% of your portfolio. While both are safe, consider further diversification.",
    action: { label: "Ask AI Advisor", href: "/advisor-page" },
  },
  {
    id: "a3", severity: "warning",
    title: "2 unaudited contracts",
    body: "PEPE and dogwifhat have no formal contract audit. Set strict stop-losses on these positions.",
  },
  {
    id: "a4", severity: "success",
    title: "Core holdings verified",
    body: "BTC and ETH (65% of portfolio) are fully on-chain verified with deep liquidity and zero contract risk.",
  },
];

// ─── Risk Config ──────────────────────────────────────────────────────────────
const RC: Record<RiskLevel, {
  bg: string; text: string; border: string; bar: string; dot: string; dialColor: string; badge: string;
}> = {
  Safe:     { bg: "bg-emerald-50",  text: "text-emerald-700", border: "border-emerald-200", bar: "bg-emerald-500",  dot: "bg-emerald-500",  dialColor: "#10b981", badge: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  Low:      { bg: "bg-teal-50",     text: "text-teal-700",    border: "border-teal-200",    bar: "bg-teal-500",    dot: "bg-teal-500",    dialColor: "#14b8a6", badge: "bg-teal-100 text-teal-800 border-teal-200"         },
  Medium:   { bg: "bg-amber-50",    text: "text-amber-700",   border: "border-amber-200",   bar: "bg-amber-500",   dot: "bg-amber-500",   dialColor: "#f59e0b", badge: "bg-amber-100 text-amber-800 border-amber-200"       },
  High:     { bg: "bg-orange-50",   text: "text-orange-700",  border: "border-orange-200",  bar: "bg-orange-500",  dot: "bg-orange-500",  dialColor: "#f97316", badge: "bg-orange-100 text-orange-800 border-orange-200"   },
  Critical: { bg: "bg-red-50",      text: "text-red-700",     border: "border-red-200",     bar: "bg-red-500",     dot: "bg-red-500",     dialColor: "#ef4444", badge: "bg-red-100 text-red-800 border-red-200"             },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtCompact(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function fmtUsd(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function computeHealthScore(): number {
  return Math.round(PORTFOLIO.reduce((s, a) => s + (a.allocation / 100) * (100 - a.riskScore), 0));
}

const HEALTH = computeHealthScore();

const RISK_DIST = (() => {
  const map: Record<RiskLevel, number> = { Safe: 0, Low: 0, Medium: 0, High: 0, Critical: 0 };
  PORTFOLIO.forEach(a => { map[a.riskLevel] += a.allocation; });
  return map;
})();

// ─── Icons ────────────────────────────────────────────────────────────────────
function ShieldIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/>
    </svg>
  );
}

function ChevronIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M4 6l4 4 4-4"/>
    </svg>
  );
}

// ─── Sparkline ────────────────────────────────────────────────────────────────
function Sparkline({ data, positive }: { data: number[]; positive: boolean }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const W = 56, H = 24;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - ((v - min) / range) * (H - 2) - 1;
    return `${x},${y}`;
  }).join(" ");
  const color = positive ? "#10b981" : "#ef4444";

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Health Dial ──────────────────────────────────────────────────────────────
function HealthDial({ score }: { score: number }) {
  const r = 72, circ = 2 * Math.PI * r, arc = circ * 0.75;
  const offset = arc - (score / 100) * arc;
  const color  = score >= 70 ? "#10b981" : score >= 45 ? "#f59e0b" : "#ef4444";
  const label  = score >= 70 ? "Good" : score >= 45 ? "Moderate" : "At Risk";

  // Tick marks
  const ticks = Array.from({ length: 11 }, (_, i) => {
    const angle = -225 + (i / 10) * 270;
    const rad = (angle * Math.PI) / 180;
    const inner = 62, outer = 70;
    const x1 = 90 + inner * Math.cos(rad);
    const y1 = 90 + inner * Math.sin(rad);
    const x2 = 90 + outer * Math.cos(rad);
    const y2 = 90 + outer * Math.sin(rad);
    return { x1, y1, x2, y2, major: i % 5 === 0 };
  });

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-48 h-48">
        <svg viewBox="0 0 180 180" className="w-full h-full" style={{ transform: "rotate(-90deg)" }}>
          {/* Outer glow ring */}
          <circle cx="90" cy="90" r="84" fill="none" stroke={color} strokeWidth="1" strokeOpacity="0.12" />

          {/* Background arc */}
          <circle cx="90" cy="90" r={r} fill="none" stroke="#f1f5f9" strokeWidth="10"
            strokeDasharray={`${arc} ${circ}`} strokeLinecap="round" />

          {/* Value arc */}
          <motion.circle cx="90" cy="90" r={r} fill="none"
            stroke={color} strokeWidth="10" strokeLinecap="round"
            strokeDasharray={`${arc} ${circ}`}
            initial={{ strokeDashoffset: arc }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.8, ease: EASE, delay: 0.3 }}
          />

          {/* Tick marks */}
          {ticks.map((t, i) => (
            <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
              stroke={t.major ? "#94a3b8" : "#e2e8f0"} strokeWidth={t.major ? 1.5 : 1}
              strokeLinecap="round" />
          ))}
        </svg>

        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 1 }}
            className="font-display font-bold text-5xl leading-none"
            style={{ color }}
          >
            {score}
          </motion.span>
          <span className="font-sans text-[11px] text-gray-400 mt-0.5 tracking-wide">out of 100</span>
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.4 }}
        className="flex items-center gap-2 -mt-1">
        <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: color }} />
        <span className="font-display font-bold text-gray-800">{label}</span>
      </motion.div>
    </div>
  );
}

// ─── Donut Chart ──────────────────────────────────────────────────────────────
function DonutChart() {
  const segs = [
    { level: "Safe"     as RiskLevel, pct: RISK_DIST.Safe,     color: "#10b981" },
    { level: "Low"      as RiskLevel, pct: RISK_DIST.Low,      color: "#14b8a6" },
    { level: "Medium"   as RiskLevel, pct: RISK_DIST.Medium,   color: "#f59e0b" },
    { level: "High"     as RiskLevel, pct: RISK_DIST.High,     color: "#f97316" },
    { level: "Critical" as RiskLevel, pct: RISK_DIST.Critical, color: "#ef4444" },
  ].filter(s => s.pct > 0);

  const r = 48, cx = 60, cy = 60, circ = 2 * Math.PI * r;
  let cumPct = 0;

  return (
    <div className="flex items-center gap-6">
      {/* SVG donut */}
      <div className="relative flex-shrink-0">
        <svg width="120" height="120" viewBox="0 0 120 120" style={{ transform: "rotate(-90deg)" }}>
          {segs.map((seg, i) => {
            const dashLen = (seg.pct / 100) * circ;
            const rotation = (cumPct / 100) * 360;
            cumPct += seg.pct;
            return (
              <motion.circle key={seg.level} cx={cx} cy={cy} r={r}
                fill="none" stroke={seg.color} strokeWidth="16"
                strokeDasharray={`${dashLen} ${circ}`}
                style={{ transformOrigin: `${cx}px ${cy}px`, transform: `rotate(${rotation}deg)` }}
                initial={{ strokeDashoffset: dashLen }}
                animate={{ strokeDashoffset: 0 }}
                transition={{ duration: 0.9, delay: 0.3 + i * 0.12, ease: EASE }}
              />
            );
          })}
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display font-bold text-gray-900 text-xl">
            {RISK_DIST.Safe + RISK_DIST.Low}%
          </span>
          <span className="font-sans text-[9px] text-gray-400 uppercase tracking-wide">safe</span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-col gap-2 flex-1 min-w-0">
        {segs.map((seg, i) => (
          <motion.div key={seg.level} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.35 + i * 0.08, ease: EASE }}
            className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: seg.color }} />
            <span className="font-sans text-xs text-gray-600 flex-1">{seg.level}</span>
            <div className="w-14 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <motion.div initial={{ width: 0 }} animate={{ width: `${seg.pct}%` }}
                transition={{ duration: 0.8, delay: 0.4 + i * 0.08, ease: EASE }}
                className="h-full rounded-full" style={{ background: seg.color }} />
            </div>
            <span className="font-mono text-xs font-bold text-gray-700 w-7 text-right">{seg.pct}%</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─── Mini Metric ──────────────────────────────────────────────────────────────
function MiniMetric({ label, value, sub, color = "gray" }: {
  label: string; value: string; sub?: string; color?: string;
}) {
  const colors: Record<string, string> = {
    green: "text-emerald-600",
    amber: "text-amber-600",
    red:   "text-red-500",
    gray:  "text-gray-900",
  };
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-sans text-xs text-gray-400">{label}</span>
      <span className={`font-display font-bold text-xl leading-none ${colors[color]}`}>{value}</span>
      {sub && <span className="font-sans text-[10px] text-gray-400">{sub}</span>}
    </div>
  );
}

// ─── Alert Card ───────────────────────────────────────────────────────────────
function AlertCard({ alert, delay = 0 }: { alert: Alert; delay?: number }) {
  const [dismissed, setDismissed] = useState(false);
  const cfg = {
    danger:  { wrap: "bg-red-50 border-red-200",           icon: "🚨", titleCls: "text-red-900",     bodyCls: "text-red-700",     btnCls: "bg-red-600 hover:bg-red-700 text-white" },
    warning: { wrap: "bg-amber-50 border-amber-200",       icon: "⚠️", titleCls: "text-amber-900",   bodyCls: "text-amber-700",   btnCls: "bg-amber-600 hover:bg-amber-700 text-white" },
    success: { wrap: "bg-emerald-50 border-emerald-200",   icon: "✓",  titleCls: "text-emerald-900", bodyCls: "text-emerald-700", btnCls: "bg-emerald-600 hover:bg-emerald-700 text-white" },
    info:    { wrap: "bg-blue-50 border-blue-200",         icon: "💡", titleCls: "text-blue-900",    bodyCls: "text-blue-700",    btnCls: "bg-blue-600 hover:bg-blue-700 text-white" },
  }[alert.severity];

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, height: 0, marginBottom: 0 }}
          transition={{ duration: 0.4, delay, ease: EASE }}
          className={`rounded-2xl border p-4 ${cfg.wrap}`}
        >
          <div className="flex items-start gap-3">
            <span className="text-base flex-shrink-0 mt-0.5">{cfg.icon}</span>
            <div className="flex-1 min-w-0">
              <p className={`font-display font-bold text-sm mb-0.5 ${cfg.titleCls}`}>{alert.title}</p>
              <p className={`font-sans text-xs leading-relaxed ${cfg.bodyCls}`}>{alert.body}</p>
              {alert.action && (
                <a href={alert.action.href}
                  className={`inline-flex items-center gap-1.5 font-sans text-xs font-bold mt-2.5 px-3 py-1.5 rounded-lg transition-colors ${cfg.btnCls}`}>
                  {alert.action.label} →
                </a>
              )}
            </div>
            <button onClick={() => setDismissed(true)}
              className="text-gray-300 hover:text-gray-500 transition-colors flex-shrink-0">
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Asset Row ────────────────────────────────────────────────────────────────
function AssetRow({ asset, index }: { asset: Asset; index: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-20px" });
  const rc = RC[asset.riskLevel];
  const pos = asset.priceChange24h >= 0;

  return (
    <motion.tr
      ref={ref}
      initial={{ opacity: 0, x: -12 }}
      animate={inView ? { opacity: 1, x: 0 } : {}}
      transition={{ duration: 0.4, delay: index * 0.06, ease: EASE }}
      className="group border-b border-gray-50 hover:bg-gray-50/60 transition-colors"
    >
      {/* Asset */}
      <td className="py-3.5 pl-5 pr-4">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-mono font-bold text-xs border flex-shrink-0 ${rc.badge}`}>
            {asset.symbol.slice(0, 3)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="font-display font-bold text-gray-900 text-sm">{asset.name}</p>
              {asset.isVerified && (
                <span title="Verified contract" className="text-emerald-500">
                  <svg className="w-3 h-3" viewBox="0 0 12 12" fill="currentColor">
                    <path d="M6 1l1.5 2.8 3.1.4-2.3 2.2.6 3.1L6 8l-2.9 1.5.6-3.1L1.4 4.2l3.1-.4z"/>
                  </svg>
                </span>
              )}
            </div>
            <p className="font-sans text-xs text-gray-400">{asset.symbol} · {asset.chain}</p>
          </div>
        </div>
      </td>

      {/* Allocation */}
      <td className="py-3.5 px-4">
        <div className="flex items-center gap-2.5">
          <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={inView ? { width: `${asset.allocation}%` } : {}}
              transition={{ duration: 0.8, delay: index * 0.06 + 0.2, ease: EASE }}
              className={`h-full rounded-full ${rc.bar}`}
            />
          </div>
          <span className="font-mono text-xs font-bold text-gray-700 tabular-nums w-7">{asset.allocation}%</span>
        </div>
      </td>

      {/* Value */}
      <td className="py-3.5 px-4">
        <p className="font-mono text-sm font-bold text-gray-800 tabular-nums">{fmtUsd(asset.valueUsd)}</p>
      </td>

      {/* 24h */}
      <td className="py-3.5 px-4">
        <div className="flex items-center gap-2">
          <Sparkline data={asset.trend} positive={pos} />
          <span className={`font-mono text-xs font-bold tabular-nums ${pos ? "text-emerald-600" : "text-red-500"}`}>
            {pos ? "+" : ""}{asset.priceChange24h.toFixed(1)}%
          </span>
        </div>
      </td>

      {/* Liquidity */}
      <td className="py-3.5 px-4">
        <p className="font-mono text-xs text-gray-600 tabular-nums">{fmtCompact(asset.liquidity)}</p>
      </td>

      {/* Risk */}
      <td className="py-3.5 px-4">
        <div className="flex items-center gap-2">
          <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${rc.bar}`} style={{ width: `${asset.riskScore}%` }} />
          </div>
          <span className={`font-sans text-xs font-bold px-2 py-0.5 rounded-full border ${rc.badge}`}>
            {asset.riskLevel}
          </span>
        </div>
      </td>

      {/* Actions */}
      <td className="py-3.5 pl-4 pr-5">
        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <a href="/analyse" title="Scan token"
            className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-emerald-100 hover:text-emerald-700 flex items-center justify-center text-gray-500 transition-colors text-xs">
            🔍
          </a>
          <a href="/advisor-page" title="Ask AI"
            className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-blue-100 hover:text-blue-700 flex items-center justify-center text-gray-500 transition-colors text-xs">
            💬
          </a>
        </div>
      </td>
    </motion.tr>
  );
}

// ─── Diversification Warning Bar ──────────────────────────────────────────────
function DiversificationBar() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });

  const checks = [
    { label: "No single asset > 50%",     pass: PORTFOLIO.every(a => a.allocation <= 50),  tip: "Largest position is BTC at 38% ✓" },
    { label: "High-risk assets < 20%",    pass: (RISK_DIST.High + RISK_DIST.Critical) < 20, tip: `${RISK_DIST.High + RISK_DIST.Critical}% in High/Critical risk — slightly above safe zone` },
    { label: "At least 3 chains",         pass: new Set(PORTFOLIO.map(a => a.chain)).size >= 3, tip: `${new Set(PORTFOLIO.map(a => a.chain)).size} chains: Bitcoin, Ethereum, Solana, BSC` },
    { label: "Safe assets > 50%",         pass: (RISK_DIST.Safe + RISK_DIST.Low) >= 50,    tip: `${RISK_DIST.Safe + RISK_DIST.Low}% in Safe/Low risk ✓` },
    { label: "No unverified > 10% each",  pass: PORTFOLIO.filter(a => !a.isVerified).every(a => a.allocation <= 10), tip: "All unverified tokens kept below 10% individually ✓" },
  ];

  const passed = checks.filter(c => c.pass).length;

  return (
    <div ref={ref} className="bg-white border border-gray-100 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-display font-bold text-gray-900 text-sm">Diversification check</h3>
          <p className="font-sans text-xs text-gray-400 mt-0.5">Best-practice rules for portfolio safety</p>
        </div>
        <div className="text-right">
          <span className="font-display font-bold text-2xl text-gray-900">{passed}</span>
          <span className="font-sans text-sm text-gray-400">/{checks.length} passed</span>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        {checks.map((c, i) => (
          <motion.div key={c.label}
            initial={{ opacity: 0, x: -8 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ delay: 0.1 + i * 0.08, ease: EASE }}
            className="flex items-start gap-3 group cursor-default"
          >
            <div className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5 transition-all ${
              c.pass ? "bg-emerald-500" : "bg-orange-500"
            }`}>
              <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                {c.pass
                  ? <path d="M2.5 6l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  : <path d="M3 6h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>}
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className={`font-sans text-sm font-medium ${c.pass ? "text-gray-700" : "text-orange-700"}`}>{c.label}</p>
              <p className="font-sans text-xs text-gray-400 mt-0.5">{c.tip}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Score bar */}
      <div className="mt-5 pt-4 border-t border-gray-100">
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-sans text-xs text-gray-400">Diversification score</span>
          <span className="font-mono text-xs font-bold text-gray-700">{Math.round((passed / checks.length) * 100)}%</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={inView ? { width: `${(passed / checks.length) * 100}%` } : {}}
            transition={{ duration: 1, delay: 0.5, ease: EASE }}
            className={`h-full rounded-full ${passed >= 4 ? "bg-emerald-500" : passed >= 3 ? "bg-amber-500" : "bg-orange-500"}`}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Chain Distribution ───────────────────────────────────────────────────────
function ChainDistribution() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });

  const chains = (() => {
    const map: Record<string, { value: number; alloc: number }> = {};
    PORTFOLIO.forEach(a => {
      if (!map[a.chain]) map[a.chain] = { value: 0, alloc: 0 };
      map[a.chain].value += a.valueUsd;
      map[a.chain].alloc += a.allocation;
    });
    return Object.entries(map)
      .map(([chain, data]) => ({ chain, ...data }))
      .sort((a, b) => b.alloc - a.alloc);
  })();

  const chainColors: Record<string, string> = {
    Bitcoin:  "#f7931a",
    Ethereum: "#627eea",
    Solana:   "#9945ff",
    BSC:      "#f3ba2f",
  };

  return (
    <div ref={ref} className="bg-white border border-gray-100 rounded-2xl p-6">
      <h3 className="font-display font-bold text-gray-900 text-sm mb-4">Chain distribution</h3>
      <div className="flex flex-col gap-3">
        {chains.map((c, i) => (
          <motion.div key={c.chain}
            initial={{ opacity: 0, x: -8 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ delay: 0.1 + i * 0.08, ease: EASE }}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: chainColors[c.chain] ?? "#94a3b8" }} />
                <span className="font-sans text-sm text-gray-700">{c.chain}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-sans text-xs text-gray-400">{fmtUsd(c.value)}</span>
                <span className="font-mono text-xs font-bold text-gray-700 w-7 text-right">{c.alloc}%</span>
              </div>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={inView ? { width: `${c.alloc}%` } : {}}
                transition={{ duration: 0.9, delay: 0.15 + i * 0.08, ease: EASE }}
                className="h-full rounded-full"
                style={{ background: chainColors[c.chain] ?? "#94a3b8" }}
              />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [sortKey, setSortKey]     = useState<SortKey>("allocation");
  const [sortAsc, setSortAsc]     = useState(false);
  const [filterRisk, setFilterRisk] = useState<RiskLevel | "All">("All");

  const sortedAssets = [...PORTFOLIO]
    .filter(a => filterRisk === "All" || a.riskLevel === filterRisk)
    .sort((a, b) => {
      const diff = (a[sortKey] as number) - (b[sortKey] as number);
      return sortAsc ? diff : -diff;
    });

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(p => !p);
    else { setSortKey(key); setSortAsc(false); }
  }

  function SortTh({ label, sKey }: { label: string; sKey: SortKey }) {
    const active = sortKey === sKey;
    return (
      <th className="py-3 px-4 text-left cursor-pointer select-none" onClick={() => toggleSort(sKey)}>
        <div className="flex items-center gap-1">
          <span className={`font-sans text-xs font-bold uppercase tracking-wide transition-colors ${active ? "text-emerald-600" : "text-gray-400"}`}>
            {label}
          </span>
          <span className={`transition-transform ${active && !sortAsc ? "rotate-180" : ""}`}>
            <ChevronIcon className={`w-3 h-3 ${active ? "text-emerald-600" : "text-gray-300"}`} />
          </span>
        </div>
      </th>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-100">
        <div className="max-w-[1360px] mx-auto px-6 h-14 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <ShieldIcon className="w-4 h-4 text-white" />
            </div>
            <span className="font-display font-bold text-gray-900 text-[15px]">TokenShield</span>
          </a>

          <div className="hidden md:flex items-center gap-1 bg-gray-100 rounded-xl p-1">
            {[
              { label: "Dashboard",  href: "/dashboard" },
              { label: "Analyser",   href: "/analyse"   },
              { label: "FOMO Guard", href: "/fomo"       },
              { label: "AI Advisor", href: "/advisor-page"    },
            ].map(l => (
              <a key={l.href} href={l.href}
                className={`font-sans text-xs font-medium px-3 py-1.5 rounded-lg transition-all ${
                  l.href === "/dashboard"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}>
                {l.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <a href="#"
              className="font-sans text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-full transition-colors">
              Connect Wallet
            </a>
          </div>
        </div>
      </nav>

      <div className="max-w-[1360px] mx-auto px-6 py-8">

        {/* Page header */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}
          className="mb-7">
          <p className="font-sans text-xs font-bold text-emerald-600 tracking-widest uppercase mb-1.5">Safety Dashboard</p>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="font-display font-bold text-gray-900 text-3xl tracking-tight leading-tight">
                Portfolio Risk Overview
              </h1>
              <p className="font-sans text-gray-400 text-sm mt-1">
                {PORTFOLIO.length} assets tracked · Total value{" "}
                <span className="font-semibold text-gray-700">{fmtUsd(TOTAL_VALUE)}</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <a href="/advisor-page"
                className="flex items-center gap-1.5 font-sans text-xs font-medium border border-gray-200 hover:bg-gray-50 text-gray-600 px-3 py-2 rounded-xl transition-colors">
                💬 Ask AI Advisor
              </a>
              <a href="/analyse"
                className="flex items-center gap-1.5 font-sans text-xs font-medium bg-gray-900 hover:bg-gray-800 text-white px-3 py-2 rounded-xl transition-colors">
                🔍 Scan new token
              </a>
            </div>
          </div>
        </motion.div>

        {/* ── Top grid: Health + Donut + Stats ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">

          {/* Health card */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08, ease: EASE }}
            className="bg-white border border-gray-100 rounded-2xl p-6 flex flex-col items-center gap-2">
            <p className="font-display font-bold text-gray-800 text-sm self-start">Wallet health score</p>
            <HealthDial score={HEALTH} />
            <p className="font-sans text-xs text-gray-400 text-center leading-relaxed max-w-[180px]">
              Weighted by allocation × inverse risk score across all positions
            </p>
          </motion.div>

          {/* Risk distribution */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14, ease: EASE }}
            className="bg-white border border-gray-100 rounded-2xl p-6">
            <p className="font-display font-bold text-gray-800 text-sm mb-5">Risk distribution</p>
            <DonutChart />

            {/* Summary pills */}
            <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t border-gray-100">
              <span className="font-sans text-xs bg-emerald-50 border border-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full font-medium">
                ✓ {RISK_DIST.Safe + RISK_DIST.Low}% safe assets
              </span>
              <span className="font-sans text-xs bg-orange-50 border border-orange-100 text-orange-700 px-2.5 py-1 rounded-full font-medium">
                ⚠ {RISK_DIST.High + RISK_DIST.Critical}% risky assets
              </span>
            </div>
          </motion.div>

          {/* Key metrics */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, ease: EASE }}
            className="bg-white border border-gray-100 rounded-2xl p-6 flex flex-col gap-5">
            <p className="font-display font-bold text-gray-800 text-sm">Key metrics</p>

            <div className="grid grid-cols-2 gap-4">
              <MiniMetric label="Total value"   value={fmtUsd(TOTAL_VALUE)}                              color="gray"  />
              <MiniMetric label="Health score"  value={`${HEALTH}/100`}                                  color={HEALTH >= 70 ? "green" : "amber"} />
              <MiniMetric label="Safe holdings" value={`${RISK_DIST.Safe + RISK_DIST.Low}%`}             color="green" sub="of portfolio" />
              <MiniMetric label="At risk"       value={`${RISK_DIST.High + RISK_DIST.Critical}%`}        color={RISK_DIST.High + RISK_DIST.Critical > 20 ? "red" : "amber"} sub="of portfolio" />
              <MiniMetric label="Assets tracked" value={`${PORTFOLIO.length}`}                           color="gray"  sub="positions" />
              <MiniMetric label="Verified"      value={`${PORTFOLIO.filter(a => a.isVerified).length}/${PORTFOLIO.length}`} color="green" sub="contracts" />
            </div>

            <div className="pt-4 border-t border-gray-100 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-sans text-gray-400">Worst performer 24h</span>
                <span className="font-mono font-bold text-red-500">
                  {[...PORTFOLIO].sort((a, b) => a.priceChange24h - b.priceChange24h)[0].symbol}{" "}
                  {[...PORTFOLIO].sort((a, b) => a.priceChange24h - b.priceChange24h)[0].priceChange24h.toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-sans text-gray-400">Best performer 24h</span>
                <span className="font-mono font-bold text-emerald-600">
                  {[...PORTFOLIO].sort((a, b) => b.priceChange24h - a.priceChange24h)[0].symbol}{" "}
                  +{[...PORTFOLIO].sort((a, b) => b.priceChange24h - a.priceChange24h)[0].priceChange24h.toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-sans text-gray-400">Highest risk asset</span>
                <span className="font-sans font-bold text-red-600">
                  {[...PORTFOLIO].sort((a, b) => b.riskScore - a.riskScore)[0].symbol} — Critical
                </span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* ── Alerts ── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28, ease: EASE }}
          className="mb-5">
          <h2 className="font-display font-bold text-gray-900 text-sm mb-3">Safety alerts</h2>
          <div className="flex flex-col gap-2.5">
            {ALERTS.map((a, i) => <AlertCard key={a.id} alert={a} delay={0.3 + i * 0.07} />)}
          </div>
        </motion.div>

        {/* ── Asset Table ── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.36, ease: EASE }}
          className="bg-white border border-gray-100 rounded-2xl overflow-hidden mb-5">
          {/* Table header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div>
              <h2 className="font-display font-bold text-gray-900 text-sm">Portfolio positions</h2>
              <p className="font-sans text-xs text-gray-400 mt-0.5">Click column headers to sort</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-sans text-xs text-gray-400">Filter:</span>
              <div className="flex gap-1.5">
                {(["All", "Safe", "Low", "Medium", "High", "Critical"] as const).map(f => (
                  <button key={f} onClick={() => setFilterRisk(f)}
                    className={`font-sans text-xs px-2.5 py-1 rounded-full border transition-all ${
                      filterRisk === f
                        ? f === "All" ? "bg-gray-900 text-white border-gray-900"
                          : `${RC[f as RiskLevel]?.badge ?? ""} border-current font-bold`
                        : "border-gray-200 text-gray-400 hover:border-gray-300"
                    }`}>
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50/80 border-b border-gray-100">
                <tr>
                  <th className="py-3 pl-5 pr-4 text-left font-sans text-xs font-bold uppercase tracking-wide text-gray-400">Asset</th>
                  <SortTh label="Allocation" sKey="allocation" />
                  <SortTh label="Value"      sKey="valueUsd" />
                  <SortTh label="24h"        sKey="priceChange24h" />
                  <th className="py-3 px-4 text-left font-sans text-xs font-bold uppercase tracking-wide text-gray-400">Liquidity</th>
                  <SortTh label="Risk"       sKey="riskScore" />
                  <th className="py-3 pl-4 pr-5 text-left font-sans text-xs font-bold uppercase tracking-wide text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedAssets.map((asset, i) => (
                  <AssetRow key={asset.id} asset={asset} index={i} />
                ))}
              </tbody>
            </table>
          </div>

          {/* Table footer */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50/40">
            <span className="font-sans text-xs text-gray-400">{sortedAssets.length} positions shown</span>
            <a href="/analyse" className="font-sans text-xs font-medium text-emerald-600 hover:text-emerald-700 transition-colors">
              + Add new token scan →
            </a>
          </div>
        </motion.div>

        {/* ── Bottom row: Diversification + Chain ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.44, ease: EASE }}>
            <DiversificationBar />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, ease: EASE }}>
            <ChainDistribution />
          </motion.div>
        </div>

        {/* ── CTA strip ── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.56, ease: EASE }}
          className="bg-gray-950 rounded-2xl px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="font-display font-bold text-white text-base">Connect MetaMask for live portfolio data</p>
            <p className="font-sans text-xs text-gray-400 mt-0.5">Auto-import your real holdings and get live risk scores</p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <a href="/advisor-page"
              className="font-sans text-xs font-medium text-gray-400 hover:text-gray-200 transition-colors">
              Ask AI Advisor →
            </a>
            <button className="font-sans text-sm font-bold bg-emerald-500 hover:bg-emerald-400 text-white px-5 py-2.5 rounded-xl transition-colors flex items-center gap-2">
              <span>🦊</span> Connect Wallet
            </button>
          </div>
        </motion.div>

        {/* Disclaimer */}
        <p className="font-sans text-xs text-gray-400 text-center mt-5">
          Demo portfolio data for illustration. Connect your wallet to see real holdings. Not financial advice.
        </p>
      </div>
    </div>
  );
}