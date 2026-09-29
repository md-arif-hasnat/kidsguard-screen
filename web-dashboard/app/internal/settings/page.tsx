"use client";

import InternalLayout from "@/components/InternalLayout";
import { CheckCircle2, Database, ShieldCheck, Wrench } from "lucide-react";

const checks = [
  {
    title: "Admin access",
    description: "Protected by the active platform administrator profile.",
    icon: ShieldCheck,
  },
  {
    title: "Error reporting",
    description: "Child error reports are sanitized before cloud upload.",
    icon: Wrench,
  },
  {
    title: "Data retention",
    description: "Scheduled cleanup includes expired child error reports.",
    icon: Database,
  },
];

export default function InternalSettingsPage() {
  return (
    <InternalLayout>
      <header className="mb-10">
        <h1 className="text-4xl font-black uppercase italic tracking-tight text-white">
          Internal <span className="text-rose-500">Settings</span>
        </h1>
        <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
          Platform configuration and security status
        </p>
      </header>

      <section className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {checks.map(({ title, description, icon: Icon }) => (
          <article key={title} className="rounded-3xl border border-slate-800 bg-slate-900 p-7 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-800 bg-slate-950 text-rose-500">
                <Icon size={23} />
              </div>
              <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-400">
                <CheckCircle2 size={14} /> Active
              </span>
            </div>
            <h2 className="text-base font-black uppercase tracking-tight text-white">{title}</h2>
            <p className="mt-2 text-xs font-medium leading-relaxed text-slate-500">{description}</p>
          </article>
        ))}
      </section>

      <div className="mt-8 rounded-3xl border border-amber-500/20 bg-amber-500/5 p-6">
        <p className="text-xs font-semibold leading-relaxed text-amber-200/80">
          Runtime configuration changes are intentionally deployment-controlled. This prevents accidental production changes from the browser.
        </p>
      </div>
    </InternalLayout>
  );
}
