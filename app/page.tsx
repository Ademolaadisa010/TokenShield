"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView, useScroll, useTransform, AnimatePresence } from "framer-motion";
import Link from "next/link";

// ─── Animation Helpers ────────────────────────────────────────────────────────

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, delay: i * 0.12, ease: EASE },
  }),
};

const fadeIn = {
  hidden: { opacity: 0 },
  visible: (i = 0) => ({
    opacity: 1,
    transition: { duration: 0.6, delay: i * 0.1, ease: "easeOut" as const },
  }),
};

const slideLeft = {
  hidden: { opacity: 0, x: -60 },
  visible: (i = 0) => ({
    opacity: 1,
    x: 0,
    transition: { duration: 0.7, delay: i * 0.1, ease: EASE },
  }),
};

const slideRight = {
  hidden: { opacity: 0, x: 60 },
  visible: (i = 0) => ({
    opacity: 1,
    x: 0,
    transition: { duration: 0.7, delay: i * 0.1, ease: EASE },
  }),
};

// ─── Section Wrapper that triggers animations when in view ────────────────────

function AnimSection({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <div ref={ref} data-visible={isInView} className={className}>
      {children}
    </div>
  );
}

// ─── Animated Counter ─────────────────────────────────────────────────────────

function Counter({ to, suffix = "" }: { to: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const step = Math.ceil(to / 60);
    const timer = setInterval(() => {
      start += step;
      if (start >= to) { setCount(to); clearInterval(timer); }
      else setCount(start);
    }, 16);
    return () => clearInterval(timer);
  }, [inView, to]);

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

// ─── Floating Badge ────────────────────────────────────────────────────────────

