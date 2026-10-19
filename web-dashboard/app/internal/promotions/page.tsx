"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BadgePercent,
  CheckCircle2,
  Copy,
  Gift,
  Loader2,
  Mail,
  Power,
  PowerOff,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import InternalLayout from "@/components/InternalLayout";
import {
  CreatePromoCodeInput,
  PromoCode,
  PromoCodeRepository,
  PromoCodeType,
} from "@/lib/repositories/PromoCodeRepository";

const EMPTY_FORM: CreatePromoCodeInput = {
  code: "",
  type: "FREE_LIMITED",
  description: "",
  accessDays: 30,
  percentage: 20,
  expiresAt: null,
  usageLimit: null,
  recurringIntervals: null,
};

function dateLabel(value: unknown): string {
  if (!value) return "No deadline";
  const candidate = value as {
    toDate?: () => Date;
    seconds?: number;
  };
  const date = typeof candidate.toDate === "function"
    ? candidate.toDate()
    : typeof candidate.seconds === "number"
      ? new Date(candidate.seconds * 1000)
      : new Date(String(value));
  return Number.isNaN(date.getTime())
    ? "No deadline"
    : new Intl.DateTimeFormat("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

function typeLabel(code: PromoCode): string {
  if (code.type === "FREE_LIMITED") {
    return `${code.accessDays || 0} days free`;
  }
  if (code.type === "FREE_FOREVER") {
    return "Free until deactivated";
  }
  return `${code.percentage || 0}% discount`;
}

function statusClasses(status: PromoCode["status"]): string {
  if (status === "ACTIVE") {
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
  }
  if (status === "DELETED") {
    return "border-slate-700 bg-slate-800 text-slate-500";
  }
  return "border-amber-500/20 bg-amber-500/10 text-amber-300";
}

export default function InternalPromotionsPage() {
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [form, setForm] = useState<CreatePromoCodeInput>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [workingCode, setWorkingCode] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [emailCode, setEmailCode] = useState<string | null>(null);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [marketingConsentConfirmed, setMarketingConsentConfirmed] =
    useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    return PromoCodeRepository.subscribe(
      (nextCodes) => {
        setCodes(nextCodes);
        setLoading(false);
      },
      (error) => {
        setMessage({ type: "error", text: error.message });
        setLoading(false);
      }
    );
  }, []);

  const stats = useMemo(() => {
    let active = 0;
    let free = 0;
    let redemptions = 0;
    for (const code of codes) {
      if (code.status === "ACTIVE") active += 1;
      if (code.type !== "PERCENTAGE" && code.status !== "DELETED") free += 1;
      redemptions += code.redemptionCount;
    }
    return { active, free, redemptions };
  }, [codes]);

  const updateForm = <Key extends keyof CreatePromoCodeInput>(
    key: Key,
    value: CreatePromoCodeInput[Key]
  ) => setForm((current) => ({ ...current, [key]: value }));

  const createCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreating(true);
    setMessage(null);
    try {
      await PromoCodeRepository.create({
        ...form,
        code: form.code.trim().toUpperCase(),
        description: form.description?.trim(),
        expiresAt: form.expiresAt
          ? new Date(form.expiresAt).toISOString()
          : null,
        usageLimit: Number(form.usageLimit || 0) || null,
        accessDays: form.type === "FREE_LIMITED"
          ? Number(form.accessDays || 0)
          : undefined,
        percentage: form.type === "PERCENTAGE"
          ? Number(form.percentage || 0)
          : undefined,
        recurringIntervals: form.type === "PERCENTAGE"
          ? Number(form.recurringIntervals || 0) || null
          : undefined,
      });
      setForm(EMPTY_FORM);
      setMessage({ type: "success", text: "Coupon created successfully." });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Coupon could not be created.",
      });
    } finally {
      setCreating(false);
    }
  };

  const changeStatus = async (
    code: string,
    status: "ACTIVE" | "INACTIVE" | "DELETED"
  ) => {
    if (
      status === "DELETED" &&
      !window.confirm(
        "Remove this coupon? It will be archived for audit and any free access granted by it will be revoked."
      )
    ) {
      return;
    }

    setWorkingCode(code);
    setMessage(null);
    try {
      const result = await PromoCodeRepository.setStatus(code, status);
      setMessage({
        type: "success",
        text: status === "ACTIVE"
          ? `${code} is active again.`
          : `${code} updated.${result.revokedAccessCount > 0
              ? ` ${result.revokedAccessCount} free access grant(s) revoked.`
              : ""}`,
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Coupon could not be updated.",
      });
    } finally {
      setWorkingCode(null);
    }
  };

  const sendEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!emailCode) return;
    setWorkingCode(emailCode);
    setMessage(null);
    try {
      await PromoCodeRepository.sendEmail(emailCode, recipientEmail);
      setMessage({
        type: "success",
        text: `Promotion sent to ${recipientEmail}.`,
      });
      setRecipientEmail("");
      setMarketingConsentConfirmed(false);
      setEmailCode(null);
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Email could not be sent.",
      });
    } finally {
      setWorkingCode(null);
    }
  };

  return (
    <InternalLayout>
      <header className="mb-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-rose-400">
              Revenue tools
            </p>
            <h1 className="mt-2 text-3xl font-black uppercase italic tracking-tight text-white sm:text-4xl">
              Coupons &amp; <span className="text-rose-500">Promotions</span>
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              Create revocable free access or Paddle-backed percentage offers,
              then send the code directly to a customer.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {[
              ["Active", stats.active],
              ["Free", stats.free],
              ["Used", stats.redemptions],
            ].map(([label, value]) => (
              <div
                key={label}
                className="min-w-20 rounded-2xl border border-slate-800 bg-slate-900 px-3 py-3 text-center sm:min-w-24"
              >
                <p className="text-xl font-black text-white">{value}</p>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </header>

      {message ? (
        <div
          role="status"
          className={`mb-6 flex items-start gap-3 rounded-2xl border p-4 text-sm font-bold ${
            message.type === "success"
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
              : "border-rose-500/20 bg-rose-500/10 text-rose-300"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="h-5 w-5 shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 shrink-0" />
          )}
          {message.text}
        </div>
      ) : null}

      <div className="grid gap-7 xl:grid-cols-[minmax(320px,0.75fr)_minmax(0,1.25fr)]">
        <form
          onSubmit={createCode}
          className="h-fit rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-2xl sm:p-7"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-rose-500/10 p-3 text-rose-400">
              <Gift className="h-6 w-6" />
            </div>
            <div>
              <h2 className="font-black uppercase tracking-tight text-white">
                New coupon
              </h2>
              <p className="text-xs text-slate-500">Letters and numbers only.</p>
            </div>
          </div>

          <div className="mt-6 space-y-5">
            <label className="block">
              <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                Coupon code
              </span>
              <input
                required
                minLength={4}
                maxLength={32}
                pattern="[A-Za-z0-9]+"
                value={form.code}
                onChange={(event) =>
                  updateForm(
                    "code",
                    event.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase()
                  )
                }
                placeholder="WELCOME20"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 font-black uppercase tracking-wider text-white outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                Coupon type
              </span>
              <select
                value={form.type}
                onChange={(event) =>
                  updateForm("type", event.target.value as PromoCodeType)
                }
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-bold text-white outline-none focus:border-rose-500"
              >
                <option value="FREE_LIMITED">Limited-time free access</option>
                <option value="FREE_FOREVER">Free until deactivated</option>
                <option value="PERCENTAGE">Percentage discount</option>
              </select>
            </label>

            {form.type === "FREE_LIMITED" ? (
              <label className="block">
                <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Free access days
                </span>
                <input
                  required
                  type="number"
                  min={1}
                  max={3650}
                  value={form.accessDays || ""}
                  onChange={(event) =>
                    updateForm("accessDays", Number(event.target.value))
                  }
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-rose-500"
                />
              </label>
            ) : null}

            {form.type === "PERCENTAGE" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Discount percent
                  </span>
                  <input
                    required
                    type="number"
                    min={1}
                    max={99}
                    value={form.percentage || ""}
                    onChange={(event) =>
                      updateForm("percentage", Number(event.target.value))
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-rose-500"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Billing cycles
                  </span>
                  <select
                    value={form.recurringIntervals || 0}
                    onChange={(event) =>
                      updateForm(
                        "recurringIntervals",
                        Number(event.target.value) || null
                      )
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-bold text-white outline-none focus:border-rose-500"
                  >
                    <option value={0}>Every renewal</option>
                    <option value={1}>First payment only</option>
                    <option value={3}>First 3 payments</option>
                    <option value={6}>First 6 payments</option>
                    <option value={12}>First 12 payments</option>
                  </select>
                </label>
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Redeem by (optional)
                </span>
                <input
                  type="datetime-local"
                  value={form.expiresAt || ""}
                  onChange={(event) =>
                    updateForm("expiresAt", event.target.value || null)
                  }
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-rose-500"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Total uses (optional)
                </span>
                <input
                  type="number"
                  min={1}
                  max={100000}
                  value={form.usageLimit || ""}
                  onChange={(event) =>
                    updateForm(
                      "usageLimit",
                      Number(event.target.value) || null
                    )
                  }
                  placeholder="Unlimited"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-rose-500"
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                Internal description
              </span>
              <textarea
                rows={3}
                maxLength={180}
                value={form.description || ""}
                onChange={(event) => updateForm("description", event.target.value)}
                placeholder="October customer campaign"
                className="w-full resize-none rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-rose-500"
              />
            </label>

            <button
              type="submit"
              disabled={creating}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 py-3.5 text-sm font-black uppercase tracking-wider text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creating ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Sparkles className="h-5 w-5" />
              )}
              Create coupon
            </button>
          </div>
        </form>

        <section className="min-w-0 rounded-3xl border border-slate-800 bg-slate-900 p-4 shadow-2xl sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="font-black uppercase tracking-tight text-white">
                Coupon library
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Deactivation blocks new use; free grants are revoked immediately.
              </p>
            </div>
            <BadgePercent className="h-6 w-6 text-rose-400" />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="h-9 w-9 animate-spin text-rose-500" />
            </div>
          ) : codes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-700 px-6 py-16 text-center text-sm text-slate-500">
              No coupons created yet.
            </div>
          ) : (
            <div className="space-y-3">
              {codes.map((code) => {
                const working = workingCode === code.code;
                return (
                  <article
                    key={code.code}
                    className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 sm:p-5"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <code className="break-all text-lg font-black tracking-wider text-white">
                            {code.code}
                          </code>
                          <button
                            type="button"
                            aria-label={`Copy ${code.code}`}
                            onClick={() => navigator.clipboard.writeText(code.code)}
                            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-800 hover:text-white"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                          <span
                            className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${statusClasses(code.status)}`}
                          >
                            {code.status}
                          </span>
                        </div>
                        <p className="mt-2 text-sm font-bold text-rose-300">
                          {typeLabel(code)}
                        </p>
                        {code.description ? (
                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            {code.description}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 gap-2">
                        {code.status !== "DELETED" ? (
                          <>
                            <button
                              type="button"
                              disabled={working || code.status !== "ACTIVE"}
                              onClick={() => {
                                setRecipientEmail("");
                                setMarketingConsentConfirmed(false);
                                setEmailCode(code.code);
                              }}
                              className="rounded-xl border border-slate-700 p-2.5 text-slate-300 transition hover:border-blue-500 hover:text-blue-300 disabled:opacity-40"
                              aria-label={`Email ${code.code}`}
                            >
                              <Mail className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              disabled={working}
                              onClick={() =>
                                changeStatus(
                                  code.code,
                                  code.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"
                                )
                              }
                              className="rounded-xl border border-slate-700 p-2.5 text-slate-300 transition hover:border-amber-500 hover:text-amber-300 disabled:opacity-40"
                              aria-label={
                                code.status === "ACTIVE"
                                  ? `Deactivate ${code.code}`
                                  : `Activate ${code.code}`
                              }
                            >
                              {working ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : code.status === "ACTIVE" ? (
                                <PowerOff className="h-4 w-4" />
                              ) : (
                                <Power className="h-4 w-4" />
                              )}
                            </button>
                            <button
                              type="button"
                              disabled={working}
                              onClick={() => changeStatus(code.code, "DELETED")}
                              className="rounded-xl border border-slate-700 p-2.5 text-slate-300 transition hover:border-rose-500 hover:text-rose-300 disabled:opacity-40"
                              aria-label={`Remove ${code.code}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-800 pt-4 text-xs sm:grid-cols-3">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-wider text-slate-600">
                          Uses
                        </p>
                        <p className="mt-1 font-bold text-slate-300">
                          {code.redemptionCount}/{code.usageLimit || "∞"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-wider text-slate-600">
                          Redeem by
                        </p>
                        <p className="mt-1 font-bold text-slate-300">
                          {dateLabel(code.expiresAt)}
                        </p>
                      </div>
                      <div className="col-span-2 sm:col-span-1">
                        <p className="text-[9px] font-black uppercase tracking-wider text-slate-600">
                          Provider
                        </p>
                        <p className="mt-1 truncate font-bold text-slate-300">
                          {code.type === "PERCENTAGE" ? "Paddle" : "KidsGuard"}
                        </p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {emailCode ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="promo-email-title"
        >
          <form
            onSubmit={sendEmail}
            className="w-full max-w-md rounded-3xl border border-slate-700 bg-slate-900 p-6 shadow-2xl sm:p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="promo-email-title" className="text-xl font-black text-white">
                  Email {emailCode}
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  The customer receives the offer and a direct redemption link.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMarketingConsentConfirmed(false);
                  setEmailCode(null);
                }}
                className="rounded-xl p-2 text-slate-500 hover:bg-slate-800 hover:text-white"
                aria-label="Close email form"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <label className="mt-6 block">
              <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                Customer email
              </span>
              <input
                required
                autoFocus
                type="email"
                value={recipientEmail}
                onChange={(event) => setRecipientEmail(event.target.value)}
                placeholder="customer@example.com"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-rose-500"
              />
            </label>
            <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-700 bg-slate-950 p-4">
              <input
                required
                type="checkbox"
                checked={marketingConsentConfirmed}
                onChange={(event) =>
                  setMarketingConsentConfirmed(event.target.checked)
                }
                className="mt-0.5 h-4 w-4"
              />
              <span className="text-xs leading-5 text-slate-400">
                I confirm this recipient may legally receive this promotional email.
              </span>
            </label>
            <button
              type="submit"
              disabled={
                workingCode === emailCode || !marketingConsentConfirmed
              }
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3.5 text-sm font-black text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {workingCode === emailCode ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Mail className="h-5 w-5" />
              )}
              Send promotion
            </button>
          </form>
        </div>
      ) : null}
    </InternalLayout>
  );
}
