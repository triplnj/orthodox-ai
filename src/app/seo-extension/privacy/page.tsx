import Link from "next/link";
import type { Metadata } from "next";

const OPERATOR_NAME = "D.Ivkovic";
const CONTACT_EMAIL = "nakafudodji@gmail.com";
const LAST_UPDATED = "July 27, 2026";

export const metadata: Metadata = {
  title: "Privacy Policy | SEO Brief & Blog Generator",
  description:
    "Privacy Policy for the SEO Brief & Blog Generator Chrome extension.",
  robots: {
    index: true,
    follow: true,
  },
};

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f6f7f9",
    color: "#1f2937",
    padding: "40px 20px",
    fontFamily:
      "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  article: {
    width: "100%",
    maxWidth: "900px",
    margin: "0 auto",
    padding: "40px",
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "16px",
    boxShadow: "0 8px 30px rgba(0, 0, 0, 0.06)",
    lineHeight: 1.7,
  },
  heading: {
    marginTop: 0,
    marginBottom: "8px",
    fontSize: "36px",
    lineHeight: 1.2,
    color: "#111827",
  },
  subtitle: {
    marginTop: 0,
    marginBottom: "8px",
    fontSize: "18px",
    color: "#4b5563",
  },
  updated: {
    marginTop: 0,
    marginBottom: "32px",
    fontSize: "14px",
    color: "#6b7280",
  },
  sectionHeading: {
    marginTop: "34px",
    marginBottom: "12px",
    fontSize: "23px",
    lineHeight: 1.3,
    color: "#111827",
  },
  subheading: {
    marginTop: "22px",
    marginBottom: "8px",
    fontSize: "18px",
    color: "#111827",
  },
  paragraph: {
    marginTop: "10px",
    marginBottom: "10px",
  },
  list: {
    marginTop: "10px",
    marginBottom: "16px",
    paddingLeft: "24px",
  },
  listItem: {
    marginBottom: "8px",
  },
  link: {
    color: "#1d4ed8",
    textDecoration: "underline",
    textUnderlineOffset: "3px",
  },
  notice: {
    marginTop: "20px",
    padding: "18px",
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    borderRadius: "10px",
  },
  footer: {
    marginTop: "42px",
    paddingTop: "24px",
    borderTop: "1px solid #e5e7eb",
    fontSize: "14px",
    color: "#6b7280",
  },
} satisfies Record<string, React.CSSProperties>;

