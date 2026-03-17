'use client';

import { useState, useMemo } from 'react';
import { signOut } from 'next-auth/react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ComposedChart, Bar, Line,
} from 'recharts';

// ── Infrastructure cost constants ─────────────────────────────────────────────

const FIRESTORE_READ_PER_100K = 0.06;
const FIRESTORE_WRITE_PER_100K = 0.18;
const FIRESTORE_STORAGE_PER_GB = 0.18;
const STORAGE_PER_GB = 0.026;
const STORAGE_EGRESS_PER_GB = 0.12;   // Firebase Storage download bandwidth
const FUNCTIONS_PER_1M = 0.40;
const MAPBOX_PER_1K_AFTER_50K = 0.50;

const FREE_READS_MONTHLY = 50_000 * 30;
const FREE_WRITES_MONTHLY = 20_000 * 30;
const FREE_FIRESTORE_GB = 1;
const FREE_STORAGE_GB = 5;
const FREE_EGRESS_GB_MONTHLY = 1;      // Firebase Storage: 1 GB/day free = ~30 GB/month
const FREE_FUNCTIONS = 2_000_000;
const FREE_MAPBOX_MONTHLY = 50_000;

// ── Photo config ──────────────────────────────────────────────────────────────

export interface PhotoCfg {
  photosPerDAUPerWeek: number;  // how many photos an active user posts per week
  avgPhotoSizeKB: number;       // KB per uploaded photo (after app compression)
  appAgeMonths: number;         // months of accumulated uploads (storage grows over time)
  photosViewedPerDAUPerDay: number; // photos scrolled past / loaded per DAU per day (egress)
}

export const PHOTO_DEFAULTS: PhotoCfg = {
  photosPerDAUPerWeek: 3,
  avgPhotoSizeKB: 500,
  appAgeMonths: 12,
  photosViewedPerDAUPerDay: 30,
};

// ── Cost model ────────────────────────────────────────────────────────────────

function calcCosts(mau: number, useCarto: boolean, photo: PhotoCfg) {
  const dau = mau * 0.3;

  // Firestore
  const reads = dau * 35 * 30;
  const readCost = Math.max(0, reads - FREE_READS_MONTHLY) / 100_000 * FIRESTORE_READ_PER_100K;
  const writes = dau * 3.3 * 30;
  const writeCost = Math.max(0, writes - FREE_WRITES_MONTHLY) / 100_000 * FIRESTORE_WRITE_PER_100K;
  const firestoreGb = (mau * 50_000) / 1e9;
  const firestoreCost = Math.max(0, firestoreGb - FREE_FIRESTORE_GB) * FIRESTORE_STORAGE_PER_GB;

  // Photo storage — cumulative: each month more photos pile up
  // total photos ever uploaded = DAU × photos/week × 4 weeks × appAgeMonths
  const totalPhotos = dau * photo.photosPerDAUPerWeek * 4 * photo.appAgeMonths;
  const storedGb = (totalPhotos * photo.avgPhotoSizeKB * 1024) / 1e9;
  const photoCost = Math.max(0, storedGb - FREE_STORAGE_GB) * STORAGE_PER_GB;

  // Photo egress — charged per GB downloaded
  // each DAU loads `photosViewedPerDAUPerDay` photos every day they're active
  const monthlyDownloadGb = (dau * photo.photosViewedPerDAUPerDay * 30 * photo.avgPhotoSizeKB * 1024) / 1e9;
  const egressCost = Math.max(0, monthlyDownloadGb - FREE_EGRESS_GB_MONTHLY) * STORAGE_EGRESS_PER_GB;

  // Cloud Functions
  const funcCalls = dau * 3 * 30;
  const funcCost = Math.max(0, funcCalls - FREE_FUNCTIONS) / 1_000_000 * FUNCTIONS_PER_1M;

  // Map tiles
  const tiles = dau * 12 * 20;
  const tileCost = useCarto ? 0 : Math.max(0, tiles - FREE_MAPBOX_MONTHLY) / 1000 * MAPBOX_PER_1K_AFTER_50K;

  return {
    firestoreReads: readCost,
    firestoreWrites: writeCost,
    firestoreStorage: firestoreCost,
    photoStorage: photoCost,
    photoEgress: egressCost,
    functions: funcCost,
    tiles: tileCost,
    // handy extras for display
    storedGb,
    monthlyDownloadGb,
    total: readCost + writeCost + firestoreCost + photoCost + egressCost + funcCost + tileCost,
  };
}

