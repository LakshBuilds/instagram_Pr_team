/**
 * Link Tracker — shaping BuyHatke's userQuality data into something reportable.
 *
 * Two counting rules drive everything here:
 *
 *  1. `totalCount` (actions) and install counts are distinct events, so they add up
 *     exactly. `userCount` is a distinct-user count PER FEATURE PER MONTH — the same
 *     person appears under several features, so summing it inflates the number. User
 *     figures are therefore always a MAX (the busiest single feature), which is a
 *     floor on real active users, never a total.
 *
 *  2. Installs come from the day-wise endpoint only. The monthly endpoint returns the
 *     `Uninstalled` bucket for `extension` alone — a creator driving 9,000 Android
 *     installs reads as 1 there.
 */

const API_SERVER_URL = import.meta.env.VITE_API_SERVER_URL || "http://localhost:3001";

/** The bucket that carries installCount/uninstallCount instead of totalCount/userCount. */
export const LIFECYCLE_FEATURE = "Uninstalled";

export const PLATFORM_LABEL: Record<string, string> = {
  extension: "Extension",
  android: "Android",
  ios: "iOS",
};

const PLATFORM_ORDER = ["extension", "android", "ios"];

export const orderPlatforms = (list: string[]): string[] =>
  [...list].sort((a, b) => {
    const ia = PLATFORM_ORDER.indexOf(a);
    const ib = PLATFORM_ORDER.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b);
  });

export interface CreatorLink {
  id: string;
  name: string;
  slug: string;
  code: string;
  handle?: string | null;
  channel?: string | null;
  campaign?: string | null;
  notes?: string | null;
  short_link?: string | null;
  created_by?: string | null;
  created_at?: string;
}

export interface StatsEntry {
  code: string;
  fetchedAt: string;
  hasData: boolean;
  message: string | null;
  monthly: { ok: boolean; hasData: boolean; payload?: unknown; error?: string };
  daily: { ok: boolean; hasData: boolean; payload?: unknown; error?: string };
  fromCache?: boolean;
  stale?: boolean;
  error?: string;
  missing?: boolean;
}

export interface Row {
  feature: string;
  platform: string;
  date: string | null;
  month: string;
  total: number;
  users: number;
  installs: number;
  uninstalls: number;
}

/* ------------------------------------------------------------------ fetch */

export async function fetchStats(
  code: string,
  opts: { cachedOnly?: boolean; refresh?: boolean } = {}
): Promise<StatsEntry | null> {
  const q = opts.refresh ? "?refresh=1" : opts.cachedOnly ? "?cached=1" : "";
  const res = await fetch(
    `${API_SERVER_URL}/api/link-tracker/stats/${encodeURIComponent(code)}${q}`
  );
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  if (json.missing) return null;
  return json as StatsEntry;
}

/* --------------------------------------------------------------- shaping */

/** Flatten feature → platform → period → metrics into flat rows. */
export function flatten(payload: unknown): Row[] {
  const rows: Row[] = [];
  const result = (payload as { data?: { result?: Record<string, Record<string, Record<string, Record<string, number>>>> } })
    ?.data?.result;
  if (!result) return rows;

  for (const [feature, platforms] of Object.entries(result)) {
    for (const [platform, periods] of Object.entries(platforms || {})) {
      for (const [period, v] of Object.entries(periods || {})) {
        rows.push({
          feature,
          platform,
          // dayWise keys are YYYY-MM-DD, the monthly endpoint's are YYYY-MM.
          date: period.length > 7 ? period : null,
          month: period.slice(0, 7),
          total: Number(v?.totalCount || 0),
          users: Number(v?.userCount || 0),
          installs: Number(v?.installCount || 0),
          uninstalls: Number(v?.uninstallCount || 0),
        });
      }
    }
  }
  return rows;
}

/** Sum daily rows up to one row per feature/platform/month. */
export function rollUpToMonths(dailyRows: Row[]): Row[] {
  const acc = new Map<string, Row>();
  for (const r of dailyRows) {
    const key = `${r.feature}|${r.platform}|${r.month}`;
    const cur = acc.get(key) ?? {
      feature: r.feature, platform: r.platform, month: r.month, date: null,
      total: 0, users: 0, installs: 0, uninstalls: 0,
    };
    cur.total += r.total;
    // Daily uniques cannot be added into a monthly unique — take the busiest day.
    cur.users = Math.max(cur.users, r.users);
    cur.installs += r.installs;
    cur.uninstalls += r.uninstalls;
    acc.set(key, cur);
  }
  return [...acc.values()];
}

export interface Dataset {
  rows: Row[];
  dailyRows: Row[] | null;
  installsSource: "daily" | "monthly";
  installsIncomplete: boolean;
  dailyError: string | null;
}

/** Decide which endpoint backs which metric. See the note at the top of this file. */
export function buildDataset(entry: StatsEntry | null): Dataset {
  const monthlyRows = entry?.monthly?.hasData ? flatten(entry.monthly.payload) : null;
  const dailyRows = entry?.daily?.hasData ? flatten(entry.daily.payload) : null;

  const baseRows = monthlyRows ?? (dailyRows ? rollUpToMonths(dailyRows) : []);
  const engagement = baseRows.filter((r) => r.feature !== LIFECYCLE_FEATURE);

  let lifecycle: Row[];
  let installsSource: "daily" | "monthly";
  let installsIncomplete: boolean;

  if (dailyRows) {
    lifecycle = rollUpToMonths(dailyRows.filter((r) => r.feature === LIFECYCLE_FEATURE));
    installsSource = "daily";
    installsIncomplete = false;
  } else {
    lifecycle = baseRows.filter((r) => r.feature === LIFECYCLE_FEATURE);
    installsSource = "monthly";
    installsIncomplete = true;
  }

  return {
    rows: [...engagement, ...lifecycle],
    dailyRows,
    installsSource,
    installsIncomplete,
    dailyError: entry?.daily?.ok === false ? entry.daily.error ?? null : null,
  };
}