function FloatingBadge({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease: EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ─── Shield Icon SVG ─────────────────────────────────────────────────────────

function ShieldIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

// ─── Nav ──────────────────────────────────────────────────────────────────────

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <motion.nav
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: EASE }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-white/90 backdrop-blur-lg shadow-sm border-b border-gray-100" : "bg-transparent"
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
            <ShieldIcon className="w-4 h-4 text-white" />
          </div>
          <span className="font-display font-bold text-gray-900 text-lg tracking-tight">TokenShield</span>
        </div>
        <div className="hidden md:flex items-center gap-8">
          {["Features", "How it works", "Safety Score", "Pricing"].map((item) => (
            <a key={item} href="#howitworks" className="font-sans text-sm text-gray-500 hover:text-gray-900 transition-colors duration-200">
              {item}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <motion.a
            href="/dashboard"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="font-sans text-sm font-semibold bg-emerald-600 text-white px-4 py-2 rounded-full hover:bg-emerald-700 transition-colors"
          >
            Dashboard
          </motion.a>
        </div>
      </div>
    </motion.nav>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero() {
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 500], [0, 120]);
  const opacity = useTransform(scrollY, [0, 400], [1, 0]);

  return (
    <section className="relative min-h-screen bg-white flex flex-col items-center justify-center overflow-hidden pt-20">
      {/* Subtle grid background */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      {/* Radial glow */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.2, ease: "easeOut" as const }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full"
        style={{ background: "radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)" }}
      />

      <motion.div style={{ y, opacity }} className="relative z-10 text-center px-6 max-w-5xl mx-auto">
        {/* Tag */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-full px-4 py-1.5 mb-8"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-sans text-xs font-semibold text-emerald-700 tracking-wide uppercase">AI-Powered Crypto Safety</span>
        </motion.div>

        {/* Headline */}
        <div className="overflow-hidden mb-6">
          <motion.h1
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: EASE }}
            className="font-display font-bold text-gray-900 leading-[1.1] tracking-tight"
            style={{ fontSize: "clamp(2.8rem, 7vw, 5.5rem)" }}
          >
            Stop losing money{" "}
            <br />
            <span className="text-emerald-600">to bad trades.</span>
          </motion.h1>
        </div>

        {/* Sub */}
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4, ease: EASE }}
          className="font-sans text-lg md:text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed mb-10"
        >
          TokenShield analyzes any crypto token for risk — scams, low liquidity, honeypots, and emotional FOMO — before you press buy.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.55 }}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center"
        >
          <motion.a
            href="/analyse"
            whileHover={{ scale: 1.04, boxShadow: "0 20px 40px rgba(16,185,129,0.25)" }}
            whileTap={{ scale: 0.97 }}
            className="font-sans font-bold text-base bg-emerald-600 text-white px-8 py-4 rounded-2xl hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-100"
          >
            Analyze a token for free →
          </motion.a>
          <motion.a
            href="/dashboard"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="font-sans font-medium text-base text-gray-600 border border-gray-200 px-8 py-4 rounded-2xl hover:border-gray-300 hover:bg-gray-50 transition-all"
          >
            Dashboard
          </motion.a>
        </motion.div>

        {/* Social proof row */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.9 }}
          className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-6 text-sm text-gray-400"
        >
          <div className="flex -space-x-2">
            {["#10b981","#3b82f6","#f59e0b","#ef4444","#8b5cf6"].map((c, i) => (
              <div key={i} className="w-7 h-7 rounded-full border-2 border-white" style={{ background: c }} />
            ))}
          </div>
          <span className="font-sans"><span className="font-semibold text-gray-700">12,000+</span> traders protected this month</span>
          <span className="hidden sm:block text-gray-200">|</span>
          <span className="font-sans"><span className="font-semibold text-gray-700">$4.2M+</span> in losses prevented</span>
        </motion.div>
      </motion.div>

      {/* Floating cards */}
      <FloatingBadge delay={1.0} className="absolute left-[5%] top-[30%] hidden lg:block">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-3 flex items-center gap-3 w-52">
          <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
            <span className="text-red-500 text-base">🚨</span>
          </div>
          <div>
            <p className="font-sans text-xs font-semibold text-gray-800">Honeypot Detected</p>
            <p className="font-sans text-xs text-gray-400">RUGTOKEN — Critical</p>
          </div>
        </div>
      </FloatingBadge>

      <FloatingBadge delay={1.15} className="absolute right-[5%] top-[28%] hidden lg:block">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-3 flex items-center gap-3 w-52">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
            <span className="text-emerald-500 text-base">✓</span>
          </div>
          <div>
            <p className="font-sans text-xs font-semibold text-gray-800">Safe to trade</p>
            <p className="font-sans text-xs text-gray-400">ETH — Risk Score 12</p>
          </div>
        </div>
      </FloatingBadge>

      <FloatingBadge delay={1.3} className="absolute left-[8%] bottom-[20%] hidden lg:block">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-3 flex items-center gap-3 w-56">
          <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
            <span className="text-amber-500 text-base">⚠</span>
          </div>
          <div>
            <p className="font-sans text-xs font-semibold text-gray-800">FOMO detected</p>
            <p className="font-sans text-xs text-gray-400">5-min cooldown started</p>
          </div>
        </div>
      </FloatingBadge>

      <FloatingBadge delay={1.45} className="absolute right-[6%] bottom-[22%] hidden lg:block">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-3 flex items-center gap-3 w-52">
          <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
            <span className="text-blue-500 text-base">💧</span>
          </div>
          <div>
            <p className="font-sans text-xs font-semibold text-gray-800">Low liquidity</p>
            <p className="font-sans text-xs text-gray-400">$12K pool — avoid</p>
          </div>
        </div>
      </FloatingBadge>

      {/* Scroll cue */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2 }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" as const }}
          className="w-5 h-8 border-2 border-gray-300 rounded-full flex items-start justify-center pt-1"
        >
          <div className="w-1 h-2 bg-gray-400 rounded-full" />
        </motion.div>
      </motion.div>
    </section>
  );
}

// ─── Stats ────────────────────────────────────────────────────────────────────

