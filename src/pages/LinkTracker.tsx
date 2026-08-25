import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import { supabase } from "@/integrations/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import Header from "@/components/dashboard/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, ComposedChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  Copy, Link2, Loader2, Plus, RefreshCw, Trash2, ArrowLeft, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import {
  analyse, buildDataset, CreatorLink, dayLabel, fetchStats, fmt, fmtFull,
  isCurrentMonth, LIFECYCLE_FEATURE, monthLabel, orderPlatforms, PLATFORM_LABEL,
  slugify, StatsEntry, timeAgo,
} from "@/lib/linkTracker";

const LINK_DOMAIN = "r.buyhatke.com";

/**
 * `creator_links` is not in src/integrations/supabase/types.ts — that file is generated
 * from the hosted schema and states it must not be hand-edited. Until it is regenerated,
 * reach the table through an untyped client, the same escape hatch this project already
 * uses for `language_locations`.
 */
const db = supabase as unknown as SupabaseClient;

const PLATFORM_COLOR: Record<string, string> = {
  extension: "#6366f1",
  android: "#0d9488",
  ios: "#db7706",
};
const SERIES = ["#6366f1", "#0d9488", "#db7706", "#c026d3", "#0284c7", "#65a30d", "#dc2626", "#7c3aed"];

const buildLink = (slug: string) => `https://${LINK_DOMAIN}/${slug}`;

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Link copied");
  } catch {
    toast.error("Could not copy — select the link and press ⌘C");
  }
}

/* ------------------------------------------------------------------ KPI */

