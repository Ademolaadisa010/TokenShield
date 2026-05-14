"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence, useInView } from "framer-motion";

// ─── Easing ───────────────────────────────────────────────────────────────────
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

// ─── Types ────────────────────────────────────────────────────────────────────
type RiskLevel = "Safe" | "Low" | "Medium" | "High" | "Critical" | "Unknown";
type SortKey = "allocation" | "riskScore" | "valueUsd" | "priceChange24h";

interface Asset {
  id: string;
  symbol: string;
  name: string;
  chain: string;
  mintAddress: string;
  balance: number;
  decimals: number;
  priceUsd: number;
  valueUsd: number;
  allocation: number;
  priceChange24h: number;
  liquidity: number;
  volume24h: number;
  riskLevel: RiskLevel;
  riskScore: number;
  isVerified: boolean;
  dexUrl?: string;
}

interface WalletState {
  connected: boolean;
  publicKey: string | null;
  loading: boolean;
  error: string | null;
}

// ─── Solana RPC helpers ───────────────────────────────────────────────────────
const SOLANA_RPC = "https://api.mainnet-beta.solana.com";

async function rpc(method: string, params: unknown[]) {
  const res = await fetch(SOLANA_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.result;
}

async function getSolBalance(pubkey: string): Promise<number> {
  const result = await rpc("getBalance", [pubkey, { commitment: "confirmed" }]);
  return result.value / 1e9; // lamports → SOL
}

interface TokenAccountInfo {
  mint: string;
  amount: number;
  decimals: number;
  symbol?: string;
  name?: string;
}

async function getTokenAccounts(pubkey: string): Promise<TokenAccountInfo[]> {
  const result = await rpc("getTokenAccountsByOwner", [
    pubkey,
    { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
    { encoding: "jsonParsed", commitment: "confirmed" },
  ]);
  return result.value
    .map((acc: { account: { data: { parsed: { info: { mint: string; tokenAmount: { uiAmount: number; decimals: number } } } } } }) => {
      const info = acc.account.data.parsed.info;
      return {
        mint: info.mint,
        amount: info.tokenAmount.uiAmount,
        decimals: info.tokenAmount.decimals,
      };
    })
    .filter((t: TokenAccountInfo) => t.amount > 0);
}

// ─── DexScreener helpers ──────────────────────────────────────────────────────
interface DexScreenerToken {
  priceUsd: number;
  change24h: number;
  liquidity: number;
  volume24h: number;
  symbol: string;
  name: string;
  dexUrl: string;
  fdv?: number;
}

async function fetchDexScreenerBatch(mints: string[]): Promise<Record<string, DexScreenerToken>> {
  const result: Record<string, DexScreenerToken> = {};
  // DexScreener allows up to 30 tokens per request
  const chunks: string[][] = [];
  for (let i = 0; i < mints.length; i += 30) chunks.push(mints.slice(i, i + 30));

  await Promise.all(
    chunks.map(async (chunk) => {
      try {
        const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${chunk.join(",")}`, {
          headers: { Accept: "application/json" },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!data.pairs) return;

        // For each mint, pick the pair with the highest liquidity (most reliable price)
        for (const pair of data.pairs) {
          if (!pair.baseToken?.address) continue;
          const mint = pair.baseToken.address;
          const liq = pair.liquidity?.usd ?? 0;
          const existing = result[mint];
          if (!existing || liq > existing.liquidity) {
            result[mint] = {
              priceUsd: parseFloat(pair.priceUsd ?? "0"),
              change24h: pair.priceChange?.h24 ?? 0,
              liquidity: liq,
              volume24h: pair.volume?.h24 ?? 0,
              symbol: pair.baseToken.symbol ?? "???",
              name: pair.baseToken.name ?? "Unknown",
              dexUrl: pair.url ?? "",
              fdv: pair.fdv ?? 0,
            };
          }
        }
      } catch {
        // silently skip failed chunks
      }
    })
  );
  return result;
}

// Known safe tokens for risk scoring
const KNOWN_SAFE: Record<string, { risk: RiskLevel; score: number }> = {
  So11111111111111111111111111111111111111112:  { risk: "Medium", score: 38 }, // SOL (wrapped)
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1F: { risk: "Low",    score: 12 }, // USDC
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: { risk: "Low",    score: 14 }, // USDT
  mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So: { risk: "Medium", score: 30 }, // mSOL
};

function computeRisk(liq: number, vol24h: number, mint: string): { risk: RiskLevel; score: number } {
  if (KNOWN_SAFE[mint]) return KNOWN_SAFE[mint];
  if (liq === 0) return { risk: "Unknown", score: 50 };

  let score = 0;
  // Low liquidity
  if (liq < 10_000)   score += 40;
  else if (liq < 100_000)  score += 25;
  else if (liq < 1_000_000) score += 12;
  else if (liq < 10_000_000) score += 5;
  // Low volume ratio
  const volRatio = vol24h / liq;
  if (volRatio < 0.01) score += 20;
  else if (volRatio < 0.05) score += 10;

  score = Math.min(score, 95);

  const risk: RiskLevel =
    score <= 10 ? "Safe" :
    score <= 25 ? "Low" :
    score <= 45 ? "Medium" :
    score <= 70 ? "High" : "Critical";

  return { risk, score };
}

// ─── Risk Config ──────────────────────────────────────────────────────────────
const RC: Record<RiskLevel, {
  bg: string; text: string; border: string; bar: string; dot: string; badge: string;
}> = {
  Safe:    { bg:"bg-emerald-50", text:"text-emerald-700", border:"border-emerald-200", bar:"bg-emerald-500", dot:"bg-emerald-500", badge:"bg-emerald-100 text-emerald-800 border-emerald-200" },
  Low:     { bg:"bg-teal-50",    text:"text-teal-700",    border:"border-teal-200",    bar:"bg-teal-500",    dot:"bg-teal-500",    badge:"bg-teal-100 text-teal-800 border-teal-200"           },
  Medium:  { bg:"bg-amber-50",   text:"text-amber-700",   border:"border-amber-200",   bar:"bg-amber-500",   dot:"bg-amber-500",   badge:"bg-amber-100 text-amber-800 border-amber-200"         },
  High:    { bg:"bg-orange-50",  text:"text-orange-700",  border:"border-orange-200",  bar:"bg-orange-500",  dot:"bg-orange-500",  badge:"bg-orange-100 text-orange-800 border-orange-200"     },
  Critical:{ bg:"bg-red-50",     text:"text-red-700",     border:"border-red-200",     bar:"bg-red-500",     dot:"bg-red-500",     badge:"bg-red-100 text-red-800 border-red-200"               },
  Unknown: { bg:"bg-gray-50",    text:"text-gray-600",    border:"border-gray-200",    bar:"bg-gray-400",    dot:"bg-gray-400",    badge:"bg-gray-100 text-gray-600 border-gray-200"             },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtCompact(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return n > 0 ? `$${n.toFixed(0)}` : "—";
}

function fmtUsd(n: number): string {
  if (n <= 0) return "$0";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);
}

function shortKey(key: string): string {
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

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

// ─── Phantom Logo ─────────────────────────────────────────────────────────────
function PhantomLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 128 128" fill="none">
      <rect width="128" height="128" rx="24" fill="#AB9FF2"/>
      <path d="M110.584 64.9142H99.142C99.142 43.7183 81.7782 26.6 60.3524 26.6C39.1596 26.6 21.9336 43.3428 21.5995 64.3554C21.2585 86.0586 38.6862 104 60.3524 104H65.9951C85.0141 104 110.584 87.0046 110.584 64.9142Z" fill="white"/>
      <ellipse cx="79.5" cy="57.5" rx="6.5" ry="6.5" fill="#AB9FF2"/>
      <ellipse cx="58.5" cy="57.5" rx="6.5" ry="6.5" fill="#AB9FF2"/>
    </svg>
  );
}

// ─── Sparkline ────────────────────────────────────────────────────────────────
function Sparkline({ positive }: { positive: boolean }) {
  // Decorative static sparkline when we don't have OHLCV history from DexScreener
  const points = positive
    ? "0,18 10,14 20,16 30,10 40,12 56,4"
    : "0,4 10,8 20,6 30,12 40,10 56,18";
  const color = positive ? "#10b981" : "#ef4444";
  return (
    <svg width={56} height={22} viewBox="0 0 56 22">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ─── Health Dial ──────────────────────────────────────────────────────────────
function HealthDial({ score }: { score: number }) {
  const r = 72, circ = 2 * Math.PI * r, arc = circ * 0.75;
  const offset = arc - (score / 100) * arc;
  const color  = score >= 70 ? "#10b981" : score >= 45 ? "#f59e0b" : "#ef4444";
  const label  = score >= 70 ? "Good" : score >= 45 ? "Moderate" : "At Risk";

  const ticks = Array.from({ length: 11 }, (_, i) => {
    const angle = -225 + (i / 10) * 270;
    const rad = (angle * Math.PI) / 180;
    const x1 = 90 + 62 * Math.cos(rad), y1 = 90 + 62 * Math.sin(rad);
    const x2 = 90 + 70 * Math.cos(rad), y2 = 90 + 70 * Math.sin(rad);
    return { x1, y1, x2, y2, major: i % 5 === 0 };
  });

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-48 h-48">
        <svg viewBox="0 0 180 180" className="w-full h-full" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="90" cy="90" r="84" fill="none" stroke={color} strokeWidth="1" strokeOpacity="0.12"/>
          <circle cx="90" cy="90" r={r} fill="none" stroke="#f1f5f9" strokeWidth="10"
            strokeDasharray={`${arc} ${circ}`} strokeLinecap="round"/>
          <motion.circle cx="90" cy="90" r={r} fill="none"
            stroke={color} strokeWidth="10" strokeLinecap="round"
            strokeDasharray={`${arc} ${circ}`}
            initial={{ strokeDashoffset: arc }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.8, ease: EASE, delay: 0.3 }}/>
          {ticks.map((t, i) => (
            <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
              stroke={t.major ? "#94a3b8" : "#e2e8f0"} strokeWidth={t.major ? 1.5 : 1} strokeLinecap="round"/>
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 1 }}
            className="font-display font-bold text-5xl leading-none" style={{ color }}>
            {score}
          </motion.span>
          <span className="font-sans text-[11px] text-gray-400 mt-0.5 tracking-wide">out of 100</span>
        </div>
      </div>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.4 }}
        className="flex items-center gap-2 -mt-1">
        <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: color }}/>
        <span className="font-display font-bold text-gray-800">{label}</span>
      </motion.div>
    </div>
  );
}

// ─── Asset Row ────────────────────────────────────────────────────────────────
function AssetRow({ asset, index }: { asset: Asset; index: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-20px" });
  const rc = RC[asset.riskLevel];
  const pos = asset.priceChange24h >= 0;

  return (
    <motion.tr ref={ref}
      initial={{ opacity: 0, x: -12 }}
      animate={inView ? { opacity: 1, x: 0 } : {}}
      transition={{ duration: 0.4, delay: index * 0.05, ease: EASE }}
      className="group border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
      {/* Asset */}
      <td className="py-3.5 pl-5 pr-4">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-mono font-bold text-xs border flex-shrink-0 ${rc.badge}`}>
            {asset.symbol.slice(0, 3)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="font-display font-bold text-gray-900 text-sm truncate max-w-[140px]">{asset.name}</p>
              {asset.isVerified && (
                <span title="Known token" className="text-emerald-500 flex-shrink-0">
                  <svg className="w-3 h-3" viewBox="0 0 12 12" fill="currentColor">
                    <path d="M6 1l1.5 2.8 3.1.4-2.3 2.2.6 3.1L6 8l-2.9 1.5.6-3.1L1.4 4.2l3.1-.4z"/>
                  </svg>
                </span>
              )}
            </div>
            <p className="font-sans text-xs text-gray-400">{asset.symbol} · Solana</p>
          </div>
        </div>
      </td>

      {/* Allocation */}
      <td className="py-3.5 px-4">
        <div className="flex items-center gap-2.5">
          <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <motion.div initial={{ width: 0 }} animate={inView ? { width: `${Math.min(asset.allocation, 100)}%` } : {}}
              transition={{ duration: 0.8, delay: index * 0.05 + 0.2, ease: EASE }}
              className={`h-full rounded-full ${rc.bar}`}/>
          </div>
          <span className="font-mono text-xs font-bold text-gray-700 tabular-nums w-9">{asset.allocation.toFixed(1)}%</span>
        </div>
      </td>

      {/* Value */}
      <td className="py-3.5 px-4">
        <p className="font-mono text-sm font-bold text-gray-800 tabular-nums">{fmtUsd(asset.valueUsd)}</p>
        <p className="font-sans text-[10px] text-gray-400 tabular-nums">{asset.balance.toLocaleString(undefined, { maximumFractionDigits: 4 })} {asset.symbol}</p>
      </td>

      {/* 24h */}
      <td className="py-3.5 px-4">
        {asset.priceUsd > 0 ? (
          <div className="flex items-center gap-2">
            <Sparkline positive={pos}/>
            <span className={`font-mono text-xs font-bold tabular-nums ${pos ? "text-emerald-600" : "text-red-500"}`}>
              {pos ? "+" : ""}{asset.priceChange24h.toFixed(2)}%
            </span>
          </div>
        ) : (
          <span className="font-sans text-xs text-gray-300">No data</span>
        )}
      </td>

      {/* Liquidity */}
      <td className="py-3.5 px-4">
        <p className="font-mono text-xs text-gray-600 tabular-nums">{fmtCompact(asset.liquidity)}</p>
      </td>

      {/* Risk */}
      <td className="py-3.5 px-4">
        <div className="flex items-center gap-2">
          <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${rc.bar}`} style={{ width: `${asset.riskScore}%` }}/>
          </div>
          <span className={`font-sans text-xs font-bold px-2 py-0.5 rounded-full border ${rc.badge}`}>
            {asset.riskLevel}
          </span>
        </div>
      </td>

      {/* Actions */}
      <td className="py-3.5 pl-4 pr-5">
        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {asset.dexUrl ? (
            <a href={asset.dexUrl} target="_blank" rel="noopener noreferrer"
              title="View on DexScreener"
              className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-emerald-100 hover:text-emerald-700 flex items-center justify-center text-gray-500 transition-colors text-xs">
              📈
            </a>
          ) : null}
          <a href="/advisor-page" title="Ask AI"
            className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-blue-100 hover:text-blue-700 flex items-center justify-center text-gray-500 transition-colors text-xs">
            💬
          </a>
        </div>
      </td>
    </motion.tr>
  );
}

// ─── Empty / Not Connected State ──────────────────────────────────────────────
function EmptyState({ onConnect, loading }: { onConnect: () => void; loading: boolean }) {
  const coins = ["◎ SOL", "🪙 USDC", "🎭 NFTs", "⚡ SPL", "🌊 DeFi"];
  return (
    <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
      <motion.div animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
        className="w-20 h-20 bg-purple-100 border border-purple-200 rounded-3xl flex items-center justify-center mb-6 shadow-sm">
        <PhantomLogo size={40}/>
      </motion.div>

      <h2 className="font-display font-bold text-gray-900 text-2xl mb-2">Connect your Phantom wallet</h2>
      <p className="font-sans text-gray-400 text-sm leading-relaxed max-w-sm mb-3">
        Connect to see your real Solana token balances with live prices and risk scores from DexScreener.
      </p>

      {/* Floating coin labels */}
      <div className="flex flex-wrap justify-center gap-2 mb-8">
        {coins.map((c, i) => (
          <motion.span key={c} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1, ease: EASE }}
            className="font-sans text-xs bg-gray-100 text-gray-500 px-3 py-1.5 rounded-full border border-gray-200">
            {c}
          </motion.span>
        ))}
      </div>

      <motion.button onClick={onConnect} disabled={loading}
        whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
        className="flex items-center gap-3 bg-[#AB9FF2] hover:bg-[#9b8ee8] text-white font-sans font-bold text-sm px-8 py-3.5 rounded-2xl transition-colors shadow-sm shadow-purple-200 disabled:opacity-60">
        {loading
          ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"/>
          : <PhantomLogo size={20}/>}
        {loading ? "Connecting…" : "Connect Phantom"}
      </motion.button>

      <p className="font-sans text-xs text-gray-400 mt-4">
        Don't have Phantom?{" "}
        <a href="https://phantom.app" target="_blank" rel="noopener noreferrer"
          className="text-purple-500 hover:underline">Download here →</a>
      </p>
    </div>
  );
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────
function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-100 rounded-lg ${className}`}/>;
}

// ─── Donut Chart (live) ───────────────────────────────────────────────────────
function DonutChart({ assets }: { assets: Asset[] }) {
  const dist: Record<RiskLevel, number> = { Safe:0, Low:0, Medium:0, High:0, Critical:0, Unknown:0 };
  assets.forEach(a => { dist[a.riskLevel] += a.allocation; });

  const segs = [
    { level:"Safe"     as RiskLevel, pct: dist.Safe,     color:"#10b981" },
    { level:"Low"      as RiskLevel, pct: dist.Low,      color:"#14b8a6" },
    { level:"Medium"   as RiskLevel, pct: dist.Medium,   color:"#f59e0b" },
    { level:"High"     as RiskLevel, pct: dist.High,     color:"#f97316" },
    { level:"Critical" as RiskLevel, pct: dist.Critical, color:"#ef4444" },
    { level:"Unknown"  as RiskLevel, pct: dist.Unknown,  color:"#94a3b8" },
  ].filter(s => s.pct > 0.5);

  const r = 48, cx = 60, cy = 60, circ = 2 * Math.PI * r;
  let cumPct = 0;
  const safePct = Math.round(dist.Safe + dist.Low);

  return (
    <div className="flex items-center gap-6">
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
                style={{ transformOrigin:`${cx}px ${cy}px`, transform:`rotate(${rotation}deg)` }}
                initial={{ strokeDashoffset: dashLen }}
                animate={{ strokeDashoffset: 0 }}
                transition={{ duration: 0.9, delay: 0.3 + i * 0.12, ease: EASE }}/>
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display font-bold text-gray-900 text-xl">{safePct}%</span>
          <span className="font-sans text-[9px] text-gray-400 uppercase tracking-wide">safe</span>
        </div>
      </div>

      <div className="flex flex-col gap-2 flex-1 min-w-0">
        {segs.map((seg, i) => (
          <motion.div key={seg.level} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.35 + i * 0.08, ease: EASE }}
            className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: seg.color }}/>
            <span className="font-sans text-xs text-gray-600 flex-1">{seg.level}</span>
            <div className="w-14 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <motion.div initial={{ width: 0 }} animate={{ width: `${seg.pct}%` }}
                transition={{ duration: 0.8, delay: 0.4 + i * 0.08, ease: EASE }}
                className="h-full rounded-full" style={{ background: seg.color }}/>
            </div>
            <span className="font-mono text-xs font-bold text-gray-700 w-7 text-right">{Math.round(seg.pct)}%</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [wallet, setWallet] = useState<WalletState>({ connected: false, publicKey: null, loading: false, error: null });
  const [assets, setAssets] = useState<Asset[]>([]);
  const [fetchingData, setFetchingData] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("valueUsd");
  const [sortAsc, setSortAsc] = useState(false);
  const [filterRisk, setFilterRisk] = useState<RiskLevel | "All">("All");

  // ── Connect Phantom ────────────────────────────────────────────────────────
  const connectPhantom = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const phantom = (window as any).solana;
    if (!phantom?.isPhantom) {
      window.open("https://phantom.app", "_blank");
      return;
    }
    setWallet(w => ({ ...w, loading: true, error: null }));
    try {
      const resp = await phantom.connect();
      const pubkey = resp.publicKey.toString();
      setWallet({ connected: true, publicKey: pubkey, loading: false, error: null });
      await loadWalletData(pubkey);
    } catch (err) {
      setWallet(w => ({ ...w, loading: false, error: "Connection cancelled or failed." }));
    }
  }, []);

  const disconnectWallet = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (window as any).solana?.disconnect().catch(() => {});
    setWallet({ connected: false, publicKey: null, loading: false, error: null });
    setAssets([]);
  }, []);

  // ── Load wallet data + DexScreener prices ────────────────────────────────
  const loadWalletData = useCallback(async (pubkey: string) => {
    setFetchingData(true);
    try {
      // 1. Fetch SOL balance + SPL tokens in parallel
      const [solBalance, tokenAccounts] = await Promise.all([
        getSolBalance(pubkey),
        getTokenAccounts(pubkey),
      ]);

      // 2. Build mint list (include native SOL mint)
      const nativeSolMint = "So11111111111111111111111111111111111111112";
      const mints = [nativeSolMint, ...tokenAccounts.map(t => t.mint)];

      // 3. Fetch DexScreener prices for all mints
      const dexData = await fetchDexScreenerBatch(mints);

      // 4. Build asset list
      const rawAssets: Omit<Asset, "allocation">[] = [];

      // SOL
      const solDex = dexData[nativeSolMint];
      const solPrice = solDex?.priceUsd ?? 0;
      const solRisk = computeRisk(solDex?.liquidity ?? 0, solDex?.volume24h ?? 0, nativeSolMint);
      if (solBalance > 0.001) {
        rawAssets.push({
          id: "sol-native",
          symbol: "SOL",
          name: "Solana",
          chain: "Solana",
          mintAddress: nativeSolMint,
          balance: solBalance,
          decimals: 9,
          priceUsd: solPrice,
          valueUsd: solBalance * solPrice,
          priceChange24h: solDex?.change24h ?? 0,
          liquidity: solDex?.liquidity ?? 0,
          volume24h: solDex?.volume24h ?? 0,
          riskLevel: solRisk.risk,
          riskScore: solRisk.score,
          isVerified: true,
          dexUrl: solDex?.dexUrl,
        });
      }

      // SPL tokens
      for (const token of tokenAccounts) {
        const dex = dexData[token.mint];
        const price = dex?.priceUsd ?? 0;
        const value = token.amount * price;
        // Skip dust (< $0.01 value and no DexScreener data)
        if (value < 0.01 && !dex) continue;
        const risk = computeRisk(dex?.liquidity ?? 0, dex?.volume24h ?? 0, token.mint);

        rawAssets.push({
          id: token.mint,
          symbol: dex?.symbol ?? token.mint.slice(0, 6),
          name: dex?.name ?? `Token ${token.mint.slice(0, 8)}…`,
          chain: "Solana",
          mintAddress: token.mint,
          balance: token.amount,
          decimals: token.decimals,
          priceUsd: price,
          valueUsd: value,
          priceChange24h: dex?.change24h ?? 0,
          liquidity: dex?.liquidity ?? 0,
          volume24h: dex?.volume24h ?? 0,
          riskLevel: risk.risk,
          riskScore: risk.score,
          isVerified: KNOWN_SAFE[token.mint] !== undefined,
          dexUrl: dex?.dexUrl,
        });
      }

      // 5. Compute allocations from total USD value
      const totalVal = rawAssets.reduce((s, a) => s + a.valueUsd, 0);
      const withAlloc: Asset[] = rawAssets.map(a => ({
        ...a,
        allocation: totalVal > 0 ? (a.valueUsd / totalVal) * 100 : 0,
      }));

      // Sort by value descending by default
      withAlloc.sort((a, b) => b.valueUsd - a.valueUsd);
      setAssets(withAlloc);
    } catch (err) {
      console.error("Failed to load wallet data:", err);
      setWallet(w => ({ ...w, error: "Failed to load wallet data. Please try again." }));
    } finally {
      setFetchingData(false);
    }
  }, []);

  // Listen for Phantom account changes
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const phantom = (window as any).solana;
    if (!phantom) return;
    const onAccountChange = (pubkey: { toString: () => string } | null) => {
      if (pubkey) {
        const key = pubkey.toString();
        setWallet(w => ({ ...w, publicKey: key }));
        loadWalletData(key);
      } else {
        disconnectWallet();
      }
    };
    phantom.on("accountChanged", onAccountChange);
    return () => phantom.off?.("accountChanged", onAccountChange);
  }, [loadWalletData, disconnectWallet]);

  // ── Derived stats ──────────────────────────────────────────────────────────
  const totalValue = assets.reduce((s, a) => s + a.valueUsd, 0);
  const healthScore = assets.length
    ? Math.round(assets.reduce((s, a) => s + (a.allocation / 100) * (100 - a.riskScore), 0))
    : 0;

  const sortedAssets = [...assets]
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
          <span className={`font-sans text-xs font-bold uppercase tracking-wide transition-colors ${active ? "text-emerald-600" : "text-gray-400"}`}>{label}</span>
          <span className={active && !sortAsc ? "rotate-180" : ""}>
            <ChevronIcon className={`w-3 h-3 ${active ? "text-emerald-600" : "text-gray-300"}`}/>
          </span>
        </div>
      </th>
    );
  }

  const isConnected = wallet.connected;
  const isLoading = wallet.loading || fetchingData;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-100">
        <div className="max-w-[1360px] mx-auto px-6 h-14 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <ShieldIcon className="w-4 h-4 text-white"/>
            </div>
            <span className="font-display font-bold text-gray-900 text-[15px]">TokenShield</span>
          </a>

          <div className="hidden md:flex items-center gap-1 bg-gray-100 rounded-xl p-1">
            {[
              { label: "Dashboard",  href: "/dashboard" },
              { label: "Analyser",   href: "/analyse"   },
              { label: "FOMO Guard", href: "/fomo"       },
              { label: "AI Advisor", href: "/advisor-page" },
            ].map(l => (
              <a key={l.href} href={l.href}
                className={`font-sans text-xs font-medium px-3 py-1.5 rounded-lg transition-all ${
                  l.href === "/dashboard" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}>{l.label}</a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {isConnected && wallet.publicKey ? (
              <div className="flex items-center gap-2.5">
                <div className="hidden sm:flex items-center gap-1.5 bg-purple-50 border border-purple-200 rounded-full px-3 py-1.5">
                  <PhantomLogo size={14}/>
                  <span className="font-mono text-xs text-purple-700">{shortKey(wallet.publicKey)}</span>
                </div>
                <button onClick={disconnectWallet}
                  className="font-sans text-xs text-gray-400 hover:text-gray-700 border border-gray-200 hover:border-gray-300 px-3 py-1.5 rounded-full transition-colors">
                  Disconnect
                </button>
              </div>
            ) : (
              <button onClick={connectPhantom} disabled={wallet.loading}
                className="flex items-center gap-2 font-sans text-xs font-bold bg-[#AB9FF2] hover:bg-[#9b8ee8] text-white px-4 py-2 rounded-full transition-colors disabled:opacity-60">
                <PhantomLogo size={14}/>
                {wallet.loading ? "Connecting…" : "Connect Wallet"}
              </button>
            )}
          </div>
        </div>
      </nav>

      <div className="max-w-[1360px] mx-auto px-6 py-8">

        {/* Error banner */}
        <AnimatePresence>
          {wallet.error && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mb-4 bg-red-50 border border-red-200 text-red-700 font-sans text-sm px-4 py-3 rounded-xl flex items-center justify-between">
              <span>⚠ {wallet.error}</span>
              <button onClick={() => setWallet(w => ({ ...w, error: null }))} className="text-red-400 hover:text-red-600">✕</button>
            </motion.div>
          )}
        </AnimatePresence>

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
                {isConnected
                  ? isLoading
                    ? "Loading your wallet data…"
                    : `${assets.length} assets tracked · Total value `
                  : "Connect your Phantom wallet to see live data"}
                {isConnected && !isLoading && assets.length > 0 && (
                  <span className="font-semibold text-gray-700">{fmtUsd(totalValue)}</span>
                )}
              </p>
            </div>
            {isConnected && (
              <div className="flex items-center gap-2">
                <button onClick={() => wallet.publicKey && loadWalletData(wallet.publicKey)}
                  disabled={isLoading}
                  className="flex items-center gap-1.5 font-sans text-xs font-medium border border-gray-200 hover:bg-gray-50 text-gray-600 px-3 py-2 rounded-xl transition-colors disabled:opacity-50">
                  🔄 {isLoading ? "Refreshing…" : "Refresh"}
                </button>
                <a href="/advisor-page"
                  className="flex items-center gap-1.5 font-sans text-xs font-medium bg-gray-900 hover:bg-gray-800 text-white px-3 py-2 rounded-xl transition-colors">
                  💬 Ask AI Advisor
                </a>
              </div>
            )}
          </div>
        </motion.div>

        {/* ── NOT CONNECTED ── */}
        {!isConnected && (
          <div className="bg-white border border-gray-100 rounded-2xl">
            <EmptyState onConnect={connectPhantom} loading={wallet.loading}/>
          </div>
        )}

        {/* ── CONNECTED + LOADING ── */}
        {isConnected && isLoading && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {[1,2,3].map(i => (
                <div key={i} className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
                  <Skeleton className="h-4 w-32"/>
                  <Skeleton className="h-36 w-full"/>
                  <Skeleton className="h-4 w-48"/>
                </div>
              ))}
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-3">
              {[1,2,3,4].map(i => <Skeleton key={i} className="h-12 w-full"/>)}
            </div>
          </div>
        )}

        {/* ── CONNECTED + DATA ── */}
        {isConnected && !isLoading && assets.length > 0 && (
          <>
            {/* Top grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
              {/* Health */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08, ease: EASE }}
                className="bg-white border border-gray-100 rounded-2xl p-6 flex flex-col items-center gap-2">
                <p className="font-display font-bold text-gray-800 text-sm self-start">Wallet health score</p>
                <HealthDial score={healthScore}/>
                <p className="font-sans text-xs text-gray-400 text-center leading-relaxed max-w-[180px]">
                  Weighted by allocation × inverse risk across all positions
                </p>
              </motion.div>

              {/* Risk distribution */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14, ease: EASE }}
                className="bg-white border border-gray-100 rounded-2xl p-6">
                <p className="font-display font-bold text-gray-800 text-sm mb-5">Risk distribution</p>
                <DonutChart assets={assets}/>
              </motion.div>

              {/* Key metrics */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, ease: EASE }}
                className="bg-white border border-gray-100 rounded-2xl p-6">
                <p className="font-display font-bold text-gray-800 text-sm mb-5">Key metrics</p>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: "Total value",   value: fmtUsd(totalValue),          color: "text-gray-900" },
                    { label: "Health score",  value: `${healthScore}/100`,         color: healthScore >= 70 ? "text-emerald-600" : "text-amber-600" },
                    { label: "Assets",        value: `${assets.length}`,           color: "text-gray-900" },
                    { label: "Verified",      value: `${assets.filter(a=>a.isVerified).length}/${assets.length}`, color: "text-emerald-600" },
                  ].map(m => (
                    <div key={m.label} className="flex flex-col gap-0.5">
                      <span className="font-sans text-xs text-gray-400">{m.label}</span>
                      <span className={`font-display font-bold text-xl leading-none ${m.color}`}>{m.value}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                  {assets.length > 0 && (() => {
                    const best = [...assets].sort((a,b)=>b.priceChange24h-a.priceChange24h)[0];
                    const worst = [...assets].sort((a,b)=>a.priceChange24h-b.priceChange24h)[0];
                    const riskiest = [...assets].sort((a,b)=>b.riskScore-a.riskScore)[0];
                    return (
                      <>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-400">Best 24h</span>
                          <span className="font-mono font-bold text-emerald-600">{best.symbol} +{best.priceChange24h.toFixed(2)}%</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-400">Worst 24h</span>
                          <span className="font-mono font-bold text-red-500">{worst.symbol} {worst.priceChange24h.toFixed(2)}%</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-400">Highest risk</span>
                          <span className="font-sans font-bold text-orange-600">{riskiest.symbol} — {riskiest.riskLevel}</span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </motion.div>
            </div>

            {/* Asset Table */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28, ease: EASE }}
              className="bg-white border border-gray-100 rounded-2xl overflow-hidden mb-5">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <div>
                  <h2 className="font-display font-bold text-gray-900 text-sm">Portfolio positions</h2>
                  <p className="font-sans text-xs text-gray-400 mt-0.5">Live prices from DexScreener · Click headers to sort</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-sans text-xs text-gray-400">Filter:</span>
                  {(["All","Safe","Low","Medium","High","Critical","Unknown"] as const).map(f => (
                    <button key={f} onClick={() => setFilterRisk(f)}
                      className={`font-sans text-xs px-2.5 py-1 rounded-full border transition-all ${
                        filterRisk === f
                          ? f === "All" ? "bg-gray-900 text-white border-gray-900"
                            : `${RC[f as RiskLevel]?.badge ?? ""} border-current font-bold`
                          : "border-gray-200 text-gray-400 hover:border-gray-300"
                      }`}>{f}</button>
                  ))}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50/80 border-b border-gray-100">
                    <tr>
                      <th className="py-3 pl-5 pr-4 text-left font-sans text-xs font-bold uppercase tracking-wide text-gray-400">Asset</th>
                      <SortTh label="Allocation" sKey="allocation"/>
                      <SortTh label="Value"      sKey="valueUsd"/>
                      <SortTh label="24h"        sKey="priceChange24h"/>
                      <th className="py-3 px-4 text-left font-sans text-xs font-bold uppercase tracking-wide text-gray-400">Liquidity</th>
                      <SortTh label="Risk"       sKey="riskScore"/>
                      <th className="py-3 pl-4 pr-5 text-left font-sans text-xs font-bold uppercase tracking-wide text-gray-400">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedAssets.map((asset, i) => <AssetRow key={asset.id} asset={asset} index={i}/>)}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50/40">
                <span className="font-sans text-xs text-gray-400">{sortedAssets.length} positions shown</span>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"/>
                  <span className="font-sans text-xs text-gray-400">Live · DexScreener</span>
                </div>
              </div>
            </motion.div>
          </>
        )}

        {/* ── CONNECTED + EMPTY ── */}
        {isConnected && !isLoading && assets.length === 0 && (
          <div className="bg-white border border-gray-100 rounded-2xl py-16 flex flex-col items-center gap-4">
            <span className="text-4xl">🪙</span>
            <p className="font-display font-bold text-gray-800">No tokens found</p>
            <p className="font-sans text-sm text-gray-400 text-center max-w-sm">
              This wallet appears to have no Solana tokens with a non-zero balance, or all balances are dust.
            </p>
            <button onClick={() => wallet.publicKey && loadWalletData(wallet.publicKey)}
              className="font-sans text-xs font-medium border border-gray-200 hover:bg-gray-50 text-gray-600 px-4 py-2 rounded-xl transition-colors">
              🔄 Retry
            </button>
          </div>
        )}

        {/* Disclaimer */}
        <p className="font-sans text-xs text-gray-400 text-center mt-6">
          Prices sourced from DexScreener. Risk scores are automated estimates, not financial advice. Always verify independently.
        </p>
      </div>
    </div>
  );
}