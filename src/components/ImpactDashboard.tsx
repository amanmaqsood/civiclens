import React, { useEffect, useMemo, useState } from "react";
import { max, mean, extent } from "d3-array";
import { scaleLinear, scaleSequential } from "d3-scale";
import { interpolateYlOrRd } from "d3-scale-chromatic";
import { IssueReport } from "../types";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CheckCircle,
  Clock,
  Copy,
  Download,
  Layers,
  MapPinned,
  Medal,
  Sparkles,
  Trophy,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { ISSUE_STATUS_KEYS, IssueStatusKey, issueStatusLabel } from "../constants/status";
import { isInternalSmokeTestIssue } from "../utils/issueVisibility";

interface ImpactDashboardProps {
  issues: IssueReport[];
  onBack: () => void;
  hasMoreIssues?: boolean;
  loadedPageSize?: number;
}

type DashboardScope = "real" | "demo";
type DashboardMode = "public" | "agency";
type DeltaTone = "good" | "bad" | "neutral";

interface MetricState {
  value: string;
  detail: string;
}

interface DeltaState {
  label: string;
  detail: string;
  tone: DeltaTone;
}

interface DailyPoint {
  key: string;
  label: string;
  count: number;
}

interface HeatmapCell {
  id: string;
  row: number;
  col: number;
  count: number;
  avgSeverity: number;
  score: number;
  label: string;
}

interface ResponseBucket {
  id: string;
  label: string;
  count: number;
  range: string;
}

interface ActivityItem {
  id: string;
  type: string;
  title: string;
  time: number;
  status: IssueStatusKey;
}

const categories = ["pothole", "water_leak", "streetlight", "waste", "drainage", "road_damage", "other"];
const statuses = ISSUE_STATUS_KEYS;
const MIN_RATE_DENOMINATOR = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

function parseStoredDate(value?: string): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function formatMetricUnavailable(reason: string): MetricState {
  return {
    value: "Not enough data",
    detail: reason,
  };
}

function startOfLocalDay(ms = Date.now()): number {
  const date = new Date(ms);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function shortDayLabel(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { weekday: "short" });
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);
}

function formatDays(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "Not enough data";
  if (value < 1) return `${Math.max(1, Math.round(value * 24))}h`;
  return `${value.toFixed(1)}d`;
}

function buildDailySeries(issues: IssueReport[], offsetDays = 0): DailyPoint[] {
  const todayStart = startOfLocalDay();
  const end = todayStart - offsetDays * DAY_MS + DAY_MS;
  const start = end - 7 * DAY_MS;
  const points = Array.from({ length: 7 }, (_, index) => {
    const dayStart = start + index * DAY_MS;
    return {
      key: new Date(dayStart).toISOString().slice(0, 10),
      label: shortDayLabel(dayStart),
      count: 0,
    };
  });
  const counts = new Map(points.map((point) => [point.key, point]));

  issues.forEach((issue) => {
    const createdAt = parseStoredDate(issue.createdAt || issue.timestamp);
    if (createdAt === null || createdAt < start || createdAt >= end) return;
    const key = new Date(startOfLocalDay(createdAt)).toISOString().slice(0, 10);
    const point = counts.get(key);
    if (point) point.count += 1;
  });

  return points;
}

function periodIssues(issues: IssueReport[], offsetDays = 0): IssueReport[] {
  const todayStart = startOfLocalDay();
  const end = todayStart - offsetDays * DAY_MS + DAY_MS;
  const start = end - 7 * DAY_MS;
  return issues.filter((issue) => {
    const createdAt = parseStoredDate(issue.createdAt || issue.timestamp);
    return createdAt !== null && createdAt >= start && createdAt < end;
  });
}

function resolutionDays(issue: IssueReport): number | null {
  const createdAt = parseStoredDate(issue.createdAt || issue.timestamp);
  const resolvedAt = parseStoredDate(issue.resolvedAt);
  if (createdAt === null || resolvedAt === null || resolvedAt < createdAt) return null;
  return (resolvedAt - createdAt) / DAY_MS;
}

