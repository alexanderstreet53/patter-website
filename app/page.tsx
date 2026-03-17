'use client';

import Link from "next/link";
import { useState } from "react";

const features = [
  {
    icon: "✦",
    title: "Feed",
    description:
      "See your friends' latest picks in one beautiful, filterable feed. No noise — only people you follow.",
  },
  {
    icon: "◎",
    title: "Explore",
    description:
      "Browse by city and category. Restaurants, bars, coffee, activities, and hidden gems await.",
  },
  {
    icon: "★",
    title: "Insider tips",
    description:
      "Every recommendation comes with a star rating and a personal tip — the kind you'd only hear from a friend.",
  },
  {
    icon: "⊞",
    title: "Saved",
    description:
      "Bookmark anything that catches your eye and revisit it when you're ready to go.",
  },
  {
    icon: "◈",
    title: "Friends",
    description:
      "Follow the people whose taste you trust. Private network — your recs stay between you.",
  },
  {
    icon: "◉",
    title: "Profile",
    description:
      "Your recommendations, your story. Share what you love and build your local guide.",
  },
];

function NotifyForm({ dark = false }: { dark?: boolean }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'duplicate' | 'error'>('idle');

  async function handleSubmit() {
    if (!email) return;
    setState('loading');
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) { setState('error'); return; }
      setState(data.duplicate ? 'duplicate' : 'success');
    } catch {
      setState('error');
    }
  }

  if (state === 'success') {
    return <p className="helper-text" style={{ marginTop: 40, fontSize: '1rem' }}>🎉 You&apos;re on the list — we&apos;ll be in touch!</p>;
  }
  if (state === 'duplicate') {
    return <p className="helper-text" style={{ marginTop: 40, fontSize: '1rem' }}>Already on the list — we&apos;ll let you know when we launch.</p>;
  }

  return (
    <>
      <div className={`email-row${dark ? ' email-row-compact' : ''}`}>
        <input
          type="email"
          placeholder="your@email.com"
          className={`email-input${dark ? ' email-input-dark' : ''}`}
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          disabled={state === 'loading'}
        />
        <button
          className={dark ? 'button-accent' : 'button-primary'}
          onClick={handleSubmit}
          disabled={state === 'loading'}
        >
          {state === 'loading' ? 'Saving…' : 'Notify me'}
        </button>
      </div>
      {state === 'error' && (
        <p className="helper-text" style={{ color: '#EF4444' }}>Something went wrong — please try again.</p>
      )}
      {!dark && state !== 'error' && (
        <p className="helper-text">No spam. We&apos;ll let you know when we launch.</p>
      )}
    </>
  );
}

export default function Home() {
  return (
    <main className="page">
      <nav className="site-nav container">
        <span className="brand-mark">
          patter.
        </span>
        <Link href="/privacy" className="nav-link">
          Privacy
        </Link>
      </nav>

      <section className="hero container">
        <div className="coming-badge">
          <span className="badge-dot" />
          Coming soon
        </div>

        <h1 className="hero-title">
          patter<span className="accent-dot">.</span>
        </h1>

        <p className="hero-subtitle">Places your friends actually love.</p>

        <p className="hero-copy">
          A private social app for discovering restaurants, bars, cafés, activities and hidden
          gems — recommended by the people you trust most.
        </p>

        <NotifyForm />
      </section>

      <div className="section-divider container" />

      <section className="section container">
        <h2 className="section-title">
          Everything you need to discover great places.
        </h2>
        <p className="section-copy">
          Built around trust, not algorithms.
        </p>

        <div className="feature-grid">
          {features.map((f) => (
            <div key={f.title} className="feature-card">
              <div className="feature-icon">{f.icon}</div>
              <h3 className="feature-title">
                {f.title}
              </h3>
              <p className="feature-text">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section container section-top-border">
        <h2 className="section-title">
          How it works.
        </h2>
        <div className="steps-grid">
          {[
            {
              step: "01",
              title: "Follow people you trust",
              body: "Add friends, colleagues, or anyone whose taste you admire. Your feed is 100% private.",
            },
            {
              step: "02",
              title: "Discover their picks",
              body: "Browse recommendations by city and category. Filter by what you're in the mood for.",
            },
            {
              step: "03",
              title: "Share your own",
              body: "Add a place, give it a star rating, and leave an insider tip. Help your friends find what you already know.",
            },
          ].map((item) => (
            <div key={item.step} className="step-card">
              <span className="step-number">{item.step}</span>
              <h3 className="step-title">{item.title}</h3>
              <p className="step-text">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="cta-card container">
        <h2 className="cta-title">
          Be the first to know.
        </h2>
        <p className="cta-copy">
          patter. is launching soon. Drop your email and we&apos;ll reach out the moment doors open.
        </p>
        <NotifyForm dark />
      </section>

      <footer className="site-footer container">
        <span className="brand-mark brand-mark-small">
          patter.
        </span>
        <div className="footer-links">
          <Link href="/privacy" className="nav-link nav-link-footer">
            Privacy Policy
          </Link>
          <span>© {new Date().getFullYear()} patter.</span>
        </div>
      </footer>
    </main>
  );
}
