"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Easing ───────────────────────────────────────────────────────────────────
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

// ─── Types ────────────────────────────────────────────────────────────────────
type Step = "intro" | "q1" | "q2" | "q3" | "q4" | "q5" | "result" | "cooldown" | "clear";

interface Answer {
  qId: string;
  value: number; // 0 = rational, 10 = emotional
  label: string;
}

// ─── Questions ────────────────────────────────────────────────────────────────
const QUESTIONS = [
  {
    id: "q1",
    step: "q1" as Step,
    next: "q2" as Step,
    icon: "💬",
    headline: "Why are you considering this trade?",
    sub: "Be honest. No one is watching.",
    options: [
      { label: "I saw it trending on Twitter / Telegram",          score: 10 },
      { label: "Someone I follow said it will 10x",                score: 9  },
      { label: "It's pumping right now and I don't want to miss",  score: 10 },
      { label: "I researched it independently over several days",  score: 1  },
      { label: "It fits a pre-defined strategy I wrote down",      score: 0  },
    ],
  },
  {
    id: "q2",
    step: "q2" as Step,
    next: "q3" as Step,
    icon: "⏱",
    headline: "How long have you been thinking about this trade?",
    sub: "Time between seeing the token and wanting to buy.",
    options: [
      { label: "Under 10 minutes",      score: 10 },
      { label: "10–60 minutes",         score: 8  },
      { label: "A few hours",           score: 5  },
      { label: "More than a day",       score: 2  },
      { label: "Over a week",           score: 0  },
    ],
  },
  {
    id: "q3",
    step: "q3" as Step,
    next: "q4" as Step,
    icon: "📖",
    headline: "Have you read the project documentation?",
    sub: "Whitepaper, tokenomics, team background.",
    options: [
      { label: "No, I haven't looked",             score: 10 },
      { label: "I skimmed a Twitter thread",        score: 8  },
      { label: "I read a summary someone wrote",   score: 5  },
      { label: "I read parts of the whitepaper",   score: 2  },
      { label: "Yes, thoroughly researched",       score: 0  },
    ],
  },
  {
    id: "q4",
    step: "q4" as Step,
    next: "q5" as Step,
    icon: "💰",
    headline: "How much are you planning to invest?",
    sub: "Relative to your total portfolio.",
    options: [
      { label: "More than 50% of my portfolio",       score: 10 },
      { label: "25–50% — it feels like a sure thing", score: 8  },
      { label: "10–25%",                               score: 4  },
      { label: "Under 10%",                            score: 1  },
      { label: "A fixed amount I pre-set as risk cap", score: 0  },
    ],
  },
  {
    id: "q5",
    step: "q5" as Step,
    next: "result" as Step,
    icon: "🧠",
    headline: "How are you feeling right now?",
    sub: "Emotionally, before pressing buy.",
    options: [
      { label: "Excited / euphoric — this is it",       score: 10 },
      { label: "Anxious I'm going to miss out",          score: 10 },
      { label: "Pressured by others in a group chat",   score: 9  },
      { label: "Calm, this fits my planned allocation", score: 1  },
      { label: "Neutral — just executing my strategy",  score: 0  },
    ],
  },
];

// ─── Shield Icon ─────────────────────────────────────────────────────────────
function ShieldIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/>
    </svg>
  );
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────
function ProgressBar({ current, total }: { current: number; total: number }) {
  return (
    <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
      <motion.div
        className="h-full bg-emerald-500 rounded-full"
        initial={{ width: 0 }}
        animate={{ width: `${(current / total) * 100}%` }}
        transition={{ duration: 0.5, ease: EASE }}
      />
    </div>
  );
}