function Stats() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  const stats = [
    { label: "Tokens analyzed", value: 2800000, suffix: "+" },
    { label: "Scams blocked", value: 14300, suffix: "+" },
    { label: "Losses prevented", value: 4200000, suffix: "$+" },
    { label: "Accuracy rate", value: 97, suffix: "%" },
  ];

  return (
    <section ref={ref} className="bg-gray-950 py-20 px-6">
      <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 30 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: i * 0.1, ease: EASE }}
            className="text-center"
          >
            <div className="font-display font-bold text-white text-3xl md:text-4xl mb-1">
              {inView ? <Counter to={s.value} suffix={s.suffix} /> : "0"}
            </div>
            <div className="font-sans text-sm text-gray-400">{s.label}</div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

// ─── Features ─────────────────────────────────────────────────────────────────

const features = [
  {
    icon: "🪙",
    title: "Token Risk Analysis",
    desc: "Deep on-chain analysis of liquidity strength, trading volume, volatility, and contract safety signals — all in seconds.",
    color: "bg-emerald-50 border-emerald-100",
    accent: "text-emerald-600",
  },
  {
    icon: "🚫",
    title: "\"Why can't I buy this?\" Explainer",
    desc: "Failed a trade? TokenShield explains low liquidity issues, high slippage, honeypot flags, and hidden fees in plain English.",
    color: "bg-red-50 border-red-100",
    accent: "text-red-500",
  },
  {
    icon: "📊",
    title: "Safety Dashboard",
    desc: "See your full portfolio risk level, percentage of risky assets, diversification warnings, and overall wallet health score.",
    color: "bg-blue-50 border-blue-100",
    accent: "text-blue-600",
  },
  {
    icon: "🧠",
    title: "AI Trade Advisor",
    desc: "Before buying, AI evaluates your decision — explains risks simply, detects emotional/FOMO trading, and suggests safer alternatives.",
    color: "bg-purple-50 border-purple-100",
    accent: "text-purple-600",
  },
  {
    icon: "⏳",
    title: "Anti-FOMO Protection",
    desc: "Rushing into a trade? TokenShield flags emotional signals, triggers a cooldown period, and helps you think more rationally.",
    color: "bg-amber-50 border-amber-100",
    accent: "text-amber-600",
  },
  {
    icon: "🔗",
    title: "Web3 Native",
    desc: "Connect MetaMask, analyze real on-chain token data, track liquidity pools and price impact live — no manual input needed.",
    color: "bg-teal-50 border-teal-100",
    accent: "text-teal-600",
  },
];

function Features() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <section className="bg-white py-28 px-6" ref={ref}>
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial="hidden"
          animate={inView ? "visible" : "hidden"}
          variants={fadeUp}
          className="text-center mb-16"
        >
          <p className="font-sans text-xs font-bold text-emerald-600 tracking-widest uppercase mb-3">What it does</p>
          <h2 className="font-display font-bold text-gray-900 text-4xl md:text-5xl leading-tight tracking-tight mb-4">
            Every layer of protection<br />before you trade
          </h2>
          <p className="font-sans text-gray-400 text-lg max-w-xl mx-auto">
            TokenShield wraps your trades in a complete safety net — from contract audits to emotional coaching.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              custom={i}
              initial="hidden"
              animate={inView ? "visible" : "hidden"}
              variants={fadeUp}
              whileHover={{ y: -6, transition: { duration: 0.25 } }}
              className={`border rounded-3xl p-7 cursor-default ${f.color}`}
            >
              <div className="text-3xl mb-4">{f.icon}</div>
              <h3 className={`font-display font-bold text-base mb-2 ${f.accent}`}>{f.title}</h3>
              <p className="font-sans text-sm text-gray-500 leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── How It Works ─────────────────────────────────────────────────────────────

const steps = [
  { num: "01", title: "Connect your wallet", desc: "Link MetaMask or paste any token address. No signup required for a quick scan." },
  { num: "02", title: "AI scans the token", desc: "TokenShield pulls on-chain data — liquidity, contracts, holder patterns, and price history." },
  { num: "03", title: "Get your risk report", desc: "Receive a plain-language risk score with specific warnings and red flags explained simply." },
  { num: "04", title: "Trade with confidence", desc: "Use the AI advisor to confirm your decision, or let FOMO Guard protect you from impulse trades." },
];

