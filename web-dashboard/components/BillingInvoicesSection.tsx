"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, FileText, Loader2, ReceiptText } from "lucide-react";

import {
  BillingRepository,
  type ParentBillingInvoice,
} from "@/lib/billing/BillingRepository";
import { downloadParentInvoicePdf } from "@/lib/billing/parentInvoicePdf";

function formatMoney(amount: number, currencyCode: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currencyCode,
    }).format(amount / 100);
  } catch {
    return `${currencyCode} ${(amount / 100).toFixed(2)}`;
  }
}

function monthKey(invoice: ParentBillingInvoice): string {
  if (!invoice.billedAt) return "unknown";
  const date = new Date(invoice.billedAt);
  return Number.isFinite(date.getTime())
    ? `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`
    : "unknown";
}

function monthLabel(key: string): string {
  if (!/^\d{4}-\d{2}$/.test(key)) return "Earlier invoices";
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export default function BillingInvoicesSection({
  isFamilyOwner,
  billingProvider,
}: {
  isFamilyOwner: boolean;
  billingProvider?: string;
}) {
  const [invoices, setInvoices] = useState<ParentBillingInvoice[]>([]);
  const [loading, setLoading] = useState(isFamilyOwner);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    if (!isFamilyOwner || billingProvider === "GOOGLE_PLAY") return;
    let cancelled = false;
    setLoading(true);
    BillingRepository.listParentInvoices()
      .then((result) => {
        if (cancelled) return;
        setInvoices(result.invoices);
        setHasMore(result.hasMore);
      })
      .catch((invoiceError: Error) => {
        if (!cancelled) setError(invoiceError.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [billingProvider, isFamilyOwner]);

  const groupedInvoices = useMemo(() => {
    const groups = new Map<string, ParentBillingInvoice[]>();
    for (const invoice of invoices) {
      const key = monthKey(invoice);
      groups.set(key, [...(groups.get(key) || []), invoice]);
    }
    return Array.from(groups.entries());
  }, [invoices]);

  const downloadInvoice = async (invoice: ParentBillingInvoice) => {
    setDownloadingId(invoice.transactionId);
    setError(null);
    try {
      downloadParentInvoicePdf(invoice);
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : "The invoice PDF could not be downloaded."
      );
    } finally {
      setDownloadingId(null);
    }
  };

  if (!isFamilyOwner) return null;

  if (billingProvider === "GOOGLE_PLAY") {
    return (
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-primary-100 p-2 text-primary-600">
            <ReceiptText size={22} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Google Play receipts
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-500">
              Google Play issues receipts for this subscription. Open your
              Google Play order history to view or download payment records.
            </p>
            <a
              href="https://play.google.com/store/account/orderhistory"
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex rounded-lg bg-primary-600 px-4 py-2 text-xs font-bold text-white hover:bg-primary-700"
            >
              Open Google Play order history
            </a>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-slate-50/60 p-6 md:p-8">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-primary-100 p-2 text-primary-600">
            <ReceiptText size={22} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Billing invoices</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-500">
              Download a PDF receipt for each completed Paddle subscription
              payment, grouped by billing month.
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 md:p-8">
        {loading ? (
          <div className="flex items-center gap-3 py-6 text-sm font-semibold text-slate-500">
            <Loader2 className="animate-spin text-primary-600" size={20} />
            Loading billing history…
          </div>
        ) : error && invoices.length === 0 ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
            {error}
          </div>
        ) : groupedInvoices.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center">
            <FileText className="mx-auto text-slate-300" size={30} />
            <p className="mt-3 text-sm font-bold text-slate-700">No paid invoices yet</p>
            <p className="mt-1 text-xs text-slate-500">
              A month will appear here after Paddle completes a subscription payment.
            </p>
          </div>
        ) : (
          <div className="space-y-7">
            {error ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
                {error}
              </div>
            ) : null}
            {groupedInvoices.map(([month, monthInvoices]) => (
              <div key={month}>
                <h3 className="mb-3 text-sm font-black uppercase tracking-wider text-slate-700">
                  {monthLabel(month)}
                </h3>
                <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
                  {monthInvoices.map((invoice) => (
                    <div
                      key={invoice.transactionId}
                      className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-900">
                          Invoice {invoice.invoiceNumber || invoice.transactionId}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {invoice.billedAt
                            ? new Date(invoice.billedAt).toLocaleDateString()
                            : "Billing date unavailable"}
                          {invoice.countryCode ? ` · ${invoice.countryCode}` : ""}
                          {` · Tax ${formatMoney(invoice.tax, invoice.currencyCode)}`}
                        </p>
                      </div>
                      <div className="flex items-center justify-between gap-4 sm:justify-end">
                        <p className="text-sm font-black text-slate-900">
                          {formatMoney(invoice.total, invoice.currencyCode)}
                        </p>
                        <button
                          type="button"
                          onClick={() => downloadInvoice(invoice)}
                          disabled={downloadingId === invoice.transactionId}
                          className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-primary-700 disabled:opacity-60"
                        >
                          {downloadingId === invoice.transactionId ? (
                            <Loader2 className="animate-spin" size={15} />
                          ) : (
                            <Download size={15} />
                          )}
                          PDF
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {hasMore ? (
              <p className="text-xs text-amber-700">
                Older invoices are available from Paddle support if you need them.
              </p>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
