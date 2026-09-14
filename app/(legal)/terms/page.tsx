import type { Metadata } from "next";
import Link from "next/link";
import { ROUTES } from "@/lib/constants/routes";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description:
    "Terms governing use of the Carl mobile app and related concierge services.",
};

const EFFECTIVE = "September 14, 2026";
const CONTACT = "support@carl.app"; // replace with your real support contact
const OPERATOR = "[Legal entity name]"; // replace before publish

export default function TermsPage() {
  return (
    <article className="legal-prose space-y-8 text-[15px] leading-7 text-foreground">
      <header className="space-y-3 border-b border-border pb-8">
        <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted">
          Carl · Legal
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          Terms &amp; Conditions
        </h1>
        <p className="text-sm text-muted">
          Effective date: {EFFECTIVE}
          <br />
          Last updated: {EFFECTIVE}
        </p>
        <p className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted">
          These Terms describe Carl’s concierge product (mobile app, agent
          fulfillment, messaging, confirmations, and payments). Replace{" "}
          <strong className="text-foreground">{OPERATOR}</strong> and{" "}
          <strong className="text-foreground">{CONTACT}</strong> before
          publishing. Have legal counsel review before App Store / Play Store
          use.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">
          1. Agreement to these Terms
        </h2>
        <p>
          These Terms &amp; Conditions (“<strong>Terms</strong>”) are a binding
          agreement between you and {OPERATOR} (“<strong>Carl</strong>,” “
          <strong>we</strong>,” “<strong>us</strong>”). By downloading,
          accessing, or using the Carl mobile application, websites, or related
          services (the “<strong>Services</strong>”), you agree to these Terms
          and our{" "}
          <Link href={ROUTES.privacy} className="text-accent hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
        <p>
          If you do not agree, do not use the Services. If you use Carl on behalf
          of an organization, you confirm you have authority to bind that
          organization.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">
          2. What Carl is
        </h2>
        <p>
          Carl is a human concierge platform. Customers submit requests in the
          mobile app. Available human agents may accept those requests and work
          them through Carl’s tools — including messaging, task status updates,
          confirmations, receipts, and payment workflows.
        </p>
        <p>
          Carl is <strong>not</strong> the hotel, airline, restaurant, or other
          end vendor unless we expressly say otherwise for a specific offering.
          Agents may contact third parties on your behalf to fulfill a request
          you authorized.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">
          3. Eligibility and accounts
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-muted">
          <li>You must be at least 16 (or the legal age in your country).</li>
          <li>You must provide accurate account information and keep it updated.</li>
          <li>You are responsible for safeguarding login credentials and device access.</li>
          <li>
            Notify us promptly at {CONTACT} if you suspect unauthorized use of
            your account.
          </li>
        </ul>
        <p>
          We may refuse, suspend, or terminate accounts that appear fraudulent,
          abusive, or in violation of these Terms.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">
          4. Customer requests and agent fulfillment
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-muted">
          <li>
            Submitting a request does not guarantee an agent will accept it or
            that a third party will fulfill it.
          </li>
          <li>
            Agents may ask for confirmations (for example contact details,
            travel data, or approval to proceed) before taking action.
          </li>
          <li>
            You are responsible for the accuracy of information you provide.
            Incorrect details can delay or break a booking or payment.
          </li>
          <li>
            Task status shown in the app (offered, in progress, waiting,
            completed, cancelled, etc.) is operational information and may change
            as work proceeds.
          </li>
          <li>
            Offers to agents may expire. Rejected or expired offers may be
            reassigned according to Carl’s routing rules.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">
          5. Messaging and acceptable use
        </h2>
        <p>You agree not to:</p>
        <ul className="list-disc space-y-1 pl-5 text-muted">
          <li>Harass, threaten, or abuse agents, staff, or other users</li>
          <li>Submit unlawful, fraudulent, or misleading requests</li>
          <li>Upload malware or attempt to disrupt the Services</li>
          <li>Scrape, reverse engineer, or misuse APIs or live channels</li>
          <li>Impersonate another person or misrepresent your authority</li>
          <li>
            Use Carl for prohibited content or transactions (illegal goods,
            sanctions evasion, exploitation, etc.)
          </li>
        </ul>
        <p>
          We may monitor messages and task activity as needed for safety,
          quality, fraud prevention, and support (including admin/operations
          chat for agents).
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">
          6. Payments, fees, and receipts
        </h2>
        <p>
          Some requests involve payment. When you authorize a payment through
          Carl:
        </p>
        <ul className="list-disc space-y-1 pl-5 text-muted">
          <li>You confirm you are authorized to use the selected payment method.</li>
          <li>
            Payments may be processed by third-party processors under their
            terms.
          </li>
          <li>
            Amounts, currency, and status shown in Carl reflect information
            available to us at the time; banks or vendors may update settlement
            later.
          </li>
          <li>
            Receipts or confirmation records may be generated for completed
            steps; keep your own copies of important booking documents.
          </li>
        </ul>
        <p>
          Unless stated otherwise in-product, third-party vendor prices, taxes,
          cancellation fees, and refunds are governed by that vendor’s policies.
          Carl’s service fees (if any) will be disclosed before you confirm.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">
          7. Third-party services
        </h2>
        <p>
          Fulfillment often depends on hotels, airlines, payment networks, maps,
          or other third parties. Those parties are independent. Carl is not
          responsible for their acts, omissions, inventory, pricing changes,
          overbookings, delays, or cancellations, except to the extent required
          by law or expressly promised in writing by Carl.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">
          8. Agent-specific terms
        </h2>
        <p>
          If you access Carl as an agent or operator, you also agree to:
        </p>
        <ul className="list-disc space-y-1 pl-5 text-muted">
          <li>Use customer data only to perform assigned work</li>
          <li>Follow Carl’s confidentiality and conduct rules</li>
          <li>Keep availability/presence status accurate while on duty</li>
          <li>
            Not export, copy, or misuse customer information outside authorized
            tools
          </li>
          <li>
            Use Admin Chat and support channels appropriately for operational
            help
          </li>
        </ul>
        <p>
          Violation may result in removal from the platform and other remedies.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">
          9. Intellectual property
        </h2>
        <p>
          Carl’s software, branding, designs, and content (excluding your
          user-submitted content) are owned by Carl or its licensors. You receive
          a limited, non-exclusive, non-transferable license to use the Services
          for their intended purpose. You grant Carl a worldwide license to host,
          process, and display content you submit as needed to operate the
          Services and fulfill your requests.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">
          10. Disclaimers
        </h2>
        <p>
          THE SERVICES ARE PROVIDED “AS IS” AND “AS AVAILABLE.” TO THE MAXIMUM
          EXTENT PERMITTED BY LAW, CARL DISCLAIMS WARRANTIES OF MERCHANTABILITY,
          FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT
          WARRANT THAT REQUESTS WILL BE ACCEPTED, COMPLETED WITHIN A PARTICULAR
          TIME, OR PRODUCE A SPECIFIC THIRD-PARTY OUTCOME.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">
          11. Limitation of liability
        </h2>
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, CARL AND ITS AFFILIATES,
          OFFICERS, EMPLOYEES, AND AGENTS WILL NOT BE LIABLE FOR INDIRECT,
          INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR LOST
          PROFITS, DATA, OR GOODWILL. CARL’S TOTAL LIABILITY FOR CLAIMS RELATING
          TO THE SERVICES WILL NOT EXCEED THE GREATER OF (A) AMOUNTS YOU PAID TO
          CARL FOR THE SERVICE GIVING RISE TO THE CLAIM IN THE 12 MONTHS BEFORE
          THE CLAIM OR (B) USD $100, EXCEPT WHERE LIABILITY CANNOT BE LIMITED BY
          LAW.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">
          12. Indemnity
        </h2>
        <p>
          You agree to defend and indemnify Carl against claims arising from your
          misuse of the Services, your content, your breach of these Terms, or
          your violation of law or third-party rights, except to the extent caused
          by Carl’s willful misconduct.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">
          13. Suspension and termination
        </h2>
        <p>
          You may stop using the Services at any time. We may suspend or end
          access if you breach these Terms, create risk, or if we discontinue the
          product. Provisions that by nature should survive (including
          intellectual property, disclaimers, limitations, and indemnity) will
          survive termination.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">
          14. Changes to the Services or Terms
        </h2>
        <p>
          We may update the Services and these Terms. We will post the updated
          Terms on this page and revise the “Last updated” date. Continued use
          after the effective date means you accept the updated Terms, except
          where local law requires additional consent.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">
          15. Governing law
        </h2>
        <p>
          These Terms are governed by the laws of{" "}
          <strong>[Governing jurisdiction — e.g., State of Delaware / England
          &amp; Wales]</strong>
          , without regard to conflict-of-law rules, except where mandatory
          consumer protections in your country apply. Courts in{" "}
          <strong>[Venue city / region]</strong> will have exclusive
          jurisdiction, subject to those mandatory protections.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight">16. Contact</h2>
        <p>
          Questions about these Terms:{" "}
          <a
            className="text-accent underline-offset-2 hover:underline"
            href={`mailto:${CONTACT}`}
          >
            {CONTACT}
          </a>
          <br />
          Operator: {OPERATOR}
        </p>
        <p className="text-sm text-muted">
          Related:{" "}
          <Link href={ROUTES.privacy} className="text-accent hover:underline">
            Privacy Policy
          </Link>
        </p>
      </section>
    </article>
  );
}
