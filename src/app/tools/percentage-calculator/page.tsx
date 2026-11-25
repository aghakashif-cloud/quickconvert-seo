"use client";

import React, { useState } from "react";
import Link from "next/link";
import BackButton from "@/components/BackButton";
import ToolSeoContent from "@/components/ToolSeoContent";
import {
  Percent,
  Calculator,
  TrendingUp,
  TrendingDown,
  Copy,
  Check,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

function formatNumber(num: number): string {
  if (!Number.isFinite(num)) return "—";
  const rounded = Math.round(num * 10000) / 10000;
  return rounded.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

export default function PercentageCalculatorPage() {
  // Calculator 1: What is X% of Y?
  const [pctOfX, setPctOfX] = useState<string>("20");
  const [pctOfY, setPctOfY] = useState<string>("250");

  // Calculator 2: X is what % of Y?
  const [whatPctX, setWhatPctX] = useState<string>("45");
  const [whatPctY, setWhatPctY] = useState<string>("180");

  // Calculator 3: Percentage Increase / Decrease from X to Y
  const [changeFrom, setChangeFrom] = useState<string>("120");
  const [changeTo, setChangeTo] = useState<string>("150");

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyResult = async (value: string, id: string) => {
    if (!value || value === "—") return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // ignore clipboard error
    }
  };

  // Calculations
  const x1 = parseFloat(pctOfX);
  const y1 = parseFloat(pctOfY);
  const res1 =
    pctOfX !== "" && pctOfY !== "" && Number.isFinite(x1) && Number.isFinite(y1)
      ? (x1 / 100) * y1
      : null;

  const x2 = parseFloat(whatPctX);
  const y2 = parseFloat(whatPctY);
  const res2 =
    whatPctX !== "" &&
    whatPctY !== "" &&
    Number.isFinite(x2) &&
    Number.isFinite(y2) &&
    y2 !== 0
      ? (x2 / y2) * 100
      : null;

  const fromVal = parseFloat(changeFrom);
  const toVal = parseFloat(changeTo);
  const res3 =
    changeFrom !== "" &&
    changeTo !== "" &&
    Number.isFinite(fromVal) &&
    Number.isFinite(toVal) &&
    fromVal !== 0
      ? ((toVal - fromVal) / Math.abs(fromVal)) * 100
      : null;
  const diff3 =
    res3 !== null && Number.isFinite(fromVal) && Number.isFinite(toVal)
      ? toVal - fromVal
      : null;

  const resetAll = () => {
    setPctOfX("");
    setPctOfY("");
    setWhatPctX("");
    setWhatPctY("");
    setChangeFrom("");
    setChangeTo("");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-10 px-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <BackButton />
        </div>

        {/* Top Tool Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
          <div>
            <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
              <Percent className="w-4 h-4" />
              Utilities • Instant Browser Calculator
            </span>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white mt-1">
              Percentage Calculator
            </h1>
            <p className="text-xs md:text-sm text-slate-400 mt-1 max-w-2xl">
              Instantly calculate X% of Y, find what percentage one number is of another, and compute percentage increase or decrease—100% locally in your browser.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/tools/word-counter"
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition"
            >
              Word Counter
            </Link>
            <Link
              href="/tools/password-generator"
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition"
            >
              Password Generator
            </Link>
            <Link
              href="/tools/file-converter"
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 transition flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              File Converter
            </Link>
          </div>
        </div>

        {/* Privacy Badge + Reset Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-emerald-500/10 border border-emerald-500/25 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <p className="text-xs md:text-sm font-medium text-emerald-300">
              100% Client-Side: Instant real-time math calculations right inside your browser with zero server calls.
            </p>
          </div>
          <button
            type="button"
            onClick={resetAll}
            className="px-3 py-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold transition flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Clear All
          </button>
        </div>

        {/* 3 Percentage Calculator Cards */}
        <div className="space-y-5">
          {/* Card 1: What is X% of Y? */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Calculator className="w-4 h-4 text-indigo-400" />
                1. What is X% of Y?
              </h2>
              <span className="text-[11px] font-mono text-slate-400 bg-slate-950 border border-slate-800 px-2.5 py-1 rounded-lg">
                (X ÷ 100) × Y
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              <div className="md:col-span-4 space-y-1.5">
                <label
                  htmlFor="pct-of-x"
                  className="block text-xs font-semibold text-slate-400"
                >
                  Percentage (X%)
                </label>
                <div className="relative">
                  <input
                    id="pct-of-x"
                    type="number"
                    step="any"
                    value={pctOfX}
                    onChange={(e) => setPctOfX(e.target.value)}
                    placeholder="e.g. 20"
                    className="w-full px-4 py-3 pr-9 rounded-xl bg-slate-950 border border-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-sm font-semibold text-white"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    %
                  </span>
                </div>
              </div>

              <div className="md:col-span-4 space-y-1.5">
                <label
                  htmlFor="pct-of-y"
                  className="block text-xs font-semibold text-slate-400"
                >
                  Of Number (Y)
                </label>
                <input
                  id="pct-of-y"
                  type="number"
                  step="any"
                  value={pctOfY}
                  onChange={(e) => setPctOfY(e.target.value)}
                  placeholder="e.g. 250"
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-sm font-semibold text-white"
                />
              </div>

              <div className="md:col-span-4 bg-indigo-500/10 border border-indigo-500/30 rounded-xl px-4 py-2.5 flex items-center justify-between gap-2">
                <div>
                  <span className="block text-[11px] font-semibold text-indigo-300 uppercase tracking-wider">
                    Result
                  </span>
                  <span className="text-xl font-extrabold text-white font-mono">
                    {res1 !== null ? formatNumber(res1) : "—"}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={res1 === null}
                  onClick={() =>
                    res1 !== null && copyResult(formatNumber(res1), "calc1")
                  }
                  className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-xs font-semibold text-slate-200 border border-slate-700 transition flex items-center gap-1.5"
                >
                  {copiedId === "calc1" ? (
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
            </div>

            {res1 !== null && (
              <p className="text-xs text-slate-400">
                <strong className="text-slate-200">{pctOfX}%</strong> of{" "}
                <strong className="text-slate-200">{pctOfY}</strong> is{" "}
                <strong className="text-indigo-300">{formatNumber(res1)}</strong>.
                (Discounted price: {formatNumber(y1 - res1)} • With markup:{" "}
                {formatNumber(y1 + res1)})
              </p>
            )}
          </div>

          {/* Card 2: X is what % of Y? */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Percent className="w-4 h-4 text-cyan-400" />
                2. X is what % of Y?
              </h2>
              <span className="text-[11px] font-mono text-slate-400 bg-slate-950 border border-slate-800 px-2.5 py-1 rounded-lg">
                (X ÷ Y) × 100
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              <div className="md:col-span-4 space-y-1.5">
                <label
                  htmlFor="what-pct-x"
                  className="block text-xs font-semibold text-slate-400"
                >
                  Part Value (X)
                </label>
                <input
                  id="what-pct-x"
                  type="number"
                  step="any"
                  value={whatPctX}
                  onChange={(e) => setWhatPctX(e.target.value)}
                  placeholder="e.g. 45"
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 text-sm font-semibold text-white"
                />
              </div>

              <div className="md:col-span-4 space-y-1.5">
                <label
                  htmlFor="what-pct-y"
                  className="block text-xs font-semibold text-slate-400"
                >
                  Whole Value (Y)
                </label>
                <input
                  id="what-pct-y"
                  type="number"
                  step="any"
                  value={whatPctY}
                  onChange={(e) => setWhatPctY(e.target.value)}
                  placeholder="e.g. 180"
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 text-sm font-semibold text-white"
                />
              </div>

              <div className="md:col-span-4 bg-cyan-500/10 border border-cyan-500/30 rounded-xl px-4 py-2.5 flex items-center justify-between gap-2">
                <div>
                  <span className="block text-[11px] font-semibold text-cyan-300 uppercase tracking-wider">
                    Percentage
                  </span>
                  <span className="text-xl font-extrabold text-white font-mono">
                    {res2 !== null ? `${formatNumber(res2)}%` : "—"}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={res2 === null}
                  onClick={() =>
                    res2 !== null &&
                    copyResult(`${formatNumber(res2)}%`, "calc2")
                  }
                  className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-xs font-semibold text-slate-200 border border-slate-700 transition flex items-center gap-1.5"
                >
                  {copiedId === "calc2" ? (
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
            </div>

            {whatPctY === "0" ? (
              <p className="text-xs text-rose-400">
                Whole value (Y) cannot be 0.
              </p>
            ) : (
              res2 !== null && (
                <p className="text-xs text-slate-400">
                  <strong className="text-slate-200">{whatPctX}</strong> is{" "}
                  <strong className="text-cyan-300">{formatNumber(res2)}%</strong>{" "}
                  of <strong className="text-slate-200">{whatPctY}</strong>.
                </p>
              )
            )}
          </div>

          {/* Card 3: Percentage Increase / Decrease */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                {res3 !== null && res3 < 0 ? (
                  <TrendingDown className="w-4 h-4 text-rose-400" />
                ) : (
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                )}
                3. Percentage Increase / Decrease
              </h2>
              <span className="text-[11px] font-mono text-slate-400 bg-slate-950 border border-slate-800 px-2.5 py-1 rounded-lg">
                ((New − Old) ÷ |Old|) × 100
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              <div className="md:col-span-4 space-y-1.5">
                <label
                  htmlFor="change-from"
                  className="block text-xs font-semibold text-slate-400"
                >
                  Original Value (From)
                </label>
                <input
                  id="change-from"
                  type="number"
                  step="any"
                  value={changeFrom}
                  onChange={(e) => setChangeFrom(e.target.value)}
                  placeholder="e.g. 120"
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 text-sm font-semibold text-white"
                />
              </div>

              <div className="md:col-span-4 space-y-1.5">
                <label
                  htmlFor="change-to"
                  className="block text-xs font-semibold text-slate-400"
                >
                  New Value (To)
                </label>
                <input
                  id="change-to"
                  type="number"
                  step="any"
                  value={changeTo}
                  onChange={(e) => setChangeTo(e.target.value)}
                  placeholder="e.g. 150"
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 text-sm font-semibold text-white"
                />
              </div>

              <div
                className={`md:col-span-4 rounded-xl px-4 py-2.5 border flex items-center justify-between gap-2 ${
                  res3 !== null && res3 < 0
                    ? "bg-rose-500/10 border-rose-500/30"
                    : "bg-emerald-500/10 border-emerald-500/30"
                }`}
              >
                <div>
                  <span
                    className={`block text-[11px] font-semibold uppercase tracking-wider ${
                      res3 !== null && res3 < 0
                        ? "text-rose-300"
                        : "text-emerald-300"
                    }`}
                  >
                    {res3 === null
                      ? "Change"
                      : res3 > 0
                      ? "Increase"
                      : res3 < 0
                      ? "Decrease"
                      : "No Change"}
                  </span>
                  <span className="text-xl font-extrabold text-white font-mono">
                    {res3 !== null
                      ? `${res3 > 0 ? "+" : ""}${formatNumber(res3)}%`
                      : "—"}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={res3 === null}
                  onClick={() =>
                    res3 !== null &&
                    copyResult(
                      `${res3 > 0 ? "+" : ""}${formatNumber(res3)}%`,
                      "calc3"
                    )
                  }
                  className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-xs font-semibold text-slate-200 border border-slate-700 transition flex items-center gap-1.5"
                >
                  {copiedId === "calc3" ? (
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
            </div>

            {changeFrom === "0" ? (
              <p className="text-xs text-rose-400">
                Original value cannot be 0 when computing percentage change.
              </p>
            ) : (
              res3 !== null &&
              diff3 !== null && (
                <p className="text-xs text-slate-400">
                  Moving from{" "}
                  <strong className="text-slate-200">{changeFrom}</strong> to{" "}
                  <strong className="text-slate-200">{changeTo}</strong> is a{" "}
                  <strong
                    className={
                      res3 < 0 ? "text-rose-300" : "text-emerald-300"
                    }
                  >
                    {formatNumber(Math.abs(res3))}%{" "}
                    {res3 < 0 ? "decrease" : "increase"}
                  </strong>{" "}
                  (difference of {diff3 > 0 ? "+" : ""}
                  {formatNumber(diff3)}).
                </p>
              )
            )}
          </div>
        </div>

        <ToolSeoContent
          toolName="Percentage Calculator"
          aboutParagraphs={[
            "Our free online Percentage Calculator lets you solve the three most common percentage problems in seconds without memorizing formulas or opening a spreadsheet. Whether you are checking a store discount, calculating sales tax or tips, grading exam marks, or tracking YouTube view growth and business revenue changes, every answer updates automatically as you type.",
            "All math runs 100% locally in your web browser with instant precision up to four decimal places, showing both the exact result and the underlying formula so students, shoppers, marketers, and business owners can double-check numbers with complete confidence.",
          ]}
          howToSteps={[
            {
              title: "Find X% of Y (Discounts, Tax & Tips)",
              detail:
                "Enter the percentage (X) and base amount (Y) in Calculator 1 to instantly see the exact value along with discounted and marked-up totals.",
            },
            {
              title: "Find What % X Is of Y (Scores & Ratios)",
              detail:
                "Enter your part score or subset (X) and total amount (Y) in Calculator 2 to compute the exact share as a percentage.",
            },
            {
              title: "Measure Percentage Increase or Decrease",
              detail:
                "Enter the starting number and new number in Calculator 3 to calculate growth or drop percentages plus the exact numeric difference.",
            },
          ]}
          highlights={[
            "Three essential percentage calculators on one clean, dark-mode screen with instant real-time updates.",
            "Displays clear formulas and plain-English summaries alongside one-click Copy buttons for every result.",
            "Automatically shows discounted and marked-up prices in Calculator 1 for fast shopping and pricing math.",
            "100% client-side, ad-light, mobile-friendly, and free with no account or signup needed.",
          ]}
        />
      </div>
    </div>
  );
}