export interface MonthPoint {
  month: string;
  actions: number;
  users: number;
  installs: number;
  uninstalls: number;
  retained: number | null;
}

export interface Analysis {
  months: string[];
  perMonth: MonthPoint[];
  features: { feature: string; actions: number; peakUsers: number }[];
  platforms: { platform: string; actions: number; installs: number }[];
  latest: MonthPoint | null;
  rows: Row[];
  engagementRows: Row[];
  totalActions: number;
  peakUsers: number;
  activeMonths: number;
  featureCount: number;
  totalInstalls: number;
  totalUninstalls: number;
  installsByPlatform: Record<string, number>;
  retained: number | null;
  hasLifecycle: boolean;
  availablePlatforms: string[];
}

export function analyse(
  rows: Row[],
  { platform = "all", range = "all" }: { platform?: string; range?: number | "all" } = {}
): Analysis {
  let r = rows;
  if (platform !== "all") r = r.filter((x) => x.platform === platform);

  const allMonths = [...new Set(rows.map((x) => x.month))].sort();
  const months = range === "all" ? allMonths : allMonths.slice(-range);
  const monthSet = new Set(months);
  r = r.filter((x) => monthSet.has(x.month));

  const engagement = r.filter((x) => x.feature !== LIFECYCLE_FEATURE);
  const lifecycle = r.filter((x) => x.feature === LIFECYCLE_FEATURE);

  const perMonth: MonthPoint[] = months.map((m) => {
    const inMonth = engagement.filter((x) => x.month === m);
    const life = lifecycle.filter((x) => x.month === m);

    const byFeature: Record<string, number> = {};
    for (const x of inMonth) {
      // Max, not sum: the same person can be counted on extension and android.
      byFeature[x.feature] = Math.max(byFeature[x.feature] || 0, x.users);
    }
    const installs = life.reduce((s, x) => s + x.installs, 0);
    const uninstalls = life.reduce((s, x) => s + x.uninstalls, 0);

    return {
      month: m,
      actions: inMonth.reduce((s, x) => s + x.total, 0),
      users: Math.max(0, ...Object.values(byFeature)),
      installs,
      uninstalls,
      retained: installs ? (installs - uninstalls) / installs : null,
    };
  });

  const featureMap: Record<string, { actions: number; byMonth: Record<string, number> }> = {};
  for (const x of engagement) {
    const f = (featureMap[x.feature] ??= { actions: 0, byMonth: {} });
    f.actions += x.total;
    f.byMonth[x.month] = Math.max(f.byMonth[x.month] || 0, x.users);
  }
  const features = Object.entries(featureMap)
    .map(([feature, f]) => ({
      feature,
      actions: f.actions,
      peakUsers: Math.max(0, ...Object.values(f.byMonth)),
    }))
    .sort((a, b) => b.actions - a.actions);

  const platformMap: Record<string, { actions: number; installs: number }> = {};
  for (const x of r) {
    const p = (platformMap[x.platform] ??= { actions: 0, installs: 0 });
    if (x.feature === LIFECYCLE_FEATURE) p.installs += x.installs;
    else p.actions += x.total;
  }
  const platforms = Object.entries(platformMap)
    .map(([platform, v]) => ({ platform, ...v }))
    .sort((a, b) => b.installs - a.installs || b.actions - a.actions);

  const installsByPlatform: Record<string, number> = {};
  for (const x of lifecycle) {
    installsByPlatform[x.platform] = (installsByPlatform[x.platform] || 0) + x.installs;
  }

  const totalInstalls = lifecycle.reduce((s, x) => s + x.installs, 0);
  const totalUninstalls = lifecycle.reduce((s, x) => s + x.uninstalls, 0);

  return {
    months,
    perMonth,
    features,
    platforms,
    latest: perMonth.length ? perMonth[perMonth.length - 1] : null,
    rows: r,
    engagementRows: engagement,
    totalActions: engagement.reduce((s, x) => s + x.total, 0),
    peakUsers: Math.max(0, ...perMonth.map((m) => m.users)),
    activeMonths: perMonth.filter((m) => m.actions > 0).length,
    featureCount: features.filter((f) => f.actions > 0).length,
    totalInstalls,
    totalUninstalls,
    installsByPlatform,
    retained: totalInstalls ? (totalInstalls - totalUninstalls) / totalInstalls : null,
    hasLifecycle: lifecycle.length > 0,
    availablePlatforms: [...new Set(rows.map((x) => x.platform))],
  };
}

/* ------------------------------------------------------------ formatting */

export function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1) + "M";
  if (n >= 10_000) return (n / 1000).toFixed(0) + "K";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return String(n);
}

export const fmtFull = (n: number | null | undefined): string =>
  n === null || n === undefined ? "—" : n.toLocaleString("en-IN");

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export function monthLabel(m: string): string {
  const [y, mo] = m.split("-");
  return `${MONTH_NAMES[Number(mo) - 1]} ${y.slice(2)}`;
}

export function dayLabel(d: string): string {
  const [y, m, day] = d.split("-");
  return `${Number(day)} ${MONTH_NAMES[Number(m) - 1]} ${y.slice(2)}`;
}

export function timeAgo(iso?: string | null): string {
  if (!iso) return "never";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 90) return "just now";
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

export function slugify(input: string): string {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

/** The current calendar month is still accumulating — flag it so a partial month isn't read as a drop. */
export function isCurrentMonth(m: string): boolean {
  const now = new Date();
  return m === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