// ── Revenue model ─────────────────────────────────────────────────────────────

interface RevStream {
  enabled: boolean;
  // affiliate
  affiliateConvPct: number;   // % of daily venue views that convert to a booking
  affiliateCommission: number; // £ per booking
  // sponsored
  sponsoredVenuesPerMAU: number;
  sponsoredFeePerMonth: number;
  // premium
  premiumConvPct: number;
  premiumPrice: number;
  // business
  businessVenuesPerMAU: number;
  businessFeePerMonth: number;
  // events
  eventConvPct: number;
  eventCommission: number;
}

const DEFAULT_STREAMS: Record<string, boolean> = {
  affiliate: true,
  sponsored: true,
  premium: true,
  business: true,
  events: true,
};

const REV_DEFAULTS = {
  affiliateConvPct: 0.5,
  affiliateCommission: 5,
  sponsoredVenuesPerMAU: 300,
  sponsoredFeePerMonth: 80,
  premiumConvPct: 3,
  premiumPrice: 3.99,
  businessVenuesPerMAU: 150,
  businessFeePerMonth: 29,
  eventConvPct: 0.2,
  eventCommission: 1,
};

interface RevResult {
  affiliate: number;
  sponsored: number;
  premium: number;
  business: number;
  events: number;
  total: number;
}

function calcRevenue(mau: number, streams: Record<string, boolean>, cfg: typeof REV_DEFAULTS): RevResult {
  const dau = mau * 0.3;
  const monthlySessions = dau * 12; // 3 map/feed sessions/week × 4 weeks

  const affiliate = streams.affiliate && mau >= STREAM_THRESHOLDS.affiliate
    ? dau * 30 * (cfg.affiliateConvPct / 100) * cfg.affiliateCommission
    : 0;
  const sponsored = streams.sponsored && mau >= STREAM_THRESHOLDS.sponsored
    ? Math.max(0, Math.floor(mau / cfg.sponsoredVenuesPerMAU)) * cfg.sponsoredFeePerMonth
    : 0;
  const premium = streams.premium && mau >= STREAM_THRESHOLDS.premium
    ? mau * (cfg.premiumConvPct / 100) * cfg.premiumPrice
    : 0;
  const business = streams.business && mau >= STREAM_THRESHOLDS.business
    ? Math.max(0, Math.floor(mau / cfg.businessVenuesPerMAU)) * cfg.businessFeePerMonth
    : 0;
  const events = streams.events && mau >= STREAM_THRESHOLDS.events
    ? monthlySessions * (cfg.eventConvPct / 100) * cfg.eventCommission
    : 0;

  return {
    affiliate, sponsored, premium, business, events,
    total: affiliate + sponsored + premium + business + events,
  };
}

// ── Revenue thresholds (min MAU before stream is viable) ──────────────────────

