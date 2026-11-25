"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import BackButton from "@/components/BackButton";
import ToolSeoContent from "@/components/ToolSeoContent";
import {
  ArrowLeftRight,
  RefreshCw,
  Copy,
  Check,
  Globe,
  Clock,
  AlertCircle,
  Calculator,
  Sparkles,
} from "lucide-react";

const POPULAR_CURRENCY_NAMES: Record<string, string> = {
  USD: "US Dollar",
  EUR: "Euro",
  GBP: "British Pound",
  PKR: "Pakistani Rupee",
  INR: "Indian Rupee",
  AED: "UAE Dirham",
  SAR: "Saudi Riyal",
  CAD: "Canadian Dollar",
  AUD: "Australian Dollar",
  JPY: "Japanese Yen",
  CNY: "Chinese Yuan",
  CHF: "Swiss Franc",
  TRY: "Turkish Lira",
  SGD: "Singapore Dollar",
  MYR: "Malaysian Ringgit",
  QAR: "Qatari Riyal",
  KWD: "Kuwaiti Dinar",
  OMR: "Omani Rial",
  BHD: "Bahraini Dinar",
  NZD: "New Zealand Dollar",
  HKD: "Hong Kong Dollar",
  KRW: "South Korean Won",
  BRL: "Brazilian Real",
  MXN: "Mexican Peso",
  ZAR: "South African Rand",
  BDT: "Bangladeshi Taka",
  LKR: "Sri Lankan Rupee",
  PHP: "Philippine Peso",
  IDR: "Indonesian Rupiah",
  THB: "Thai Baht",
  VND: "Vietnamese Dong",
  EGP: "Egyptian Pound",
  NGN: "Nigerian Naira",
  SEK: "Swedish Krona",
  NOK: "Norwegian Krone",
  DKK: "Danish Krone",
  PLN: "Polish Zloty",
};

const PRIORITY_CODES = [
  "USD",
  "EUR",
  "GBP",
  "PKR",
  "INR",
  "AED",
  "SAR",
  "CAD",
  "AUD",
  "JPY",
  "CNY",
  "CHF",
  "TRY",
  "SGD",
  "MYR",
];

const QUICK_PAIRS: { from: string; to: string }[] = [
  { from: "USD", to: "PKR" },
  { from: "USD", to: "INR" },
  { from: "USD", to: "EUR" },
  { from: "USD", to: "GBP" },
  { from: "USD", to: "AED" },
  { from: "GBP", to: "PKR" },
  { from: "EUR", to: "USD" },
  { from: "AED", to: "PKR" },
];

