"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import BackButton from "@/components/BackButton";
import ToolSeoContent from "@/components/ToolSeoContent";
import {
  KeyRound,
  RefreshCw,
  Copy,
  Check,
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  Trash2,
  Sparkles,
  CheckSquare,
  Square,
} from "lucide-react";

const UPPERCASE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWERCASE_CHARS = "abcdefghijklmnopqrstuvwxyz";
const NUMBER_CHARS = "0123456789";
const SYMBOL_CHARS = "!@#$%^&*()-_=+[]{}|;:,.<>?";
const AMBIGUOUS_REGEX = /[0O1lI]/g;

/**
 * Cryptographically secure uniform random integer in [0, max) using
 * window.crypto.getRandomValues with rejection sampling to avoid modulo bias.
 */
function getSecureRandomInt(max: number): number {
  if (max <= 1) return 0;
  const array = new Uint32Array(1);
  const maxUint32 = 0xffffffff;
  const limit = maxUint32 - ((maxUint32 + 1) % max);

  let rand = 0;
  do {
    window.crypto.getRandomValues(array);
    rand = array[0];
  } while (rand > limit);

  return rand % max;
}

function secureShuffle(chars: string[]): string[] {
  const result = [...chars];
  for (let i = result.length - 1; i > 0; i--) {
    const j = getSecureRandomInt(i + 1);
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }
  return result;
}

interface StrengthInfo {
  label: string;
  entropy: number;
  barPercent: number;
  textColor: string;
  barColor: string;
  badgeClass: string;
}

function evaluateStrength(length: number, poolSize: number): StrengthInfo {
  if (length <= 0 || poolSize <= 0) {
    return {
      label: "None",
      entropy: 0,
      barPercent: 0,
      textColor: "text-slate-400",
      barColor: "bg-slate-600",
      badgeClass: "bg-slate-800 border-slate-700 text-slate-300",
    };
  }
  const entropy = Math.round(length * Math.log2(poolSize));
  if (entropy < 40) {
    return {
      label: "Weak",
      entropy,
      barPercent: 25,
      textColor: "text-rose-400",
      barColor: "bg-rose-500",
      badgeClass: "bg-rose-500/15 border-rose-500/30 text-rose-300",
    };
  }
  if (entropy < 60) {
    return {
      label: "Fair",
      entropy,
      barPercent: 50,
      textColor: "text-amber-400",
      barColor: "bg-amber-500",
      badgeClass: "bg-amber-500/15 border-amber-500/30 text-amber-300",
    };
  }
  if (entropy < 85) {
    return {
      label: "Strong",
      entropy,
      barPercent: 78,
      textColor: "text-cyan-400",
      barColor: "bg-cyan-500",
      badgeClass: "bg-cyan-500/15 border-cyan-500/30 text-cyan-300",
    };
  }
  return {
    label: "Very Strong",
    entropy,
    barPercent: 100,
    textColor: "text-emerald-400",
    barColor: "bg-emerald-500",
    badgeClass: "bg-emerald-500/15 border-emerald-500/30 text-emerald-300",
  };
}