function percentDelta(current: number, previous: number, lowerIsBetter = false): DeltaState {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) {
    return { label: "n/a", detail: "Delta vs prior 7d unavailable", tone: "neutral" };
  }
  if (previous === 0) {
    if (current === 0) return { label: "0", detail: "No change vs prior 7d", tone: "neutral" };
    return { label: "+new", detail: "No prior-period baseline", tone: lowerIsBetter ? "bad" : "good" };
  }
  const pct = ((current - previous) / previous) * 100;
  const rounded = Math.round(pct);
  const improved = lowerIsBetter ? pct <= 0 : pct >= 0;
  return {
    label: `${rounded >= 0 ? "+" : ""}${rounded}%`,
    detail: "Delta vs prior 7d",
    tone: rounded === 0 ? "neutral" : improved ? "good" : "bad",
  };
}

function buildHeatmapCells(issues: IssueReport[]): HeatmapCell[] {
  const geocoded = issues.filter((issue) => (
    typeof issue.lat === "number" &&
    Number.isFinite(issue.lat) &&
    typeof issue.lng === "number" &&
    Number.isFinite(issue.lng)
  ));
  if (geocoded.length === 0) return [];

  const latExtent = extent(geocoded, (issue) => issue.lat as number);
  const lngExtent = extent(geocoded, (issue) => issue.lng as number);
  let minLat = latExtent[0] ?? 0;
  let maxLat = latExtent[1] ?? minLat;
  let minLng = lngExtent[0] ?? 0;
  let maxLng = lngExtent[1] ?? minLng;
  if (minLat === maxLat) {
    minLat -= 0.005;
    maxLat += 0.005;
  }
  if (minLng === maxLng) {
    minLng -= 0.005;
    maxLng += 0.005;
  }

  const rows = 4;
  const cols = 4;
  const cells = Array.from({ length: rows * cols }, (_, index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;
    return {
      id: `${row}-${col}`,
      row,
      col,
      count: 0,
      severitySum: 0,
    };
  });

  geocoded.forEach((issue) => {
    const lngRatio = ((issue.lng as number) - minLng) / (maxLng - minLng);
    const latRatio = ((issue.lat as number) - minLat) / (maxLat - minLat);
    const col = Math.max(0, Math.min(cols - 1, Math.floor(lngRatio * cols)));
    const row = Math.max(0, Math.min(rows - 1, rows - 1 - Math.floor(latRatio * rows)));
    const cell = cells[row * cols + col];
    cell.count += 1;
    cell.severitySum += issue.severity || 3;
  });

  return cells.map((cell) => {
    const avgSeverity = cell.count > 0 ? cell.severitySum / cell.count : 0;
    const latHigh = maxLat - ((maxLat - minLat) / rows) * cell.row;
    const latLow = maxLat - ((maxLat - minLat) / rows) * (cell.row + 1);
    const lngLow = minLng + ((maxLng - minLng) / cols) * cell.col;
    const lngHigh = minLng + ((maxLng - minLng) / cols) * (cell.col + 1);
    return {
      id: cell.id,
      row: cell.row,
      col: cell.col,
      count: cell.count,
      avgSeverity,
      score: cell.count * Math.max(1, avgSeverity || 1),
      label: `${latLow.toFixed(4)}-${latHigh.toFixed(4)}, ${lngLow.toFixed(4)}-${lngHigh.toFixed(4)}`,
    };
  });
}

function buildResponseBuckets(issues: IssueReport[]): ResponseBucket[] {
  const durations = issues.flatMap((issue) => {
    const days = resolutionDays(issue);
    return days === null ? [] : [days];
  });
  const buckets = [
    { id: "under-1", label: "<1d", range: "0 to 1 day", min: 0, max: 1 },
    { id: "one-three", label: "1-3d", range: "1 to 3 days", min: 1, max: 3 },
    { id: "three-seven", label: "3-7d", range: "3 to 7 days", min: 3, max: 7 },
    { id: "over-seven", label: ">7d", range: "More than 7 days", min: 7, max: Infinity },
  ];
  return buckets.map((bucket) => ({
    id: bucket.id,
    label: bucket.label,
    range: bucket.range,
    count: durations.filter((days) => days >= bucket.min && days < bucket.max).length,
  }));
}