const STREAM_THRESHOLDS: Record<string, number> = {
  affiliate:  500,      // can approach small local venues once you have a handful of engaged users
  sponsored:  2_500,    // venues need meaningful local reach before paying for a slot
  premium:    1_000,    // need enough active users who've seen the value of the free tier
  business:   1_000,    // venue owners won't pay until they see their venue being talked about
  events:     10_000,   // Skiddle/Eventbrite won't partner without meaningful traffic
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const MAU_MILESTONES = [100, 500, 1_000, 5_000, 10_000, 50_000, 100_000, 250_000, 500_000, 1_000_000, 5_000_000, 10_000_000];

function fmtGbp(n: number) {
  if (n < 0.01) return '£0';
  if (n >= 1_000_000) return `£${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `£${(n / 1_000).toFixed(1)}k`;
  return `£${n.toFixed(0)}`;
}
function fmtNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return `${n}`;
}
function profitColor(n: number) {
  if (n > 0) return '#10B981';
  if (n > -50) return '#F59E0B';
  return '#EF4444';
}

const COST_COLORS = {
  firestoreReads: '#0D6B5E', firestoreWrites: '#10B981', firestoreStorage: '#06B6D4',
  photoStorage: '#8B5CF6', photoEgress: '#EC4899', functions: '#F59E0B', tiles: '#EF4444',
};
const COST_LABELS: Record<string, string> = {
  firestoreReads: 'Firestore reads', firestoreWrites: 'Firestore writes',
  firestoreStorage: 'Firestore storage', photoStorage: 'Photo storage',
  photoEgress: 'Photo bandwidth', functions: 'Cloud Functions', tiles: 'Map tiles',
};
const REV_COLORS = {
  affiliate: '#10B981', sponsored: '#F59E0B', premium: '#8B5CF6',
  business: '#06B6D4', events: '#EF4444',
};
const REV_LABELS: Record<string, string> = {
  affiliate: 'Affiliate / Bookings',
  sponsored: 'Sponsored Posts',
  premium: 'Patter Premium',
  business: 'Business Accounts',
  events: 'Event Ticketing',
};

const CONSOLE_LINKS = [
  { label: 'Firestore', href: 'https://console.firebase.google.com/project/patter-356b7/firestore', icon: '🔥' },
  { label: 'Storage', href: 'https://console.firebase.google.com/project/patter-356b7/storage', icon: '📦' },
  { label: 'Functions', href: 'https://console.firebase.google.com/project/patter-356b7/functions', icon: '⚡' },
  { label: 'Disaster Recovery', href: 'https://console.cloud.google.com/firestore/databases/-default-/disaster-recovery?project=patter-356b7', icon: '🛡️' },
  { label: 'Cloud Billing', href: 'https://console.cloud.google.com/billing?project=patter-356b7', icon: '💳' },
];

// ── Revenue stream descriptions ───────────────────────────────────────────────

const STREAM_META: Record<string, { icon: string; title: string; desc: string; assumptions: string }> = {
  affiliate: {
    icon: '🤝',
    title: 'Affiliate / Booking Commission',
    desc: 'Partner with venues (tours, restaurants, experiences). Earn per completed booking made through Patter.',
    assumptions: 'e.g. Edinburgh Vault Tours, escape rooms, restaurant reservations via OpenTable/Resy. Viable once you have ~500 MAU in a city to show partners.',
  },
  sponsored: {
    icon: '📌',
    title: 'Sponsored Patters',
    desc: 'Venues pay a monthly flat fee to appear at top of feed and as highlighted map pins with a "Sponsored" badge.',
    assumptions: 'Just a sponsored:true flag in Firestore. Venues need to see £80/mo as worthwhile — that means meaningful local reach (~2,500 MAU).',
  },
  premium: {
    icon: '⭐',
    title: 'Patter Premium',
    desc: 'Monthly subscription: opening hours + phone (Google Places enrichment), advanced filters, offline maps, PDF export of your patters.',
    assumptions: '£3.99/month. Users need to have seen enough value in free tier first — viable at ~1,000 MAU. 3% conversion is typical for social apps.',
  },
  business: {
    icon: '🏪',
    title: 'Business Venue Accounts',
    desc: 'Venues claim their listing, add photos, see analytics (patter count, saves), respond to patters, run promos. Verified badge on map.',
    assumptions: '£29/month. Venue owners won\'t pay until they can see their place is being talked about. Viable at ~1,000 MAU.',
  },
  events: {
    icon: '🎟️',
    title: 'Event Ticketing Commission',
    desc: 'Deep-link to Skiddle/Eventbrite from event patters. Earn per ticket sold through Patter.',
    assumptions: 'Requires a formal partnership deal — Skiddle/Eventbrite won\'t integrate without meaningful traffic. Realistic at 10,000+ MAU.',
  },
};

// ── Slider helper ─────────────────────────────────────────────────────────────

function Slider({ label, value, min, max, step, fmt, onChange }: {
  label: string; value: number; min: number; max: number; step: number;
  fmt: (v: number) => string; onChange: (v: number) => void;
}) {
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>
        <span>{label}</span>
        <span style={{ color: 'var(--primary)' }}>{fmt(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: 'var(--primary)', height: 4 }} />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AdminPage() {
  // log-scale slider: 0–1000 maps to 100–10M
  const [sliderVal, setSliderVal] = useState(300);
  const mau = Math.round(Math.pow(10, 2 + (sliderVal / 1000) * 5)); // 10^2 → 10^7
  const setMau = (m: number) => setSliderVal(Math.round(((Math.log10(m) - 2) / 5) * 1000));
  const [useCarto, setUseCarto] = useState(true);
  const [tab, setTab] = useState<'costs' | 'revenue' | 'pl'>('costs');
  const [streams, setStreams] = useState(DEFAULT_STREAMS);
  const [revCfg, setRevCfg] = useState(REV_DEFAULTS);
  const [photoCfg, setPhotoCfg] = useState(PHOTO_DEFAULTS);

  const toggleStream = (key: string) =>
    setStreams(s => ({ ...s, [key]: !s[key] }));

  const setRevParam = (key: keyof typeof REV_DEFAULTS, val: number) =>
    setRevCfg(c => ({ ...c, [key]: val }));

  const setPhotoParam = (key: keyof PhotoCfg, val: number) =>
    setPhotoCfg(c => ({ ...c, [key]: val }));

  const cost = useMemo(() => calcCosts(mau, useCarto, photoCfg), [mau, useCarto, photoCfg]);
  const rev = useMemo(() => calcRevenue(mau, streams, revCfg), [mau, streams, revCfg]);
  const profit = rev.total - cost.total;

  const chartData = useMemo(() =>
    MAU_MILESTONES.map(m => {
      const c = calcCosts(m, useCarto, photoCfg);
      const r = calcRevenue(m, streams, revCfg);
      return {
        mau: fmtNum(m),
        'Firestore reads': +c.firestoreReads.toFixed(2),
        'Firestore writes': +c.firestoreWrites.toFixed(2),
        'Firestore storage': +c.firestoreStorage.toFixed(2),
        'Photo storage': +c.photoStorage.toFixed(2),
        'Photo bandwidth': +c.photoEgress.toFixed(2),
        'Cloud Functions': +c.functions.toFixed(2),
        'Map tiles': +c.tiles.toFixed(2),
        totalCost: +c.total.toFixed(2),
        'Affiliate': +r.affiliate.toFixed(2),
        'Sponsored': +r.sponsored.toFixed(2),
        'Premium': +r.premium.toFixed(2),
        'Business': +r.business.toFixed(2),
        'Events': +r.events.toFixed(2),
        totalRev: +r.total.toFixed(2),
        profit: +(r.total - c.total).toFixed(2),
      };
    }), [useCarto, photoCfg, streams, revCfg]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)', fontFamily: 'var(--font-dm-sans), sans-serif', color: 'var(--text)' }}>

      {/* Header */}
      <div style={{ borderBottom: '1px solid var(--line)', padding: '16px 32px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: -1, color: 'var(--primary)' }}>patter.</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', background: 'var(--card)', padding: '3px 10px', borderRadius: 20 }}>admin</span>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {CONSOLE_LINKS.map(l => (
            <a key={l.label} href={l.href} target="_blank" rel="noreferrer"
              style={{ fontSize: 12, fontWeight: 600, color: 'var(--primary)', background: 'var(--card)', padding: '5px 12px', borderRadius: 20, textDecoration: 'none', border: '1px solid var(--line)', whiteSpace: 'nowrap' }}>
              {l.icon} {l.label}
            </a>
          ))}
          <button onClick={() => signOut({ callbackUrl: '/login' })}
            style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', background: 'var(--card)', padding: '5px 12px', borderRadius: 20, border: '1px solid var(--line)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            Sign out
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 24px' }}>

        {/* MAU + P&L summary bar */}
        <div style={{ background: 'white', borderRadius: 20, padding: 28, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid var(--line)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 24, marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 2 }}>MONTHLY ACTIVE USERS</div>
              <div style={{ fontSize: 48, fontWeight: 800, letterSpacing: -2, color: 'var(--primary)', lineHeight: 1 }}>{fmtNum(mau)}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>DAU: ~{fmtNum(Math.round(mau * 0.3))}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 2 }}>MONTHLY COSTS</div>
              <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: -1, lineHeight: 1, color: '#EF4444' }}>{fmtGbp(cost.total)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 2 }}>MONTHLY REVENUE</div>
              <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: -1, lineHeight: 1, color: '#10B981' }}>{fmtGbp(rev.total)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 2 }}>NET PROFIT / LOSS</div>
              <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: -1, lineHeight: 1, color: profitColor(profit) }}>
                {profit >= 0 ? '+' : ''}{fmtGbp(profit)}
              </div>
            </div>
          </div>
          <input type="range" min={0} max={1000} step={1} value={sliderVal}
            onChange={e => setSliderVal(Number(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--primary)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
            {[100, 1_000, 10_000, 100_000, 1_000_000, 10_000_000].map(m => (
              <span key={m} style={{ cursor: 'pointer' }} onClick={() => setMau(m)}>{fmtNum(m)}</span>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {(['costs', 'revenue', 'pl'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{ padding: '9px 22px', borderRadius: 20, fontWeight: 700, fontSize: 13, border: '1px solid var(--line)', cursor: 'pointer',
                background: tab === t ? 'var(--primary)' : 'white', color: tab === t ? 'white' : 'var(--text)' }}>
              {t === 'costs' ? '📊 Infrastructure costs' : t === 'revenue' ? '💰 Revenue streams' : '📈 P&L at scale'}
            </button>
          ))}
          {/* CARTO toggle always visible */}
          <div style={{ marginLeft: 'auto' }}>
            <button onClick={() => setUseCarto(v => !v)}
              style={{ padding: '9px 18px', borderRadius: 20, fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer',
                background: useCarto ? '#10B981' : '#EF4444', color: 'white' }}>
              {useCarto ? '🗺️ CARTO (free)' : '🗺️ Mapbox'}
            </button>
          </div>
        </div>

        {/* ── COSTS TAB ── */}
        {tab === 'costs' && (
          <>
            {/* Photo assumptions */}
            <div style={{ background: 'white', borderRadius: 18, padding: '20px 24px', marginBottom: 20, border: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <span style={{ fontSize: 20 }}>📸</span>
                <div style={{ fontWeight: 800, fontSize: 15 }}>Photo assumptions</div>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 20, fontSize: 12, color: 'var(--muted)' }}>
                  <span>Stored: <b style={{ color: '#8B5CF6' }}>{cost.storedGb >= 1000 ? `${(cost.storedGb/1000).toFixed(1)} TB` : `${cost.storedGb.toFixed(1)} GB`}</b></span>
                  <span>Monthly download: <b style={{ color: '#EC4899' }}>{cost.monthlyDownloadGb >= 1000 ? `${(cost.monthlyDownloadGb/1000).toFixed(1)} TB` : `${cost.monthlyDownloadGb.toFixed(1)} GB`}</b></span>
                  <span>Storage cost: <b style={{ color: '#8B5CF6' }}>{fmtGbp(cost.photoStorage)}/mo</b></span>
                  <span>Bandwidth cost: <b style={{ color: '#EC4899' }}>{fmtGbp(cost.photoEgress)}/mo</b></span>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
                <Slider label="Photos posted per DAU per week" value={photoCfg.photosPerDAUPerWeek} min={0.5} max={15} step={0.5}
                  fmt={v => `${v}/wk`} onChange={v => setPhotoParam('photosPerDAUPerWeek', v)} />
                <Slider label="Avg photo size (after compression)" value={photoCfg.avgPhotoSizeKB} min={100} max={2000} step={50}
                  fmt={v => v >= 1000 ? `${(v/1000).toFixed(1)} MB` : `${v} KB`} onChange={v => setPhotoParam('avgPhotoSizeKB', v)} />
                <Slider label="App age (months of accumulated uploads)" value={photoCfg.appAgeMonths} min={1} max={36} step={1}
                  fmt={v => `${v} mo`} onChange={v => setPhotoParam('appAgeMonths', v)} />
                <Slider label="Photos viewed per DAU per day (egress)" value={photoCfg.photosViewedPerDAUPerDay} min={5} max={200} step={5}
                  fmt={v => `${v}/day`} onChange={v => setPhotoParam('photosViewedPerDAUPerDay', v)} />
              </div>
            </div>

            {/* Service cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
              {(Object.keys(COST_COLORS) as (keyof typeof COST_COLORS)[]).map(key => {
                const val = cost[key as keyof typeof cost] as number;
                const isFree = val < 0.01;
                return (
                  <div key={key} style={{ background: 'white', borderRadius: 16, padding: '18px 20px', border: '1px solid var(--line)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 3, background: COST_COLORS[key], flexShrink: 0 }} />
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>{COST_LABELS[key].toUpperCase()}</div>
                    </div>
                    <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: -1, color: isFree ? '#10B981' : val > 50 ? '#EF4444' : 'var(--text)' }}>
                      {isFree ? 'Free' : fmtGbp(val)}
                    </div>
                    {isFree && <div style={{ fontSize: 11, color: '#10B981', marginTop: 4, fontWeight: 600 }}>Within free tier</div>}
                  </div>
                );
              })}
            </div>

            {/* Cost chart */}
            <div style={{ background: 'white', borderRadius: 20, padding: 28, marginBottom: 20, border: '1px solid var(--line)' }}>
              <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 20 }}>Infrastructure cost at scale</div>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="mau" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={v => `£${v}`} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [`£${Number(v ?? 0).toFixed(0)}`, '']} />
                  <Legend />
                  {(Object.keys(COST_COLORS) as (keyof typeof COST_COLORS)[]).map(key =>
                    (key !== 'tiles' || !useCarto) && (
                      <Area key={key} type="monotone" dataKey={COST_LABELS[key]}
                        stackId="1" stroke={COST_COLORS[key]} fill={COST_COLORS[key]} fillOpacity={0.8} strokeWidth={0} />
                    )
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Cost table */}
            <div style={{ background: 'white', borderRadius: 20, padding: 28, border: '1px solid var(--line)' }}>
              <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 16 }}>Cost projection table</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--line)' }}>
                    {['MAU', 'Firestore', 'Photo storage', 'Bandwidth', 'Functions', 'Tiles', 'Total'].map(h => (
                      <th key={h} style={{ textAlign: h === 'MAU' ? 'left' : 'right', padding: '8px 12px', color: 'var(--muted)', fontWeight: 700, fontSize: 11 }}>{h.toUpperCase()}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MAU_MILESTONES.map((m, i) => {
                    const c = calcCosts(m, useCarto, photoCfg);
                    const isSelected = Math.abs(m - mau) < 300;
                    return (
                      <tr key={m} onClick={() => setMau(m)} style={{ borderBottom: '1px solid var(--line)', cursor: 'pointer', background: isSelected ? 'rgba(13,107,94,0.06)' : i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.01)' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 800, color: 'var(--primary)' }}>{fmtNum(m)}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>{fmtGbp(c.firestoreReads + c.firestoreWrites + c.firestoreStorage)}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: '#8B5CF6' }}>{fmtGbp(c.photoStorage)}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: '#EC4899' }}>{fmtGbp(c.photoEgress)}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>{fmtGbp(c.functions)}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: c.tiles > 0 ? '#EF4444' : '#10B981', fontWeight: 600 }}>{c.tiles > 0 ? fmtGbp(c.tiles) : 'Free'}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: c.total < 10 ? '#10B981' : c.total < 200 ? 'var(--primary)' : '#EF4444' }}>{fmtGbp(c.total)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div style={{ marginTop: 14, padding: '12px 16px', background: 'var(--card)', borderRadius: 12, fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
                💡 Photo storage is cumulative (grows with app age). Bandwidth charged at £0.12/GB after 1 GB/day free. Adjust photo assumptions above to model different posting behaviours. Firestore free: 50k reads + 20k writes/day, 1 GB. Firebase Storage free: 5 GB.
              </div>
            </div>
          </>
        )}

        {/* ── REVENUE TAB ── */}
        {tab === 'revenue' && (
          <>
            {/* Revenue stream cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 16, marginBottom: 20 }}>
              {(Object.keys(STREAM_META) as (keyof typeof STREAM_META)[]).map(key => {
                const meta = STREAM_META[key];
                const on = streams[key];
                const threshold = STREAM_THRESHOLDS[key];
                const locked = mau < threshold;
                const revVal = rev[key as keyof RevResult] as number;
                return (
                  <div key={key} style={{ background: 'white', borderRadius: 18, padding: '22px 24px', border: `1px solid ${locked ? 'rgba(0,0,0,0.06)' : on ? 'var(--line)' : 'rgba(0,0,0,0.06)'}`, opacity: on ? (locked ? 0.6 : 1) : 0.5, transition: 'opacity 0.2s' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                      <span style={{ fontSize: 24, lineHeight: 1 }}>{locked ? '🔒' : meta.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                          <div style={{ fontWeight: 800, fontSize: 16 }}>{meta.title}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
                            {locked ? (
                              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', background: 'rgba(0,0,0,0.05)', padding: '4px 12px', borderRadius: 20 }}>
                                Unlocks at {fmtNum(threshold)} MAU
                              </div>
                            ) : (
                              <>
                                <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: -1, color: on ? REV_COLORS[key] : 'var(--muted)' }}>
                                  {on ? fmtGbp(revVal) : '—'}
                                </div>
                                <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>/mo</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5, marginBottom: 8 }}>{meta.desc}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic', marginBottom: 12 }}>{meta.assumptions}</div>

                        {/* Sliders per stream */}
                        {key === 'affiliate' && (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            <Slider label="Booking conversion (% of venue views)" value={revCfg.affiliateConvPct} min={0.1} max={5} step={0.1}
                              fmt={v => `${v}%`} onChange={v => setRevParam('affiliateConvPct', v)} />
                            <Slider label="Commission per booking" value={revCfg.affiliateCommission} min={1} max={20} step={0.5}
                              fmt={v => `£${v}`} onChange={v => setRevParam('affiliateCommission', v)} />
                          </div>
                        )}
                        {key === 'sponsored' && (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            <Slider label="1 venue per N MAU" value={revCfg.sponsoredVenuesPerMAU} min={50} max={1000} step={50}
                              fmt={v => `${v} MAU`} onChange={v => setRevParam('sponsoredVenuesPerMAU', v)} />
                            <Slider label="Monthly fee per venue" value={revCfg.sponsoredFeePerMonth} min={20} max={300} step={10}
                              fmt={v => `£${v}/mo`} onChange={v => setRevParam('sponsoredFeePerMonth', v)} />
                          </div>
                        )}
                        {key === 'premium' && (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            <Slider label="% of MAU who subscribe" value={revCfg.premiumConvPct} min={0.5} max={15} step={0.5}
                              fmt={v => `${v}%`} onChange={v => setRevParam('premiumConvPct', v)} />
                            <Slider label="Price per month" value={revCfg.premiumPrice} min={0.99} max={9.99} step={0.5}
                              fmt={v => `£${v}`} onChange={v => setRevParam('premiumPrice', v)} />
                          </div>
                        )}
                        {key === 'business' && (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            <Slider label="1 business per N MAU" value={revCfg.businessVenuesPerMAU} min={50} max={500} step={25}
                              fmt={v => `${v} MAU`} onChange={v => setRevParam('businessVenuesPerMAU', v)} />
                            <Slider label="Monthly subscription" value={revCfg.businessFeePerMonth} min={9} max={99} step={5}
                              fmt={v => `£${v}/mo`} onChange={v => setRevParam('businessFeePerMonth', v)} />
                          </div>
                        )}
                        {key === 'events' && (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            <Slider label="% sessions → ticket purchase" value={revCfg.eventConvPct} min={0.05} max={2} step={0.05}
                              fmt={v => `${v}%`} onChange={v => setRevParam('eventConvPct', v)} />
                            <Slider label="Commission per ticket" value={revCfg.eventCommission} min={0.25} max={5} step={0.25}
                              fmt={v => `£${v}`} onChange={v => setRevParam('eventCommission', v)} />
                          </div>
                        )}
                      </div>
                      <button onClick={() => toggleStream(key)}
                        style={{ flexShrink: 0, padding: '7px 16px', borderRadius: 20, fontWeight: 700, fontSize: 12,
                          border: 'none', cursor: 'pointer', marginTop: 2,
                          background: on ? 'rgba(13,107,94,0.1)' : 'rgba(0,0,0,0.06)',
                          color: on ? 'var(--primary)' : 'var(--muted)' }}>
                        {on ? '✓ ON' : 'OFF'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Revenue chart */}
            <div style={{ background: 'white', borderRadius: 20, padding: 28, border: '1px solid var(--line)' }}>
              <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 20 }}>Revenue at scale</div>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="mau" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={v => `£${v}`} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [`£${Number(v ?? 0).toFixed(0)}`, '']} />
                  <Legend />
                  {(Object.keys(REV_COLORS) as (keyof typeof REV_COLORS)[]).map(key =>
                    streams[key] && (
                      <Area key={key} type="monotone" dataKey={key.charAt(0).toUpperCase() + key.slice(1)}
                        stackId="1" stroke={REV_COLORS[key]} fill={REV_COLORS[key]} fillOpacity={0.8} strokeWidth={0} />
                    )
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </>
        )}

        {/* ── P&L TAB ── */}
        {tab === 'pl' && (
          <>
            {/* P&L chart — revenue vs cost lines */}
            <div style={{ background: 'white', borderRadius: 20, padding: 28, marginBottom: 20, border: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 20 }}>
                <div style={{ fontWeight: 800, fontSize: 16 }}>Revenue vs costs at scale</div>
                <div style={{ fontSize: 13, color: profitColor(profit), fontWeight: 700 }}>
                  At {fmtNum(mau)} MAU: {profit >= 0 ? '+' : ''}{fmtGbp(profit)}/mo
                </div>
              </div>
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="mau" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={v => `£${v}`} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [`£${Number(v ?? 0).toFixed(0)}`, '']} />
                  <Legend />
                  <Area type="monotone" dataKey="totalRev" name="Total Revenue" stackId={undefined}
                    stroke="#10B981" fill="#10B981" fillOpacity={0.15} strokeWidth={2.5} />
                  <Area type="monotone" dataKey="totalCost" name="Total Cost" stackId={undefined}
                    stroke="#EF4444" fill="#EF4444" fillOpacity={0.1} strokeWidth={2.5} />
                  <Line type="monotone" dataKey="profit" name="Net Profit" stroke="#8B5CF6" strokeWidth={2} dot={false} strokeDasharray="5 3" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Full P&L table */}
            <div style={{ background: 'white', borderRadius: 20, padding: 28, border: '1px solid var(--line)' }}>
              <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 16 }}>Full P&L table</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--line)' }}>
                    <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--muted)', fontWeight: 700, fontSize: 11 }}>MAU</th>
                    <th style={{ textAlign: 'right', padding: '8px 12px', color: '#EF4444', fontWeight: 700, fontSize: 11 }}>COSTS</th>
                    {(Object.keys(REV_COLORS) as string[]).filter(k => streams[k]).map(k => (
                      <th key={k} style={{ textAlign: 'right', padding: '8px 12px', color: REV_COLORS[k as keyof typeof REV_COLORS], fontWeight: 700, fontSize: 11 }}>
                        {k.toUpperCase()}
                      </th>
                    ))}
                    <th style={{ textAlign: 'right', padding: '8px 12px', color: '#10B981', fontWeight: 700, fontSize: 11 }}>REVENUE</th>
                    <th style={{ textAlign: 'right', padding: '8px 12px', color: '#8B5CF6', fontWeight: 700, fontSize: 11 }}>PROFIT</th>
                  </tr>
                </thead>
                <tbody>
                  {MAU_MILESTONES.map((m, i) => {
                    const c = calcCosts(m, useCarto, photoCfg);
                    const r = calcRevenue(m, streams, revCfg);
                    const p = r.total - c.total;
                    const isSelected = Math.abs(m - mau) < 300;
                    return (
                      <tr key={m} onClick={() => setMau(m)} style={{ borderBottom: '1px solid var(--line)', cursor: 'pointer', background: isSelected ? 'rgba(13,107,94,0.06)' : i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.01)' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 800, color: 'var(--primary)' }}>{fmtNum(m)}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: '#EF4444', fontWeight: 600 }}>{fmtGbp(c.total)}</td>
                        {(Object.keys(REV_COLORS) as string[]).filter(k => streams[k]).map(k => (
                          <td key={k} style={{ padding: '10px 12px', textAlign: 'right', color: REV_COLORS[k as keyof typeof REV_COLORS] }}>
                            {fmtGbp(r[k as keyof RevResult] as number)}
                          </td>
                        ))}
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#10B981' }}>{fmtGbp(r.total)}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: profitColor(p) }}>
                          {p >= 0 ? '+' : ''}{fmtGbp(p)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div style={{ marginTop: 14, padding: '12px 16px', background: 'var(--card)', borderRadius: 12, fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
                💡 Revenue assumptions are adjustable in the Revenue tab. Click any row to update the MAU slider. Profit shown in purple is revenue minus all infrastructure costs.
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
