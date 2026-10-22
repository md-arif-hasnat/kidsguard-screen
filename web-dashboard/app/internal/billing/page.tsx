"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  Banknote,
  Download,
  Globe2,
  Loader2,
  ReceiptText,
  RefreshCw,
} from "lucide-react";

import InternalLayout from "@/components/InternalLayout";
import {
  BillingRepository,
  type AdminMonthlyBillingReport,
} from "@/lib/billing/BillingRepository";
import { downloadMonthlyBillingStatement } from "@/lib/billing/billingStatementPdf";

function currentMonth(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

function formatMoney(amount: number, currencyCode: string): string {
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency: currencyCode,
    }).format(amount / 100);
  } catch {
    return `${currencyCode} ${(amount / 100).toFixed(2)}`;
  }
}

function countryName(countryCode: string): string {
  if (countryCode === "UNKNOWN") return "Unknown country";
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(countryCode) || countryCode;
  } catch {
    return countryCode;
  }
}

export default function InternalBillingPage() {
  const [month, setMonth] = useState(currentMonth);
  const [reloadKey, setReloadKey] = useState(0);
  const [report, setReport] = useState<AdminMonthlyBillingReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    BillingRepository.getAdminMonthlyReport(month)
      .then((nextReport) => {
        if (!cancelled) setReport(nextReport);
      })
      .catch((reportError: Error) => {
        if (!cancelled) {
          setReport(null);
          setError(reportError.message);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [month, reloadKey]);

  return (
    <InternalLayout>
      <header className="mb-8 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-rose-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-rose-400">
            <ReceiptText size={13} />
            Super Admin Finance
          </div>
          <h1 className="text-3xl font-black uppercase tracking-tight text-white">
            Subscription <span className="text-rose-500">billing & tax</span>
          </h1>
          <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-slate-400">
            Completed Paddle subscription payments, grouped by customer country
            and original transaction currency. Tax values come directly from
            the completed transaction record.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-bold text-slate-300">
            Billing month
            <input
              type="month"
              value={month}
              max={currentMonth()}
              onChange={(event) => setMonth(event.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-bold text-white outline-none focus:border-rose-500"
            />
          </label>
          <button
            type="button"
            onClick={() => setReloadKey((value) => value + 1)}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-200 hover:bg-slate-800 disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => report && downloadMonthlyBillingStatement(report)}
            disabled={!report || loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 py-3 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-rose-950/30 hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download size={16} />
            Download PDF
          </button>
        </div>
      </header>

      {error ? (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-5 text-sm font-semibold text-rose-200">
          <AlertCircle className="mt-0.5 shrink-0" size={20} />
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex min-h-[360px] items-center justify-center rounded-[2rem] border border-slate-800 bg-slate-900">
          <div className="text-center">
            <Loader2 className="mx-auto animate-spin text-rose-500" size={42} />
            <p className="mt-4 text-xs font-black uppercase tracking-widest text-slate-500">
              Reconciling Paddle transactions
            </p>
          </div>
        </div>
      ) : report ? (
        <div className="space-y-8">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard icon={Banknote} label="Completed payments" value={String(report.transactionCount)} />
            <SummaryCard icon={Globe2} label="Billing countries" value={String(new Set(report.countryBreakdown.map((row) => row.countryCode)).size)} />
            <SummaryCard icon={ReceiptText} label="Transaction currencies" value={String(report.currencyTotals.length)} />
            <SummaryCard icon={Banknote} label="Payout currencies" value={String(report.payoutTotals.length)} />
          </div>

          <section className="overflow-hidden rounded-[2rem] border border-slate-800 bg-slate-900 shadow-2xl">
            <div className="border-b border-slate-800 p-6 md:p-8">
              <h2 className="text-lg font-black uppercase tracking-tight text-white">Country-wise collected tax</h2>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                Net and tax use Paddle&apos;s completed transaction totals after credits. Different currencies are never combined.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-800 text-left">
                <thead className="bg-slate-950/60 text-[10px] font-black uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-6 py-4">Country</th>
                    <th className="px-6 py-4">Currency</th>
                    <th className="px-6 py-4">Payments</th>
                    <th className="px-6 py-4">Tax rates</th>
                    <th className="px-6 py-4">Net</th>
                    <th className="px-6 py-4">Tax</th>
                    <th className="px-6 py-4">Collected</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-sm text-slate-300">
                  {report.countryBreakdown.map((row) => (
                    <tr key={`${row.countryCode}-${row.currencyCode}`} className="hover:bg-white/[0.02]">
                      <td className="whitespace-nowrap px-6 py-4 font-bold text-white">
                        {countryName(row.countryCode)}
                        <span className="ml-2 text-[10px] text-slate-600">{row.countryCode}</span>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs">{row.currencyCode}</td>
                      <td className="px-6 py-4 font-bold">{row.transactionCount}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-xs text-slate-400">
                        {row.taxRates.length > 0
                          ? row.taxRates.map((rate) => `${(rate * 100).toFixed(2).replace(/\.00$/, "")}%`).join(", ")
                          : "0% / not reported"}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">{formatMoney(row.net, row.currencyCode)}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-amber-300">{formatMoney(row.tax, row.currencyCode)}</td>
                      <td className="whitespace-nowrap px-6 py-4 font-black text-emerald-400">{formatMoney(row.gross, row.currencyCode)}</td>
                    </tr>
                  ))}
                  {report.countryBreakdown.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-sm font-semibold text-slate-500">
                        No completed subscription payments were found for this month.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <TotalsPanel
              title="Customer currency totals"
              rows={report.currencyTotals.map((row) => ({
                key: row.currencyCode,
                headline: formatMoney(row.gross, row.currencyCode),
                detail: `${formatMoney(row.net, row.currencyCode)} net + ${formatMoney(row.tax, row.currencyCode)} tax · ${row.transactionCount} payments`,
              }))}
            />
            <TotalsPanel
              title="Paddle payout reconciliation"
              rows={report.payoutTotals.map((row) => ({
                key: row.currencyCode,
                headline: `${formatMoney(row.earnings, row.currencyCode)} earnings`,
                detail: `${formatMoney(row.gross, row.currencyCode)} collected · ${formatMoney(row.tax, row.currencyCode)} tax · ${formatMoney(row.fees, row.currencyCode)} fees`,
              }))}
            />
          </section>

          <p className="text-xs leading-relaxed text-slate-500">
            {report.note} The downloaded file is an internal revenue and tax statement; each customer&apos;s legal tax invoice remains the official Paddle PDF available from the parent profile.
          </p>
        </div>
      ) : null}
    </InternalLayout>
  );
}

function SummaryCard({ icon: Icon, label, value }: { icon: typeof Banknote; label: string; value: string }) {
  return (
    <div className="rounded-[1.5rem] border border-slate-800 bg-slate-900 p-6">
      <Icon className="text-rose-500" size={22} />
      <p className="mt-5 text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-black text-white">{value}</p>
    </div>
  );
}

function TotalsPanel({ title, rows }: { title: string; rows: Array<{key: string; headline: string; detail: string}> }) {
  return (
    <div className="rounded-[2rem] border border-slate-800 bg-slate-900 p-6 md:p-8">
      <h2 className="text-base font-black uppercase tracking-tight text-white">{title}</h2>
      <div className="mt-5 space-y-3">
        {rows.map((row) => (
          <div key={row.key} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <div className="flex items-center justify-between gap-4">
              <span className="font-mono text-xs font-black text-rose-400">{row.key}</span>
              <span className="text-sm font-black text-white">{row.headline}</span>
            </div>
            <p className="mt-2 text-xs text-slate-500">{row.detail}</p>
          </div>
        ))}
        {rows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-800 p-5 text-center text-xs font-semibold text-slate-600">No totals for this month.</p>
        ) : null}
      </div>
    </div>
  );
}