function HowItWorks() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <section id="howitworks" className="bg-gray-50 py-28 px-6" ref={ref}>
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial="hidden"
          animate={inView ? "visible" : "hidden"}
          variants={fadeUp}
          className="text-center mb-16"
        >
          <p className="font-sans text-xs font-bold text-emerald-600 tracking-widest uppercase mb-3">How it works</p>
          <h2 className="font-display font-bold text-gray-900 text-4xl md:text-5xl tracking-tight leading-tight">
            Four steps to safer trades
          </h2>
        </motion.div>

        <div className="relative">
          {/* Connector line */}
          <div className="hidden md:block absolute top-10 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-200 to-transparent" />

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {steps.map((step, i) => (
              <motion.div
                key={step.num}
                custom={i}
                initial="hidden"
                animate={inView ? "visible" : "hidden"}
                variants={fadeUp}
                className="relative flex flex-col items-center text-center"
              >
                <motion.div
                  whileHover={{ scale: 1.1, rotate: 3 }}
                  className="w-16 h-16 rounded-2xl bg-white border border-gray-200 shadow-sm flex items-center justify-center mb-5 relative z-10"
                >
                  <span className="font-mono text-sm font-bold text-emerald-600">{step.num}</span>
                </motion.div>
                <h3 className="font-display font-bold text-gray-900 text-base mb-2">{step.title}</h3>
                <p className="font-sans text-sm text-gray-400 leading-relaxed">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Risk Score Demo ──────────────────────────────────────────────────────────

function RiskScoreDemo() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const [active, setActive] = useState(0);

  const tokens = [
    {
      symbol: "BTC", name: "Bitcoin", risk: "Low", score: 8, color: "emerald",
      metrics: [
        { label: "Liquidity", val: 98 },
        { label: "Contract safety", val: 100 },
        { label: "Volatility risk", val: 22 },
        { label: "Volume health", val: 95 },
      ],
      verdict: "Bitcoin remains the safest crypto asset. Massive liquidity, no contract risks, fully transparent on-chain.",
    },
    {
      symbol: "SOL", name: "Solana", risk: "Medium", score: 44, color: "amber",
      metrics: [
        { label: "Liquidity", val: 72 },
        { label: "Contract safety", val: 80 },
        { label: "Volatility risk", val: 58 },
        { label: "Volume health", val: 68 },
      ],
      verdict: "Solana is legitimate but volatile. Network outages and high beta make it a medium-risk hold.",
    },
    {
      symbol: "SAFEMOON", name: "SafeMoon", risk: "Critical", score: 91, color: "red",
      metrics: [
        { label: "Liquidity", val: 9 },
        { label: "Contract safety", val: 12 },
        { label: "Volatility risk", val: 97 },
        { label: "Volume health", val: 6 },
      ],
      verdict: "🚨 Honeypot signals detected. High sell tax, locked liquidity, and rug-pull patterns identified.",
    },
  ];

  const riskColors: Record<string, string> = {
    Low: "bg-emerald-100 text-emerald-700",
    Medium: "bg-amber-100 text-amber-700",
    Critical: "bg-red-100 text-red-700",
  };

  const barColors: Record<string, string> = {
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
    red: "bg-red-500",
  };

  const t = tokens[active];

  return (
    <section className="bg-white py-28 px-6" ref={ref}>
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial="hidden"
          animate={inView ? "visible" : "hidden"}
          variants={fadeUp}
          className="text-center mb-14"
        >
          <p className="font-sans text-xs font-bold text-emerald-600 tracking-widest uppercase mb-3">Live demo</p>
          <h2 className="font-display font-bold text-gray-900 text-4xl md:text-5xl tracking-tight leading-tight">
            See the risk score<br />in action
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Token picker */}
          <motion.div
            initial="hidden"
            animate={inView ? "visible" : "hidden"}
            variants={slideLeft}
            className="flex flex-col gap-3"
          >
            {tokens.map((tok, i) => (
              <motion.button
                key={tok.symbol}
                onClick={() => setActive(i)}
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.98 }}
                className={`flex items-center gap-4 p-5 rounded-2xl border text-left transition-all duration-200 ${
                  active === i
                    ? "border-emerald-300 bg-emerald-50 shadow-sm"
                    : "border-gray-100 bg-gray-50 hover:border-gray-200"
                }`}
              >
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-mono text-xs font-bold ${
                  active === i ? "bg-emerald-600 text-white" : "bg-white text-gray-600 border border-gray-200"
                }`}>
                  {tok.symbol.slice(0, 3)}
                </div>
                <div className="flex-1">
                  <div className="font-display font-bold text-gray-900 text-sm">{tok.name}</div>
                  <div className="font-sans text-xs text-gray-400">{tok.symbol}</div>
                </div>
                <span className={`font-sans text-xs font-semibold px-3 py-1 rounded-full ${riskColors[tok.risk]}`}>
                  {tok.risk}
                </span>
              </motion.button>
            ))}
          </motion.div>

          {/* Result card */}
          <motion.div
            initial="hidden"
            animate={inView ? "visible" : "hidden"}
            variants={slideRight}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4, ease: EASE }}
                className="bg-white border border-gray-100 rounded-3xl p-7 shadow-lg shadow-gray-50"
              >
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <div className="font-display font-bold text-gray-900 text-xl">{t.name}</div>
                    <div className="font-mono text-xs text-gray-400 mt-0.5">{t.symbol}</div>
                  </div>
                  <div className="text-right">
                    <div className={`font-display font-bold text-3xl ${
                      t.color === "emerald" ? "text-emerald-600" : t.color === "amber" ? "text-amber-500" : "text-red-500"
                    }`}>
                      {t.score}<span className="text-lg text-gray-300">/100</span>
                    </div>
                    <div className="font-sans text-xs text-gray-400">risk score</div>
                  </div>
                </div>

                <div className="flex flex-col gap-4 mb-6">
                  {t.metrics.map((m) => (
                    <div key={m.label}>
                      <div className="flex justify-between mb-1.5">
                        <span className="font-sans text-xs text-gray-500">{m.label}</span>
                        <span className="font-mono text-xs font-bold text-gray-700">{m.val}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${m.val}%` }}
                          transition={{ duration: 0.8, ease: EASE }}
                          className={`h-full rounded-full ${barColors[t.color]}`}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className={`rounded-xl p-4 text-sm font-sans leading-relaxed ${
                  t.color === "emerald" ? "bg-emerald-50 text-emerald-800" :
                  t.color === "amber" ? "bg-amber-50 text-amber-800" :
                  "bg-red-50 text-red-800"
                }`}>
                  {t.verdict}
                </div>
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ─── Testimonials ─────────────────────────────────────────────────────────────

const testimonials = [
  {
    quote: "TokenShield flagged a honeypot I was about to buy. Saved me $3,000 in 30 seconds. Nothing else caught it.",
    name: "Alex K.",
    role: "DeFi trader",
    avatar: "#10b981",
  },
  {
    quote: "The FOMO Guard is genius. I was about to panic-buy a SHIB clone at 3am — the cooldown made me rethink and I dodged a rug pull.",
    name: "Priya M.",
    role: "Crypto beginner",
    avatar: "#6366f1",
  },
  {
    quote: "Finally a safety tool that actually explains things in plain English. I know exactly WHY something is risky now.",
    name: "Marcus T.",
    role: "Portfolio manager",
    avatar: "#f59e0b",
  },
];

function Testimonials() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <section className="bg-gray-50 py-28 px-6" ref={ref}>
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial="hidden"
          animate={inView ? "visible" : "hidden"}
          variants={fadeUp}
          className="text-center mb-14"
        >
          <p className="font-sans text-xs font-bold text-emerald-600 tracking-widest uppercase mb-3">Traders say</p>
          <h2 className="font-display font-bold text-gray-900 text-4xl md:text-5xl tracking-tight">
            Real protection, real stories
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.name}
              custom={i}
              initial="hidden"
              animate={inView ? "visible" : "hidden"}
              variants={fadeUp}
              whileHover={{ y: -5, transition: { duration: 0.25 } }}
              className="bg-white border border-gray-100 rounded-3xl p-7"
            >
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, j) => (
                  <span key={j} className="text-amber-400 text-sm">★</span>
                ))}
              </div>
              <p className="font-sans text-gray-600 text-sm leading-relaxed mb-6">"{t.quote}"</p>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: t.avatar }}>
                  {t.name[0]}
                </div>
                <div>
                  <div className="font-sans font-semibold text-gray-900 text-sm">{t.name}</div>
                  <div className="font-sans text-gray-400 text-xs">{t.role}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── CTA ──────────────────────────────────────────────────────────────────────

