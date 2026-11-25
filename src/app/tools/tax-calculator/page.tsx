"use client";

import React, { useState } from "react";
import Link from "next/link";
import BackButton from "@/components/BackButton";
import ToolSeoContent from "@/components/ToolSeoContent";
import {
  Landmark,
  Calculator,
  AlertTriangle,
  Percent,
  Wallet,
  Receipt,
  Globe,
  RotateCcw,
} from "lucide-react";

interface TaxSlab {
  min: number;
  max: number | null; // null means infinity
  rate: number; // percentage, e.g. 5 for 5%
  label?: string;
}

interface CountryTaxConfig {
  code: string;
  name: string;
  currencyCode: string;
  currencySymbol: string;
  sampleIncome: string;
  regimeNote: string;
  slabs: TaxSlab[];
}

const COUNTRY_TAX_CONFIGS: CountryTaxConfig[] = [
  {
    code: "PK",
    name: "Pakistan",
    currencyCode: "PKR",
    currencySymbol: "Rs ",
    sampleIncome: "2400000",
    regimeNote: "Basic Salaried Individual Income Tax Slabs (PKR / Year)",
    slabs: [
      { min: 0, max: 600000, rate: 0, label: "Tax-free threshold" },
      { min: 600000, max: 1200000, rate: 5 },
      { min: 1200000, max: 2200000, rate: 15 },
      { min: 2200000, max: 3200000, rate: 25 },
      { min: 3200000, max: 4100000, rate: 30 },
      { min: 4100000, max: null, rate: 35 },
    ],
  },
  {
    code: "IN",
    name: "India",
    currencyCode: "INR",
    currencySymbol: "₹",
    sampleIncome: "1500000",
    regimeNote: "Basic New Tax Regime Progressive Slabs (INR / Year)",
    slabs: [
      { min: 0, max: 400000, rate: 0, label: "Tax-free threshold" },
      { min: 400000, max: 800000, rate: 5 },
      { min: 800000, max: 1200000, rate: 10 },
      { min: 1200000, max: 1600000, rate: 15 },
      { min: 1600000, max: 2000000, rate: 20 },
      { min: 2000000, max: 2400000, rate: 25 },
      { min: 2400000, max: null, rate: 30 },
    ],
  },
  {
    code: "US",
    name: "United States",
    currencyCode: "USD",
    currencySymbol: "$",
    sampleIncome: "85000",
    regimeNote: "Basic Federal Single-Filer Taxable Income Brackets (USD / Year)",
    slabs: [
      { min: 0, max: 11925, rate: 10 },
      { min: 11925, max: 48475, rate: 12 },
      { min: 48475, max: 103350, rate: 22 },
      { min: 103350, max: 197300, rate: 24 },
      { min: 197300, max: 250525, rate: 32 },
      { min: 250525, max: 626350, rate: 35 },
      { min: 626350, max: null, rate: 37 },
    ],
  },
  {
    code: "UK",
    name: "United Kingdom",
    currencyCode: "GBP",
    currencySymbol: "£",
    sampleIncome: "55000",
    regimeNote: "Basic UK Income Tax Bands (England / Wales / NI, GBP / Year)",
    slabs: [
      { min: 0, max: 12570, rate: 0, label: "Personal Allowance" },
      { min: 12570, max: 50270, rate: 20, label: "Basic Rate" },
      { min: 50270, max: 125140, rate: 40, label: "Higher Rate" },
      { min: 125140, max: null, rate: 45, label: "Additional Rate" },
    ],
  },
  {
    code: "AE",
    name: "United Arab Emirates (UAE)",
    currencyCode: "AED",
    currencySymbol: "AED ",
    sampleIncome: "240000",
    regimeNote: "Personal Employment Income Tax (0% in UAE)",
    slabs: [
      {
        min: 0,
        max: null,
        rate: 0,
        label: "No personal income tax",
      },
    ],
  },
];

interface SlabBreakdownRow {
  rangeText: string;
  label?: string;
  rate: number;
  taxableAmount: number;
  taxAmount: number;
  isActive: boolean;
}

interface TaxCalculationResult {
  country: CountryTaxConfig;
  grossIncome: number;
  totalTax: number;
  effectiveRate: number;
  marginalRate: number;
  netIncome: number;
  breakdown: SlabBreakdownRow[];
}

