import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — patter.",
  description: "How patter. collects, uses and protects your personal data.",
};

const sections = [
  {
    title: "1. Information we collect",
    body: [
      "**Account information.** When you create a patter. account, we collect your name, email address, and a password (stored as a secure hash). You may also choose to add a profile photo and a short bio.",
      "**Recommendations.** When you add a place, we store the content you provide — name, city, category, description, star rating, insider tip, and any photo you upload.",
      "**Usage data.** We collect standard log data such as your IP address, device type, browser or app version, and pages visited in order to operate and improve the service.",
      "**Communications.** If you contact us by email we will keep a record of your message and our reply.",
    ],
  },
  {
    title: "2. How we use your information",
    body: [
      "To create and maintain your account and authenticate you securely.",
      "To display your recommendations and profile to people who follow you within the app.",
      "To send transactional emails (e.g. account verification, password reset). We will only send marketing messages if you explicitly opt in.",
      "To monitor and improve performance, security, and reliability of the service.",
      "To comply with legal obligations.",
    ],
  },
  {
    title: "3. Sharing your information",
    body: [
      "patter. is a **private network by design**. Your recommendations are only visible to users who follow you — they are never public.",
      "We do not sell, rent or trade your personal data to any third party.",
      "We use a small number of trusted sub-processors (e.g. Firebase / Google Cloud for hosting and authentication, cloud storage for photos) under data processing agreements. These processors may only use your data to perform services on our behalf.",
      "We may disclose information if required by law, court order, or to protect the rights, property or safety of patter., our users, or the public.",
    ],
  },
  {
    title: "4. Data retention",
    body: [
      "We keep your account data for as long as your account is active. If you delete your account, we will delete your personal data within 30 days, except where we are required by law to retain it longer.",
      "Aggregated, anonymised analytics data (which cannot identify you) may be kept indefinitely.",
    ],
  },
  {
    title: "5. Security",
    body: [
      "We use industry-standard security measures including TLS encryption in transit, encrypted storage at rest, and access controls to protect your data. However, no method of transmission or storage is 100% secure, and we cannot guarantee absolute security.",
    ],
  },
  {
    title: "6. Your rights",
    body: [
      "Depending on where you live, you may have rights including: access to the personal data we hold about you; correction of inaccurate data; deletion of your data; restriction or objection to processing; and data portability.",
      "To exercise any of these rights, email us at **privacy@patter.app**. We will respond within 30 days.",
    ],
  },
  {
    title: "7. Cookies",
    body: [
      "The patter. web app uses only essential cookies required for authentication and session management. We do not use advertising or tracking cookies.",
    ],
  },
  {
    title: "8. Children",
    body: [
      "patter. is not directed at children under the age of 13 (or 16 where required by local law). We do not knowingly collect personal data from children. If you believe a child has provided us with personal data, please contact us and we will delete it promptly.",
    ],
  },
  {
    title: "9. Changes to this policy",
    body: [
      "We may update this Privacy Policy from time to time. When we do, we will revise the 'Last updated' date at the top of this page and, where the changes are significant, notify you by email or in-app message.",
    ],
  },
  {
    title: "10. Contact",
    body: [
      "If you have any questions or concerns about this Privacy Policy or how we handle your data, please contact us at **privacy@patter.app**.",
    ],
  },
];

function renderBody(text: string) {
  return text.split(/\*\*(.*?)\*\*/g).map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} style={{ color: "var(--primary)", fontWeight: 600 }}>
        {part}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

export default function PrivacyPage() {
  return (
    <main className="page">
      <nav className="site-nav narrow-container">
        <Link href="/" className="brand-mark">
          patter.
        </Link>
        <Link href="/" className="nav-link">
          ← Back
        </Link>
      </nav>

      <article className="privacy-article narrow-container">
        <div className="privacy-header">
          <h1 className="privacy-title">Privacy Policy</h1>
          <p className="privacy-date">Last updated: 15 March 2026</p>
          <p className="privacy-intro">
            patter. (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;) is
            committed to protecting your privacy. This policy explains what
            personal data we collect, why we collect it, and how we use and
            safeguard it when you use the patter. app or website.
          </p>
        </div>

        <div className="section-divider narrow-divider" />

        <div className="privacy-sections">
          {sections.map((section) => (
            <section key={section.title} className="privacy-section">
              <h2 className="privacy-section-title">{section.title}</h2>
              <ul className="privacy-list">
                {section.body.map((item, i) => (
                  <li key={i} className="privacy-item">
                    <span className="privacy-dot" />
                    <span>{renderBody(item)}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="privacy-note">
          <p className="privacy-note-text">
            By using patter., you agree to this Privacy Policy. If you do not
            agree, please do not use the app or website. For questions, reach
            us at{" "}
            <a href="mailto:privacy@patter.app" className="privacy-link">
              privacy@patter.app
            </a>
            .
          </p>
        </div>
      </article>

      <footer className="site-footer narrow-container site-footer-bordered">
        <Link href="/" className="brand-mark brand-mark-small">
          patter.
        </Link>
        <span className="footer-links">
          © {new Date().getFullYear()} patter.
        </span>
      </footer>
    </main>
  );
}