function formatMoney(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function getCurrencyLabel(code: string): string {
  const known = POPULAR_CURRENCY_NAMES[code];
  if (known) return `${code} — ${known}`;
  try {
    if (typeof Intl !== "undefined" && typeof Intl.DisplayNames === "function") {
      const displayNames = new Intl.DisplayNames(["en"], { type: "currency" });
      const resolved = displayNames.of(code);
      if (resolved && resolved !== code) {
        return `${code} — ${resolved}`;
      }
    }
  } catch {
    // ignore unsupported currency codes
  }
  return code;
}

export default function CurrencyConverterPage() {
  const [amount, setAmount] = useState<string>("100");
  const [fromCurrency, setFromCurrency] = useState<string>("USD");
  const [toCurrency, setToCurrency] = useState<string>("PKR");

  const [rates, setRates] = useState<Record<string, number>>({});
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [rateSource, setRateSource] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  const [convertedResult, setConvertedResult] = useState<{
    amount: number;
    from: string;
    to: string;
    result: number;
    unitRate: number;
    inverseRate: number;
  } | null>(null);

  const [copied, setCopied] = useState<boolean>(false);

  const computeConversion = useCallback(
    (
      amtStr: string,
      from: string,
      to: string,
      rateMap: Record<string, number>
    ) => {
      const parsed = parseFloat(amtStr);
      const fromRate = rateMap[from];
      const toRate = rateMap[to];
      if (
        !Number.isFinite(parsed) ||
        parsed < 0 ||
        !fromRate ||
        !toRate
      ) {
        setConvertedResult(null);
        return;
      }
      const unitRate = toRate / fromRate;
      const inverseRate = fromRate / toRate;
      setConvertedResult({
        amount: parsed,
        from,
        to,
        result: parsed * unitRate,
        unitRate,
        inverseRate,
      });
    },
    []
  );

  const fetchRates = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("https://open.er-api.com/v6/latest/USD");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data?.result === "success" && data?.rates) {
        setRates(data.rates);
        const updatedDate = data.time_last_update_utc
          ? new Date(data.time_last_update_utc).toLocaleString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              timeZoneName: "short",
            })
          : new Date().toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            });
        setLastUpdated(updatedDate);
        setRateSource("ExchangeRate-API (open.er-api.com)");
        setLoading(false);
        return;
      }
      throw new Error("Invalid exchange rate payload");
    } catch {
      // Fallback to Frankfurter API if open.er-api.com is unavailable
      try {
        const fallbackRes = await fetch(
          "https://api.frankfurter.app/latest?from=USD"
        );
        if (!fallbackRes.ok) throw new Error(`HTTP ${fallbackRes.status}`);
        const fallbackData = await fallbackRes.json();
        if (fallbackData?.rates) {
          const mergedRates: Record<string, number> = {
            USD: 1,
            ...fallbackData.rates,
          };
          setRates(mergedRates);
          setLastUpdated(fallbackData.date || new Date().toISOString().slice(0, 10));
          setRateSource("Frankfurter ECB API (api.frankfurter.app)");
          setLoading(false);
          return;
        }
      } catch {
        // fall through to error state
      }
      setError(
        "Unable to fetch live exchange rates right now. Please check your internet connection and click Refresh Rates."
      );
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRates();
  }, [fetchRates]);

  // Automatically calculate once live rates load
  useEffect(() => {
    if (Object.keys(rates).length > 0) {
      // If fallback API doesn't include current toCurrency, default safely to EUR
      const validFrom = rates[fromCurrency] ? fromCurrency : "USD";
      const validTo = rates[toCurrency] ? toCurrency : "EUR";
      if (validFrom !== fromCurrency) setFromCurrency(validFrom);
      if (validTo !== toCurrency) setToCurrency(validTo);
      computeConversion(amount, validFrom, validTo, rates);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rates]);

  const sortedCurrencyCodes = useMemo(() => {
    const keys = Object.keys(rates);
    if (keys.length === 0) return PRIORITY_CODES;
    const priorityPresent = PRIORITY_CODES.filter((c) => rates[c] !== undefined);
    const remaining = keys
      .filter((c) => !PRIORITY_CODES.includes(c))
      .sort((a, b) => a.localeCompare(b));
    return [...priorityPresent, ...remaining];
  }, [rates]);

  const handleConvert = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    computeConversion(amount, fromCurrency, toCurrency, rates);
  };

  const handleSwap = () => {
    const nextFrom = toCurrency;
    const nextTo = fromCurrency;
    setFromCurrency(nextFrom);
    setToCurrency(nextTo);
    if (Object.keys(rates).length > 0) {
      computeConversion(amount, nextFrom, nextTo, rates);
    }
  };

  const handleQuickPair = (from: string, to: string) => {
    if (!rates[from] || !rates[to]) return;
    setFromCurrency(from);
    setToCurrency(to);
    computeConversion(amount, from, to, rates);
  };

  const handleCopy = async () => {
    if (!convertedResult) return;
    const text = `${formatMoney(convertedResult.amount, 2)} ${convertedResult.from} = ${formatMoney(convertedResult.result, 2)} ${convertedResult.to}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-8 sm:py-10 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <BackButton />

        {/* Header */}
        <header className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-semibold">
            <Globe className="w-3.5 h-3.5" />
            <span>Live Exchange Rates • 160+ World Currencies</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            Live Currency{" "}
            <span className="bg-gradient-to-r from-indigo-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">
              Converter
            </span>
          </h1>
          <p className="text-sm sm:text-base text-slate-400 max-w-2xl leading-relaxed">
            Convert between USD, EUR, GBP, PKR, INR, AED, and over 160 global
            currencies using live exchange rates calculated directly in your
            browser.
          </p>
        </header>

        {/* Main Converter Card */}
        <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-7 space-y-6 shadow-xl shadow-black/30">
          {error && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs sm:text-sm">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">{error}</div>
              <button
                type="button"
                onClick={fetchRates}
                className="px-3 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-xs font-bold shrink-0 transition"
              >
                Retry
              </button>
            </div>
          )}

          <form onSubmit={handleConvert} className="space-y-5">
            {/* Amount Input */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label
                  htmlFor="currency-amount"
                  className="text-xs font-semibold uppercase tracking-wider text-slate-400"
                >
                  Amount
                </label>
                <div className="flex items-center gap-1.5">
                  {["1", "100", "500", "1000"].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        setAmount(preset);
                        if (Object.keys(rates).length > 0) {
                          computeConversion(
                            preset,
                            fromCurrency,
                            toCurrency,
                            rates
                          );
                        }
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition ${
                        amount === preset
                          ? "bg-indigo-600/20 border-indigo-500/50 text-indigo-300"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700"
                      }`}
                    >
                      {Number(preset).toLocaleString("en-US")}
                    </button>
                  ))}
                </div>
              </div>
              <input
                id="currency-amount"
                type="number"
                step="any"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount (e.g. 100)"
                className="w-full px-4 py-3.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-lg sm:text-xl font-bold text-white focus:outline-none transition"
              />
            </div>

            {/* From / Swap / To */}
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-end gap-3">
              <div className="space-y-2">
                <label
                  htmlFor="from-currency"
                  className="text-xs font-semibold uppercase tracking-wider text-slate-400 block"
                >
                  From Currency
                </label>
                <select
                  id="from-currency"
                  value={fromCurrency}
                  onChange={(e) => setFromCurrency(e.target.value)}
                  className="w-full px-3.5 py-3 rounded-xl bg-slate-950 border border-slate-800 focus:border-indigo-500 text-sm font-semibold text-white focus:outline-none transition cursor-pointer"
                >
                  {sortedCurrencyCodes.map((code) => (
                    <option key={code} value={code} className="bg-slate-950">
                      {getCurrencyLabel(code)}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={handleSwap}
                aria-label="Swap currencies"
                title="Swap currencies"
                className="mx-auto md:mx-0 p-3 rounded-xl bg-slate-800 hover:bg-indigo-600 border border-slate-700 hover:border-indigo-500 text-slate-200 hover:text-white transition flex items-center justify-center"
              >
                <ArrowLeftRight className="w-4 h-4" />
              </button>

              <div className="space-y-2">
                <label
                  htmlFor="to-currency"
                  className="text-xs font-semibold uppercase tracking-wider text-slate-400 block"
                >
                  To Currency
                </label>
                <select
                  id="to-currency"
                  value={toCurrency}
                  onChange={(e) => setToCurrency(e.target.value)}
                  className="w-full px-3.5 py-3 rounded-xl bg-slate-950 border border-slate-800 focus:border-indigo-500 text-sm font-semibold text-white focus:outline-none transition cursor-pointer"
                >
                  {sortedCurrencyCodes.map((code) => (
                    <option key={code} value={code} className="bg-slate-950">
                      {getCurrencyLabel(code)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={loading || Object.keys(rates).length === 0}
                className="flex-1 sm:flex-initial px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 disabled:opacity-50 text-white text-sm font-bold shadow-lg shadow-indigo-600/25 transition flex items-center justify-center gap-2"
              >
                <Globe className="w-4 h-4" />
                {loading ? "Loading Rates..." : "Convert"}
              </button>

              <button
                type="button"
                onClick={fetchRates}
                disabled={loading}
                className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs sm:text-sm font-semibold transition flex items-center gap-1.5"
              >
                <RefreshCw
                  className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
                />
                Refresh Rates
              </button>
            </div>
          </form>

          {/* Converted Result Panel */}
          <div className="rounded-2xl bg-slate-950/90 border border-slate-800 p-5 sm:p-6 space-y-4">
            {loading && !convertedResult ? (
              <div className="py-4 text-center text-sm text-slate-400">
                Fetching latest exchange rates...
              </div>
            ) : convertedResult ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-xs sm:text-sm font-medium text-slate-400">
                      {formatMoney(convertedResult.amount, 2)}{" "}
                      {convertedResult.from} =
                    </p>
                    <p className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white break-all">
                      {formatMoney(convertedResult.result, 2)}{" "}
                      <span className="text-emerald-400">
                        {convertedResult.to}
                      </span>
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleCopy}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition flex items-center gap-1.5 shrink-0"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Copy Result
                      </>
                    )}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-3 border-t border-slate-800/80 text-xs font-mono text-slate-300">
                  <div className="px-3 py-2 rounded-lg bg-slate-900/90 border border-slate-800/80">
                    1 {convertedResult.from} ={" "}
                    <span className="text-cyan-400 font-bold">
                      {formatMoney(convertedResult.unitRate, 4)}{" "}
                      {convertedResult.to}
                    </span>
                  </div>
                  <div className="px-3 py-2 rounded-lg bg-slate-900/90 border border-slate-800/80">
                    1 {convertedResult.to} ={" "}
                    <span className="text-indigo-400 font-bold">
                      {formatMoney(convertedResult.inverseRate, 4)}{" "}
                      {convertedResult.from}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <div className="py-3 text-sm text-slate-400">
                Enter a valid amount and click <strong>Convert</strong> to view
                the live exchange rate.
              </div>
            )}

            {/* Last Updated Note */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/60 text-[11px] text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span>
                  Last updated:{" "}
                  <strong className="text-slate-200">
                    {lastUpdated || "Loading..."}
                  </strong>
                </span>
              </span>
              {rateSource && (
                <span className="text-slate-500">Source: {rateSource}</span>
              )}
            </div>
          </div>
        </section>

        {/* Popular Live Pairs Quick-Select */}
        {Object.keys(rates).length > 0 && (
          <section className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-3.5">
            <h2 className="text-sm font-bold text-white">
              Popular Live Exchange Rates
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {QUICK_PAIRS.filter(
                (pair) => rates[pair.from] && rates[pair.to]
              ).map((pair) => {
                const pairRate = rates[pair.to] / rates[pair.from];
                return (
                  <button
                    key={`${pair.from}-${pair.to}`}
                    type="button"
                    onClick={() => handleQuickPair(pair.from, pair.to)}
                    className="p-3 rounded-xl bg-slate-950/80 hover:bg-slate-800/90 border border-slate-800 hover:border-indigo-500/40 text-left transition"
                  >
                    <div className="text-xs font-bold text-indigo-300">
                      {pair.from} → {pair.to}
                    </div>
                    <div className="text-sm font-mono font-bold text-white mt-0.5">
                      {formatMoney(pairRate, 2)}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Related Utilities */}
        <section className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-0.5">
            <h2 className="text-sm font-bold text-white">
              Need More Financial &amp; Everyday Utilities?
            </h2>
            <p className="text-xs text-slate-400">
              Estimate annual income tax, calculate percentages, or generate
              secure passwords right in your browser.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Link
              href="/tools/tax-calculator"
              className="px-3.5 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-xs font-semibold text-indigo-200 transition flex items-center gap-1.5"
            >
              <Calculator className="w-3.5 h-3.5 text-indigo-400" />
              Tax Calculator
            </Link>
            <Link
              href="/tools/percentage-calculator"
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              Percentage Calculator
            </Link>
            <Link
              href="/tools/password-generator"
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition"
            >
              Password Generator
            </Link>
          </div>
        </section>

        {/* Rich SEO Content */}
        <ToolSeoContent
          toolName="Live Currency Converter"
          aboutParagraphs={[
            "Whether you are invoicing international freelance clients, planning travel budgets, shopping from overseas stores, or checking remittance values, our free Currency Converter gives you fast, accurate conversions across more than 160 world currencies including USD, EUR, GBP, PKR, INR, AED, and SAR.",
            "Exchange rates are fetched directly in your browser from live public rate feeds with a clear last-updated timestamp, and every conversion calculation happens locally on your device with zero tracking or account sign-ups.",
          ]}
          howToSteps={[
            {
              title: "Enter Your Amount",
              detail:
                "Type any amount or click a quick preset (1, 100, 500, or 1,000) in the Amount input box.",
            },
            {
              title: "Pick From & To Currencies",
              detail:
                "Choose your source and target currencies from the dropdown menus, or click the Swap button to reverse the pair instantly.",
            },
            {
              title: "Convert & Copy",
              detail:
                "Click Convert to view the exact converted total, both 1-unit exchange rates, and the Last Updated timestamp, then copy the result with one click.",
            },
          ]}
          highlights={[
            "Covers 160+ global currencies including USD, EUR, GBP, PKR, INR, AED, SAR, CAD, AUD, and JPY.",
            "Displays both direct (1 From = X To) and inverse (1 To = Y From) exchange rates for transparent comparison.",
            "Includes a visible Last Updated date so you always know how fresh the mid-market reference rates are.",
            "Note: Live reference rates reflect mid-market values; banks and card networks may apply their own spread or conversion fee.",
          ]}
        />
      </div>
    </div>
  );
}