function buildActivityFeed(issues: IssueReport[]): ActivityItem[] {
  return issues.flatMap((issue) => {
    const items: ActivityItem[] = [];
    const createdAt = parseStoredDate(issue.createdAt || issue.timestamp);
    if (createdAt !== null) {
      items.push({
        id: `${issue.id}-reported`,
        type: "Reported",
        title: issue.title || issue.summary || issue.category,
        time: createdAt,
        status: issue.status,
      });
    }
    const resolvedAt = parseStoredDate(issue.resolvedAt);
    if (resolvedAt !== null) {
      items.push({
        id: `${issue.id}-resolved`,
        type: "Resolved",
        title: issue.title || issue.summary || issue.category,
        time: resolvedAt,
        status: "resolved",
      });
    }
    const updatedAt = parseStoredDate(issue.updatedAt);
    if (updatedAt !== null && updatedAt !== createdAt && updatedAt !== resolvedAt) {
      items.push({
        id: `${issue.id}-updated`,
        type: issueStatusLabel(issue.status),
        title: issue.title || issue.summary || issue.category,
        time: updatedAt,
        status: issue.status,
      });
    }
    return items;
  }).sort((a, b) => b.time - a.time).slice(0, 8);
}

function buildMetrics(issues: IssueReport[]) {
  const totalReported = issues.length;
  const totalResolved = issues.filter((issue) => issue.status === "resolved").length;
  const resolutionRate = totalReported >= MIN_RATE_DENOMINATOR
    ? {
        value: `${Math.round((totalResolved / totalReported) * 100)}%`,
        detail: "Resolved among loaded records",
      }
    : formatMetricUnavailable(`Need at least ${MIN_RATE_DENOMINATOR} loaded records`);

  const resolutionDurations = issues.flatMap((issue) => {
    const days = resolutionDays(issue);
    return days === null ? [] : [days];
  });
  const avgResolutionDays = resolutionDurations.length > 0 ? mean(resolutionDurations) ?? null : null;
  const avgResolutionTime = avgResolutionDays !== null
    ? {
        value: formatDays(avgResolutionDays),
        detail: `${resolutionDurations.length} resolved record${resolutionDurations.length === 1 ? "" : "s"} with stored timestamps`,
      }
    : formatMetricUnavailable("No resolved records with stored created/resolved timestamps");

  const totalDuplicates = issues.reduce((acc, curr) => {
    const count = curr.reportCount || 1;
    return acc + Math.max(0, count - 1);
  }, 0);

  const categoryCounts = categories.reduce((acc, cat) => {
    acc[cat] = issues.filter((issue) => issue.category === cat).length;
    return acc;
  }, {} as Record<string, number>);

  const statusCounts = statuses.reduce((acc, stat) => {
    acc[stat] = issues.filter((issue) => issue.status === stat).length;
    return acc;
  }, {} as Record<IssueStatusKey, number>);

  const currentPeriod = periodIssues(issues, 0);
  const priorPeriod = periodIssues(issues, 7);
  const currentResolved = currentPeriod.filter((issue) => issue.status === "resolved").length;
  const priorResolved = priorPeriod.filter((issue) => issue.status === "resolved").length;
  const currentRate = currentPeriod.length > 0 ? currentResolved / currentPeriod.length : 0;
  const priorRate = priorPeriod.length > 0 ? priorResolved / priorPeriod.length : 0;
  const currentAvg = mean(currentPeriod.flatMap((issue) => {
    const days = resolutionDays(issue);
    return days === null ? [] : [days];
  })) ?? 0;
  const priorAvg = mean(priorPeriod.flatMap((issue) => {
    const days = resolutionDays(issue);
    return days === null ? [] : [days];
  })) ?? 0;

  const currentDuplicates = currentPeriod.reduce((sum, issue) => sum + Math.max(0, (issue.reportCount || 1) - 1), 0);
  const priorDuplicates = priorPeriod.reduce((sum, issue) => sum + Math.max(0, (issue.reportCount || 1) - 1), 0);

  return {
    totalReported,
    totalResolved,
    resolutionRate,
    avgResolutionTime,
    avgResolutionDays,
    totalDuplicates,
    categoryCounts,
    statusCounts,
    currentPeriod,
    priorPeriod,
    dailySeries: buildDailySeries(issues, 0),
    priorDailySeries: buildDailySeries(issues, 7),
    deltas: {
      reported: percentDelta(currentPeriod.length, priorPeriod.length),
      resolutionRate: percentDelta(currentRate, priorRate),
      avgResponse: percentDelta(currentAvg, priorAvg, true),
      duplicates: percentDelta(currentDuplicates, priorDuplicates),
    },
    heatmapCells: buildHeatmapCells(issues),
    responseBuckets: buildResponseBuckets(issues),
    activityFeed: buildActivityFeed(issues),
  };
}

