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
  Home,
  Briefcase,
  Calendar,
  Info,
} from "lucide-react";

type TaxMode = "salary" | "property";

interface TaxSlab {
  min: number;
  max: number | null;
  rate: number;
  label?: string;
}

interface PropertyTaxConfig {
  defaultRate: number; // percentage, e.g. 1.1 for 1.1%
  minTypicalRate: number;
  maxTypicalRate: number;
  rateRangeLabel: string;
  samplePropertyValue: string;
  basisNote: string;
  extraNote: string;
}

interface CountryTaxConfig {
  code: string;
  name: string;
  currencyCode: string;
  currencySymbol: string;
  sampleMonthlySalary: string;
  incomeRegimeNote: string;
  slabs: TaxSlab[];
  property: PropertyTaxConfig;
}

const COUNTRY_TAX_CONFIGS: CountryTaxConfig[] = [
  {
    code: "PK",
    name: "Pakistan",
    currencyCode: "PKR",
    currencySymbol: "Rs ",
    sampleMonthlySalary: "200000",
    incomeRegimeNote: "FY 2024/2025 Basic Salaried Income Tax Slabs (PKR / Year)",
    slabs: [
      { min: 0, max: 600000, rate: 0, label: "Tax-free threshold" },
      { min: 600000, max: 1200000, rate: 5 },
      { min: 1200000, max: 2200000, rate: 15 },
      { min: 2200000, max: 3200000, rate: 25 },
      { min: 3200000, max: 4100000, rate: 30 },
      { min: 4100000, max: null, rate: 35 },
    ],
    property: {
      defaultRate: 2.0,
      minTypicalRate: 1.0,
      maxTypicalRate: 3.0,
      rateRangeLabel: "~1% – 3% average estimate",
      samplePropertyValue: "15000000",
      basisNote: "Estimated annual urban property / holding tax benchmark (~2% national average)",
      extraNote:
        "Provincial Excise & Taxation departments (Punjab, Sindh, KP, ICT) assess annual property tax based on locality, covered area, and self-occupied vs. rented status.",
    },
  },
  {
    code: "IN",
    name: "India",
    currencyCode: "INR",
    currencySymbol: "₹",
    sampleMonthlySalary: "125000",
    incomeRegimeNote: "FY 2024/2025 Basic New Tax Regime Slabs (INR / Year)",
    slabs: [
      { min: 0, max: 300000, rate: 0, label: "Tax-free threshold" },
      { min: 300000, max: 700000, rate: 5 },
      { min: 700000, max: 1000000, rate: 10 },
      { min: 1000000, max: 1200000, rate: 15 },
      { min: 1200000, max: 1500000, rate: 20 },
      { min: 1500000, max: null, rate: 30 },
    ],
    property: {
      defaultRate: 1.5,
      minTypicalRate: 1.0,
      maxTypicalRate: 2.0,
      rateRangeLabel: "~1% – 2% average estimate",
      samplePropertyValue: "10000000",
      basisNote: "Estimated annual municipal property tax benchmark (~1.5% national average)",
      extraNote:
        "Indian municipal corporations calculate property tax via Capital Value System (CVS), Unit Area System (UAS), or Annual Rental Value (ARV) depending on the city.",
    },
  },
  {
    code: "US",
    name: "United States",
    currencyCode: "USD",
    currencySymbol: "$",
    sampleMonthlySalary: "7000",
    incomeRegimeNote: "2024/2025 Basic Federal Single-Filer Brackets (USD / Year)",
    slabs: [
      { min: 0, max: 11925, rate: 10 },
      { min: 11925, max: 48475, rate: 12 },
      { min: 48475, max: 103350, rate: 22 },
      { min: 103350, max: 197300, rate: 24 },
      { min: 197300, max: 250525, rate: 32 },
      { min: 250525, max: 626350, rate: 35 },
      { min: 626350, max: null, rate: 37 },
    ],
    property: {
      defaultRate: 1.1,
      minTypicalRate: 0.3,
      maxTypicalRate: 2.2,
      rateRangeLabel: "~1.1% national average (0.3% – 2.2% by state)",
      samplePropertyValue: "400000",
      basisNote: "Estimated US effective annual property tax (~1.1% national average)",
      extraNote:
        "US property taxes are levied at the county and municipal level. States like Hawaii and Alabama average under 0.5%, while New Jersey and Illinois often exceed 2.0%.",
    },
  },
  {
    code: "UK",
    name: "United Kingdom",
    currencyCode: "GBP",
    currencySymbol: "£",
    sampleMonthlySalary: "4500",
    incomeRegimeNote: "2024/2025 Basic UK Income Tax Bands (GBP / Year)",
    slabs: [
      { min: 0, max: 12570, rate: 0, label: "Personal Allowance" },
      { min: 12570, max: 50270, rate: 20, label: "Basic Rate" },
      { min: 50270, max: 125140, rate: 40, label: "Higher Rate" },
      { min: 125140, max: null, rate: 45, label: "Additional Rate" },
    ],
    property: {
      defaultRate: 0.75,
      minTypicalRate: 0.5,
      maxTypicalRate: 1.0,
      rateRangeLabel: "~0.5% – 1.0% Council Tax estimate",
      samplePropertyValue: "300000",
      basisNote: "Estimated UK annual Council Tax equivalent (~0.75% of home value)",
      extraNote:
        "In the UK, ongoing residential property tax is charged via local Council Tax Valuation Bands (A–H), typically averaging around £1,600–£2,500+ per year depending on the local authority.",
    },
  },
  {
    code: "AE",
    name: "United Arab Emirates (UAE)",
    currencyCode: "AED",
    currencySymbol: "AED ",
    sampleMonthlySalary: "20000",
    incomeRegimeNote: "2024/2025 Personal Employment Income Tax (0% in UAE)",
    slabs: [
      {
        min: 0,
        max: null,
        rate: 0,
        label: "No personal income tax",
      },
    ],
    property: {
      defaultRate: 0,
      minTypicalRate: 0,
      maxTypicalRate: 0.5,
      rateRangeLabel: "0% annual property tax (municipality fees may apply)",
      samplePropertyValue: "1500000",
      basisNote: "0% annual residential property tax in the UAE",
      extraNote:
        "The UAE levies 0% annual property tax on residential ownership. However, buyers pay a one-time transfer fee (e.g., 4% DLD fee in Dubai) and residents pay a municipality housing fee (~5% of annual rent).",
    },
  },
];

