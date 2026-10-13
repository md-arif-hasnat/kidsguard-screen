import type { Metadata } from "next";
import Link from "next/link";
import {
  Eye,
  HeartHandshake,
  LockKeyhole,
  MapPin,
  MessageCircleQuestion,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import LegalFooter from "@/components/LegalFooter";

export const metadata: Metadata = {
  title: "Privacy for Children | KidsGuard",
  description:
    "A simple explanation for children about how KidsGuard uses device information.",
};

const cards = [
  {
    icon: MapPin,
    title: "Where the device is",
    text: "KidsGuard may show your device location to your parent or guardian so they can help keep you safe.",
  },
  {
    icon: Smartphone,
    title: "How the device is used",
    text: "It may record which apps are installed or used, screen-time information, and some browser or YouTube activity.",
  },
  {
    icon: ShieldCheck,
    title: "Safety controls",
    text: "Your parent or guardian may set bedtime, app limits, website protection, or temporarily lock parts of the device.",
  },
  {
    icon: Eye,
    title: "Who can see it",
    text: "The information is intended for authorized adults in your family and people who must operate or protect the service.",
  },
];

export default function ChildPrivacyPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-950 via-slate-950 to-slate-950 px-4 py-12 text-slate-100">
      <article className="mx-auto max-w-4xl">
        <div className="rounded-3xl border border-sky-800/60 bg-slate-900 p-6 shadow-2xl md:p-10">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-300">
            <HeartHandshake className="h-9 w-9" />
          </div>

          <p className="mt-6 text-xs font-black uppercase tracking-[0.2em] text-sky-400">
            A simple privacy guide
          </p>
          <h1 className="mt-3 text-3xl font-black text-white md:text-4xl">
            What KidsGuard means for you
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-300">
            KidsGuard is a safety app that a parent or guardian can use on a
            child&apos;s device. It helps them understand how the device is
            being used and apply family safety rules.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {cards.map(({ icon: Icon, title, text }) => (
              <section
                key={title}
                className="rounded-2xl border border-slate-700 bg-slate-950/60 p-5"
              >
                <Icon className="h-7 w-7 text-sky-400" />
                <h2 className="mt-3 text-lg font-bold text-white">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">{text}</p>
              </section>
            ))}
          </div>

          <section className="mt-8 rounded-2xl border border-emerald-700/60 bg-emerald-950/30 p-6">
            <LockKeyhole className="h-8 w-8 text-emerald-400" />
            <h2 className="mt-3 text-xl font-bold text-emerald-100">
              Your information should be protected
            </h2>
            <p className="mt-2 leading-7 text-emerald-100/80">
              KidsGuard uses security controls to protect information. It
              should not be used to secretly monitor adults, bully someone, or
              do anything unlawful.
            </p>
          </section>

          <section className="mt-8 rounded-2xl border border-amber-700/60 bg-amber-950/30 p-6">
            <MessageCircleQuestion className="h-8 w-8 text-amber-400" />
            <h2 className="mt-3 text-xl font-bold text-amber-100">
              You can ask questions
            </h2>
            <p className="mt-2 leading-7 text-amber-100/80">
              If something feels confusing or unfair, talk to your parent,
              guardian, teacher, or another trusted adult. You can ask what is
              being collected, why a rule was set, or whether information can
              be corrected or deleted.
            </p>
          </section>

          <section className="mt-8 border-t border-slate-800 pt-7">
            <h2 className="text-xl font-bold text-white">
              More information for parents and guardians
            </h2>
            <p className="mt-3 leading-7 text-slate-400">
              This child-friendly notice is a short explanation. The complete
              details, legal bases, retention periods, transfers, and privacy
              rights are in the{" "}
              <Link className="font-bold text-sky-400 underline" href="/privacy">
                full Privacy Policy
              </Link>
              .
            </p>
            <p className="mt-4 text-sm text-slate-500">
              Last updated: October 13, 2026
            </p>
          </section>
        </div>

        <div className="mt-8 overflow-hidden rounded-2xl">
          <LegalFooter dark />
        </div>
      </article>
    </main>
  );
}