function Sparkline({ points, label }: { points: DailyPoint[]; label: string }) {
  const width = 164;
  const height = 44;
  const values = points.map((point) => point.count);
  const maxValue = Math.max(1, max(values) || 1);
  const x = scaleLinear().domain([0, Math.max(1, values.length - 1)]).range([4, width - 4]);
  const y = scaleLinear().domain([0, maxValue]).range([height - 7, 7]);
  const polyline = values.map((value, index) => `${x(index)},${y(value)}`).join(" ");

  return (
    <svg className="h-11 w-full max-w-[164px]" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
      <title>{`${label}: ${values.join(", ")}`}</title>
      <line x1="4" y1={height - 7} x2={width - 4} y2={height - 7} stroke="currentColor" strokeOpacity="0.14" />
      <polyline points={polyline} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {values.map((value, index) => (
        <circle key={`${points[index].key}-${value}`} cx={x(index)} cy={y(value)} r="2.5" fill="currentColor">
          <title>{`${points[index].label}: ${value}`}</title>
        </circle>
      ))}
    </svg>
  );
}

function DeltaBadge({ delta }: { delta: DeltaState }) {
  const classes = delta.tone === "good"
    ? "border-verify/30 bg-verify/10 text-ink"
    : delta.tone === "bad"
      ? "border-alert/30 bg-alert/10 text-ink"
      : "border-hairline bg-paper text-slate";
  const Icon = delta.tone === "bad" ? TrendingDown : TrendingUp;
  return (
    <span className={`inline-flex min-h-[28px] items-center gap-1 rounded-lg border px-2 text-sm font-mono font-bold ${classes}`} title={delta.detail}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {delta.label}
    </span>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
  delta,
  points,
  tone = "text-ink",
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  value: string;
  detail: string;
  delta: DeltaState;
  points: DailyPoint[];
  tone?: string;
}) {
  return (
    <div className="min-h-[178px] rounded-2xl border border-hairline bg-white p-4 shadow-[0_2px_8px_-2px_rgba(14,26,43,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className={`h-4 w-4 shrink-0 ${tone}`} aria-hidden={true} />
          <span className="text-sm font-mono text-slate">{label}</span>
        </div>
        <DeltaBadge delta={delta} />
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className={`text-4xl font-mono font-black tabular-nums leading-none ${tone}`}>{value}</p>
          <p className="mt-2 text-sm font-semibold leading-snug text-slate">{detail}</p>
        </div>
        <div className={tone}>
          <Sparkline points={points} label={`${label} 7-day sparkline`} />
        </div>
      </div>
    </div>
  );
}

