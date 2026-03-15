import Link from "next/link";

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

const cities = [
  "Paris",
  "Tokyo",
  "Barcelona",
  "London",
  "Copenhagen",
  "Venice",
  "Oslo",
  "Porto",
  "Lisbon",
];

export default function Home() {
  return (
    <main
      className="min-h-screen"
      style={{ backgroundColor: "var(--background)" }}
    >
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-5 max-w-5xl mx-auto">
        <span
          className="text-xl font-bold tracking-tight"
          style={{ color: "var(--primary)" }}
        >
          patter.
        </span>
        <Link
          href="/privacy"
          className="text-sm font-medium opacity-50 hover:opacity-100 transition-opacity"
          style={{ color: "var(--primary)" }}
        >
          Privacy
        </Link>
      </nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-20 pb-32 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-10"
          style={{
            backgroundColor: "rgba(27, 58, 47, 0.07)",
            color: "var(--primary)",
          }}
        >
          <span
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ backgroundColor: "var(--accent)" }}
          />
          Coming soon
        </div>

        <h1
          className="text-6xl sm:text-7xl md:text-8xl font-bold tracking-tighter leading-none mb-6"
          style={{ color: "var(--primary)" }}
        >
          patter<span style={{ color: "var(--accent)" }}>.</span>
        </h1>

        <p
          className="text-xl sm:text-2xl font-light max-w-xl mx-auto mb-4 leading-relaxed"
          style={{ color: "var(--primary)", opacity: 0.75 }}
        >
          Places your friends actually love.
        </p>

        <p
          className="text-base max-w-lg mx-auto leading-relaxed"
          style={{ color: "var(--muted)" }}
        >
          A private social app for discovering restaurants, bars, cafés,
          activities and hidden gems — recommended by the people you trust most.
        </p>

        <div className="mt-14 flex flex-col sm:flex-row items-center justify-center gap-3">
          <input
            type="email"
            placeholder="your@email.com"
            className="w-full sm:w-72 px-5 py-3.5 rounded-2xl text-sm border outline-none focus:ring-2 transition"
            style={{
              backgroundColor: "white",
              borderColor: "rgba(27,58,47,0.15)",
              color: "var(--primary)",
              fontFamily: "inherit",
            }}
          />
          <button
            className="w-full sm:w-auto px-7 py-3.5 rounded-2xl text-sm font-semibold transition-all hover:opacity-90 active:scale-95"
            style={{
              backgroundColor: "var(--primary)",
              color: "var(--background)",
              fontFamily: "inherit",
            }}
          >
            Notify me
          </button>
        </div>
        <p className="mt-3 text-xs" style={{ color: "var(--muted)" }}>
          No spam. We&apos;ll let you know when we launch.
        </p>
      </section>

      {/* Divider */}
      <div
        className="max-w-5xl mx-auto px-6"
        style={{ borderTop: "1px solid rgba(27,58,47,0.1)" }}
      />

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 py-24">
        <h2
          className="text-3xl font-bold tracking-tight mb-3"
          style={{ color: "var(--primary)" }}
        >
          Everything you need to discover great places.
        </h2>
        <p className="text-base mb-14" style={{ color: "var(--muted)" }}>
          Built around trust, not algorithms.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f) => (
            <div
              key={f.title}
              className="p-7 rounded-3xl"
              style={{ backgroundColor: "rgba(27,58,47,0.05)" }}
            >
              <div
                className="text-2xl mb-4"
                style={{ color: "var(--accent)" }}
              >
                {f.icon}
              </div>
              <h3
                className="text-base font-semibold mb-2"
                style={{ color: "var(--primary)" }}
              >
                {f.title}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Cities strip */}
      <section
        className="py-10 overflow-hidden"
        style={{ backgroundColor: "var(--primary)" }}
      >
        <div className="flex gap-6 animate-marquee whitespace-nowrap">
          {[...cities, ...cities, ...cities].map((city, i) => (
            <span
              key={i}
              className="text-sm font-medium tracking-widest uppercase flex-shrink-0"
              style={{ color: "rgba(250,247,242,0.5)" }}
            >
              {city}
              <span className="ml-6" style={{ color: "var(--accent)" }}>
                ✦
              </span>
            </span>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-5xl mx-auto px-6 py-24">
        <h2
          className="text-3xl font-bold tracking-tight mb-14"
          style={{ color: "var(--primary)" }}
        >
          How it works.
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
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
            <div key={item.step} className="flex flex-col gap-3">
              <span
                className="text-4xl font-bold tracking-tighter"
                style={{ color: "rgba(27,58,47,0.12)" }}
              >
                {item.step}
              </span>
              <h3
                className="text-lg font-semibold"
                style={{ color: "var(--primary)" }}
              >
                {item.title}
              </h3>
              <p
                className="text-sm leading-relaxed"
                style={{ color: "var(--muted)" }}
              >
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section
        className="mx-6 mb-16 rounded-3xl py-20 px-8 text-center"
        style={{ backgroundColor: "var(--primary)" }}
      >
        <h2
          className="text-3xl sm:text-4xl font-bold tracking-tight mb-4"
          style={{ color: "var(--background)" }}
        >
          Be the first to know.
        </h2>
        <p
          className="text-base mb-10 max-w-md mx-auto leading-relaxed"
          style={{ color: "rgba(250,247,242,0.65)" }}
        >
          patter. is launching soon. Drop your email and we&apos;ll reach out
          the moment doors open.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-sm mx-auto">
          <input
            type="email"
            placeholder="your@email.com"
            className="w-full px-5 py-3.5 rounded-2xl text-sm border-none outline-none focus:ring-2 transition"
            style={{
              backgroundColor: "rgba(250,247,242,0.12)",
              color: "var(--background)",
              fontFamily: "inherit",
            }}
          />
          <button
            className="w-full sm:w-auto flex-shrink-0 px-7 py-3.5 rounded-2xl text-sm font-semibold transition-all hover:opacity-90 active:scale-95"
            style={{
              backgroundColor: "var(--accent)",
              color: "var(--primary)",
              fontFamily: "inherit",
            }}
          >
            Notify me
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-5xl mx-auto px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
        <span
          className="text-lg font-bold tracking-tight"
          style={{ color: "var(--primary)" }}
        >
          patter.
        </span>
        <div className="flex items-center gap-6 text-sm" style={{ color: "var(--muted)" }}>
          <Link
            href="/privacy"
            className="hover:opacity-100 opacity-70 transition-opacity"
          >
            Privacy Policy
          </Link>
          <span>© {new Date().getFullYear()} patter.</span>
        </div>
      </footer>

      <style jsx global>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-33.333%); }
        }
        .animate-marquee {
          animation: marquee 20s linear infinite;
        }
      `}</style>
    </main>
  );
}