function formatCurrency(
  value: number,
  symbol: string,
  decimals = 0
): string {
  if (!Number.isFinite(value)) return "—";
  return `${symbol}${value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

function calculateProgressiveTax(
  country: CountryTaxConfig,
  income: number
): TaxCalculationResult {
  let totalTax = 0;
  let marginalRate = 0;

  const breakdown: SlabBreakdownRow[] = country.slabs.map((slab) => {
    const upperBound = slab.max === null ? Infinity : slab.max;
    const taxableAmount =
      income > slab.min ? Math.min(income, upperBound) - slab.min : 0;
    const taxAmount = (taxableAmount * slab.rate) / 100;
    const isActive = taxableAmount > 0;

    if (isActive) {
      totalTax += taxAmount;
      marginalRate = slab.rate;
    }

    const rangeText =
      slab.max === null
        ? slab.min === 0
          ? "All Income"
          : `Above ${formatCurrency(slab.min, country.currencySymbol)}`
        : `${formatCurrency(slab.min, country.currencySymbol)} – ${formatCurrency(slab.max, country.currencySymbol)}`;

    return {
      rangeText,
      label: slab.label,
      rate: slab.rate,
      taxableAmount,
      taxAmount,
      isActive,
    };
  });

  const effectiveRate = income > 0 ? (totalTax / income) * 100 : 0;
  const netIncome = Math.max(0, income - totalTax);

  return {
    country,
    grossIncome: income,
    totalTax,
    effectiveRate,
    marginalRate,
    netIncome,
    breakdown,
  };
}

export default function TaxCalculatorPage() {
  const [selectedCountryCode, setSelectedCountryCode] = useState<string>("PK");
  const [annualIncome, setAnnualIncome] = useState<string>(
    COUNTRY_TAX_CONFIGS[0].sampleIncome
  );
  const [result, setResult] = useState<TaxCalculationResult | null>(() =>
    calculateProgressiveTax(
      COUNTRY_TAX_CONFIGS[0],
      parseFloat(COUNTRY_TAX_CONFIGS[0].sampleIncome)
    )
  );
  const [inputError, setInputError] = useState<string>("");

  const activeCountry =
    COUNTRY_TAX_CONFIGS.find((c) => c.code === selectedCountryCode) ||
    COUNTRY_TAX_CONFIGS[0];

  const handleCountryChange = (nextCode: string) => {
    const nextCountry =
      COUNTRY_TAX_CONFIGS.find((c) => c.code === nextCode) ||
      COUNTRY_TAX_CONFIGS[0];
    setSelectedCountryCode(nextCode);
    setAnnualIncome(nextCountry.sampleIncome);
    setInputError("");
    setResult(
      calculateProgressiveTax(
        nextCountry,
        parseFloat(nextCountry.sampleIncome)
      )
    );
  };

  const handleCalculate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const parsed = parseFloat(annualIncome);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setInputError("Please enter a valid annual income of 0 or greater.");
      setResult(null);
      return;
    }
    setInputError("");
    setResult(calculateProgressiveTax(activeCountry, parsed));
  };

  const handleReset = () => {
    setAnnualIncome(activeCountry.sampleIncome);
    setInputError("");
    setResult(
      calculateProgressiveTax(
        activeCountry,
        parseFloat(activeCountry.sampleIncome)
      )
    );
  };

  const taxSharePercent =
    result && result.grossIncome > 0
      ? Math.min(100, (result.totalTax / result.grossIncome) * 100)
      : 0;
  const netSharePercent = 100 - taxSharePercent;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-8 sm:py-10 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <BackButton />

        {/* Header */}
        <header className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold">
            <Landmark className="w-3.5 h-3.5" />
            <span>100% Client-Side • Pakistan, India, US, UK &amp; UAE</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            Country-Wise Income{" "}
            <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400 bg-clip-text text-transparent">
              Tax Calculator
            </span>
          </h1>
          <p className="text-sm sm:text-base text-slate-400 max-w-2xl leading-relaxed">
            Estimate your annual income tax, effective tax rate, and take-home
            net income across Pakistan, India, the United States, the United
            Kingdom, and the UAE with a clear slab-by-slab breakdown.
          </p>
        </header>

        {/* Input Form Card */}
        <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-7 space-y-5 shadow-xl shadow-black/30">
          <form onSubmit={handleCalculate} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Country Selector */}
              <div className="space-y-2">
                <label
                  htmlFor="tax-country"
                  className="text-xs font-semibold uppercase tracking-wider text-slate-400 block"
                >
                  Select Country
                </label>
                <select
                  id="tax-country"
                  value={selectedCountryCode}
                  onChange={(e) => handleCountryChange(e.target.value)}
                  className="w-full px-3.5 py-3.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-amber-500 text-sm font-semibold text-white focus:outline-none transition cursor-pointer"
                >
                  {COUNTRY_TAX_CONFIGS.map((country) => (
                    <option
                      key={country.code}
                      value={country.code}
                      className="bg-slate-950"
                    >
                      {country.name} ({country.currencyCode})
                    </option>
                  ))}
                </select>
              </div>

              {/* Annual Income Input */}
              <div className="space-y-2">
                <label
                  htmlFor="annual-income"
                  className="text-xs font-semibold uppercase tracking-wider text-slate-400 block"
                >
                  Annual Income ({activeCountry.currencyCode})
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400 pointer-events-none">
                    {activeCountry.currencySymbol.trim()}
                  </span>
                  <input
                    id="annual-income"
                    type="number"
                    min="0"
                    step="any"
                    value={annualIncome}
                    onChange={(e) => setAnnualIncome(e.target.value)}
                    placeholder={`e.g. ${activeCountry.sampleIncome}`}
                    className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-base font-bold text-white focus:outline-none transition"
                  />
                </div>
              </div>
            </div>

            {inputError && (
              <p className="text-xs font-semibold text-rose-400">
                {inputError}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <button
                  type="submit"
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-extrabold text-sm shadow-lg shadow-amber-600/20 transition flex items-center gap-2"
                >
                  <Calculator className="w-4 h-4" />
                  Calculate Tax
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs sm:text-sm font-semibold transition flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset
                </button>
              </div>
              <span className="text-[11px] text-slate-400">
                {activeCountry.regimeNote}
              </span>
            </div>
          </form>
        </section>

        {/* Results Section */}
        {result && (
          <section className="space-y-5">
            {/* Summary Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-rose-400 uppercase tracking-wider">
                  <Receipt className="w-4 h-4" />
                  <span>Total Annual Tax</span>
                </div>
                <p className="text-2xl sm:text-3xl font-extrabold text-white break-all">
                  {formatCurrency(
                    result.totalTax,
                    result.country.currencySymbol,
                    2
                  )}
                </p>
                <p className="text-xs text-slate-400">
                  Monthly:{" "}
                  <strong className="text-slate-200">
                    {formatCurrency(
                      result.totalTax / 12,
                      result.country.currencySymbol,
                      2
                    )}
                  </strong>
                </p>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-400 uppercase tracking-wider">
                  <Percent className="w-4 h-4" />
                  <span>Effective Tax Rate</span>
                </div>
                <p className="text-2xl sm:text-3xl font-extrabold text-white">
                  {result.effectiveRate.toFixed(2)}%
                </p>
                <p className="text-xs text-slate-400">
                  Top marginal slab:{" "}
                  <strong className="text-slate-200">
                    {result.marginalRate}%
                  </strong>
                </p>
              </div>

              <div className="bg-slate-900/90 border border-emerald-500/30 rounded-2xl p-5 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                  <Wallet className="w-4 h-4" />
                  <span>Net Annual Income</span>
                </div>
                <p className="text-2xl sm:text-3xl font-extrabold text-emerald-300 break-all">
                  {formatCurrency(
                    result.netIncome,
                    result.country.currencySymbol,
                    2
                  )}
                </p>
                <p className="text-xs text-slate-400">
                  Monthly take-home:{" "}
                  <strong className="text-slate-200">
                    {formatCurrency(
                      result.netIncome / 12,
                      result.country.currencySymbol,
                      2
                    )}
                  </strong>
                </p>
              </div>
            </div>

            {/* Visual Income Split Bar */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-emerald-400">
                  Take-Home Pay ({netSharePercent.toFixed(1)}%)
                </span>
                <span className="text-rose-400">
                  Estimated Tax ({taxSharePercent.toFixed(1)}%)
                </span>
              </div>
              <div className="w-full h-3 rounded-full bg-slate-800 overflow-hidden flex">
                <div
                  className="h-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${netSharePercent}%` }}
                />
                <div
                  className="h-full bg-rose-500 transition-all duration-300"
                  style={{ width: `${taxSharePercent}%` }}
                />
              </div>
            </div>

            {/* Slab-by-Slab Breakdown Table */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm sm:text-base font-bold text-white">
                  Tax Slab Breakdown — {result.country.name}
                </h2>
                <span className="text-xs text-slate-400">
                  Gross Annual Income:{" "}
                  <strong className="text-slate-200">
                    {formatCurrency(
                      result.grossIncome,
                      result.country.currencySymbol,
                      2
                    )}
                  </strong>
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-slate-950/70 text-slate-400 uppercase text-[11px] tracking-wider border-b border-slate-800">
                      <th className="py-3 px-4 font-semibold">Income Slab</th>
                      <th className="py-3 px-4 font-semibold">Tax Rate</th>
                      <th className="py-3 px-4 font-semibold text-right">
                        Taxable in Slab
                      </th>
                      <th className="py-3 px-4 font-semibold text-right">
                        Tax Owed
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {result.breakdown.map((row, idx) => (
                      <tr
                        key={idx}
                        className={
                          row.isActive
                            ? "bg-amber-500/[0.04] text-slate-100"
                            : "text-slate-500"
                        }
                      >
                        <td className="py-3 px-4 font-medium">
                          <div>{row.rangeText}</div>
                          {row.label && (
                            <div className="text-[11px] text-slate-400">
                              {row.label}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-md font-mono font-bold text-xs ${
                              row.isActive
                                ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                                : "bg-slate-800 text-slate-400"
                            }`}
                          >
                            {row.rate}%
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono">
                          {formatCurrency(
                            row.taxableAmount,
                            result.country.currencySymbol,
                            2
                          )}
                        </td>
                        <td
                          className={`py-3 px-4 text-right font-mono font-bold ${
                            row.taxAmount > 0
                              ? "text-rose-300"
                              : "text-slate-400"
                          }`}
                        >
                          {formatCurrency(
                            row.taxAmount,
                            result.country.currencySymbol,
                            2
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-950/90 border-t border-slate-700 font-bold text-white">
                      <td className="py-3.5 px-4" colSpan={2}>
                        Total Estimated Tax
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-300">
                        {formatCurrency(
                          result.grossIncome,
                          result.country.currencySymbol,
                          2
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-rose-400">
                        {formatCurrency(
                          result.totalTax,
                          result.country.currencySymbol,
                          2
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* Required Tax Disclaimer */}
        <section
          aria-label="Tax Calculation Disclaimer"
          className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 sm:p-5 flex items-start gap-3"
        >
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h2 className="text-xs sm:text-sm font-bold text-amber-300 uppercase tracking-wide">
              Important Disclaimer
            </h2>
            <p className="text-xs sm:text-sm text-amber-100/90 leading-relaxed">
              This calculator provides an estimate based on basic tax slabs. Tax
              laws change frequently. Please consult a tax professional for
              accurate advice.
            </p>
          </div>
        </section>

        {/* Cross-links */}
        <section className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-0.5">
            <h2 className="text-sm font-bold text-white">
              Convert Your Net Income to Another Currency
            </h2>
            <p className="text-xs text-slate-400">
              Compare salaries internationally with live exchange rates or run
              quick percentage math.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Link
              href="/tools/currency-converter"
              className="px-3.5 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-xs font-semibold text-indigo-200 transition flex items-center gap-1.5"
            >
              <Globe className="w-3.5 h-3.5 text-indigo-400" />
              Currency Converter
            </Link>
            <Link
              href="/tools/percentage-calculator"
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition"
            >
              Percentage Calculator
            </Link>
            <Link
              href="/tools/word-counter"
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition"
            >
              Word Counter
            </Link>
          </div>
        </section>

        {/* Rich SEO Guide */}
        <ToolSeoContent
          toolName="Country-Wise Income Tax Calculator"
          aboutParagraphs={[
            "Understanding progressive income tax brackets can be confusing because entering a higher slab does not mean your entire salary is taxed at that top percentage. Only the portion of your annual income that falls inside each slab is taxed at that slab's rate.",
            "Our free client-side Country-Wise Tax Calculator breaks down your estimated annual tax, effective tax rate, monthly and yearly take-home pay, and exact slab-by-slab contributions for Pakistan, India, the United States, the United Kingdom, and the United Arab Emirates—all privately inside your browser with zero data sent to any server.",
          ]}
          howToSteps={[
            {
              title: "Choose Your Country",
              detail:
                "Select Pakistan (PKR), India (INR), United States (USD), United Kingdom (GBP), or United Arab Emirates (AED) from the country selector.",
            },
            {
              title: "Enter Annual Gross Income",
              detail:
                "Type your total yearly salary or taxable income in that country's local currency.",
            },
            {
              title: "Review Your Slab Breakdown",
              detail:
                "Click Calculate Tax to inspect total annual tax, effective vs. marginal tax rate, net take-home pay, and exactly how much tax applies to each progressive slab.",
            },
          ]}
          highlights={[
            "100% client-side calculation—your salary and financial details never leave your browser.",
            "Clearly distinguishes effective tax rate (average tax paid) from marginal tax rate (highest slab reached).",
            "Shows both annual and monthly tax and net take-home estimates for easier budgeting.",
            "Covers basic progressive slabs across five major economies including 0% personal income tax in the UAE.",
          ]}
        />
      </div>
    </div>
  );
}
