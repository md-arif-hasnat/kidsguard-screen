import { auth } from "@/lib/firebase";

export interface ParentBillingInvoice {
  transactionId: string;
  invoiceNumber: string | null;
  billedAt: string | null;
  countryCode: string | null;
  origin: string | null;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  fee: number;
  earnings: number;
  currencyCode: string;
}

export interface BillingCountryTotal {
  countryCode: string;
  currencyCode: string;
  transactionCount: number;
  net: number;
  tax: number;
  gross: number;
  taxRates: number[];
}

export interface BillingCurrencyTotal {
  currencyCode: string;
  transactionCount: number;
  net: number;
  tax: number;
  gross: number;
}

export interface BillingPayoutTotal {
  currencyCode: string;
  gross: number;
  tax: number;
  fees: number;
  earnings: number;
}

export interface AdminMonthlyBillingReport {
  month: string;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  transactionCount: number;
  countryBreakdown: BillingCountryTotal[];
  currencyTotals: BillingCurrencyTotal[];
  payoutTotals: BillingPayoutTotal[];
  source: "PADDLE_COMPLETED_TRANSACTIONS";
  note: string;
}

async function callBillingFunction<T>(
  functionName: string,
  data: Record<string, unknown> = {}
): Promise<T> {
  const user = auth?.currentUser;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!user || !projectId) {
    throw new Error("Authenticated Firebase user required.");
  }

  const idToken = await user.getIdToken();
  const response = await fetch(
    `https://us-central1-${projectId}.cloudfunctions.net/${functionName}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ data }),
    }
  );
  const payload = await response.json().catch(() => null) as
    | {result?: T; data?: T; error?: {message?: string}}
    | null;
  if (!response.ok || payload?.error || (!payload?.result && !payload?.data)) {
    throw new Error(
      payload?.error?.message || "Billing records could not be loaded."
    );
  }
  return (payload.result || payload.data) as T;
}

export class BillingRepository {
  static listParentInvoices(): Promise<{
    invoices: ParentBillingInvoice[];
    hasMore: boolean;
    source: "PADDLE";
  }> {
    return callBillingFunction("listParentBillingInvoicesV2");
  }

  static getParentInvoiceDownloadUrl(transactionId: string): Promise<{
    transactionId: string;
    invoiceNumber: string | null;
    downloadUrl: string;
    expiresAt: string;
  }> {
    return callBillingFunction("getParentInvoiceDownloadUrlV2", {
      transactionId,
    });
  }

  static getAdminMonthlyReport(
    month: string
  ): Promise<AdminMonthlyBillingReport> {
    return callBillingFunction("getAdminMonthlyBillingReportV2", { month });
  }
}
