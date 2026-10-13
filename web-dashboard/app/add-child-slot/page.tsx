"use client";

import Link from "next/link";
import { AlertCircle, CheckCircle2, PlusCircle } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useParentProfile } from "@/lib/context/ParentProfileContext";

export default function AddChildSlotPage() {
  const { family } = useParentProfile();
  const subscription = family?.subscription;
  const included = subscription?.baseChildSlots || 2;
  const extra = subscription?.extraChildSlots || 0;
  const allowed = included + extra;
  const childCount = family?.childDeviceIds?.length || 0;
  const providerReady = Boolean(
    process.env.NEXT_PUBLIC_PADDLE_EXTRA_CHILD_PRICE_ID
  );

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-10">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-blue-50 p-3 text-blue-600">
            <PlusCircle className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900">
              Add Another Child
            </h1>
            <p className="mt-2 text-slate-500">
              Purchase one additional child-device slot before pairing.
            </p>
          </div>
        </div>

        <section className="mt-8 rounded-2xl border border-blue-200 bg-blue-50 p-6">
          <p className="text-xs font-black uppercase tracking-wider text-blue-600">
            Recurring add-on
          </p>
          <h2 className="mt-2 text-3xl font-black text-blue-950">
            €1.99/month
          </h2>
          <p className="mt-2 text-sm leading-6 text-blue-800">
            Each paid add-on permits one additional connected child. It renews
            with the main monthly subscription until removed or cancelled.
          </p>
        </section>

        <div className="mt-6 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-2xl font-black text-slate-900">{childCount}</p>
            <p className="text-xs text-slate-500">Connected</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-2xl font-black text-slate-900">{allowed}</p>
            <p className="text-xs text-slate-500">Allowed</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-2xl font-black text-slate-900">{extra}</p>
            <p className="text-xs text-slate-500">Paid slots</p>
          </div>
        </div>

        <div className="mt-6 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          <p className="text-sm leading-6 text-emerald-800">
            Pairing remains blocked until Paddle confirms payment through a
            signed webhook and KidsGuard increases the paid slot count.
          </p>
        </div>

        {providerReady ? (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            <p className="mt-2 text-sm font-semibold leading-6 text-amber-800">
              The add-on price is configured. Signed webhook and secure
              server-side subscription-update integration must be deployed
              before charging customers.
            </p>
          </div>
        ) : (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            <p className="mt-2 text-sm font-semibold leading-6 text-amber-800">
              Extra-child checkout is not enabled yet. Configure the approved
              Paddle recurring add-on price first.
            </p>
          </div>
        )}

        <button
          disabled
          className="mt-6 w-full cursor-not-allowed rounded-xl bg-blue-600 px-5 py-4 font-black text-white opacity-50"
        >
          Continue to Add Slot
        </button>

        <Link
          href="/"
          className="mt-4 block text-center text-sm font-bold text-blue-600 hover:underline"
        >
          Return to Family Overview
        </Link>
      </div>
    </DashboardLayout>
  );
}