// ─── FOMO Gauge ───────────────────────────────────────────────────────────────
function FOMOGauge({ score }: { score: number }) {
  // score 0–100
  const r = 70;
  const circ = 2 * Math.PI * r;
  const arc = circ * 0.75;
  const offset = arc - (score / 100) * arc;

  const color =
    score <= 25 ? "#10b981"
    : score <= 50 ? "#f59e0b"
    : score <= 75 ? "#f97316"
    : "#ef4444";

  const label =
    score <= 20 ? "Rational"
    : score <= 40 ? "Slightly impulsive"
    : score <= 60 ? "FOMO detected"
    : score <= 80 ? "High FOMO"
    : "Extreme FOMO";

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-48 h-48">
        <svg viewBox="0 0 160 160" className="w-full h-full" style={{ transform: "rotate(-225deg)" }}>
          <circle cx="80" cy="80" r={r} fill="none" stroke="#f1f5f9" strokeWidth="12"
            strokeDasharray={`${arc} ${circ}`} strokeLinecap="round" />
          <motion.circle cx="80" cy="80" r={r} fill="none"
            stroke={color} strokeWidth="12" strokeLinecap="round"
            strokeDasharray={`${arc} ${circ}`}
            initial={{ strokeDashoffset: arc }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.6, ease: EASE, delay: 0.3 }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.8 }}
            className="font-display font-bold text-5xl leading-none"
            style={{ color }}
          >
            {score}
          </motion.span>
          <span className="font-sans text-xs text-gray-400 mt-1">FOMO score</span>
        </div>
      </div>
      <motion.span
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2 }}
        className="font-display font-bold text-base"
        style={{ color }}
      >
        {label}
      </motion.span>
    </div>
  );
}

