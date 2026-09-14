import type { Metadata } from "next";
import Link from "next/link";
import { ROUTES } from "@/lib/constants/routes";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Carl collects, uses, and protects personal information in the Carl mobile app and related services.",
};

const EFFECTIVE = "September 14, 2026";
const CONTACT = "privacy@carl.app"; // replace with your real privacy contact
const OPERATOR = "[Legal entity name]"; // replace before publish

export default function PrivacyPolicyPage() {
  return (
    <article className="legal-prose space-y-8 text-[15px] leading-7 text-foreground">
      <header className="space-y-3 border-b border-border pb-8">
        <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted">
          Carl · Legal
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          Privacy Policy
        </h1>
        <p className="text-sm text-muted">
          Effective date: {EFFECTIVE}
          <br />
          Last updated: {EFFECTIVE}
        </p>
        <p className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted">
          This draft describes how the Carl product works today (mobile app for
          customers, agent workspace, and backend services). Replace{" "}
          <strong className="text-foreground">{OPERATOR}</strong> and{" "}
          <strong className="text-foreground">{CONTACT}</strong> with your real
          company details before publishing.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">1. Who we are</h2>
        <p>
          Carl (“<strong>Carl</strong>,” “<strong>we</strong>,” “
          <strong>us</strong>,” or “<strong>our</strong>”) is a human concierge
          platform. Customers use the Carl mobile application to request help
          (for example travel, lodging, bookings, and related services). Trained
          human agents handle those requests through Carl’s agent tools. This
          Privacy Policy explains how we collect, use, share, and protect
          personal information when you use Carl’s mobile app, websites, and
          related services (the “<strong>Services</strong>”).
        </p>
        <p>
          The Services are operated by {OPERATOR}. For privacy questions,
          contact us at{" "}
          <a className="text-accent underline-offset-2 hover:underline" href={`mailto:${CONTACT}`}>
            {CONTACT}
          </a>
          .
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">
          2. Scope
        </h2>
        <p>This Policy applies to:</p>
        <ul className="list-disc space-y-1 pl-5 text-muted">
          <li>Customers using the Carl mobile app</li>
          <li>Agents and operators using Carl workspaces</li>
          <li>Visitors to Carl public pages linked from the app</li>
        </ul>
        <p>
          It does not cover third-party websites, hotels, airlines, payment
          processors, or other providers you may interact with outside Carl,
          except as described in Section 6.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">
          3. Information we collect
        </h2>
        <h3 className="text-base font-semibold">3.1 Information you provide</h3>
        <ul className="list-disc space-y-1 pl-5 text-muted">
          <li>
            <span className="text-foreground">Account details</span> — name,
            email, phone number, password or authentication credentials, profile
            photo, and similar registration information.
          </li>
          <li>
            <span className="text-foreground">Request and task content</span> —
            what you ask Carl to do (titles, descriptions, preferences,
            itinerary details, membership or loyalty identifiers you choose to
            share, and related files or notes).
          </li>
          <li>
            <span className="text-foreground">Messages</span> — chat content
            between customers and agents (and, for agents, messages with Carl
            operations/admin support).
          </li>
          <li>
            <span className="text-foreground">Confirmations and approvals</span>{" "}
            — information needed to confirm bookings or actions (for example
            guest names, contact numbers, travel details, and confirmation
            status).
          </li>
          <li>
            <span className="text-foreground">Payment-related information</span>{" "}
            — payment requests, amounts, status, receipts, and limited payment
            method descriptors (such as brand and last four digits) when shown
            in-product. Full card numbers are handled by our payment partners
            where applicable; Carl is not intended to store full card PAN data
            in agent tools.
          </li>
          <li>
            <span className="text-foreground">Support content</span> — messages
            you send to Carl support or admin chat.
          </li>
        </ul>

        <h3 className="text-base font-semibold">3.2 Information collected automatically</h3>
        <ul className="list-disc space-y-1 pl-5 text-muted">
          <li>
            Device and app data (device type, OS, app version, language,
            approximate network information).
          </li>
          <li>
            Usage and log data (screens viewed, feature use, timestamps, crash
            or diagnostic events).
          </li>
          <li>
            Online identifiers needed for security and sessions (such as
            authentication tokens and session cookies on web surfaces).
          </li>
          <li>
            Real-time connection metadata when using live features (for example
            WebSocket connection status for chat and task updates).
          </li>
        </ul>

        <h3 className="text-base font-semibold">3.3 Location and place context</h3>
        <p>
          Carl may process place or venue labels and related context you or an
          agent associate with a task (for example a hotel or location name). If
          the mobile app requests precise device location, we will ask for your
          permission and use it only to support the request you made (or as
          otherwise disclosed at the time of collection).
        </p>

        <h3 className="text-base font-semibold">3.4 Information from others</h3>
        <p>
          Agents, admins, and service partners may add information while
          fulfilling your request (status updates, notes, booking references,
          payment outcomes). We may also receive limited account or fraud
          signals from authentication and infrastructure providers.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">
          4. How we use information
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-muted">
          <li>Provide, operate, and improve the Services</li>
          <li>Match customer requests with available human agents</li>
          <li>Enable messaging, task workflow, confirmations, and receipts</li>
          <li>Process or facilitate payments you authorize</li>
          <li>Send service notices (task updates, security alerts)</li>
          <li>Maintain availability/presence for agent operations</li>
          <li>Detect, prevent, and investigate fraud, abuse, or security incidents</li>
          <li>Comply with law and enforce our Terms</li>
          <li>Analyze aggregated usage to improve product quality</li>
        </ul>
        <p>
          We do not sell your personal information. We do not use customer chat
          content to train public generative AI models unless we clearly ask and
          you agree in a separate notice.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">
          5. How Carl works with human agents
        </h2>
        <p>
          When you submit a request, authorized Carl agents can see information
          needed to help you — including your request details, messages, and
          relevant confirmation or payment status. Agents use Carl’s secure
          workspace tools. Agent activity may be logged for quality, safety, and
          operational purposes.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">
          6. Sharing of information
        </h2>
        <p>We may share personal information with:</p>
        <ul className="list-disc space-y-1 pl-5 text-muted">
          <li>
            <span className="text-foreground">Service providers</span> —
            hosting, analytics, messaging infrastructure, customer support
            tooling, and similar processors who act on our instructions.
          </li>
          <li>
            <span className="text-foreground">Payment processors</span> — to
            complete payments you request or approve.
          </li>
          <li>
            <span className="text-foreground">Vendors involved in your request</span>{" "}
            — for example hotels, airlines, or other providers, when needed to
            fulfill what you asked Carl to do.
          </li>
          <li>
            <span className="text-foreground">Professional advisors and authorities</span>{" "}
            — when required by law, legal process, or to protect rights, safety,
            and security.
          </li>
          <li>
            <span className="text-foreground">Business transfers</span> — if we
            are involved in a merger, acquisition, or asset sale, subject to
            appropriate protections.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">
          7. Retention
        </h2>
        <p>
          We keep personal information for as long as needed to provide the
          Services, resolve disputes, enforce agreements, and meet legal,
          tax, and accounting requirements. Task history, messages,
          confirmations, and payment records may be retained for operational
          and compliance reasons after a request is completed. You may request
          deletion as described below, subject to legal exceptions.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">
          8. Security
        </h2>
        <p>
          We use administrative, technical, and organizational measures designed
          to protect personal information, including authenticated access,
          encrypted transport (HTTPS), session controls, and role-based access
          for agents. No method of transmission or storage is 100% secure. Please
          use a strong password and protect your devices.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">
          9. Your choices and rights
        </h2>
        <p>Depending on where you live, you may have rights to:</p>
        <ul className="list-disc space-y-1 pl-5 text-muted">
          <li>Access or receive a copy of your personal information</li>
          <li>Correct inaccurate information</li>
          <li>Delete information (subject to legal/operational limits)</li>
          <li>Object to or restrict certain processing</li>
          <li>Withdraw consent where processing is consent-based</li>
          <li>Opt out of non-essential notifications in app settings</li>
        </ul>
        <p>
          To exercise these rights, email{" "}
          <a className="text-accent underline-offset-2 hover:underline" href={`mailto:${CONTACT}`}>
            {CONTACT}
          </a>
          . We may need to verify your identity before responding. If you are an
          agent, some account changes may also be available in your profile
          settings.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">
          10. Children
        </h2>
        <p>
          Carl is not directed to children under 16 (or the minimum age required
          in your country). We do not knowingly collect personal information from
          children. If you believe a child has provided information, contact us
          and we will take appropriate steps.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">
          11. International transfers
        </h2>
        <p>
          Carl may process information on servers or with providers located
          outside your country. Where required, we use appropriate safeguards for
          cross-border transfers.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">
          12. Changes to this Policy
        </h2>
        <p>
          We may update this Privacy Policy from time to time. We will post the
          updated version on this page and change the “Last updated” date. If
          changes are material, we may provide additional notice in the app or by
          email.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">13. Contact</h2>
        <p>
          Privacy requests:{" "}
          <a className="text-accent underline-offset-2 hover:underline" href={`mailto:${CONTACT}`}>
            {CONTACT}
          </a>
          <br />
          Operator: {OPERATOR}
        </p>
        <p className="text-sm text-muted">
          Related:{" "}
          <Link href={ROUTES.terms} className="text-accent hover:underline">
            Terms &amp; Conditions
          </Link>
        </p>
      </section>
    </article>
  );
}