function Kpi({
  label, value, sub, warn,
}: { label: string; value: string; sub?: string | null; warn?: boolean }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-2xl font-semibold tracking-tight mt-1 ${warn ? "text-amber-600" : ""}`}>
          {value}
        </p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

/* ============================================================ main page */

const LinkTracker = () => {
  const navigate = useNavigate();
  const { user, isLoaded } = useUser();

  const [links, setLinks] = useState<CreatorLink[]>([]);
  const [stats, setStats] = useState<Record<string, StatsEntry | null>>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<CreatorLink | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [form, setForm] = useState({
    name: "", slug: "", code: "", handle: "", channel: "", campaign: "", notes: "",
  });

  useEffect(() => {
    if (!isLoaded) return;
    if (!user) navigate("/auth");
  }, [isLoaded, user, navigate]);

  const loadLinks = useCallback(async () => {
    const { data, error } = await db
      .from("creator_links")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      // The table is created by supabase/migrations/create_creator_links_table.sql
      toast.error(`Could not load links: ${error.message}`);
      setLoading(false);
      return;
    }
    const rows = (data ?? []) as CreatorLink[];
    setLinks(rows);

    // Cached-only: never fires the slow upstream calls just from opening the page.
    const entries = await Promise.all(
      rows.map(async (l) => {
        try {
          return [l.code, await fetchStats(l.code, { cachedOnly: true })] as const;
        } catch {
          return [l.code, null] as const;
        }
      })
    );
    setStats(Object.fromEntries(entries));
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user) loadLinks();
  }, [user, loadLinks]);

  /* ---- create ---- */

  const openDialog = () => {
    setForm({ name: "", slug: "", code: "", handle: "", channel: "", campaign: "", notes: "" });
    setDialogOpen(true);
  };

  const onNameChange = (name: string) => {
    const s = slugify(name);
    setForm((f) => ({
      ...f,
      name,
      slug: f.slug && f.slug !== slugify(f.name) ? f.slug : s,
      code: f.code && f.code !== slugify(f.name).toUpperCase() ? f.code : s.toUpperCase(),
    }));
  };

  const createLink = async () => {
    const name = form.name.trim();
    if (!name) return toast.error("Creator name is required");
    const slug = slugify(form.slug || name);
    if (!slug) return toast.error("Could not build a link from that name");

    setSaving(true);
    const { data, error } = await db
      .from("creator_links")
      .insert({
        name,
        slug,
        code: (form.code.trim() || slug).toUpperCase(),
        handle: form.handle.trim(),
        channel: form.channel.trim(),
        campaign: form.campaign.trim(),
        notes: form.notes.trim(),
        created_by: user?.primaryEmailAddress?.emailAddress ?? null,
      })
      .select()
      .single();
    setSaving(false);

    if (error) {
      toast.error(
        error.code === "23505" ? `The link /${slug} is already taken.` : error.message
      );
      return;
    }
    toast.success(`Link created: ${LINK_DOMAIN}/${slug}`);
    setDialogOpen(false);
    setLinks((prev) => [data as CreatorLink, ...prev]);
  };

  const removeLink = async (link: CreatorLink) => {
    if (!confirm(`Remove "${link.name}" from the tracker?\n\nThe link keeps working — this only removes it from this list.`)) return;
    const { error } = await db.from("creator_links").delete().eq("id", link.id);
    if (error) return toast.error(error.message);
    setLinks((prev) => prev.filter((l) => l.id !== link.id));
    setSelected(null);
    toast.success("Creator removed");
  };

  /* ---- sync ---- */

  const refreshOne = async (code: string) => {
    const entry = await fetchStats(code, { refresh: true });
    setStats((prev) => ({ ...prev, [code]: entry }));
    return entry;
  };

  const syncAll = async () => {
    setSyncing(true);
    let done = 0;
    // Sequential on purpose — each call can take up to a minute upstream.
    for (const l of links) {
      try {
        await refreshOne(l.code);
        done++;
      } catch (e) {
        toast.error(`${l.name}: ${(e as Error).message}`);
      }
    }
    setSyncing(false);
    toast.success(`Synced ${done}/${links.length}`);
  };

  /* ---- portfolio aggregate ---- */

  const agg = useMemo(() => {
    const byPlatform: Record<string, number> = {};
    const byMonth = new Map<string, Record<string, number>>();
    let installs = 0, uninstalls = 0, actions = 0, withData = 0, notSynced = 0;
    let anyIncomplete = false;
    const perCreator: { link: CreatorLink; installs: number; retained: number | null; actions: number }[] = [];

    for (const l of links) {
      const entry = stats[l.code];
      if (entry === undefined || entry === null) { notSynced++; continue; }
      if (!entry.hasData) continue;
      withData++;

      const ds = buildDataset(entry);
      const a = analyse(ds.rows, { range: "all" });
      if (ds.installsIncomplete) anyIncomplete = true;

      installs += a.totalInstalls;
      uninstalls += a.totalUninstalls;
      actions += a.totalActions;

      for (const [p, v] of Object.entries(a.installsByPlatform)) {
        byPlatform[p] = (byPlatform[p] || 0) + v;
      }
      for (const r of ds.rows) {
        if (r.feature !== LIFECYCLE_FEATURE || !r.installs) continue;
        const m = byMonth.get(r.month) ?? {};
        m[r.platform] = (m[r.platform] || 0) + r.installs;
        byMonth.set(r.month, m);
      }
      perCreator.push({ link: l, installs: a.totalInstalls, retained: a.retained, actions: a.totalActions });
    }

    perCreator.sort((a, b) => b.installs - a.installs);
    const months = [...byMonth.keys()].sort();

    return {
      installs, uninstalls, actions, withData, notSynced, anyIncomplete, byPlatform, perCreator,
      retained: installs ? (installs - uninstalls) / installs : null,
      trend: months.map((m) => ({ month: monthLabel(m), ...byMonth.get(m) })),
      platformList: orderPlatforms(Object.keys(byPlatform)),
    };
  }, [links, stats]);

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-20 text-center text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-3" />
          Loading link tracker…
        </div>
      </div>
    );
  }

  if (selected) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <CreatorDetail
          link={selected}
          entry={stats[selected.code] ?? null}
          onBack={() => setSelected(null)}
          onRefresh={refreshOne}
          onDelete={removeLink}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-6 space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Link2 className="h-6 w-6" /> Link Tracker
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {links.length} creator link{links.length === 1 ? "" : "s"} on {LINK_DOMAIN} · all-time figures
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={syncAll} disabled={syncing || !links.length}>
              {syncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Sync all
            </Button>
            <Button onClick={openDialog} className="bg-gradient-instagram">
              <Plus className="h-4 w-4 mr-2" /> New creator link
            </Button>
          </div>
        </div>

        {agg.notSynced > 0 && (
          <Card className="border-amber-500/50 bg-amber-500/5">
            <CardContent className="pt-6 text-sm flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <span>
                <strong>{agg.notSynced} of {links.length} creators have never been synced.</strong>{" "}
                The totals below cover only the {agg.withData} with data. Hit <em>Sync all</em> to
                include the rest — each one takes up to a minute, since BuyHatke's API is slow.
              </span>
            </CardContent>
          </Card>
        )}

        {!links.length ? (
          <Card>
            <CardContent className="py-16 text-center">
              <h2 className="font-semibold mb-1">No creator links yet</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Create your first link — give it to a creator and their installs show up here.
              </p>
              <Button onClick={openDialog} className="bg-gradient-instagram">
                <Plus className="h-4 w-4 mr-2" /> New creator link
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-6">
              <Kpi label="Total installs" value={fmt(agg.installs)} sub={`${fmtFull(agg.installs)} all time`} />
              <Kpi label="Android users" value={fmt(agg.byPlatform.android || 0)}
                sub={agg.installs ? `${(((agg.byPlatform.android || 0) / agg.installs) * 100).toFixed(0)}% of installs` : null} />
              <Kpi label="iOS users" value={fmt(agg.byPlatform.ios || 0)}
                sub={agg.installs ? `${(((agg.byPlatform.ios || 0) / agg.installs) * 100).toFixed(0)}% of installs` : null} />
              <Kpi label="Extension users" value={fmt(agg.byPlatform.extension || 0)}
                sub={agg.installs ? `${(((agg.byPlatform.extension || 0) / agg.installs) * 100).toFixed(0)}% of installs` : null} />
              <Kpi label="Still installed"
                value={agg.retained === null ? "—" : `${(agg.retained * 100).toFixed(0)}%`}
                sub={`${fmtFull(agg.uninstalls)} uninstalled`} />
              <Kpi label="Total actions" value={fmt(agg.actions)} sub={`across ${agg.withData} creator${agg.withData === 1 ? "" : "s"}`} />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Installs by platform</CardTitle>
                  <CardDescription>Where your creator traffic actually lands.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart
                      layout="vertical"
                      data={Object.entries(agg.byPlatform)
                        .sort((a, b) => b[1] - a[1])
                        .map(([p, v]) => ({ name: PLATFORM_LABEL[p] || p, value: v, platform: p }))}
                      margin={{ left: 20, right: 30 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
                      <XAxis type="number" tickFormatter={fmt} fontSize={11} />
                      <YAxis type="category" dataKey="name" width={72} fontSize={12} />
                      <Tooltip formatter={(v: number) => [fmtFull(v), "Installs"]} />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {Object.entries(agg.byPlatform).sort((a, b) => b[1] - a[1]).map(([p]) => (
                          <Cell key={p} fill={PLATFORM_COLOR[p] || "#6366f1"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Top creators by installs</CardTitle>
                  <CardDescription>Who is actually driving volume.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart
                      layout="vertical"
                      data={agg.perCreator.slice(0, 6).map((c) => ({ name: c.link.name, value: c.installs }))}
                      margin={{ left: 20, right: 30 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
                      <XAxis type="number" tickFormatter={fmt} fontSize={11} />
                      <YAxis type="category" dataKey="name" width={110} fontSize={11} />
                      <Tooltip formatter={(v: number) => [fmtFull(v), "Installs"]} />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {agg.perCreator.slice(0, 6).map((_, i) => (
                          <Cell key={i} fill={SERIES[i % SERIES.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {agg.trend.length > 1 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Installs over time</CardTitle>
                  <CardDescription>All creators combined, stacked by platform.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={agg.trend}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="month" fontSize={11} />
                      <YAxis tickFormatter={fmt} fontSize={11} />
                      <Tooltip formatter={(v: number, n: string) => [fmtFull(v), PLATFORM_LABEL[n] || n]} />
                      <Legend formatter={(v) => PLATFORM_LABEL[v] || v} />
                      {agg.platformList.map((p) => (
                        <Bar key={p} dataKey={p} stackId="a" fill={PLATFORM_COLOR[p] || "#6366f1"} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Creator portfolio</CardTitle>
                <CardDescription>
                  Click a row for full analytics. Installs come from BuyHatke's day-wise
                  endpoint — the only one that reports Android and iOS.
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Creator</TableHead>
                      <TableHead>Link</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead className="text-right">Installs</TableHead>
                      <TableHead className="text-right">Android</TableHead>
                      <TableHead className="text-right">iOS</TableHead>
                      <TableHead className="text-right">Extension</TableHead>
                      <TableHead className="text-right">Kept</TableHead>
                      <TableHead>Campaign</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {links.map((l) => {
                      const entry = stats[l.code];
                      const a = entry?.hasData
                        ? analyse(buildDataset(entry).rows, { range: "all" })
                        : null;
                      const P = a?.installsByPlatform ?? {};
                      const dim = "text-muted-foreground";
                      return (
                        <TableRow key={l.id} className="cursor-pointer" onClick={() => setSelected(l)}>
                          <TableCell>
                            <div className="font-medium">{l.name}</div>
                            {l.handle && <div className="text-xs text-muted-foreground">{l.handle}</div>}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">/{l.slug}</TableCell>
                          <TableCell className="font-mono text-xs">{l.code}</TableCell>
                          <TableCell className="text-right font-semibold">
                            {a ? fmt(a.totalInstalls) : <span className={dim}>{entry === undefined || entry === null ? "not synced" : "—"}</span>}
                          </TableCell>
                          <TableCell className="text-right">{P.android ? fmt(P.android) : <span className={dim}>—</span>}</TableCell>
                          <TableCell className="text-right">{P.ios ? fmt(P.ios) : <span className={dim}>—</span>}</TableCell>
                          <TableCell className="text-right">{P.extension ? fmt(P.extension) : <span className={dim}>—</span>}</TableCell>
                          <TableCell className="text-right">
                            {a?.retained == null ? <span className={dim}>—</span> : `${(a.retained * 100).toFixed(0)}%`}
                          </TableCell>
                          <TableCell>{l.campaign || <span className={dim}>—</span>}</TableCell>
                          <TableCell>
                            <Button
                              size="icon" variant="ghost"
                              onClick={(e) => { e.stopPropagation(); copy(buildLink(l.slug)); }}
                              title="Copy link"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* ---- create dialog ---- */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New creator link</DialogTitle>
            <DialogDescription>
              The link path and tracking code fill themselves in from the name.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Creator name</Label>
              <Input value={form.name} onChange={(e) => onNameChange(e.target.value)} placeholder="Laksh Mahajan" />
            </div>
            <div>
              <Label>Link path</Label>
              <div className="flex items-center gap-1">
                <span className="text-xs font-mono text-muted-foreground shrink-0">https://{LINK_DOMAIN}/</span>
                <Input value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} placeholder="laksh_mahajan" />
              </div>
            </div>
            <div>
              <Label>Tracking code</Label>
              <Input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} placeholder="LAKSH_MAHAJAN" />
              <p className="text-xs text-muted-foreground mt-1">
                Sent to the userQuality API. Change it only if your tech team uses a different code.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Handle</Label>
                <Input value={form.handle} onChange={(e) => setForm((f) => ({ ...f, handle: e.target.value }))} placeholder="@lakshmahajan" />
              </div>
              <div>
                <Label>Channel</Label>
                <Input value={form.channel} onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))} placeholder="Instagram" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Campaign</Label>
                <Input value={form.campaign} onChange={(e) => setForm((f) => ({ ...f, campaign: e.target.value }))} placeholder="Aug 2026 push" />
              </div>
              <div>
                <Label>Notes</Label>
                <Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="₹15k / 3 reels" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={createLink} disabled={saving} className="bg-gradient-instagram">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

/* ======================================================= creator detail */

function CreatorDetail({
  link, entry, onBack, onRefresh, onDelete,
}: {
  link: CreatorLink;
  entry: StatsEntry | null;
  onBack: () => void;
  onRefresh: (code: string) => Promise<StatsEntry | null>;
  onDelete: (l: CreatorLink) => void;
}) {
  const [current, setCurrent] = useState<StatsEntry | null>(entry);
  const [busy, setBusy] = useState(false);
  const [platform, setPlatform] = useState<string>("all");

  // Never synced — pull it once on open rather than showing an empty shell.
  useEffect(() => {
    if (current === null && !busy) void doRefresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doRefresh = async () => {
    setBusy(true);
    try {
      setCurrent(await onRefresh(link.code));
    } catch (e) {
      toast.error((e as Error).message);
    }
    setBusy(false);
  };

  const ds = current?.hasData ? buildDataset(current) : null;
  const a = ds ? analyse(ds.rows, { platform, range: "all" }) : null;

  const dailyInstalls = useMemo(() => {
    if (!ds?.dailyRows) return [];
    const byDay = new Map<string, number>();
    for (const r of ds.dailyRows) {
      if (r.feature !== LIFECYCLE_FEATURE || !r.date) continue;
      if (platform !== "all" && r.platform !== platform) continue;
      byDay.set(r.date, (byDay.get(r.date) || 0) + r.installs);
    }
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 59);
    const from = cutoff.toISOString().slice(0, 10);
    return [...byDay.entries()]
      .filter(([d]) => d >= from)
      .sort((x, y) => x[0].localeCompare(y[0]))
      .map(([date, installs]) => ({ date, label: dayLabel(date), installs }));
  }, [ds, platform]);

  const peak = dailyInstalls.reduce(
    (b, d) => (d.installs > (b?.installs ?? 0) ? d : b),
    null as null | { label: string; installs: number }
  );

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Button variant="ghost" size="sm" onClick={onBack} className="mb-2 -ml-2">
            <ArrowLeft className="h-4 w-4 mr-1" /> All creators
          </Button>
          <h1 className="text-2xl font-bold">{link.name}</h1>
          <div className="flex flex-wrap gap-2 mt-2">
            {link.handle && <Badge variant="secondary">{link.handle}</Badge>}
            {link.channel && <Badge variant="secondary">{link.channel}</Badge>}
            {link.campaign && <Badge variant="secondary">{link.campaign}</Badge>}
            <Badge variant="outline" className="font-mono">code {link.code}</Badge>
          </div>
          <div className="flex items-center gap-2 mt-3 border rounded-md px-3 py-2 max-w-md">
            <code className="text-sm flex-1 truncate">{buildLink(link.slug)}</code>
            <Button size="sm" variant="ghost" onClick={() => copy(buildLink(link.slug))}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={doRefresh} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Refresh
          </Button>
          <Button variant="outline" size="sm" className="text-destructive" onClick={() => onDelete(link)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {busy && !a && (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-3" />
            Fetching from BuyHatke — the API takes up to a minute. The result is cached
            afterwards, so this is only slow the first time each day.
          </CardContent>
        </Card>
      )}

      {!busy && !a && (
        <Card>
          <CardContent className="py-16 text-center">
            <h2 className="font-semibold mb-1">No data for this code yet</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {current?.message
                ? `The API replied "${current.message}" for code ${link.code}.`
                : `Nothing recorded for code ${link.code}.`}{" "}
              That is normal for a brand-new link — data appears once people who came
              through it install the app or extension.
            </p>
          </CardContent>
        </Card>
      )}

      {a && ds && (
        <>
          {ds.installsIncomplete && (
            <Card className="border-amber-500/50 bg-amber-500/5">
              <CardContent className="pt-6 text-sm flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <span>
                  <strong>Install numbers here are extension-only and too low.</strong> The
                  day-wise endpoint is the only one that reports Android and iOS installs, and
                  it did not answer for this creator{ds.dailyError ? ` (${ds.dailyError})` : ""}.
                  Hit Refresh to try again.
                </span>
              </CardContent>
            </Card>
          )}

          <Tabs value={platform} onValueChange={setPlatform}>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <TabsList>
                <TabsTrigger value="all">All platforms</TabsTrigger>
                {orderPlatforms(a.availablePlatforms).map((p) => (
                  <TabsTrigger key={p} value={p}>{PLATFORM_LABEL[p] || p}</TabsTrigger>
                ))}
              </TabsList>
              <p className="text-xs text-muted-foreground">
                {current?.stale ? "stale — API unreachable, showing older data" : `data as of ${timeAgo(current?.fetchedAt)}`}
              </p>
            </div>

            <TabsContent value={platform} className="space-y-6 mt-4">
              <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
                <Kpi label="Installs" value={fmt(a.totalInstalls)}
                  warn={ds.installsIncomplete}
                  sub={ds.installsIncomplete ? "extension only" : `${fmtFull(a.totalInstalls)} all time`} />
                <Kpi label="Uninstalls" value={fmt(a.totalUninstalls)}
                  sub={a.totalInstalls ? `${((a.totalUninstalls / a.totalInstalls) * 100).toFixed(1)}% of installs` : null} />
                <Kpi label="Still installed"
                  value={a.retained === null ? "—" : `${(a.retained * 100).toFixed(0)}%`} />
                <Kpi label="Peak monthly users" value={fmt(a.peakUsers)} sub="busiest single feature" />
                <Kpi label="Total actions" value={fmt(a.totalActions)} sub={`${a.featureCount} features used`} />
              </div>

              {dailyInstalls.length > 1 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Installs by day</CardTitle>
                    <CardDescription>
                      Last 60 days — the spike tells you which day a post landed.
                      {peak && peak.installs > 0 && (
                        <> <strong>Best day: {peak.label} with {fmtFull(peak.installs)} installs.</strong></>
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={dailyInstalls}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="label" fontSize={10} interval="preserveStartEnd" minTickGap={24} />
                        <YAxis tickFormatter={fmt} fontSize={11} />
                        <Tooltip formatter={(v: number) => [fmtFull(v), "Installs"]} />
                        <Bar dataKey="installs" fill="#6366f1" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Monthly engagement</CardTitle>
                  <CardDescription>
                    Bars are total actions. The line is unique users of the busiest feature
                    that month — a floor, since the same person appears under several features.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <ComposedChart data={a.perMonth.map((m) => ({
                      ...m,
                      label: monthLabel(m.month) + (isCurrentMonth(m.month) ? " *" : ""),
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="label" fontSize={11} />
                      <YAxis yAxisId="l" tickFormatter={fmt} fontSize={11} />
                      <YAxis yAxisId="r" orientation="right" tickFormatter={fmt} fontSize={11} />
                      <Tooltip formatter={(v: number, n: string) => [fmtFull(v), n === "actions" ? "Actions" : "Users (floor)"]} />
                      <Legend />
                      <Bar yAxisId="l" dataKey="actions" fill="#6366f1" radius={[3, 3, 0, 0]} name="Actions" />
                      <Line yAxisId="r" type="monotone" dataKey="users" stroke="#0d9488" strokeWidth={2} name="Users (floor)" />
                    </ComposedChart>
                  </ResponsiveContainer>
                  <p className="text-xs text-muted-foreground mt-2">* current month still in progress</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">What their audience uses</CardTitle>
                  <CardDescription>Actions per feature, with peak monthly users.</CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Feature</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                        <TableHead className="text-right">Peak users/mo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {a.features.map((f) => (
                        <TableRow key={f.feature}>
                          <TableCell>{f.feature}</TableCell>
                          <TableCell className="text-right">{fmtFull(f.actions)}</TableCell>
                          <TableCell className="text-right">{fmtFull(f.peakUsers)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

export default LinkTracker;