export default function ImpactDashboard({
  issues,
  onBack,
  hasMoreIssues = false,
  loadedPageSize = 50,
}: ImpactDashboardProps) {
  const [scope, setScope] = useState<DashboardScope>("real");
  const [mode, setMode] = useState<DashboardMode>("public");
  const publicIssues = useMemo(() => issues.filter((issue) => !isInternalSmokeTestIssue(issue)), [issues]);
  const realIssues = useMemo(() => publicIssues.filter((issue) => !issue.isDemoData), [publicIssues]);
  const demoIssues = useMemo(() => publicIssues.filter((issue) => issue.isDemoData), [publicIssues]);
  const scopedIssues = scope === "real" ? realIssues : demoIssues;
  const metrics = useMemo(() => buildMetrics(scopedIssues), [scopedIssues]);
  const maxCategoryCount = Math.max(...Object.values(metrics.categoryCounts), 1);
  const maxStatusCount = Math.max(...Object.values(metrics.statusCounts), 1);
  const maxBucketCount = Math.max(...metrics.responseBuckets.map((bucket) => bucket.count), 1);
  const maxHeatScore = Math.max(...metrics.heatmapCells.map((cell) => cell.score), 1);
  const heatColor = scaleSequential(interpolateYlOrRd).domain([0, maxHeatScore]);

  const scopeOptions: { id: DashboardScope; label: string; count: number }[] = [
    { id: "real", label: "Real records", count: realIssues.length },
    { id: "demo", label: "Synthetic demo", count: demoIssues.length },
  ];
  const modeOptions: { id: DashboardMode; label: string }[] = [
    { id: "public", label: "Public live" },
    { id: "agency", label: "Agency triage" },
  ];

  const [insight, setInsight] = useState<any>(null);
  const [insightLoading, setInsightLoading] = useState(true);
  useEffect(() => {
    let active = true;
    fetch("/api/insights/predictive")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (active) setInsight(d?.insight ? d : null); })
      .catch(() => { if (active) setInsight(null); })
      .finally(() => { if (active) setInsightLoading(false); });
    return () => { active = false; };
  }, []);

  const [leaders, setLeaders] = useState<any[]>([]);
  useEffect(() => {
    let active = true;
    fetch("/api/leaderboard")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (active) setLeaders(Array.isArray(d?.leaders) ? d.leaders : []); })
      .catch(() => { if (active) setLeaders([]); });
    return () => { active = false; };
  }, []);

  const handleExportOpen311 = async () => {
    try {
      const res = await fetch("/api/export/open311");
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "civiclens-open311.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Export is best-effort; the dashboard remains readable without it.
    }
  };

  return (
    <div id="impact-dashboard" className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-5 bg-paper p-4 pb-28 font-sans text-ink sm:p-6 lg:p-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-hairline bg-white shadow-2xs transition-all hover:bg-paper"
            title="Back to Landing"
            aria-label="Back to landing page"
          >
            <ArrowLeft className="h-4 w-4 text-ink" />
          </button>
          <div>
            <span className="block text-sm font-mono text-ink/80">Pilot impact dashboard</span>
            <h2 className="text-3xl font-display font-black text-ink">Loaded incident ledger</h2>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {modeOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setMode(option.id)}
              aria-pressed={mode === option.id}
              className={`min-h-[44px] rounded-xl border px-4 text-base font-bold ${
                mode === option.id
                  ? "border-ink bg-ink text-paper"
                  : "border-hairline bg-white text-ink hover:bg-paper"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-hairline bg-white p-3 shadow-xs">
        <div className="flex flex-wrap gap-2">
          {scopeOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setScope(option.id)}
              aria-pressed={scope === option.id}
              className={`min-h-[44px] rounded-xl border px-4 text-base font-bold ${
                scope === option.id
                  ? "border-ink bg-ink text-paper"
                  : "border-hairline bg-paper text-ink hover:bg-white"
              }`}
            >
              {option.label} ({option.count})
            </button>
          ))}
        </div>
        <p className="text-base leading-relaxed text-slate">
          Metrics are calculated from the records currently loaded: {scopedIssues.length} {scope === "real" ? "real" : "synthetic demo"} records.
          {hasMoreIssues ? ` More records may exist beyond the loaded page of ${loadedPageSize}.` : " The current query reports no additional page."}
        </p>
      </div>

      {scopedIssues.length === 0 ? (
        <div className="rounded-2xl border border-hairline bg-white p-6 text-center shadow-xs">
          <p className="text-lg font-black text-ink">No records in this dashboard scope.</p>
          <p className="mt-2 text-sm font-semibold text-slate">Switch scope or create a report to populate live metrics.</p>
        </div>
      ) : (
        <>
          <div id="dashboard-kpi-row" className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              icon={Layers}
              label="Loaded records"
              value={formatNumber(metrics.totalReported)}
              detail={scope === "demo" ? "Synthetic demo records" : "Non-demo records"}
              delta={metrics.deltas.reported}
              points={metrics.dailySeries}
            />
            <MetricCard
              icon={CheckCircle}
              label="Resolved rate"
              value={metrics.resolutionRate.value}
              detail={metrics.resolutionRate.detail}
              delta={metrics.deltas.resolutionRate}
              points={metrics.dailySeries.map((point) => ({
                ...point,
                count: metrics.currentPeriod.filter((issue) => issue.status === "resolved").length && point.count,
              }))}
              tone="text-ink"
            />
            <MetricCard
              icon={Clock}
              label="Response time"
              value={metrics.avgResolutionTime.value}
              detail={metrics.avgResolutionTime.detail}
              delta={metrics.deltas.avgResponse}
              points={metrics.dailySeries}
            />
            <MetricCard
              icon={Copy}
              label="Consolidated"
              value={formatNumber(metrics.totalDuplicates)}
              detail="Stored duplicate count signals"
              delta={metrics.deltas.duplicates}
              points={metrics.dailySeries}
              tone="text-marigold"
            />
          </div>

          {mode === "public" ? (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.25fr_0.75fr]">
              <section id="dashboard-heatmap" className="rounded-2xl border border-hairline bg-white p-4 shadow-[0_4px_16px_-4px_rgba(14,26,43,0.05)]">
                <div className="flex flex-col gap-2 border-b border-hairline pb-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="flex items-center gap-2 text-lg font-black text-ink">
                      <MapPinned className="h-5 w-5 text-alert" aria-hidden="true" />
                      Civic heatmap
                    </h3>
                    <p className="text-sm font-semibold text-slate">D3 severity-weighted grid from persisted coordinates.</p>
                  </div>
                  <span className="rounded-lg border border-hairline bg-paper px-2 py-1 text-sm font-mono text-slate">
                    {metrics.heatmapCells.filter((cell) => cell.count > 0).length} active cells
                  </span>
                </div>
                {metrics.heatmapCells.length === 0 ? (
                  <p className="mt-4 rounded-xl border border-hairline bg-paper p-4 text-sm font-semibold text-slate">No geocoded records are available for heatmap rendering.</p>
                ) : (
                  <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(260px,1fr)_minmax(260px,0.9fr)]">
                    <svg className="aspect-[4/3] w-full rounded-xl border border-hairline bg-paper p-2" viewBox="0 0 420 315" role="img" aria-label="Severity weighted civic heatmap">
                      <title>Severity weighted civic heatmap. Darker cells indicate more or higher-severity reports.</title>
                      {metrics.heatmapCells.map((cell) => {
                        const x = 18 + cell.col * 96;
                        const y = 18 + cell.row * 66;
                        const fill = cell.count > 0 ? heatColor(cell.score) : "var(--surface-2)";
                        return (
                          <g key={cell.id}>
                            <rect
                              x={x}
                              y={y}
                              width="86"
                              height="56"
                              rx="8"
                              fill={fill}
                              stroke="var(--border-subtle)"
                            >
                              <title>{`${cell.count} issues; avg severity ${cell.avgSeverity.toFixed(1)}; ${cell.label}`}</title>
                            </rect>
                          </g>
                        );
                      })}
                    </svg>

                    <div className="overflow-x-auto rounded-xl border border-hairline">
                      <table className="min-w-full text-left text-sm">
                        <caption className="sr-only">Heatmap table fallback</caption>
                        <thead className="bg-paper text-xs font-mono uppercase text-ink">
                          <tr>
                            <th scope="col" className="px-3 py-2">Grid</th>
                            <th scope="col" className="px-3 py-2">Issues</th>
                            <th scope="col" className="px-3 py-2">Avg severity</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-hairline">
                          {metrics.heatmapCells.filter((cell) => cell.count > 0).map((cell) => (
                            <tr key={`${cell.id}-fallback`}>
                              <td className="px-3 py-2 font-mono text-slate">{cell.label}</td>
                              <td className="px-3 py-2 font-bold tabular-nums text-ink">{cell.count}</td>
                              <td className="px-3 py-2 font-bold tabular-nums text-ink">{cell.avgSeverity.toFixed(1)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </section>

              <section id="dashboard-live-feed" className="rounded-2xl border border-hairline bg-white p-4 shadow-[0_4px_16px_-4px_rgba(14,26,43,0.05)]">
                <h3 className="flex items-center gap-2 border-b border-hairline pb-3 text-lg font-black text-ink">
                  <Activity className="h-5 w-5 text-verify" aria-hidden="true" />
                  Live activity feed
                </h3>
                {metrics.activityFeed.length === 0 ? (
                  <p className="mt-4 rounded-xl border border-hairline bg-paper p-4 text-sm font-semibold text-slate">No recent lifecycle activity in the loaded records.</p>
                ) : (
                  <ol className="mt-4 flex flex-col gap-3">
                    {metrics.activityFeed.map((item) => (
                      <li key={item.id} className="rounded-xl border border-hairline bg-paper p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-mono font-bold text-slate">{item.type}</p>
                            <p className="mt-1 text-sm font-bold leading-snug text-ink">{item.title}</p>
                          </div>
                          <span className="rounded-lg border border-hairline bg-white px-2 py-1 text-xs font-mono text-slate">
                            {new Date(item.time).toLocaleString()}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.95fr_1.05fr]">
              <section id="dashboard-response-distribution" className="rounded-2xl border border-hairline bg-white p-4 shadow-[0_4px_16px_-4px_rgba(14,26,43,0.05)]">
                <h3 className="flex items-center gap-2 border-b border-hairline pb-3 text-lg font-black text-ink">
                  <BarChart3 className="h-5 w-5 text-marigold" aria-hidden="true" />
                  Response-time distribution
                </h3>
                <div className="mt-4 flex flex-col gap-3">
                  {metrics.responseBuckets.map((bucket) => {
                    const pct = bucket.count === 0 ? 0 : Math.max(8, Math.round((bucket.count / maxBucketCount) * 100));
                    return (
                      <div key={bucket.id} className="flex flex-col gap-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-bold text-ink">{bucket.label}</span>
                          <span className="font-mono tabular-nums text-slate">{bucket.count}</span>
                        </div>
                        <div className="h-3 rounded-full border border-hairline bg-paper">
                          <div
                            className="h-full rounded-full bg-marigold"
                            style={{ width: `${pct}%` }}
                            role="img"
                            aria-label={`${bucket.count} resolved records in ${bucket.range}`}
                            title={`${bucket.count} resolved records in ${bucket.range}`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section id="dashboard-agency-table" className="rounded-2xl border border-hairline bg-white p-4 shadow-[0_4px_16px_-4px_rgba(14,26,43,0.05)]">
                <h3 className="border-b border-hairline pb-3 text-lg font-black text-ink">Agency status queue</h3>
                <div className="mt-4 overflow-x-auto rounded-xl border border-hairline">
                  <table className="min-w-full text-left text-sm">
                    <caption className="sr-only">Agency dashboard table fallback</caption>
                    <thead className="bg-paper text-xs font-mono uppercase text-ink">
                      <tr>
                        <th scope="col" className="px-3 py-2">Status</th>
                        <th scope="col" className="px-3 py-2">Count</th>
                        <th scope="col" className="px-3 py-2">Share</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-hairline">
                      {statuses.map((status) => {
                        const count = metrics.statusCounts[status] || 0;
                        const share = metrics.totalReported > 0 ? Math.round((count / metrics.totalReported) * 100) : 0;
                        return (
                          <tr key={status}>
                            <td className="px-3 py-2 font-bold text-ink">{issueStatusLabel(status)}</td>
                            <td className="px-3 py-2 font-mono font-bold tabular-nums text-ink">{count}</td>
                            <td className="px-3 py-2 font-mono tabular-nums text-slate">{share}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border border-hairline bg-white p-4 shadow-[0_4px_16px_-4px_rgba(14,26,43,0.05)]">
              <h3 className="border-b border-hairline pb-3 text-lg font-black text-ink">Category distribution</h3>
              <div className="mt-4 flex flex-col gap-3">
                {categories.map((cat) => {
                  const count = metrics.categoryCounts[cat] || 0;
                  const pct = count === 0 ? 0 : Math.max(6, Math.round((count / maxCategoryCount) * 100));
                  return (
                    <div key={cat} className="flex flex-col gap-1 text-sm">
                      <div className="flex items-center justify-between font-semibold text-slate">
                        <span className="text-sm font-bold capitalize text-ink">{cat.replace("_", " ")}</span>
                        <span className="font-mono tabular-nums text-ink">{count}</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full border border-hairline bg-paper">
                        <div className="h-full rounded-full bg-marigold transition-all duration-300" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-2xl border border-hairline bg-white p-4 shadow-[0_4px_16px_-4px_rgba(14,26,43,0.05)]">
              <h3 className="border-b border-hairline pb-3 text-lg font-black text-ink">Status lifecycles</h3>
              <div className="mt-4 flex flex-col gap-3">
                {statuses.map((stat) => {
                  const count = metrics.statusCounts[stat] || 0;
                  const pct = count === 0 ? 0 : Math.max(6, Math.round((count / maxStatusCount) * 100));
                  const statusBarColors: Record<IssueStatusKey, string> = {
                    submitted: "bg-slate",
                    verified: "bg-marigold",
                    in_progress: "bg-[#3B82F6]",
                    resolved: "bg-verify",
                  };

                  return (
                    <div key={stat} className="flex flex-col gap-1 text-sm">
                      <div className="flex items-center justify-between font-semibold text-slate">
                        <span className="text-sm font-bold text-ink">{issueStatusLabel(stat)}</span>
                        <span className="font-mono tabular-nums text-ink">{count}</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full border border-hairline bg-paper">
                        <div className={`${statusBarColors[stat] || "bg-slate"} h-full rounded-full transition-all duration-300`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </>
      )}

      <section className="flex flex-col gap-3 rounded-2xl border border-hairline bg-white p-4 shadow-[0_4px_16px_-4px_rgba(14,26,43,0.05)]">
        <div className="flex items-center justify-between gap-3 border-b border-hairline pb-2">
          <h3 className="flex items-center gap-2 text-lg font-bold text-ink">
            <Sparkles className="h-5 w-5 text-marigold" aria-hidden="true" />
            Predictive insights
          </h3>
          <button
            onClick={handleExportOpen311}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-hairline bg-paper px-3 py-2 text-sm font-semibold text-ink hover:bg-white"
            aria-label="Export all records as Open311 GeoReport v2 JSON"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Open311 export
          </button>
        </div>
        {insightLoading ? (
          <div className="h-20 animate-pulse rounded-xl bg-paper" role="status">
            <span className="sr-only">Loading predictive insights</span>
          </div>
        ) : !insight?.insight ? (
          <p className="text-sm text-slate">No predictive briefing yet. An operator can generate one from the agency desk.</p>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm leading-relaxed text-ink-2">{insight.insight.summary}</p>
            {Array.isArray(insight.insight.priorityCategories) && insight.insight.priorityCategories.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-slate">Priority categories:</span>
                {insight.insight.priorityCategories.map((c: string) => (
                  <span key={c} className="rounded-full bg-marigold/10 px-2.5 py-1 text-sm font-semibold text-marigold-ink">{String(c).replace(/_/g, " ")}</span>
                ))}
              </div>
            )}
            {Array.isArray(insight.insight.predictedHotspots) && insight.insight.predictedHotspots.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-slate">Predicted hotspots</span>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {insight.insight.predictedHotspots.slice(0, 6).map((h: any, i: number) => {
                    const risk = String(h.riskLevel || "medium").toLowerCase();
                    const riskClass = risk === "high" ? "text-alert" : risk === "low" ? "text-verify" : "text-marigold-ink";
                    return (
                      <div key={i} className="flex flex-col gap-1 rounded-xl border border-hairline bg-paper p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-ink">{h.area}</span>
                          <span className={`inline-flex items-center gap-1 text-sm font-bold ${riskClass}`}>
                            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                            {risk}
                          </span>
                        </div>
                        <span className="text-sm text-slate">{String(h.category).replace(/_/g, " ")}</span>
                        {h.rationale && <span className="text-[13px] leading-snug text-ink-2">{h.rationale}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {Array.isArray(insight.insight.recommendedActions) && insight.insight.recommendedActions.length > 0 && (
              <div className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-slate">Recommended actions</span>
                <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-ink-2">
                  {insight.insight.recommendedActions.slice(0, 4).map((a: string, i: number) => <li key={i}>{a}</li>)}
                </ul>
              </div>
            )}
            {insight.aiFallback && (
              <p className="text-[13px] italic text-slate">Deterministic summary shown (AI forecast temporarily unavailable).</p>
            )}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-hairline bg-white p-4 shadow-[0_4px_16px_-4px_rgba(14,26,43,0.05)]">
        <h3 className="flex items-center gap-2 border-b border-hairline pb-2 text-lg font-bold text-ink">
          <Trophy className="h-5 w-5 text-marigold" aria-hidden="true" />
          Community leaderboard
        </h3>
        {leaders.length === 0 ? (
          <p className="text-sm text-slate">No contributors yet. Report, support, or verify issues to earn points and badges.</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {leaders.map((l) => (
              <li key={l.rank} className="flex items-center gap-3 rounded-xl border border-hairline bg-paper p-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-marigold/10 font-mono text-sm font-bold text-marigold-ink">
                  {l.rank <= 3 ? <Medal className="h-4 w-4 text-marigold" aria-hidden="true" /> : l.rank}
                </span>
                <div className="min-w-0 flex flex-col">
                  <span className="truncate text-sm font-bold text-ink">{l.handle}</span>
                  <span className="text-[13px] text-slate">Level {l.level} | {l.reportCount} reports | {l.verifyCount} verifications | Trust {typeof l.trustScore === "number" ? Math.round(l.trustScore * 100) : 32}%</span>
                  {Array.isArray(l.badges) && l.badges.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {l.badges.map((b: string) => (
                        <span key={b} className="rounded-full bg-verify/10 px-2 py-0.5 text-[13px] font-semibold text-verify">{b}</span>
                      ))}
                    </div>
                  )}
                </div>
                <span className="ml-auto shrink-0 font-mono text-lg font-bold tabular-nums text-ink">{l.points}<span className="text-[13px] font-semibold text-slate"> pts</span></span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