export default function PasswordGeneratorPage() {
  const [length, setLength] = useState<number>(16);
  const [includeUppercase, setIncludeUppercase] = useState<boolean>(true);
  const [includeLowercase, setIncludeLowercase] = useState<boolean>(true);
  const [includeNumbers, setIncludeNumbers] = useState<boolean>(true);
  const [includeSymbols, setIncludeSymbols] = useState<boolean>(true);
  const [excludeAmbiguous, setExcludeAmbiguous] = useState<boolean>(false);

  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [optionWarning, setOptionWarning] = useState<string>("");

  const buildPools = useCallback(
    (
      upper: boolean,
      lower: boolean,
      nums: boolean,
      syms: boolean,
      noAmbiguous: boolean
    ) => {
      const strip = (s: string) =>
        noAmbiguous ? s.replace(AMBIGUOUS_REGEX, "") : s;
      const pools: string[] = [];
      if (upper) pools.push(strip(UPPERCASE_CHARS));
      if (lower) pools.push(strip(LOWERCASE_CHARS));
      if (nums) pools.push(strip(NUMBER_CHARS));
      if (syms) pools.push(strip(SYMBOL_CHARS));
      return pools.filter((p) => p.length > 0);
    },
    []
  );

  const generatePassword = useCallback(
    (
      opts?: {
        len?: number;
        upper?: boolean;
        lower?: boolean;
        nums?: boolean;
        syms?: boolean;
        noAmbiguous?: boolean;
      },
      recordHistory = true
    ) => {
      if (typeof window === "undefined" || !window.crypto?.getRandomValues) {
        return;
      }

      const len = opts?.len ?? length;
      const upper = opts?.upper ?? includeUppercase;
      const lower = opts?.lower ?? includeLowercase;
      const nums = opts?.nums ?? includeNumbers;
      const syms = opts?.syms ?? includeSymbols;
      const noAmbiguous = opts?.noAmbiguous ?? excludeAmbiguous;

      const pools = buildPools(upper, lower, nums, syms, noAmbiguous);
      if (pools.length === 0) return;

      const combinedPool = pools.join("");
      const chars: string[] = [];

      // Guarantee at least one character from each enabled set when length permits
      for (const pool of pools) {
        if (chars.length < len) {
          chars.push(pool[getSecureRandomInt(pool.length)]);
        }
      }

      // Fill remaining characters uniformly from the full pool
      while (chars.length < len) {
        chars.push(combinedPool[getSecureRandomInt(combinedPool.length)]);
      }

      const nextPassword = secureShuffle(chars).join("");
      setPassword(nextPassword);

      if (recordHistory) {
        setHistory((prev) =>
          [nextPassword, ...prev.filter((item) => item !== nextPassword)].slice(
            0,
            5
          )
        );
      }
    },
    [
      length,
      includeUppercase,
      includeLowercase,
      includeNumbers,
      includeSymbols,
      excludeAmbiguous,
      buildPools,
    ]
  );

  // Generate an initial password on client mount to prevent SSR hydration mismatch
  useEffect(() => {
    generatePassword(undefined, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activePools = buildPools(
    includeUppercase,
    includeLowercase,
    includeNumbers,
    includeSymbols,
    excludeAmbiguous
  );
  const poolSize = activePools.reduce((sum, p) => sum + p.length, 0);
  const strength = evaluateStrength(length, poolSize);

  const handleToggleOption = (
    key: "upper" | "lower" | "nums" | "syms",
    currentValue: boolean
  ) => {
    const nextUpper = key === "upper" ? !currentValue : includeUppercase;
    const nextLower = key === "lower" ? !currentValue : includeLowercase;
    const nextNums = key === "nums" ? !currentValue : includeNumbers;
    const nextSyms = key === "syms" ? !currentValue : includeSymbols;

    if (!nextUpper && !nextLower && !nextNums && !nextSyms) {
      setOptionWarning("At least one character type must remain selected.");
      setTimeout(() => setOptionWarning(""), 2500);
      return;
    }

    setOptionWarning("");
    if (key === "upper") setIncludeUppercase(nextUpper);
    if (key === "lower") setIncludeLowercase(nextLower);
    if (key === "nums") setIncludeNumbers(nextNums);
    if (key === "syms") setIncludeSymbols(nextSyms);

    generatePassword(
      {
        upper: nextUpper,
        lower: nextLower,
        nums: nextNums,
        syms: nextSyms,
      },
      false
    );
  };

  const handleLengthChange = (nextLen: number) => {
    const clamped = Math.min(64, Math.max(8, nextLen));
    setLength(clamped);
    generatePassword({ len: clamped }, false);
  };

  const handleAmbiguousToggle = () => {
    const next = !excludeAmbiguous;
    setExcludeAmbiguous(next);
    generatePassword({ noAmbiguous: next }, false);
  };

  const copyText = async (value: string, id: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(id);
      setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      // ignore clipboard errors
    }
  };

  const optionItems = [
    {
      key: "upper" as const,
      label: "Uppercase Letters",
      sample: "A–Z",
      enabled: includeUppercase,
    },
    {
      key: "lower" as const,
      label: "Lowercase Letters",
      sample: "a–z",
      enabled: includeLowercase,
    },
    {
      key: "nums" as const,
      label: "Numbers",
      sample: "0–9",
      enabled: includeNumbers,
    },
    {
      key: "syms" as const,
      label: "Symbols",
      sample: "!@#$%^&*",
      enabled: includeSymbols,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-8 sm:py-10 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <BackButton />

        {/* Header */}
        <header className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
            <Lock className="w-3.5 h-3.5" />
            <span>Cryptographically Secure • crypto.getRandomValues</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            Strong Password{" "}
            <span className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-400 bg-clip-text text-transparent">
              Generator
            </span>
          </h1>
          <p className="text-sm sm:text-base text-slate-400 max-w-2xl leading-relaxed">
            Create unpredictable, high-entropy passwords locally inside your
            browser using the Web Crypto API. Customize length, letters, numbers,
            and symbols with zero server transmission or logging.
          </p>
        </header>

        {/* Main Generator Card */}
        <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-7 space-y-6 shadow-xl shadow-black/30">
          {/* Generated Password Display */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Generated Password
              </span>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold ${strength.badgeClass}`}
              >
                <KeyRound className="w-3.5 h-3.5" />
                {strength.label} ({strength.entropy} bits)
              </span>
            </div>

            <div className="relative flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 bg-slate-950 border border-slate-800 rounded-2xl p-3 sm:p-4">
              <div className="flex-1 min-w-0 flex items-center gap-2">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  readOnly
                  aria-label="Generated password"
                  className="w-full bg-transparent text-lg sm:text-xl font-mono font-bold tracking-wide text-white focus:outline-none select-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition shrink-0"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => copyText(password, "main")}
                  className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold transition shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-1.5"
                >
                  {copiedKey === "main" ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => generatePassword(undefined, true)}
                  className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-bold transition shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className="w-4 h-4" />
                  Generate
                </button>
              </div>
            </div>

            {/* Strength Bar */}
            <div className="space-y-1.5">
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${strength.barColor}`}
                  style={{ width: `${strength.barPercent}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>
                  Character pool size:{" "}
                  <strong className="text-slate-200">{poolSize}</strong> unique
                  characters
                </span>
                <span className={`font-semibold ${strength.textColor}`}>
                  {strength.entropy >= 80
                    ? "Resistant to modern brute-force cracking"
                    : strength.entropy >= 60
                      ? "Good for everyday accounts"
                      : "Increase length or add character types"}
                </span>
              </div>
            </div>
          </div>

          {/* Length Controls */}
          <div className="pt-2 border-t border-slate-800/80 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label
                htmlFor="password-length"
                className="text-sm font-bold text-slate-200"
              >
                Password Length:{" "}
                <span className="text-emerald-400 font-mono text-base">
                  {length}
                </span>
              </label>
              <div className="flex items-center gap-1.5">
                {[12, 16, 24, 32].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handleLengthChange(preset)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition ${
                      length === preset
                        ? "bg-emerald-600/20 border-emerald-500/50 text-emerald-300"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700"
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <input
              id="password-length"
              type="range"
              min={8}
              max={64}
              value={length}
              onChange={(e) => handleLengthChange(Number(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer"
            />
            <div className="flex justify-between text-[11px] text-slate-500 font-mono">
              <span>8</span>
              <span>16</span>
              <span>32</span>
              <span>48</span>
              <span>64</span>
            </div>
          </div>

          {/* Character Type Toggles */}
          <div className="pt-2 border-t border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-slate-200">
                Character Options
              </h2>
              {optionWarning && (
                <span className="text-xs font-semibold text-amber-400">
                  {optionWarning}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {optionItems.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => handleToggleOption(opt.key, opt.enabled)}
                  className={`flex items-center justify-between p-3.5 rounded-xl border text-left transition ${
                    opt.enabled
                      ? "bg-emerald-500/10 border-emerald-500/40 text-white"
                      : "bg-slate-950/70 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {opt.enabled ? (
                      <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-500 shrink-0" />
                    )}
                    <span className="text-sm font-semibold">{opt.label}</span>
                  </div>
                  <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-slate-300">
                    {opt.sample}
                  </span>
                </button>
              ))}
            </div>

            {/* Exclude Ambiguous Toggle */}
            <button
              type="button"
              onClick={handleAmbiguousToggle}
              className={`w-full flex items-center justify-between p-3.5 rounded-xl border text-left transition ${
                excludeAmbiguous
                  ? "bg-indigo-500/10 border-indigo-500/40 text-white"
                  : "bg-slate-950/70 border-slate-800 text-slate-400 hover:border-slate-700"
              }`}
            >
              <div className="flex items-center gap-2.5">
                {excludeAmbiguous ? (
                  <CheckSquare className="w-4 h-4 text-indigo-400 shrink-0" />
                ) : (
                  <Square className="w-4 h-4 text-slate-500 shrink-0" />
                )}
                <div>
                  <span className="text-sm font-semibold block">
                    Exclude Ambiguous Characters
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Removes look-alike characters (0, O, 1, l, I) for easier
                    manual typing
                  </span>
                </div>
              </div>
              <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-slate-300 shrink-0">
                0 O 1 l I
              </span>
            </button>
          </div>
        </section>

        {/* Session History (Memory Only) */}
        {history.length > 0 && (
          <section className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-slate-200">
                Recent Passwords (Current Session Only)
              </h2>
              <button
                type="button"
                onClick={() => setHistory([])}
                className="text-xs font-semibold text-slate-400 hover:text-rose-400 flex items-center gap-1 transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear
              </button>
            </div>
            <div className="space-y-2">
              {history.map((item, idx) => (
                <div
                  key={`${item}-${idx}`}
                  className="flex items-center justify-between gap-3 bg-slate-950/80 border border-slate-800/80 rounded-xl px-3.5 py-2.5"
                >
                  <span className="font-mono text-xs sm:text-sm text-slate-200 truncate">
                    {showPassword ? item : "•".repeat(item.length)}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyText(item, `hist-${idx}`)}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1 shrink-0 transition"
                  >
                    {copiedKey === `hist-${idx}` ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Copy
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Privacy Notice + Related Utilities */}
        <section className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 shrink-0">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">
                100% Local Web Crypto Security
              </h2>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                Every password is generated in your browser&apos;s memory using
                cryptographically secure hardware randomness. Nothing is ever
                transmitted, logged, or stored on any server.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Link
              href="/tools/percentage-calculator"
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              Percentage Calculator
            </Link>
            <Link
              href="/tools/word-counter"
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition"
            >
              Word Counter
            </Link>
            <Link
              href="/tools/file-converter"
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition"
            >
              File Converter
            </Link>
          </div>
        </section>

        {/* Rich SEO Guide */}
        <ToolSeoContent
          toolName="Strong Password Generator"
          aboutParagraphs={[
            "Reusing weak or predictable passwords across email, banking, and social accounts is one of the leading causes of credential-stuffing breaches. Our free Password Generator builds truly unpredictable passwords directly inside your web browser so you can secure every login without trusting a remote server.",
            "Unlike basic generators that rely on predictable Math.random() calls, this utility uses your browser's built-in window.crypto.getRandomValues Web Crypto API with rejection sampling for unbiased randomness, then applies a secure Fisher-Yates shuffle to guarantee every enabled character type is fairly represented.",
          ]}
          howToSteps={[
            {
              title: "Select Password Length",
              detail:
                "Use the slider or preset buttons (12, 16, 24, or 32) to choose a password length—16+ characters is recommended for everyday accounts.",
            },
            {
              title: "Choose Character Types",
              detail:
                "Enable uppercase letters, lowercase letters, numbers, and symbols for maximum entropy, or exclude look-alike characters (0, O, 1, l, I) for easier manual typing.",
            },
            {
              title: "Generate & Copy Locally",
              detail:
                "Click Generate to create a fresh cryptographically random password and press Copy to paste it directly into your password manager.",
            },
          ]}
          highlights={[
            "100% client-side randomness powered by window.crypto.getRandomValues with zero server requests or logging.",
            "Rejection sampling eliminates modulo bias so every character in the pool has an equal selection probability.",
            "Real-time bit-entropy strength meter shows how resistant your password is against brute-force attacks.",
            "Optional in-memory session history lets you recover a freshly generated password until you clear it or close the tab.",
          ]}
        />
      </div>
    </div>
  );
}