interface SlabBreakdownRow {
  rangeText: string;
  label?: string;
  rate: number;
  taxableAmount: number;
  annualTaxAmount: number;
  monthlyTaxAmount: number;
  isActive: boolean;
}

interface SalaryTaxResult {
  country: CountryTaxConfig;
  monthlyGross: number;
  annualGross: number;
  annualTax: number;
  monthlyTax: number;
  effectiveRate: number;
  marginalRate: number;
  annualNet: number;
  monthlyNet: number;
  breakdown: SlabBreakdownRow[];
}

interface PropertyTaxResult {
  country: CountryTaxConfig;
  propertyValue: number;
  appliedRate: number;
  annualTax: number;
  quarterlyTax: number;
  monthlyTax: number;
  lowRangeAnnualTax: number;
  highRangeAnnualTax: number;
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

function calculateSalaryTax(
  country: CountryTaxConfig,
  monthlyGross: number
): SalaryTaxResult {
  const annualGross = monthlyGross * 12;
  let annualTax = 0;
  let marginalRate = 0;

  const breakdown: SlabBreakdownRow[] = country.slabs.map((slab) => {
    const upperBound = slab.max === null ? Infinity : slab.max;
    const taxableAmount =
      annualGross > slab.min ? Math.min(annualGross, upperBound) - slab.min : 0;
    const annualTaxAmount = (taxableAmount * slab.rate) / 100;
    const isActive = taxableAmount > 0;

    if (isActive) {
      annualTax += annualTaxAmount;
      marginalRate = slab.rate;
    }

    const rangeText =
      slab.max === null
        ? slab.min === 0
          ? "All Annual Income"
          : `Above ${formatCurrency(slab.min, country.currencySymbol)}`
        : `${formatCurrency(slab.min, country.currencySymbol)} – ${formatCurrency(slab.max, country.currencySymbol)}`;

    return {
      rangeText,
      label: slab.label,
      rate: slab.rate,
      taxableAmount,
      annualTaxAmount,
      monthlyTaxAmount: annualTaxAmount / 12,
      isActive,
    };
  });

  const effectiveRate = annualGross > 0 ? (annualTax / annualGross) * 100 : 0;
  const annualNet = Math.max(0, annualGross - annualTax);

  return {
    country,
    monthlyGross,
    annualGross,
    annualTax,
    monthlyTax: annualTax / 12,
    effectiveRate,
    marginalRate,
    annualNet,
    monthlyNet: annualNet / 12,
    breakdown,
  };
}

function calculatePropertyTax(
  country: CountryTaxConfig,
  propertyValue: number,
  appliedRate: number
): PropertyTaxResult {
  const annualTax = (propertyValue * appliedRate) / 100;
  return {
    country,
    propertyValue,
    appliedRate,
    annualTax,
    quarterlyTax: annualTax / 4,
    monthlyTax: annualTax / 12,
    lowRangeAnnualTax: (propertyValue * country.property.minTypicalRate) / 100,
    highRangeAnnualTax: (propertyValue * country.property.maxTypicalRate) / 100,
  };
}

export default function TaxCalculatorPage() {
  const [activeMode, setActiveMode] = useState<TaxMode>("salary");
  const [selectedCountryCode, setSelectedCountryCode] = useState<string>("PK");

  // Salary Tax state
  const [monthlySalary, setMonthlySalary] = useState<string>(
    COUNTRY_TAX_CONFIGS[0].sampleMonthlySalary
  );
  const [salaryError, setSalaryError] = useState<string>("");
  const [salaryResult, setSalaryResult] = useState<SalaryTaxResult | null>(() =>
    calculateSalaryTax(
      COUNTRY_TAX_CONFIGS[0],
      parseFloat(COUNTRY_TAX_CONFIGS[0].sampleMonthlySalary)
    )
  );

  // Property Tax state
  const [propertyValue, setPropertyValue] = useState<string>(
    COUNTRY_TAX_CONFIGS[0].property.samplePropertyValue
  );
  const [propertyRate, setPropertyRate] = useState<string>(
    String(COUNTRY_TAX_CONFIGS[0].property.defaultRate)
  );
  const [propertyError, setPropertyError] = useState<string>("");
  const [propertyResult, setPropertyResult] =
    useState<PropertyTaxResult | null>(() =>
      calculatePropertyTax(
        COUNTRY_TAX_CONFIGS[0],
        parseFloat(COUNTRY_TAX_CONFIGS[0].property.samplePropertyValue),
        COUNTRY_TAX_CONFIGS[0].property.defaultRate
      )
    );

  const activeCountry =
    COUNTRY_TAX_CONFIGS.find((c) => c.code === selectedCountryCode) ||
    COUNTRY_TAX_CONFIGS[0];

  const liveAnnualPreview = (() => {
    const parsed = parseFloat(monthlySalary);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed * 12 : null;
  })();

  const handleCountryChange = (nextCode: string) => {
    const nextCountry =
      COUNTRY_TAX_CONFIGS.find((c) => c.code === nextCode) ||
      COUNTRY_TAX_CONFIGS[0];
    setSelectedCountryCode(nextCode);

    // Update Salary Tax defaults for the newly selected country
    setMonthlySalary(nextCountry.sampleMonthlySalary);
    setSalaryError("");
    setSalaryResult(
      calculateSalaryTax(
        nextCountry,
        parseFloat(nextCountry.sampleMonthlySalary)
      )
    );

    // Update Property Tax defaults for the newly selected country
    setPropertyValue(nextCountry.property.samplePropertyValue);
    setPropertyRate(String(nextCountry.property.defaultRate));
    setPropertyError("");
    setPropertyResult(
      calculatePropertyTax(
        nextCountry,
        parseFloat(nextCountry.property.samplePropertyValue),
        nextCountry.property.defaultRate
      )
    );
  };

  const handleCalculateSalary = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const parsed = parseFloat(monthlySalary);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setSalaryError("Please enter a valid monthly salary of 0 or greater.");
      setSalaryResult(null);
      return;
    }
    setSalaryError("");
    setSalaryResult(calculateSalaryTax(activeCountry, parsed));
  };

  const handleResetSalary = () => {
    setMonthlySalary(activeCountry.sampleMonthlySalary);
    setSalaryError("");
    setSalaryResult(
      calculateSalaryTax(
        activeCountry,
        parseFloat(activeCountry.sampleMonthlySalary)
      )
    );
  };

  const handleCalculateProperty = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const parsedValue = parseFloat(propertyValue);
    const parsedRate = parseFloat(propertyRate);
    if (!Number.isFinite(parsedValue) || parsedValue < 0) {
      setPropertyError("Please enter a valid property value of 0 or greater.");
      setPropertyResult(null);
      return;
    }
    if (!Number.isFinite(parsedRate) || parsedRate < 0 || parsedRate > 100) {
      setPropertyError("Please enter a valid tax rate between 0% and 100%.");
      setPropertyResult(null);
      return;
    }
    setPropertyError("");
    setPropertyResult(
      calculatePropertyTax(activeCountry, parsedValue, parsedRate)
    );
  };

  const handleResetProperty = () => {
    setPropertyValue(activeCountry.property.samplePropertyValue);
    setPropertyRate(String(activeCountry.property.defaultRate));
    setPropertyError("");
    setPropertyResult(
      calculatePropertyTax(
        activeCountry,
        parseFloat(activeCountry.property.samplePropertyValue),
        activeCountry.property.defaultRate
      )
    );
  };

  const taxSharePercent =
    salaryResult && salaryResult.annualGross > 0
      ? Math.min(100, (salaryResult.annualTax / salaryResult.annualGross) * 100)
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
            <span>
              2024/2025 Estimates • Pakistan, India, US, UK &amp; UAE
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            Salary &amp; Property{" "}
            <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400 bg-clip-text text-transparent">
              Tax Calculator
            </span>
          </h1>
          <p className="text-sm sm:text-base text-slate-400 max-w-2xl leading-relaxed">
            Switch between our <strong>Salary Tax</strong> calculator (monthly
            salary to annual slabs &amp; take-home pay) and{" "}
            <strong>Property Tax</strong> estimator—100% client-side with zero
            data sent to any server.
          </p>
        </header>

        {/* Mode Switcher Tabs */}
        <div
          role="tablist"
          aria-label="Tax Calculator Modes"
          className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-slate-900 border border-slate-800"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeMode === "salary"}
            onClick={() => setActiveMode("salary")}
            className={`py-3 px-4 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 ${
              activeMode === "salary"
                ? "bg-gradient-to-r from-amber-500 to-orange-600 text-slate-950 shadow-lg shadow-amber-600/20"
                : "text-slate-400 hover:text-white hover:bg-slate-800/80"
            }`}
          >
            <Briefcase className="w-4 h-4" />
            <span>Salary Tax</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeMode === "property"}
            onClick={() => setActiveMode("property")}
            className={`py-3 px-4 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 ${
              activeMode === "property"
                ? "bg-gradient-to-r from-cyan-500 to-indigo-600 text-white shadow-lg shadow-cyan-600/20"
                : "text-slate-400 hover:text-white hover:bg-slate-800/80"
            }`}
          >
            <Home className="w-4 h-4" />
            <span>Property Tax</span>
          </button>
        </div>

        {/* MODE 1: SALARY / INCOME TAX */}
        {activeMode === "salary" && (
          <div className="space-y-6">
            {/* Salary Input Form Card */}
            <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-7 space-y-5 shadow-xl shadow-black/30">
              <form onSubmit={handleCalculateSalary} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Country Selector */}
                  <div className="space-y-2">
                    <label
                      htmlFor="salary-tax-country"
                      className="text-xs font-semibold uppercase tracking-wider text-slate-400 block"
                    >
                      Select Country
                    </label>
                    <select
                      id="salary-tax-country"
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

                  {/* Monthly Salary Input */}
                  <div className="space-y-2">
                    <label
                      htmlFor="monthly-salary"
                      className="text-xs font-semibold uppercase tracking-wider text-slate-400 block"
                    >
                      Monthly Salary ({activeCountry.currencyCode})
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400 pointer-events-none">
                        {activeCountry.currencySymbol.trim()}
                      </span>
                      <input
                        id="monthly-salary"
                        type="number"
                        min="0"
                        step="any"
                        value={monthlySalary}
                        onChange={(e) => setMonthlySalary(e.target.value)}
                        placeholder={`e.g. ${activeCountry.sampleMonthlySalary}`}
                        className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-base font-bold text-white focus:outline-none transition"
                      />
                    </div>
                  </div>
                </div>

                {/* Live Auto-Calculated Annual Salary Pill */}
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 rounded-xl bg-slate-950/80 border border-slate-800/80 text-xs sm:text-sm">
                  <span className="inline-flex items-center gap-2 text-slate-400">
                    <Calendar className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Auto-Calculated Annual Salary (Monthly × 12):</span>
                  </span>
                  <span className="font-mono font-extrabold text-amber-300 text-sm sm:text-base">
                    {liveAnnualPreview !== null
                      ? formatCurrency(
                          liveAnnualPreview,
                          activeCountry.currencySymbol,
                          0
                        )
                      : "—"}
                  </span>
                </div>

                {salaryError && (
                  <p className="text-xs font-semibold text-rose-400">
                    {salaryError}
                  </p>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <button
                      type="submit"
                      className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-extrabold text-sm shadow-lg shadow-amber-600/20 transition flex items-center gap-2"
                    >
                      <Calculator className="w-4 h-4" />
                      Calculate Salary Tax
                    </button>
                    <button
                      type="button"
                      onClick={handleResetSalary}
                      className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs sm:text-sm font-semibold transition flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Reset
                    </button>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    {activeCountry.incomeRegimeNote}
                  </span>
                </div>
              </form>
            </section>

            {/* Salary Tax Results */}
            {salaryResult && (
              <section className="space-y-5">
                {/* Summary Stat Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-slate-900/90 border border-emerald-500/35 rounded-2xl p-5 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                      <Wallet className="w-4 h-4" />
                      <span>Monthly Take-Home</span>
                    </div>
                    <p className="text-2xl sm:text-3xl font-extrabold text-emerald-300 break-all">
                      {formatCurrency(
                        salaryResult.monthlyNet,
                        salaryResult.country.currencySymbol,
                        2
                      )}
                    </p>
                    <p className="text-xs text-slate-400">
                      Annual net:{" "}
                      <strong className="text-slate-200">
                        {formatCurrency(
                          salaryResult.annualNet,
                          salaryResult.country.currencySymbol,
                          2
                        )}
                      </strong>
                    </p>
                  </div>

                  <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs font-semibold text-rose-400 uppercase tracking-wider">
                      <Receipt className="w-4 h-4" />
                      <span>Total Tax</span>
                    </div>
                    <p className="text-2xl sm:text-3xl font-extrabold text-white break-all">
                      {formatCurrency(
                        salaryResult.annualTax,
                        salaryResult.country.currencySymbol,
                        2
                      )}
                    </p>
                    <p className="text-xs text-slate-400">
                      Monthly tax:{" "}
                      <strong className="text-rose-300">
                        {formatCurrency(
                          salaryResult.monthlyTax,
                          salaryResult.country.currencySymbol,
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
                      {salaryResult.effectiveRate.toFixed(2)}%
                    </p>
                    <p className="text-xs text-slate-400">
                      Top marginal slab:{" "}
                      <strong className="text-slate-200">
                        {salaryResult.marginalRate}%
                      </strong>
                    </p>
                  </div>
                </div>

                {/* Take-Home vs. Tax Bar */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-emerald-400">
                      Take-Home Salary ({netSharePercent.toFixed(1)}%)
                    </span>
                    <span className="text-rose-400">
                      Estimated Income Tax ({taxSharePercent.toFixed(1)}%)
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
                      2024/2025 Income Tax Slab Breakdown —{" "}
                      {salaryResult.country.name}
                    </h2>
                    <span className="text-xs text-slate-400">
                      Annual Salary:{" "}
                      <strong className="text-slate-200">
                        {formatCurrency(
                          salaryResult.annualGross,
                          salaryResult.country.currencySymbol,
                          2
                        )}
                      </strong>
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs sm:text-sm">
                      <thead>
                        <tr className="bg-slate-950/70 text-slate-400 uppercase text-[11px] tracking-wider border-b border-slate-800">
                          <th className="py-3 px-4 font-semibold">
                            Annual Income Slab
                          </th>
                          <th className="py-3 px-4 font-semibold">Rate</th>
                          <th className="py-3 px-4 font-semibold text-right">
                            Taxable Amount
                          </th>
                          <th className="py-3 px-4 font-semibold text-right">
                            Annual Tax
                          </th>
                          <th className="py-3 px-4 font-semibold text-right">
                            Monthly Tax
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/70">
                        {salaryResult.breakdown.map((row, idx) => (
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
                                salaryResult.country.currencySymbol,
                                2
                              )}
                            </td>
                            <td
                              className={`py-3 px-4 text-right font-mono font-bold ${
                                row.annualTaxAmount > 0
                                  ? "text-rose-300"
                                  : "text-slate-400"
                              }`}
                            >
                              {formatCurrency(
                                row.annualTaxAmount,
                                salaryResult.country.currencySymbol,
                                2
                              )}
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-slate-300">
                              {formatCurrency(
                                row.monthlyTaxAmount,
                                salaryResult.country.currencySymbol,
                                2
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-950/90 border-t border-slate-700 font-bold text-white">
                          <td className="py-3.5 px-4" colSpan={2}>
                            Total Estimated Income Tax
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-slate-300">
                            {formatCurrency(
                              salaryResult.annualGross,
                              salaryResult.country.currencySymbol,
                              2
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-rose-400">
                            {formatCurrency(
                              salaryResult.annualTax,
                              salaryResult.country.currencySymbol,
                              2
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-rose-300">
                            {formatCurrency(
                              salaryResult.monthlyTax,
                              salaryResult.country.currencySymbol,
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
          </div>
        )}

        {/* MODE 2: PROPERTY TAX */}
        {activeMode === "property" && (
          <div className="space-y-6">
            {/* Property Input Form Card */}
            <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-7 space-y-5 shadow-xl shadow-black/30">
              <form onSubmit={handleCalculateProperty} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Country Selector */}
                  <div className="space-y-2">
                    <label
                      htmlFor="property-tax-country"
                      className="text-xs font-semibold uppercase tracking-wider text-slate-400 block"
                    >
                      Select Country
                    </label>
                    <select
                      id="property-tax-country"
                      value={selectedCountryCode}
                      onChange={(e) => handleCountryChange(e.target.value)}
                      className="w-full px-3.5 py-3.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-cyan-500 text-sm font-semibold text-white focus:outline-none transition cursor-pointer"
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

                  {/* Property Value Input */}
                  <div className="space-y-2">
                    <label
                      htmlFor="property-value"
                      className="text-xs font-semibold uppercase tracking-wider text-slate-400 block"
                    >
                      Property Value ({activeCountry.currencyCode})
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400 pointer-events-none">
                        {activeCountry.currencySymbol.trim()}
                      </span>
                      <input
                        id="property-value"
                        type="number"
                        min="0"
                        step="any"
                        value={propertyValue}
                        onChange={(e) => setPropertyValue(e.target.value)}
                        placeholder={`e.g. ${activeCountry.property.samplePropertyValue}`}
                        className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 text-base font-bold text-white focus:outline-none transition"
                      />
                    </div>
                  </div>

                  {/* Estimated Annual Tax Rate (%) */}
                  <div className="space-y-2">
                    <label
                      htmlFor="property-rate"
                      className="text-xs font-semibold uppercase tracking-wider text-slate-400 block"
                    >
                      Annual Rate (%)
                    </label>
                    <div className="relative">
                      <input
                        id="property-rate"
                        type="number"
                        min="0"
                        max="100"
                        step="0.05"
                        value={propertyRate}
                        onChange={(e) => setPropertyRate(e.target.value)}
                        className="w-full pl-4 pr-10 py-3.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 text-base font-bold text-white focus:outline-none transition"
                      />
                      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-cyan-400 pointer-events-none">
                        %
                      </span>
                    </div>
                  </div>
                </div>

                {/* National Rate Info Strip */}
                <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-slate-950/80 border border-slate-800/80 text-xs text-slate-300">
                  <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-semibold text-slate-200">
                      {activeCountry.name} Typical Rate:{" "}
                      <span className="text-cyan-300">
                        {activeCountry.property.rateRangeLabel}
                      </span>
                    </p>
                    <p className="text-slate-400 leading-relaxed">
                      {activeCountry.property.extraNote}
                    </p>
                  </div>
                </div>

                {propertyError && (
                  <p className="text-xs font-semibold text-rose-400">
                    {propertyError}
                  </p>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <button
                      type="submit"
                      className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-extrabold text-sm shadow-lg shadow-cyan-600/20 transition flex items-center gap-2"
                    >
                      <Home className="w-4 h-4" />
                      Calculate Property Tax
                    </button>
                    <button
                      type="button"
                      onClick={handleResetProperty}
                      className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs sm:text-sm font-semibold transition flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Reset Average
                    </button>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    {activeCountry.property.basisNote}
                  </span>
                </div>
              </form>
            </section>

            {/* Property Tax Results */}
            {propertyResult && (
              <section className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-slate-900/90 border border-cyan-500/35 rounded-2xl p-5 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs font-semibold text-cyan-400 uppercase tracking-wider">
                      <Home className="w-4 h-4" />
                      <span>Estimated Annual Tax</span>
                    </div>
                    <p className="text-2xl sm:text-3xl font-extrabold text-cyan-300 break-all">
                      {formatCurrency(
                        propertyResult.annualTax,
                        propertyResult.country.currencySymbol,
                        2
                      )}
                    </p>
                    <p className="text-xs text-slate-400">
                      Applied rate:{" "}
                      <strong className="text-slate-200">
                        {propertyResult.appliedRate}%
                      </strong>
                    </p>
                  </div>

                  <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs font-semibold text-indigo-400 uppercase tracking-wider">
                      <Calendar className="w-4 h-4" />
                      <span>Monthly Equivalent</span>
                    </div>
                    <p className="text-2xl sm:text-3xl font-extrabold text-white break-all">
                      {formatCurrency(
                        propertyResult.monthlyTax,
                        propertyResult.country.currencySymbol,
                        2
                      )}
                    </p>
                    <p className="text-xs text-slate-400">
                      Quarterly:{" "}
                      <strong className="text-slate-200">
                        {formatCurrency(
                          propertyResult.quarterlyTax,
                          propertyResult.country.currencySymbol,
                          2
                        )}
                      </strong>
                    </p>
                  </div>

                  <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs font-semibold text-amber-400 uppercase tracking-wider">
                      <Percent className="w-4 h-4" />
                      <span>Typical City Range</span>
                    </div>
                    <p className="text-lg sm:text-xl font-extrabold text-white break-all leading-snug pt-1">
                      {formatCurrency(
                        propertyResult.lowRangeAnnualTax,
                        propertyResult.country.currencySymbol,
                        0
                      )}{" "}
                      –{" "}
                      {formatCurrency(
                        propertyResult.highRangeAnnualTax,
                        propertyResult.country.currencySymbol,
                        0
                      )}
                    </p>
                    <p className="text-xs text-slate-400">
                      Range: {propertyResult.country.property.minTypicalRate}% –{" "}
                      {propertyResult.country.property.maxTypicalRate}% / year
                    </p>
                  </div>
                </div>

                {/* Property Tax Breakdown Table */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-sm sm:text-base font-bold text-white">
                      Property Tax Estimate Breakdown —{" "}
                      {propertyResult.country.name}
                    </h2>
                    <span className="text-xs text-slate-400">
                      Assessed Property Value:{" "}
                      <strong className="text-slate-200">
                        {formatCurrency(
                          propertyResult.propertyValue,
                          propertyResult.country.currencySymbol,
                          0
                        )}
                      </strong>
                    </span>
                  </div>

                  <div className="divide-y divide-slate-800/80 text-xs sm:text-sm">
                    <div className="flex items-center justify-between px-5 py-3.5">
                      <span className="text-slate-400">Property Value</span>
                      <span className="font-mono font-bold text-white">
                        {formatCurrency(
                          propertyResult.propertyValue,
                          propertyResult.country.currencySymbol,
                          2
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between px-5 py-3.5">
                      <span className="text-slate-400">
                        Applied Annual Property Tax Rate
                      </span>
                      <span className="font-mono font-bold text-cyan-300">
                        {propertyResult.appliedRate}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between px-5 py-3.5">
                      <span className="text-slate-400">
                        Estimated Quarterly Tax (÷ 4)
                      </span>
                      <span className="font-mono font-semibold text-slate-200">
                        {formatCurrency(
                          propertyResult.quarterlyTax,
                          propertyResult.country.currencySymbol,
                          2
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between px-5 py-3.5">
                      <span className="text-slate-400">
                        Estimated Monthly Reserve (÷ 12)
                      </span>
                      <span className="font-mono font-semibold text-slate-200">
                        {formatCurrency(
                          propertyResult.monthlyTax,
                          propertyResult.country.currencySymbol,
                          2
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between px-5 py-4 bg-slate-950/80">
                      <span className="font-bold text-white">
                        Total Estimated Annual Property Tax
                      </span>
                      <span className="font-mono font-extrabold text-cyan-400 text-base">
                        {formatCurrency(
                          propertyResult.annualTax,
                          propertyResult.country.currencySymbol,
                          2
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </section>
            )}
          </div>
        )}

        {/* Strong Required Disclaimer */}
        <section
          aria-label="Tax Calculation Disclaimer"
          className="bg-amber-500/10 border border-amber-500/35 rounded-2xl p-4 sm:p-5 flex items-start gap-3"
        >
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h2 className="text-xs sm:text-sm font-bold text-amber-300 uppercase tracking-wide">
              Important Tax Disclaimer
            </h2>
            <p className="text-xs sm:text-sm text-amber-100/95 leading-relaxed font-medium">
              Note: Tax laws and property tax rates vary by city and change
              frequently. These calculations are estimates based on national
              averages. Please consult a local tax professional.
            </p>
          </div>
        </section>

        {/* Cross-links */}
        <section className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-0.5">
            <h2 className="text-sm font-bold text-white">
              Convert Your Salary or Property Value to Another Currency
            </h2>
            <p className="text-xs text-slate-400">
              Compare international salaries and real-estate budgets with live
              exchange rates.
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
          toolName="Salary & Property Tax Calculator"
          aboutParagraphs={[
            "Planning a household budget requires estimating both how much income tax is deducted from your monthly paycheck and how much annual property tax applies to real estate you own or plan to buy. Our upgraded client-side Tax Calculator combines both modes into one fast dark-mode utility covering Pakistan, India, the United States, the United Kingdom, and the UAE.",
            "In Salary Tax mode, simply enter your monthly salary—the calculator automatically multiplies it by 12 to compute your annual taxable income, applies 2024/2025 progressive tax slabs, and displays your monthly take-home pay alongside a complete slab-by-slab breakdown. In Property Tax mode, enter your property value in local currency to estimate annual, quarterly, and monthly property tax using national average benchmarks or your own local municipal rate.",
          ]}
          howToSteps={[
            {
              title: "Choose Salary Tax or Property Tax",
              detail:
                "Use the top tab switcher to select either the Monthly Salary Income Tax calculator or the Annual Property Tax estimator.",
            },
            {
              title: "Select Country & Enter Amount",
              detail:
                "Pick Pakistan, India, the US, the UK, or the UAE, then enter your Monthly Salary or Property Value in local currency.",
            },
            {
              title: "Review Your Breakdown",
              detail:
                "Inspect your monthly take-home salary and progressive slab breakdown in Salary mode, or your annual, quarterly, and typical city-range estimates in Property Tax mode.",
            },
          ]}
          highlights={[
            "Auto-converts Monthly Salary to Annual Salary (Monthly × 12) before applying progressive 2024/2025 income tax slabs.",
            "Includes country-average Property Tax benchmarks (Pakistan ~1–3%, India ~1–2%, US ~1.1%, UK Council Tax estimate, UAE 0% annual property tax) with editable rate override.",
            "Runs 100% client-side in your browser so your salary and property figures remain completely private.",
            "Supports instant switching between countries with automatic currency formatting and sample defaults.",
          ]}
        />
      </div>
    </div>
  );
}
