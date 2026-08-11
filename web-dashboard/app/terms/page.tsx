import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | KidsGuard",
  description: "Terms of Service for the KidsGuard parental safety service.",
};

export default function TermsOfServicePage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-12 text-slate-200">
      <article className="mx-auto max-w-4xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl md:p-10">
        <h1 className="text-3xl font-bold text-white">
          KidsGuard Terms of Service
        </h1>

        <p className="mt-2 text-sm text-slate-400">
          Last updated: August 11, 2026
        </p>

        <section className="mt-8 space-y-4">
          <p>
            These Terms of Service govern access to and use of KidsGuard, a
            parental safety and child-device management service operated by
            United Foreign Trade, Bangladesh.
          </p>

          <p>
            By creating an account, starting a trial, purchasing a
            subscription, or using KidsGuard, you agree to these Terms.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-semibold text-white">
            1. Eligibility and authority
          </h2>

          <p className="mt-3">
            You must be at least 18 years old and legally capable of entering
            into a binding agreement. You may use KidsGuard only as a parent,
            legal guardian, or person with lawful authority over the child and
            device being managed.
          </p>

          <p className="mt-3">
            Children may not create public parent accounts or independently
            purchase KidsGuard subscriptions.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-semibold text-white">
            2. Permitted use
          </h2>

          <p className="mt-3">
            KidsGuard may be used only for transparent, lawful parental safety
            and child-device management. You are responsible for obtaining all
            permissions and providing all notices required by the laws that
            apply to you.
          </p>

          <p className="mt-3">
            You must not use KidsGuard for covert surveillance, stalking,
            harassment, monitoring an adult without lawful authorization, or
            any illegal or abusive purpose.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-semibold text-white">
            3. Accounts and security
          </h2>

          <ul className="mt-3 list-disc space-y-2 pl-6">
            <li>You must provide accurate registration information.</li>
            <li>You are responsible for protecting your login credentials.</li>
            <li>You must verify your email address when requested.</li>
            <li>
              You must notify us promptly if you suspect unauthorized access.
            </li>
            <li>
              You are responsible for activity performed through your account,
              except where applicable law provides otherwise.
            </li>
          </ul>
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-semibold text-white">
            4. Pairing child devices
          </h2>

          <p className="mt-3">
            A child device must be paired with an authorized parent account.
            Pairing codes are temporary and must not be shared with
            unauthorized persons. You must remove devices that you no longer
            have authority to manage.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-semibold text-white">
            5. Trial and subscription
          </h2>

          <p className="mt-3">
            KidsGuard may offer a seven-day free trial that requires a valid
            payment method. Unless cancelled before the trial ends, the
            subscription will automatically begin and the displayed
            subscription price will be charged.
          </p>

          <p className="mt-3">
            The planned base subscription is EUR 2.99 per month and includes
            up to two child-device slots. Additional child-device capacity may
            be offered for an additional recurring price displayed before
            purchase.
          </p>

          <p className="mt-3">
            The final price, currency, taxes, billing interval, included
            capacity, and renewal terms shown at checkout form part of your
            purchase agreement and take priority if they differ from a
            promotional or informational page.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-semibold text-white">
            6. Automatic renewal and cancellation
          </h2>

          <p className="mt-3">
            Subscriptions renew automatically at the applicable billing
            interval until cancelled. You may cancel through the available
            billing portal or by contacting support. Unless applicable law
            requires otherwise, cancellation takes effect at the end of the
            current paid billing period.
          </p>

          <p className="mt-3">
            Cancelling during a free trial prevents the first subscription
            charge, provided cancellation is completed before the trial
            expires.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-semibold text-white">
            7. Payments, taxes, and refunds
          </h2>

          <p className="mt-3">
            Payments may be processed by an independent payment provider.
            Prices and applicable taxes will be displayed at checkout. The
            payment provider may issue invoices and process refunds,
            chargebacks, or payment disputes.
          </p>

          <p className="mt-3">
            Refund requests will be reviewed according to applicable consumer
            law, the circumstances of the request, and the refund information
            presented at checkout. Nothing in these Terms limits mandatory
            consumer rights that cannot legally be excluded.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-semibold text-white">
            8. Service availability
          </h2>

          <p className="mt-3">
            Device status, location, notifications, and remote features may
            depend on internet access, device power, operating-system
            permissions, background restrictions, GPS availability, and
            third-party services. KidsGuard cannot guarantee uninterrupted,
            immediate, or error-free operation.
          </p>

          <p className="mt-3">
            KidsGuard is a parental assistance tool and is not an emergency
            service. In an emergency, contact the appropriate local emergency
            services directly.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-semibold text-white">
            9. User responsibilities
          </h2>

          <ul className="mt-3 list-disc space-y-2 pl-6">
            <li>Use KidsGuard only on devices you are authorized to manage.</li>
            <li>Keep device permissions and contact information accurate.</li>
            <li>Review alerts and device status responsibly.</li>
            <li>Comply with privacy, employment, family, and criminal laws.</li>
            <li>Do not bypass security or interfere with the service.</li>
            <li>
              Do not upload malicious code or attempt unauthorized access.
            </li>
          </ul>
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-semibold text-white">
            10. Suspension and termination
          </h2>

          <p className="mt-3">
            We may restrict or suspend access when reasonably necessary to
            protect children, users, the service, or third parties; investigate
            suspected fraud or abuse; comply with law; or respond to a material
            violation of these Terms.
          </p>

          <p className="mt-3">
            Users may stop using KidsGuard and request account deletion,
            subject to any records that must be retained for legal, security,
            billing, fraud-prevention, or dispute-resolution purposes.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-semibold text-white">
            11. Intellectual property
          </h2>

          <p className="mt-3">
            KidsGuard, including its software, design, branding, documentation,
            and service content, is protected by applicable intellectual
            property laws. These Terms grant only a limited, revocable,
            non-transferable right to use the service for its intended purpose.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-semibold text-white">
            12. Limitation of liability
          </h2>

          <p className="mt-3">
            To the maximum extent permitted by applicable law, KidsGuard and
            its operator are not liable for indirect, incidental, special, or
            consequential losses resulting from service interruption,
            unavailable device data, user misuse, third-party services, or
            circumstances beyond reasonable control.
          </p>

          <p className="mt-3">
            This section does not exclude liability or consumer protections
            that cannot legally be excluded.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-semibold text-white">
            13. Privacy
          </h2>

          <p className="mt-3">
            Our collection and use of personal information is described in the{" "}
            <a
              className="text-blue-400 underline hover:text-blue-300"
              href="/privacy"
            >
              KidsGuard Privacy Policy
            </a>
            .
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-semibold text-white">
            14. Governing terms
          </h2>

          <p className="mt-3">
            These Terms are governed by the applicable laws of Bangladesh,
            without removing any mandatory rights or protections available to
            consumers under the laws that apply in their country of residence.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-semibold text-white">
            15. Changes to these Terms
          </h2>

          <p className="mt-3">
            We may update these Terms when the service, pricing, legal
            requirements, or business practices change. Material changes will
            be communicated where required. Continued use after the effective
            date of an update constitutes acceptance where permitted by law.
          </p>
        </section>

        <section className="mt-8 border-t border-slate-800 pt-6">
          <h2 className="text-xl font-semibold text-white">16. Contact</h2>

          <p className="mt-3">
            Service operator:
            <br />
            <strong className="text-white">United Foreign Trade</strong>
            <br />
            Bangladesh
          </p>

          <p className="mt-3">
            Email:
            <br />
            <a
              className="text-blue-400 underline hover:text-blue-300"
              href="mailto:anish.jmc07@yahoo.com"
            >
              anish.jmc07@yahoo.com
            </a>
          </p>
        </section>
      </article>
    </main>
  );
}