export default function SeoExtensionPrivacyPage() {
  return (
    <main style={styles.page}>
      <article style={styles.article}>
        <header>
          <h1 style={styles.heading}>Privacy Policy</h1>

          <p style={styles.subtitle}>
            SEO Brief &amp; Blog Generator Chrome Extension
          </p>

          <p style={styles.updated}>Last updated: {LAST_UPDATED}</p>
        </header>

        <p style={styles.paragraph}>
          This Privacy Policy explains how the SEO Brief &amp; Blog Generator
          Chrome extension, referred to in this policy as the
          &quot;Extension,&quot; collects, uses, stores, and shares information.
          The Extension is operated by {OPERATOR_NAME}, referred to as
          &quot;we,&quot; &quot;us,&quot; or &quot;our.&quot;
        </p>

        <p style={styles.paragraph}>
          By installing or using the Extension, you acknowledge the data
          practices described in this Privacy Policy.
        </p>

        <section>
          <h2 style={styles.sectionHeading}>1. Extension purpose</h2>

          <p style={styles.paragraph}>
            The Extension helps users create SEO briefs and complete
            SEO-oriented content based on information they provide. It also
            allows users to copy, download, or insert generated content into
            supported Shopify and ChatGPT editors.
          </p>
        </section>

        <section>
          <h2 style={styles.sectionHeading}>2. Information we process</h2>

          <h3 style={styles.subheading}>Information you provide</h3>

          <p style={styles.paragraph}>
            When you request content generation, the Extension may process:
          </p>

          <ul style={styles.list}>
            <li style={styles.listItem}>Keywords and topic information</li>
            <li style={styles.listItem}>Target audience</li>
            <li style={styles.listItem}>Preferred tone of voice</li>
            <li style={styles.listItem}>Selected language</li>
            <li style={styles.listItem}>Page or content type</li>
            <li style={styles.listItem}>
              Whether you request an SEO brief or a complete article
            </li>
            <li style={styles.listItem}>
              Generated content that you choose to copy, download, or insert
            </li>
          </ul>

          <h3 style={styles.subheading}>
            Subscription and license information
          </h3>

          <p style={styles.paragraph}>
            If you activate a paid subscription, the Extension processes:
          </p>

          <ul style={styles.list}>
            <li style={styles.listItem}>Your Lemon Squeezy license key</li>
            <li style={styles.listItem}>A license activation instance ID</li>
            <li style={styles.listItem}>
              License status and expiration information
            </li>
            <li style={styles.listItem}>
              The number of devices activated under the license
            </li>
          </ul>

          <p style={styles.paragraph}>
            We do not directly collect or store your complete payment card
            details. Payments, invoices, taxes, subscription management, and
            purchase-related information are processed by Lemon Squeezy.
          </p>

          <h3 style={styles.subheading}>Free-trial information</h3>

          <p style={styles.paragraph}>
            The Extension provides a limited number of free content
            generations. To enforce this limit and reduce misuse, we process a
            randomly generated installation or device identifier and the
            number of successful free generations associated with it.
          </p>

          <p style={styles.paragraph}>
            This identifier is used for trial management and is not intended to
            reveal your real-world identity.
          </p>

          <h3 style={styles.subheading}>Technical information</h3>

          <p style={styles.paragraph}>
            Our hosting and infrastructure providers may automatically process
            limited technical information when requests are made, including:
          </p>

          <ul style={styles.list}>
            <li style={styles.listItem}>IP address</li>
            <li style={styles.listItem}>Request date and time</li>
            <li style={styles.listItem}>Browser or user-agent information</li>
            <li style={styles.listItem}>Server response and error logs</li>
            <li style={styles.listItem}>
              Information necessary to maintain security and prevent abuse
            </li>
          </ul>
        </section>

        <section>
          <h2 style={styles.sectionHeading}>
            3. Information stored in your browser
          </h2>

          <p style={styles.paragraph}>
            The Extension may store the following information locally using
            Chrome Storage or browser local storage:
          </p>

          <ul style={styles.list}>
            <li style={styles.listItem}>Theme preference</li>
            <li style={styles.listItem}>
              A limited history of recently generated content
            </li>
            <li style={styles.listItem}>
              Installation or device identifier
            </li>
            <li style={styles.listItem}>License key</li>
            <li style={styles.listItem}>License instance ID</li>
            <li style={styles.listItem}>Cached subscription status</li>
          </ul>

          <p style={styles.paragraph}>
            Recent generation history remains on your device unless you clear
            it, clear your browser data, or uninstall the Extension.
          </p>
        </section>

        <section>
          <h2 style={styles.sectionHeading}>
            4. How we use information
          </h2>

          <p style={styles.paragraph}>
            We use the information described above only for purposes such as:
          </p>

          <ul style={styles.list}>
            <li style={styles.listItem}>
              Generating the SEO content requested by the user
            </li>
            <li style={styles.listItem}>
              Providing copying, downloading, and editor-insertion features
            </li>
            <li style={styles.listItem}>
              Validating and managing paid subscriptions
            </li>
            <li style={styles.listItem}>
              Providing and enforcing the free-trial limit
            </li>
            <li style={styles.listItem}>
              Detecting misuse, fraud, and unauthorized access
            </li>
            <li style={styles.listItem}>
              Diagnosing errors and maintaining service reliability
            </li>
            <li style={styles.listItem}>
              Complying with applicable legal obligations
            </li>
          </ul>

          <p style={styles.paragraph}>
            We do not use Extension data for personalized advertising,
            behavioral advertising, credit decisions, or data brokerage.
          </p>

          <p style={styles.paragraph}>
            We do not sell personal information.
          </p>
        </section>

        <section>
          <h2 style={styles.sectionHeading}>
            5. Shopify and ChatGPT editor access
          </h2>

          <p style={styles.paragraph}>
            The Extension requests access to supported Shopify or ChatGPT pages
            only when the user explicitly selects an insertion feature.
          </p>

          <p style={styles.paragraph}>
            The Extension uses this access to locate the relevant text editor
            and insert the generated content selected by the user. It is not
            designed to collect unrelated page content, browsing history,
            private conversations, Shopify customer information, store orders,
            or other unrelated website data.
          </p>

          <p style={styles.paragraph}>
            Content is inserted only after a direct user action, such as
            clicking the corresponding injection button.
          </p>
        </section>

        <section>
          <h2 style={styles.sectionHeading}>
            6. Service providers and data sharing
          </h2>

          <p style={styles.paragraph}>
            We share information only when necessary to operate the Extension,
            provide its features, protect the service, or comply with law.
          </p>

          <h3 style={styles.subheading}>OpenAI</h3>

          <p style={styles.paragraph}>
            Keywords, instructions, content settings, and related prompts are
            sent to the OpenAI API to generate the requested SEO content.
          </p>

          <p style={styles.paragraph}>
            OpenAI processes this information according to its applicable
            business service terms and data policies.
          </p>

          <p style={styles.paragraph}>
            <a
              href="https://openai.com/policies/privacy-policy/"
              target="_blank"
              rel="noreferrer"
              style={styles.link}
            >
              OpenAI Privacy Policy
            </a>
          </p>

          <h3 style={styles.subheading}>Lemon Squeezy</h3>

          <p style={styles.paragraph}>
            Lemon Squeezy processes purchases, payment information, invoices,
            taxes, subscription status, customer contact details, and license
            keys. Lemon Squeezy acts as the payment and subscription provider.
          </p>

          <p style={styles.paragraph}>
            <a
              href="https://www.lemonsqueezy.com/privacy"
              target="_blank"
              rel="noreferrer"
              style={styles.link}
            >
              Lemon Squeezy Privacy Policy
            </a>
          </p>

          <h3 style={styles.subheading}>Render</h3>

          <p style={styles.paragraph}>
            Render hosts the Extension&apos;s backend service and may process
            network requests, technical metadata, and server logs necessary to
            provide and secure that service.
          </p>

          <p style={styles.paragraph}>
            <a
              href="https://render.com/privacy"
              target="_blank"
              rel="noreferrer"
              style={styles.link}
            >
              Render Privacy Policy
            </a>
          </p>

          <h3 style={styles.subheading}>MongoDB</h3>

          <p style={styles.paragraph}>
            MongoDB infrastructure may be used to store installation
            identifiers and free-trial usage records.
          </p>

          <p style={styles.paragraph}>
            <a
              href="https://www.mongodb.com/legal/privacy-policy"
              target="_blank"
              rel="noreferrer"
              style={styles.link}
            >
              MongoDB Privacy Policy
            </a>
          </p>

          <h3 style={styles.subheading}>Google Chrome</h3>

          <p style={styles.paragraph}>
            Google distributes the Extension through the Chrome Web Store and
            provides the browser APIs and local storage functionality used by
            the Extension.
          </p>

          <p style={styles.paragraph}>
            <a
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noreferrer"
              style={styles.link}
            >
              Google Privacy Policy
            </a>
          </p>

          <h3 style={styles.subheading}>Vercel</h3>

          <p style={styles.paragraph}>
            This Privacy Policy page is hosted through Vercel. Vercel may
            process ordinary website request and server-log information when
            this page is visited.
          </p>

          <p style={styles.paragraph}>
            <a
              href="https://vercel.com/legal/privacy-policy"
              target="_blank"
              rel="noreferrer"
              style={styles.link}
            >
              Vercel Privacy Policy
            </a>
          </p>
        </section>

        <section>
          <h2 style={styles.sectionHeading}>7. Payments</h2>

          <p style={styles.paragraph}>
            Paid access is offered as a recurring subscription through Lemon
            Squeezy. We do not directly receive or store complete credit-card
            numbers, card verification codes, or other complete payment-card
            credentials.
          </p>

          <p style={styles.paragraph}>
            Lemon Squeezy may collect information such as your name, email
            address, billing address, tax information, payment information, and
            transaction details according to its own privacy policy.
          </p>
        </section>

        <section>
          <h2 style={styles.sectionHeading}>8. Legal bases for processing</h2>

          <p style={styles.paragraph}>
            Where the General Data Protection Regulation or similar law
            applies, we process information under one or more of the following
            legal bases:
          </p>

          <ul style={styles.list}>
            <li style={styles.listItem}>
              Performance of a contract or steps requested before entering a
              contract
            </li>
            <li style={styles.listItem}>
              Our legitimate interests in providing, securing, maintaining,
              and preventing misuse of the Extension
            </li>
            <li style={styles.listItem}>
              Compliance with legal obligations
            </li>
            <li style={styles.listItem}>
              Consent, where consent is required by applicable law
            </li>
          </ul>
        </section>

        <section>
          <h2 style={styles.sectionHeading}>9. Data retention</h2>

          <p style={styles.paragraph}>
            Locally stored preferences, generation history, and license
            information remain in the browser until they are cleared by the
            user, removed by the Extension, or deleted when the Extension is
            uninstalled, subject to Chrome&apos;s storage behavior.
          </p>

          <p style={styles.paragraph}>
            Free-trial usage records may be retained for as long as reasonably
            necessary to enforce trial limits, prevent repeated abuse, maintain
            security, and resolve disputes.
          </p>

          <p style={styles.paragraph}>
            We do not intentionally maintain a permanent server-side archive of
            every SEO prompt and generated response. However, limited
            information may temporarily appear in technical, security, or error
            logs, and third-party providers may retain information according to
            their own terms and policies.
          </p>

          <p style={styles.paragraph}>
            Subscription and transaction records may be retained by Lemon
            Squeezy where required for payment processing, accounting, tax,
            fraud prevention, and legal compliance.
          </p>
        </section>

        <section>
          <h2 style={styles.sectionHeading}>10. Data security</h2>

          <p style={styles.paragraph}>
            The Extension transmits information to its backend and service
            providers over HTTPS. We use reasonable technical and
            organizational measures intended to protect information against
            unauthorized access, alteration, disclosure, or destruction.
          </p>

          <p style={styles.paragraph}>
            No internet transmission or storage system can be guaranteed to be
            completely secure.
          </p>
        </section>

        <section>
          <h2 style={styles.sectionHeading}>11. Your choices and rights</h2>

          <p style={styles.paragraph}>
            Depending on your location, you may have rights to request access
            to, correction of, deletion of, restriction of, or portability of
            personal information associated with you. You may also have the
            right to object to certain processing or withdraw consent where
            processing is based on consent.
          </p>

          <p style={styles.paragraph}>
            You can clear recent generation history from within the Extension.
            You can also remove locally stored Extension information by
            clearing Extension data or uninstalling the Extension.
          </p>

          <p style={styles.paragraph}>
            You may request deletion of server-side trial information by
            contacting us. To locate the applicable record, we may need your
            Extension installation identifier or other information reasonably
            necessary to identify the record.
          </p>

          <p style={styles.paragraph}>
            Requests may be submitted to{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} style={styles.link}>
              {CONTACT_EMAIL}
            </a>
            .
          </p>

          <p style={styles.paragraph}>
            Users in the European Economic Area may also have the right to
            submit a complaint to their local data-protection supervisory
            authority.
          </p>
        </section>

        <section>
          <h2 style={styles.sectionHeading}>
            12. California privacy information
          </h2>

          <p style={styles.paragraph}>
            We do not sell personal information and do not share personal
            information for cross-context behavioral advertising.
          </p>

          <p style={styles.paragraph}>
            Residents of California may contact us to exercise privacy rights
            available under applicable California law. We will not
            discriminate against a user for making a valid privacy request.
          </p>
        </section>

        <section>
          <h2 style={styles.sectionHeading}>13. Children&apos;s privacy</h2>

          <p style={styles.paragraph}>
            The Extension is not directed to children under 13, and we do not
            knowingly collect personal information from children under 13. If
            you believe a child has provided personal information through the
            Extension, contact us so that we can review and, where appropriate,
            delete it.
          </p>
        </section>

        <section>
          <h2 style={styles.sectionHeading}>
            14. Chrome Web Store Limited Use disclosure
          </h2>

          <div style={styles.notice}>
            <p style={styles.paragraph}>
              The use of information received from Google APIs will adhere to
              the Chrome Web Store User Data Policy, including the Limited Use
              requirements.
            </p>

            <p style={styles.paragraph}>
              Information obtained through Chrome extension permissions is used
              only to provide or improve the Extension&apos;s user-facing
              features. It is not sold, used for personalized advertising, or
              transferred to data brokers.
            </p>

            <p style={styles.paragraph}>
              Human access to user data is prohibited except when the user
              provides explicit consent for support, when access is required
              for security or abuse investigation, when required by law, or
              when data has been aggregated and anonymized for permitted
              internal operations.
            </p>
          </div>
        </section>

        <section>
          <h2 style={styles.sectionHeading}>
            15. International data transfers
          </h2>

          <p style={styles.paragraph}>
            Our service providers may process information in countries outside
            your country of residence. Where required, providers and operators
            are expected to use legally recognized safeguards for international
            data transfers.
          </p>
        </section>

        <section>
          <h2 style={styles.sectionHeading}>
            16. Changes to this Privacy Policy
          </h2>

          <p style={styles.paragraph}>
            We may update this Privacy Policy when the Extension, its service
            providers, or applicable requirements change. The date at the top
            of this page indicates when the policy was last updated.
          </p>

          <p style={styles.paragraph}>
            Material changes affecting how the Extension handles user
            information may also be disclosed through the Extension, the Chrome
            Web Store listing, or another appropriate notice.
          </p>
        </section>

        <section>
          <h2 style={styles.sectionHeading}>17. Contact</h2>

          <p style={styles.paragraph}>
            Data controller and Extension operator:
          </p>

          <p style={styles.paragraph}>
            <strong>{OPERATOR_NAME}</strong>
            <br />
            Email:{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} style={styles.link}>
              {CONTACT_EMAIL}
            </a>
          </p>
        </section>

        <footer style={styles.footer}>
          <p>
            This Privacy Policy applies specifically to the SEO Brief &amp; Blog
            Generator Chrome Extension.
          </p>

          <p>
            <Link href="/" style={styles.link}>
             Return to the main website
                </Link>
          </p>
        </footer>
      </article>
    </main>
  );
}