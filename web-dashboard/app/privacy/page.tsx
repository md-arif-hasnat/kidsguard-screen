import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | KidsGuard",
  description: "Privacy Policy for the KidsGuard parental safety service.",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-12 text-slate-200">
      <article className="mx-auto max-w-4xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl md:p-10">
        <h1 className="text-3xl font-bold text-white">
          KidsGuard Privacy Policy
        </h1>

        <p className="mt-2 text-sm text-slate-400">
          Last updated: August 11, 2026
        </p>

        <section className="mt-8 space-y-4">
          <p>
            KidsGuard is a parental safety and child-device management service
            operated by United Foreign Trade, Bangladesh.
          </p>

          <p>
            This Privacy Policy explains what information KidsGuard collects,
            why it is collected, how it is used, and the choices available to
            parents and legal guardians.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-semibold text-white">
            1. Who may use KidsGuard
          </h2>

          <p className="mt-3">
            A KidsGuard account may only be created and managed by an adult
            parent or legal guardian. A child cannot create a public KidsGuard
            account independently. The parent or legal guardian is responsible
            for installing, pairing, and using KidsGuard lawfully on a child
            device under their authority.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-semibold text-white">
            2. Information we collect
          </h2>

          <ul className="mt-3 list-disc space-y-2 pl-6">
            <li>
              Parent account information, including name, email address,
              authentication status, family membership, and account settings.
            </li>

            <li>
              Child profile information provided by the parent, including
              display name, avatar, paired-device identifiers, and family
              relationship.
            </li>

            <li>
              Child-device information, including device name, operating-system
              version, app version, battery level, charging state, online
              status, and security or permission status.
            </li>

            <li>
              Location information, location history, safe-zone events, and
              related timestamps when location features are enabled.
            </li>

            <li>
              Safety and activity information, including SOS events, installed
              application information, application activity, browser or media
              activity made available through enabled monitoring features, and
              remote-command status.
            </li>

            <li>
              Notification, support, audit, diagnostic, error, and security-log
              information.
            </li>

            <li>
              Subscription and billing status. Full payment-card details are
              processed by the selected payment provider and are not stored by
              KidsGuard.
            </li>
          </ul>
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-semibold text-white">
            3. How we use information
          </h2>

          <ul className="mt-3 list-disc space-y-2 pl-6">
            <li>Provide and secure the KidsGuard service.</li>
            <li>Connect parent accounts with authorized child devices.</li>
            <li>Display device status, location, alerts, and activity.</li>
            <li>Deliver SOS, safe-zone, battery, device, and security alerts.</li>
            <li>Process support requests and investigate technical problems.</li>
            <li>Prevent fraud, abuse, unauthorized access, and misuse.</li>
            <li>Maintain subscriptions and enforce service limits.</li>
            <li>Comply with applicable legal obligations.</li>
          </ul>
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-semibold text-white">
            4. Legal basis
          </h2>

          <p className="mt-3">
            Where applicable, information is processed to provide the service
            requested by the account holder, based on the parent or legal
            guardian&apos;s authorization, for legitimate safety and security
            purposes, and to comply with legal obligations. Permission-based
            features may be disabled through the device or account settings,
            subject to essential service requirements.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-semibold text-white">
            5. Children&apos;s information
          </h2>

          <p className="mt-3">
            KidsGuard is designed for use by parents and legal guardians, not
            for independent use by children. We do not knowingly allow a child
            to create a public parent account. Child information is processed
            only to provide parental safety and device-management features
            configured by the parent or legal guardian.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-semibold text-white">
            6. Sharing and service providers
          </h2>

          <p className="mt-3">
            Information may be processed by trusted infrastructure,
            authentication, database, hosting, messaging, support, and payment
            providers required to operate KidsGuard. These may include Google
            Firebase, Google Cloud, Vercel, and the payment provider selected
            for subscription processing.
          </p>

          <p className="mt-3">
            We do not sell children&apos;s or parents&apos; personal
            information. Information may be disclosed when legally required,
            to protect users, or to investigate fraud, abuse, or security
            incidents.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-semibold text-white">
            7. International data processing
          </h2>

          <p className="mt-3">
            KidsGuard and its service providers may process information in
            countries other than the user&apos;s country. Where required,
            appropriate contractual, organizational, and technical safeguards
            are used for international data transfers.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-semibold text-white">
            8. Data retention
          </h2>

          <p className="mt-3">
            Information is retained only for as long as reasonably necessary
            to provide the service, maintain security, resolve disputes, and
            meet legal obligations. Retention periods may differ depending on
            the type of information and the family&apos;s settings.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-semibold text-white">
            9. Account and data deletion
          </h2>

          <div className="mt-3 space-y-3">
            <p>
              The Family Owner may request deletion of the
              KidsGuard account, family profile, connected child
              profiles, devices, and associated personal data
              directly from the app or through our online
              deletion page.
            </p>

            <p>
              Once deletion is requested, permanent deletion is
              scheduled for 30 days later. The Family Owner may
              cancel the request by signing in again before the
              scheduled deletion date.
            </p>

            <p>
              After the 30-day recovery period, the account and
              associated family data will be permanently deleted,
              unless specific records must be retained to comply
              with applicable tax, accounting, fraud-prevention,
              security, dispute-resolution, or other legal
              obligations. Any retained records will be limited
              to what is legally necessary and kept only for the
              required retention period.
            </p>

            <p>
              Family members cannot delete the entire family
              account. They may contact support to request removal
              of their own profile or to leave the family.
            </p>

            <p>
              You can submit an account deletion request at{" "}
              <a
                href="/delete-account"
                className="font-semibold text-blue-400 hover:underline"
              >
                KidsGuard Account Deletion
              </a>
              .
            </p>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-semibold text-white">
            10. Your privacy rights
          </h2>

          <p className="mt-3">
            Depending on applicable law, users may have rights to access,
            correct, delete, restrict, or object to processing of personal
            information, and to request data portability or withdraw consent
            where processing is based on consent.
          </p>

          <p className="mt-3">
            Users may also have the right to complain to the relevant data
            protection authority.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-semibold text-white">
            11. Security
          </h2>

          <p className="mt-3">
            We use technical and organizational safeguards intended to protect
            information against unauthorized access, alteration, disclosure,
            or loss. No internet-based system can be guaranteed to be
            completely secure.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-semibold text-white">
            12. Changes to this policy
          </h2>

          <p className="mt-3">
            This Privacy Policy may be updated when the service, legal
            requirements, or data-processing practices change. The latest
            version will be published on this page with an updated date.
          </p>
        </section>

        <section className="mt-8 border-t border-slate-800 pt-6">
          <h2 className="text-xl font-semibold text-white">13. Contact</h2>

          <p className="mt-3">
            Data controller and service operator:
            <br />
            <strong className="text-white">United Foreign Trade</strong>
            <br />
            Bangladesh
          </p>

          <p className="mt-3">
            Privacy and data requests:
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