function CTA() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <section className="bg-white py-28 px-6" ref={ref}>
      <div className="max-w-3xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 30 }}
          animate={inView ? { opacity: 1, scale: 1, y: 0 } : {}}
          transition={{ duration: 0.8, ease: EASE }}
          className="bg-gray-950 rounded-[2.5rem] px-10 py-16 relative overflow-hidden"
        >
          {/* Glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full"
            style={{ background: "radial-gradient(circle, rgba(16,185,129,0.15) 0%, transparent 70%)" }} />

          <div className="relative z-10">
            <div className="w-14 h-14 bg-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <ShieldIcon className="w-7 h-7 text-white" />
            </div>
            <h2 className="font-display font-bold text-white text-4xl md:text-5xl tracking-tight mb-4 leading-tight">
              Your next trade<br />deserves a safety check
            </h2>
            <p className="font-sans text-gray-400 text-lg mb-8 max-w-lg mx-auto">
              Analyze any token for free. No wallet connection required for your first scan.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <motion.a
                href="/dashboard"
                whileHover={{ scale: 1.04, boxShadow: "0 20px 40px rgba(16,185,129,0.3)" }}
                whileTap={{ scale: 0.97 }}
                className="font-sans font-bold text-base bg-emerald-500 text-white px-8 py-4 rounded-xl hover:bg-emerald-400 transition-colors"
              >
                Dashboard
              </motion.a>
              <motion.a
                href="/analyse"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="font-sans font-medium text-base text-gray-400 border border-gray-700 px-8 py-4 rounded-xl hover:border-gray-500 hover:text-gray-200 transition-all"
              >
                Analyse for free
              </motion.a>
            </div>
            <p className="font-sans text-xs text-gray-600 mt-5">Not financial advice. Always DYOR.</p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="bg-white border-t border-gray-100 py-10 px-6">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-emerald-600 rounded-md flex items-center justify-center">
            <ShieldIcon className="w-3 h-3 text-white" />
          </div>
          <span className="font-display font-bold text-gray-900 text-sm">TokenShield</span>
          <span className="font-sans text-xs text-gray-400 ml-2">© 2025</span>
        </div>
        <div className="flex gap-6">
          {["Privacy", "Terms", "Docs", "Twitter", "Discord"].map((l) => (
            <a key={l} href="#" className="font-sans text-xs text-gray-400 hover:text-gray-700 transition-colors">
              {l}
            </a>
          ))}
        </div>
        <p className="font-sans text-xs text-gray-300">Not financial advice. Use at your own risk.</p>
      </div>
    </footer>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  return (
    <div className="bg-white text-gray-900 overflow-x-hidden">
      <Nav />
      <Hero />
      <Stats />
      <Features />
      <HowItWorks />
      <RiskScoreDemo />
      <Testimonials />
      <CTA />
      <Footer />
    </div>
  );
}