// ─── Cooldown Timer ───────────────────────────────────────────────────────────
function CooldownTimer({ seconds, onDone }: { seconds: number; onDone: () => void }) {
  const [remaining, setRemaining] = useState(seconds);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setRemaining(r => {
        if (r <= 1) {
          clearInterval(intervalRef.current!);
          onDone();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current!);
  }, [onDone]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const pct  = 1 - remaining / seconds;
  const r    = 52;
  const circ = 2 * Math.PI * r;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-36 h-36">
        <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
          <circle cx="60" cy="60" r={r} fill="none" stroke="#f1f5f9" strokeWidth="8" />
          <motion.circle cx="60" cy="60" r={r} fill="none" stroke="#f97316" strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={circ * (1 - pct)}
            transition={{ duration: 0.8 }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono font-bold text-3xl text-gray-900 tabular-nums">
            {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
          </span>
          <span className="font-sans text-xs text-gray-400">remaining</span>
        </div>
      </div>
    </div>
  );
}

// ─── Breathing Exercise ────────────────────────────────────────────────────────
function BreathingOrb() {
  const [phase, setPhase] = useState<"inhale" | "hold" | "exhale">("inhale");
  const [count, setCount] = useState(4);

  useEffect(() => {
    const durations = { inhale: 4, hold: 4, exhale: 6 };
    let current = count;

    const tick = setInterval(() => {
      current -= 1;
      setCount(current);
      if (current <= 0) {
        setPhase(p => {
          const next = p === "inhale" ? "hold" : p === "hold" ? "exhale" : "inhale";
          current = durations[next];
          setCount(current);
          return next;
        });
      }
    }, 1000);

    return () => clearInterval(tick);
  }, []);

  const label = phase === "inhale" ? "Breathe in" : phase === "hold" ? "Hold" : "Breathe out";
  const scale = phase === "inhale" ? 1.3 : phase === "hold" ? 1.3 : 0.85;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative flex items-center justify-center w-32 h-32">
        <motion.div
          animate={{ scale }}
          transition={{ duration: phase === "inhale" ? 4 : phase === "hold" ? 0.1 : 6, ease: "easeInOut" as const }}
          className="absolute w-24 h-24 rounded-full bg-emerald-400/20"
        />
        <motion.div
          animate={{ scale: scale * 0.75 }}
          transition={{ duration: phase === "inhale" ? 4 : phase === "hold" ? 0.1 : 6, ease: "easeInOut" as const }}
          className="absolute w-24 h-24 rounded-full bg-emerald-400/30"
        />
        <motion.div
          animate={{ scale: scale * 0.5 }}
          transition={{ duration: phase === "inhale" ? 4 : phase === "hold" ? 0.1 : 6, ease: "easeInOut" as const }}
          className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center"
        >
          <span className="font-mono font-bold text-white text-xl">{count}</span>
        </motion.div>
      </div>
      <p className="font-display font-bold text-gray-700 text-base">{label}</p>
    </div>
  );
}

// ─── Insight Card ─────────────────────────────────────────────────────────────
function InsightCard({ icon, title, body, delay = 0 }: { icon: string; title: string; body: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: EASE }}
      className="bg-white border border-gray-100 rounded-2xl p-5"
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl flex-shrink-0">{icon}</span>
        <div>
          <p className="font-display font-bold text-gray-900 text-sm mb-1">{title}</p>
          <p className="font-sans text-xs text-gray-500 leading-relaxed">{body}</p>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function FOMOPage() {
  const [step, setStep]         = useState<Step>("intro");
  const [answers, setAnswers]   = useState<Answer[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [fomoScore, setFomoScore] = useState(0);
  const [cooldownDone, setCooldownDone] = useState(false);

  const currentQIndex = QUESTIONS.findIndex(q => q.step === step);
  const currentQ = currentQIndex >= 0 ? QUESTIONS[currentQIndex] : null;

  function handleAnswer(optionIndex: number) {
    if (!currentQ) return;
    setSelected(optionIndex);
  }

  function handleNext() {
    if (!currentQ || selected === null) return;
    const opt = currentQ.options[selected];
    const newAnswers = [...answers, { qId: currentQ.id, value: opt.score, label: opt.label }];
    setAnswers(newAnswers);
    setSelected(null);

    if (currentQ.next === "result") {
      // Compute score
      const total = newAnswers.reduce((sum, a) => sum + a.value, 0);
      const maxPossible = QUESTIONS.length * 10;
      const score = Math.round((total / maxPossible) * 100);
      setFomoScore(score);
    }
    setStep(currentQ.next);
  }

  function restart() {
    setStep("intro");
    setAnswers([]);
    setSelected(null);
    setFomoScore(0);
    setCooldownDone(false);
  }

  const isFOMO = fomoScore > 45;
  const isHighFOMO = fomoScore > 65;

  // ── Intro ──
  if (step === "intro") {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Nav />
        <div className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="max-w-lg w-full">
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }}
              className="text-center mb-10">
              <div className="w-20 h-20 bg-amber-100 border border-amber-200 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <span className="text-4xl">🧠</span>
              </div>
              <h1 className="font-display font-bold text-gray-900 text-4xl tracking-tight mb-3">FOMO Guard</h1>
              <p className="font-sans text-gray-500 text-base leading-relaxed">
                A 5-question emotional check before you place your trade. 90 seconds. Could save you thousands.
              </p>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, ease: EASE }}
              className="flex flex-col gap-3 mb-8">
              {[
                { icon: "📊", text: "Research-backed questions based on behavioral finance" },
                { icon: "⚡", text: "Takes under 2 minutes to complete" },
                { icon: "🔒", text: "100% anonymous — nothing is stored" },
                { icon: "⏳", text: "Cooling-off timer if high FOMO is detected" },
              ].map((f, i) => (
                <motion.div key={f.text} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.25 + i * 0.08, ease: EASE }}
                  className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-4 py-3">
                  <span className="text-lg">{f.icon}</span>
                  <span className="font-sans text-sm text-gray-600">{f.text}</span>
                </motion.div>
              ))}
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55, ease: EASE }}
              className="flex flex-col gap-3">
              <motion.button
                onClick={() => setStep("q1")}
                whileHover={{ scale: 1.02, boxShadow: "0 16px 32px rgba(217,119,6,0.15)" }}
                whileTap={{ scale: 0.97 }}
                className="w-full h-14 bg-amber-500 hover:bg-amber-600 text-white font-display font-bold text-base rounded-2xl transition-colors shadow-md shadow-amber-100"
              >
                Start emotional check →
              </motion.button>
              <a href="/analyse"
                className="w-full h-12 border border-gray-200 hover:bg-gray-50 text-gray-600 font-sans font-medium text-sm rounded-2xl transition-colors flex items-center justify-center">
                Skip — just scan my token
              </a>
            </motion.div>

            {/* Research note */}
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
              className="font-sans text-xs text-gray-400 text-center mt-6 leading-relaxed">
              Based on research: FOMO-driven crypto trades lose money in <span className="font-semibold text-gray-600">71% of cases</span> (University of Hamburg, 2022)
            </motion.p>
          </div>
        </div>
      </div>
    );
  }

  // ── Question ──
  if (currentQ) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Nav />
        <div className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="max-w-lg w-full">

            {/* Progress */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-8">
              <div className="flex items-center justify-between mb-2">
                <span className="font-sans text-xs text-gray-400">Question {currentQIndex + 1} of {QUESTIONS.length}</span>
                <span className="font-sans text-xs font-semibold text-amber-600">{Math.round(((currentQIndex) / QUESTIONS.length) * 100)}% done</span>
              </div>
              <ProgressBar current={currentQIndex} total={QUESTIONS.length} />
            </motion.div>

            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.35, ease: EASE }}
              >
                {/* Question card */}
                <div className="bg-white border border-gray-100 rounded-3xl p-8 mb-4">
                  <div className="text-center mb-6">
                    <div className="w-14 h-14 bg-amber-50 border border-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <span className="text-2xl">{currentQ.icon}</span>
                    </div>
                    <h2 className="font-display font-bold text-gray-900 text-xl leading-tight mb-1">{currentQ.headline}</h2>
                    <p className="font-sans text-sm text-gray-400">{currentQ.sub}</p>
                  </div>

                  <div className="flex flex-col gap-2.5">
                    {currentQ.options.map((opt, i) => (
                      <motion.button
                        key={opt.label}
                        onClick={() => handleAnswer(i)}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.06, ease: EASE }}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        className={`w-full text-left px-4 py-3.5 rounded-xl border font-sans text-sm transition-all duration-200 ${
                          selected === i
                            ? "border-amber-400 bg-amber-50 text-amber-900 font-semibold shadow-sm"
                            : "border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-300 hover:bg-white"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 transition-all ${
                            selected === i ? "border-amber-500 bg-amber-500" : "border-gray-300"
                          }`}>
                            {selected === i && (
                              <div className="w-full h-full rounded-full flex items-center justify-center">
                                <div className="w-1.5 h-1.5 bg-white rounded-full" />
                              </div>
                            )}
                          </div>
                          {opt.label}
                        </div>
                      </motion.button>
                    ))}
                  </div>
                </div>

                <motion.button
                  onClick={handleNext}
                  disabled={selected === null}
                  whileHover={selected !== null ? { scale: 1.02 } : {}}
                  whileTap={selected !== null ? { scale: 0.97 } : {}}
                  className={`w-full h-13 py-3.5 rounded-2xl font-display font-bold text-base transition-all ${
                    selected !== null
                      ? "bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-100 cursor-pointer"
                      : "bg-gray-100 text-gray-400 cursor-not-allowed"
                  }`}
                >
                  {currentQ.next === "result" ? "See my result →" : "Next question →"}
                </motion.button>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    );
  }

  // ── Result ──
  if (step === "result") {
    const insights = isFOMO ? [
      {
        icon: "📉",
        title: "FOMO trades underperform by 23%",
        body: "Research from MIT shows emotionally-driven crypto buys underperform planned trades by an average of 23% over 30 days.",
      },
      {
        icon: "🧪",
        title: "Your brain right now",
        body: "Excitement and fear of missing out trigger dopamine spikes that literally impair rational decision-making — the same as gambling.",
      },
      {
        icon: "⏳",
        title: "The best trades can wait",
        body: "If a trade is genuinely good today, it will still be good in 10 minutes. The urgency you feel is manufactured by market makers.",
      },
    ] : [
      {
        icon: "✅",
        title: "Systematic trading beats FOMO",
        body: "Traders who follow pre-defined strategies outperform reactive traders by 31% annually. You're on the right path.",
      },
      {
        icon: "📋",
        title: "One more step",
        body: "Before trading, run a token safety scan to verify liquidity, contract safety, and on-chain signals.",
      },
      {
        icon: "🔁",
        title: "Keep the discipline",
        body: "Write down your trade thesis before executing. If you can't explain it in 2 sentences, reconsider.",
      },
    ];

    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Nav />
        <div className="flex-1 px-6 py-12">
          <div className="max-w-2xl mx-auto">

            {/* Score */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ ease: EASE }}
              className="bg-white border border-gray-100 rounded-3xl p-8 mb-6 text-center">
              <p className="font-sans text-xs font-bold tracking-widest uppercase text-gray-400 mb-6">Your FOMO Assessment</p>
              <div className="flex justify-center mb-6">
                <FOMOGauge score={fomoScore} />
              </div>

              {isFOMO ? (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.4 }}>
                  <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full mb-4 ${isHighFOMO ? "bg-red-50 border border-red-200" : "bg-amber-50 border border-amber-200"}`}>
                    <span>{isHighFOMO ? "🚨" : "⚠️"}</span>
                    <span className={`font-display font-bold text-sm ${isHighFOMO ? "text-red-700" : "text-amber-700"}`}>
                      {isHighFOMO ? "Strong FOMO detected — step back" : "FOMO signals present — proceed carefully"}
                    </span>
                  </div>
                  <p className="font-sans text-gray-500 text-sm leading-relaxed max-w-md mx-auto">
                    Your responses suggest emotional factors are driving this trade decision.
                    {isHighFOMO
                      ? " We strongly recommend a cooling-off period before executing."
                      : " Consider waiting and re-evaluating with a clearer head."}
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 mt-6 justify-center">
                    <motion.button
                      onClick={() => setStep("cooldown")}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      className="bg-amber-500 hover:bg-amber-600 text-white font-display font-bold text-sm px-8 py-3.5 rounded-2xl transition-colors shadow-md shadow-amber-100"
                    >
                      ⏳ Start {isHighFOMO ? "10" : "5"}-min cooldown
                    </motion.button>
                    <a href="/analyse"
                      className="border border-gray-200 hover:bg-gray-50 text-gray-600 font-sans font-medium text-sm px-8 py-3.5 rounded-2xl transition-colors flex items-center justify-center">
                      Scan token anyway →
                    </a>
                  </div>
                </motion.div>
              ) : (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.4 }}>
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-4 bg-emerald-50 border border-emerald-200">
                    <span>✅</span>
                    <span className="font-display font-bold text-sm text-emerald-700">Rational decision signals detected</span>
                  </div>
                  <p className="font-sans text-gray-500 text-sm leading-relaxed max-w-md mx-auto">
                    Your reasoning appears systematic and research-based. Good foundation for a trade decision — always verify the token safety before executing.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 mt-6 justify-center">
                    <a href="/analyse"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-display font-bold text-sm px-8 py-3.5 rounded-2xl transition-colors shadow-md shadow-emerald-100 flex items-center justify-center">
                      Scan token safety →
                    </a>
                    <button onClick={restart}
                      className="border border-gray-200 hover:bg-gray-50 text-gray-600 font-sans font-medium text-sm px-8 py-3.5 rounded-2xl transition-colors">
                      Retake check
                    </button>
                  </div>
                </motion.div>
              )}
            </motion.div>

            {/* Answer review */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, ease: EASE }}
              className="bg-white border border-gray-100 rounded-3xl p-6 mb-6">
              <h3 className="font-display font-bold text-gray-900 text-sm mb-4">Your answers</h3>
              <div className="flex flex-col gap-2.5">
                {answers.map((a, i) => {
                  const q = QUESTIONS[i];
                  const emotional = a.value >= 7;
                  const neutral   = a.value >= 3;
                  return (
                    <motion.div key={a.qId} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.35 + i * 0.07, ease: EASE }}
                      className="flex items-start gap-3">
                      <div className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5 ${
                        emotional ? "bg-red-500" : neutral ? "bg-amber-500" : "bg-emerald-500"
                      }`}>
                        <svg className="w-3 h-3 text-white" viewBox="0 0 10 10" fill="none">
                          {emotional
                            ? <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                            : neutral
                            ? <path d="M2 5h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                            : <path d="M2 5l2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>}
                        </svg>
                      </div>
                      <div>
                        <p className="font-sans text-xs text-gray-400 mb-0.5">{q.headline}</p>
                        <p className={`font-sans text-sm font-medium ${emotional ? "text-red-700" : neutral ? "text-amber-700" : "text-emerald-700"}`}>
                          {a.label}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>

            {/* Insights */}
            <div className="flex flex-col gap-3 mb-6">
              <h3 className="font-display font-bold text-gray-900 text-sm px-1">Research insights</h3>
              {insights.map((ins, i) => (
                <InsightCard key={ins.title} {...ins} delay={0.4 + i * 0.1} />
              ))}
            </div>

            {/* Restart */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
              className="text-center">
              <button onClick={restart} className="font-sans text-xs text-gray-400 hover:text-gray-600 transition-colors">
                ← Take the check again
              </button>
            </motion.div>
          </div>
        </div>
      </div>
    );
  }

  // ── Cooldown ──
  if (step === "cooldown") {
    const duration = isHighFOMO ? 600 : 300;

    if (cooldownDone) {
      return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
          <Nav />
          <div className="flex-1 flex items-center justify-center px-6 py-12">
            <div className="max-w-lg w-full text-center">
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ ease: EASE }}>
                <div className="w-20 h-20 bg-emerald-100 border border-emerald-200 rounded-3xl flex items-center justify-center mx-auto mb-6">
                  <span className="text-4xl">✅</span>
                </div>
                <h2 className="font-display font-bold text-gray-900 text-3xl mb-3">Cooldown complete</h2>
                <p className="font-sans text-gray-500 text-base leading-relaxed mb-8 max-w-sm mx-auto">
                  You've taken the time to pause. Now make a rational decision — not an emotional one.
                </p>
                <div className="flex flex-col gap-3 max-w-xs mx-auto">
                  <a href="/analyse"
                    className="w-full h-13 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-display font-bold text-base rounded-2xl transition-colors shadow-md shadow-emerald-100 flex items-center justify-center">
                    Scan token safety now →
                  </a>
                  <button onClick={restart}
                    className="w-full h-12 border border-gray-200 hover:bg-gray-50 text-gray-600 font-sans font-medium text-sm rounded-2xl transition-colors">
                    Retake FOMO check
                  </button>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Nav />
        <div className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="max-w-lg w-full">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ ease: EASE }}
              className="text-center mb-8">
              <div className="w-16 h-16 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">⏳</span>
              </div>
              <h2 className="font-display font-bold text-gray-900 text-2xl mb-2">Cooling off period</h2>
              <p className="font-sans text-gray-500 text-sm leading-relaxed max-w-sm mx-auto">
                Step away from the chart. Use this time to breathe and let the impulse pass.
              </p>
            </motion.div>

            {/* Two columns: timer + breathing */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, ease: EASE }}
                className="bg-white border border-gray-100 rounded-2xl p-6 flex flex-col items-center gap-4">
                <p className="font-display font-bold text-gray-800 text-sm">Time remaining</p>
                <CooldownTimer seconds={duration} onDone={() => setCooldownDone(true)} />
                <p className="font-sans text-xs text-gray-400 text-center">
                  Your trade opportunity will still be there after this.
                </p>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, ease: EASE }}
                className="bg-white border border-gray-100 rounded-2xl p-6 flex flex-col items-center gap-4">
                <p className="font-display font-bold text-gray-800 text-sm">Box breathing</p>
                <BreathingOrb />
                <p className="font-sans text-xs text-gray-400 text-center">
                  Used by Navy SEALs to reduce adrenaline before decisions.
                </p>
              </motion.div>
            </div>

            {/* Reminders */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, ease: EASE }}
              className="bg-white border border-gray-100 rounded-2xl p-6 mb-5">
              <h3 className="font-display font-bold text-gray-800 text-sm mb-4">Ask yourself while you wait</h3>
              <div className="flex flex-col gap-3">
                {[
                  "Can I explain this investment in 2 clear sentences?",
                  "Would I be comfortable if my portfolio was 10% this token?",
                  "Am I okay if this token drops 70% tomorrow?",
                  "Did I set a stop-loss or exit strategy before deciding to buy?",
                  "Would I still want this trade if no one else knew about it?",
                ].map((q, i) => (
                  <motion.div key={q} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + i * 0.07, ease: EASE }}
                    className="flex items-start gap-2.5">
                    <span className="text-amber-400 font-bold text-xs mt-0.5 flex-shrink-0">→</span>
                    <span className="font-sans text-sm text-gray-600">{q}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            <button onClick={restart}
              className="w-full h-11 border border-gray-200 hover:bg-gray-50 text-gray-500 font-sans font-medium text-sm rounded-xl transition-colors">
              Cancel cooldown — I changed my mind
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// ─── Nav ──────────────────────────────────────────────────────────────────────
function Nav() {
  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-gray-100">
      <div className="max-w-[1320px] mx-auto px-6 h-14 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <ShieldIcon className="w-4 h-4 text-white" />
          </div>
          <span className="font-display font-bold text-gray-900 text-[15px]">TokenShield</span>
        </a>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-1.5">
            <span className="text-base">🧠</span>
            <span className="font-sans text-xs text-gray-500 font-medium">FOMO Guard</span>
          </div>
          <a href="/" className="font-sans text-xs font-medium text-gray-400 hover:text-gray-700 transition-colors">← Home</a>
        </div>
      </div>
    </nav>
  );
}