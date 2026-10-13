import type { Metadata } from "next";
import Link from "next/link";
import LegalFooter from "@/components/LegalFooter";

export const metadata: Metadata = {
  title: "Impressum | KidsGuard",
  description: "Provider identification and contact information for KidsGuard.",
};

export default function ImpressumPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-12 text-slate-200">
      <article className="mx-auto max-w-4xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl md:p-10">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-400">
          Provider information
        </p>
        <h1 className="mt-3 text-3xl font-bold text-white">Impressum</h1>
        <p className="mt-2 text-sm text-slate-400">
          Last updated: October 13, 2026
        </p>

        <section className="mt-8">
          <h2 className="text-xl font-semibold text-white">Service provider</h2>
          <p className="mt-3 leading-7">
            <strong className="text-white">United Foreign Trade</strong>
            <br />
            Operator of the KidsGuard parental safety service
            <br />
            Bangladesh
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-semibold text-white">Contact</h2>
          <p className="mt-3 leading-7">
            Email:{" "}
            <a
              className="text-blue-400 underline hover:text-blue-300"
              href="mailto:anish.jmc07@yahoo.com"
            >
              anish.jmc07@yahoo.com
            </a>
          </p>
        </section>

        <section className="mt-8 rounded-xl border border-amber-700/60 bg-amber-950/40 p-5">
          <h2 className="font-semibold text-amber-200">
            Information to be completed before commercial launch
          </h2>
          <p className="mt-2 text-sm leading-6 text-amber-100/80">
            The full serviceable business address, proprietor or authorized
            representative, telephone number, legal form, and applicable
            Bangladesh trade-registration details will be added after the
            operator confirms the exact public business information.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-semibold text-white">
            Responsible for this service
          </h2>
          <p className="mt-3 leading-7">
            United Foreign Trade is responsible for the commercial operation
            and content of KidsGuard. This page does not replace the separate{" "}
            <Link className="text-blue-400 underline" href="/privacy">
              Privacy Policy
            </Link>{" "}
            or{" "}
            <Link className="text-blue-400 underline" href="/terms">
              Terms of Service
            </Link>
            .
          </p>
        </section>
      </article>

      <div className="mx-auto mt-8 max-w-4xl overflow-hidden rounded-2xl">
        <LegalFooter dark />
      </div>
    </main>
  );
}
