/**
 * SupervisorDashboard — dedicated read-only surface for halaqah supervisors.
 *
 * Distinct from TeacherDashboard:
 *   - Read-only. No edit halaqah, no delete users, no settings.
 *   - Lists EVERY halaqah the user supervises (a supervisor can be
 *     assigned to multiple halaqahs).
 *   - Per halaqah: students with consistency (30d), 7-day activity strip,
 *     memorization & review page totals, last-activity recency.
 *
 * Decision-support, not attendance roll-call. The supervisor uses this
 * surface to identify outstanding reporters and students needing
 * follow-up — so the table prioritizes consistency signals over a
 * binary present/absent flag.
 *
 * Data sources:
 *   - api.supervisors.listByUser(profile.id)  → assignments
 *   - api.halaqah.getById(halaqah_id)         → halaqah metadata
 *   - api.halaqah.members.byHalaqah(...)      → members joined to profile
 *   - api.reports.byHalaqah(halaqah_id, 500)  → recent reports + items
 */
import { useEffect, useState } from "react";
import {
  DashboardLayout,
  PageSection,
} from "../components/templates/DashboardLayout";
import { Card, CardContent } from "../components/molecules/Card";
import { DashboardViewSwitcher } from "../components/molecules/DashboardViewSwitcher";
import { Badge } from "../components/atoms/Badge";
import { Button } from "../components/atoms/Button";
import { Input } from "../components/atoms/Input";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useTranslation } from "../locales/i18n";
import { api } from "../lib/supabase";
import { uiText } from "../lib/uiText";
import { getDisplayName, getFullName, buildWhatsAppLink } from "../lib/utils";
import { segmentationRules } from "../lib/segmentationRules";
import {
  canManageStudentActivation,
  canContactStudents,
} from "../lib/permissions";
import type { AccountStatus, Halaqah, HalaqahMember, Report } from "../types";

// ---------------- Local types -----------------------------------------

type Tier = "excellent" | "good" | "weak" | "inactive";

/** Per-day record used by the expandable 7-day breakdown. */
interface DailyEntry {
  dayKey: string; // YYYY-MM-DD (local)
  date: Date; // start-of-day local Date for label rendering
  reported: boolean;
  memorization: number; // pages summed across reports submitted that day
  review: number;
}

interface StudentRow {
  id: string;
  /** Display name (first + second) used as the row's primary label. */
  name: string;
  /** Full three-part name shown in the contact column. */
  fullName: string;
  /** Phone — surfaced to authorized viewers as a tap-to-WhatsApp link. */
  phone: string | null;
  /** Email — surfaced as a `mailto:` link. */
  email: string | null;
  /** Account status — drives the activation toggle button label. */
  status: AccountStatus | null;
  totalReports: number;
  reports30d: number;
  consistency30: number; // 0..100, distinct days reported / 30
  tier: Tier;
  last7Days: boolean[]; // length 7, index 0 = 6 days ago, index 6 = today
  memorizationPages: number;
  reviewPages: number;
  lastReportDate: string | null;
  daysSinceLast: number | null;
  // Detailed breakdown shown when the row is expanded. Same ordering as
  // last7Days (oldest → newest) so the supervisor reads left-to-right /
  // right-to-left in chronological order.
  dailyBreakdown: DailyEntry[];
}

interface HalaqahPanel {
  halaqah: Halaqah;
  students: StudentRow[];
  // Aggregates surfaced in the panel header.
  reports30dTotal: number;
  engagedCount: number; // students with consistency >= 50
  topReporter: StudentRow | null;
  needsAttention: number; // students with tier 'weak' or 'inactive'
}

// ---------------- Helpers ---------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;

/** Local YYYY-MM-DD key (timezone-stable for grouping). */
function localDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function diffDaysFromToday(iso: string, now = new Date()): number {
  const then = startOfDay(new Date(iso));
  const today = startOfDay(now);
  return Math.round((today.getTime() - then.getTime()) / DAY_MS);
}

function tierFor(consistency: number): Tier {
  if (consistency >= 80) return "excellent";
  if (consistency >= 50) return "good";
  if (consistency >= 20) return "weak";
  return "inactive";
}

function tierBadgeVariant(
  t: Tier,
): "success" | "primary" | "warning" | "destructive" {
  if (t === "excellent") return "success";
  if (t === "good") return "primary";
  if (t === "weak") return "warning";
  return "destructive";
}

function tierBarClass(t: Tier): string {
  if (t === "excellent") return "bg-emerald-500";
  if (t === "good") return "bg-primary";
  if (t === "weak") return "bg-amber-500";
  return "bg-rose-500";
}

function tierLabelKey(t: Tier): string {
  if (t === "excellent") return "supervisor.tierExcellent";
  if (t === "good") return "supervisor.tierGood";
  if (t === "weak") return "supervisor.tierWeak";
  return "supervisor.tierInactive";
}

// ---------------- Row builder -----------------------------------------

function buildStudentRow(
  member: HalaqahMember,
  reports: Report[],
  now: Date,
): StudentRow {
  // Build the 30-day key window AND the 7-day Date window. The 7-day
  // window is kept as full Date objects (start-of-day) so the
  // breakdown UI can render localized day-of-week + date labels.
  const last30Keys: string[] = [];
  const last7Dates: Date[] = []; // newest → oldest, reversed below.
  for (let i = 0; i < 30; i++) {
    const d = new Date(now.getTime() - i * DAY_MS);
    last30Keys.push(localDayKey(d));
    if (i < 7) last7Dates.push(startOfDay(d));
  }
  last7Dates.reverse(); // oldest → newest, matches last7Days[] ordering.

  const reportedDays = new Set<string>();
  // Per-day page totals over the last 7 days. Bucketed by local day key
  // so multiple reports on the same day correctly aggregate.
  const dayPages: Record<string, { memorization: number; review: number }> = {};
  let memorizationPages = 0;
  let reviewPages = 0;
  let lastReportDate: string | null = null;

  for (const r of reports) {
    const key = localDayKey(new Date(r.report_date));
    reportedDays.add(key);
    if (!lastReportDate || r.report_date > lastReportDate) {
      lastReportDate = r.report_date;
    }
    let mem = 0;
    let rev = 0;
    for (const it of r.items ?? []) {
      if (it.type === "memorization") mem += it.pages;
      else if (it.type === "review") rev += it.pages;
    }
    memorizationPages += mem;
    reviewPages += rev;
    const bucket = (dayPages[key] ??= { memorization: 0, review: 0 });
    bucket.memorization += mem;
    bucket.review += rev;
  }

  const reports30d = last30Keys.reduce(
    (acc, k) => acc + (reportedDays.has(k) ? 1 : 0),
    0,
  );
  const consistency30 = Math.round((reports30d / 30) * 100);
  const tier = tierFor(consistency30);
  const last7Days = last7Dates.map((d) => reportedDays.has(localDayKey(d)));
  const daysSinceLast = lastReportDate
    ? diffDaysFromToday(lastReportDate, now)
    : null;

  const dailyBreakdown: DailyEntry[] = last7Dates.map((d) => {
    const k = localDayKey(d);
    const bucket = dayPages[k];
    return {
      dayKey: k,
      date: d,
      reported: reportedDays.has(k),
      memorization: bucket?.memorization ?? 0,
      review: bucket?.review ?? 0,
    };
  });

  // Contact + status fields for the supervisor view. Pulled from the
  // joined profile on the member row (members.byHalaqah now selects
  // `third_name`, `phone`, `email`, `status`). Falls back gracefully
  // to nulls so older join shapes don't crash the renderer.
  const studentProfile = member.student;
  return {
    id: member.student_id,
    name: studentProfile ? getDisplayName(studentProfile) : member.student_id,
    fullName: studentProfile
      ? getFullName(studentProfile) || getDisplayName(studentProfile)
      : member.student_id,
    phone: studentProfile?.phone ?? null,
    email: studentProfile?.email ?? null,
    status: studentProfile?.status ?? null,
    totalReports: reports.length,
    reports30d,
    consistency30,
    tier,
    last7Days,
    memorizationPages,
    reviewPages,
    lastReportDate,
    daysSinceLast,
    dailyBreakdown,
  };
}

// ---------------- Component -------------------------------------------

export function SupervisorDashboard() {
  const { t } = useTranslation();
  const { profile, refreshProfile } = useAuth();
  const toast = useToast();

  const [panels, setPanels] = useState<HalaqahPanel[]>([]);
  const [loading, setLoading] = useState(true);
  // Expanded student ids (key = `${halaqahId}:${studentId}` so the same
  // student appearing in two halaqahs expands independently).
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [activationLoadingId, setActivationLoadingId] = useState<string | null>(
    null,
  );
  // Free-text search applied per-halaqah-panel. A single shared query is
  // intentional — supervisors typically scan all their halaqahs for the
  // same name, not different names per halaqah.
  const [searchQuery, setSearchQuery] = useState("");

  // Permission gates.
  //
  // Reaching SupervisorDashboard *implies* the user is a relational
  // halaqah_supervisor — the dispatcher (App.tsx) routes here only when
  // `isUserSupervisor(assignments)` is true and the user picked the
  // supervisor view. Many production supervisors have `profile.role =
  // 'student'` (dual-role pattern), so a role-only check would hide the
  // activation column from them. Pass `isSupervisor: true` so the
  // helper accepts the relational case alongside the role-based case.
  // Server-side RPC still enforces the per-student scope.
  const canActivate = canManageStudentActivation(profile?.role, {
    isSupervisor: true,
  });
  // Same dual-role rationale as canActivate above — relational
  // supervisors carry profile.role='student'.
  const canSeeContact = canContactStudents(profile?.role, {
    isSupervisor: true,
  });

  const toggleExpanded = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Toggle a student's account status. The next status is the inverse
  // of the row's current status (active ↔ suspended). Locally mutate
  // the matching row on success so the panel reflects the change
  // without a full refetch.
  const handleToggleActivation = async (row: StudentRow) => {
    const next: AccountStatus =
      row.status === "active" ? "suspended" : "active";
    setActivationLoadingId(row.id);
    try {
      const { error } = await api.profiles.setStudentStatus(row.id, next);
      if (error) {
        toast.error(error.message || t("errors.unauthorized"));
        return;
      }
      setPanels((prev) =>
        prev.map((p) => ({
          ...p,
          students: p.students.map((s) =>
            s.id === row.id ? { ...s, status: next } : s,
          ),
        })),
      );
      toast.success(
        next === "active"
          ? t("admin.studentActivated")
          : t("admin.studentSuspended"),
      );
      // Self-suspend: refresh own profile so AuthProvider's active-status
      // guard fires immediately. Without this the suspending user keeps
      // their stale 'active' profile until the next visibility change /
      // navigation event.
      if (row.id === profile?.id && next !== "active") {
        await refreshProfile();
      }
    } finally {
      setActivationLoadingId(null);
    }
  };

  useEffect(() => {
    if (!profile?.id) return;
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      try {
        const { data: assignments } = await api.supervisors.listByUser(
          profile.id,
        );
        const ids = (assignments ?? []).map((a) => a.halaqah_id);

        if (ids.length === 0) {
          if (!cancelled) {
            setPanels([]);
          }
          return;
        }

        const now = new Date();

        const built = await Promise.all(
          ids.map(async (halaqahId) => {
            const [halaqahRes, membersRes, reportsRes] = await Promise.all([
              api.halaqah.getById(halaqahId),
              api.halaqah.members.byHalaqah(halaqahId),
              // Bumped from 100 to 500 — 30-day stats need a wider window
              // for active halaqahs (multiple students × ~daily cadence).
              api.reports.byHalaqah(halaqahId, 500),
            ]);
            const halaqah = halaqahRes.data;
            const members = (membersRes.data ?? []) as HalaqahMember[];
            const reports = (reportsRes.data ?? []) as Report[];

            const reportsByStudent: Record<string, Report[]> = {};
            for (const r of reports) {
              (reportsByStudent[r.student_id] ??= []).push(r);
            }

            const students: StudentRow[] = members
              .map((m) =>
                buildStudentRow(m, reportsByStudent[m.student_id] ?? [], now),
              )
              // Sort: highest consistency first, then most recently active.
              .sort((a, b) => {
                if (b.consistency30 !== a.consistency30) {
                  return b.consistency30 - a.consistency30;
                }
                const aLast = a.lastReportDate ?? "";
                const bLast = b.lastReportDate ?? "";
                return bLast.localeCompare(aLast);
              });

            // Halaqah-level aggregates.
            const reports30dTotal = students.reduce(
              (acc, s) => acc + s.reports30d,
              0,
            );
            const engagedCount = students.filter(
              (s) => s.consistency30 >= 50,
            ).length;
            const topReporter =
              students.length > 0 && students[0].consistency30 > 0
                ? students[0]
                : null;
            const needsAttention = students.filter(
              (s) => s.tier === "weak" || s.tier === "inactive",
            ).length;

            return {
              halaqah,
              students,
              reports30dTotal,
              engagedCount,
              topReporter,
              needsAttention,
            } as HalaqahPanel;
          }),
        );

        if (cancelled) return;

        const valid = built.filter(
          (p): p is HalaqahPanel => p.halaqah !== null,
        );
        setPanels(valid);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  // ----- Loading ------------------------------------------------------
  if (loading) {
    return (
      <DashboardLayout
        title={t("supervisor.title")}
        subtitle={t("supervisor.subtitle")}
      >
        <DashboardViewSwitcher />
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      </DashboardLayout>
    );
  }

  // ----- No assignments ----------------------------------------------
  if (panels.length === 0) {
    return (
      <DashboardLayout
        title={t("supervisor.title")}
        subtitle={t("supervisor.subtitle")}
      >
        <DashboardViewSwitcher />
        <Card padding="lg">
          <CardContent>
            <p className="text-center text-muted text-base py-8">
              {t("supervisor.noAssignments")}
            </p>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  // ----- Helpers used inside render ----------------------------------
  const formatRecency = (s: StudentRow): string => {
    if (s.daysSinceLast === null) return t("supervisor.noActivity");
    if (s.daysSinceLast <= 0) return t("supervisor.today");
    if (s.daysSinceLast === 1) return t("supervisor.yesterday");
    return t("supervisor.daysAgo").replace("{{n}}", String(s.daysSinceLast));
  };

  // ----- Render ------------------------------------------------------
  return (
    <DashboardLayout
      title={t("supervisor.title")}
      subtitle={t("supervisor.subtitle")}
    >
      {/* Dual-role accounts (student + supervisor) get a top-level
          view switcher. Renders nothing for pure supervisors. */}
      <DashboardViewSwitcher />
      <div className="mb-4">
        <Input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t("common.search")}
        />
      </div>
      <div className="space-y-8">
        {panels.map((panel) => {
          const { halaqah, students: allStudents } = panel;
          // Apply the shared search query at render time so the input
          // stays responsive across every halaqah panel without
          // re-deriving panels[].
          const q = searchQuery.trim().toLowerCase();
          const students = q
            ? allStudents.filter((s) => {
                const name = (s.name || "").toLowerCase();
                const full = (s.fullName || "").toLowerCase();
                const email = (s.email || "").toLowerCase();
                const phone = (s.phone || "").toLowerCase();
                return (
                  name.includes(q) ||
                  full.includes(q) ||
                  email.includes(q) ||
                  phone.includes(q)
                );
              })
            : allStudents;
          const ui = segmentationRules.getGenderedUI({
            role: "teacher",
            segment: halaqah.segment,
          });
          const segmentKey =
            halaqah.segment === "men"
              ? "segment.men"
              : halaqah.segment === "women"
                ? "segment.women"
                : "";

          return (
            <PageSection
              key={halaqah.id}
              title={`${t(ui.halaqahLabel)} — ${halaqah.name}`}
            >
              <Card padding="md" variant="bordered">
                {/* Halaqah meta */}
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <span className="text-base text-muted">
                    {t("supervisor.halaqahName")}:
                  </span>
                  <span className="text-base font-medium text-foreground">
                    {halaqah.name}
                  </span>
                  {segmentKey && (
                    <Badge variant="secondary">{t(segmentKey)}</Badge>
                  )}
                </div>

                {/* Aggregate summary cards — drives the supervisor's
                    quick read of the halaqah's overall health. */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                  <SummaryStat
                    label={t("supervisor.summaryReports30")}
                    value={String(panel.reports30dTotal)}
                  />
                  <SummaryStat
                    label={t("supervisor.summaryActive")}
                    value={`${panel.engagedCount} / ${allStudents.length}`}
                  />
                  <SummaryStat
                    label={t("supervisor.summaryTopReporter")}
                    value={panel.topReporter?.name ?? t("supervisor.noneYet")}
                  />
                  <SummaryStat
                    label={t("supervisor.summaryNeedsAttention")}
                    value={String(panel.needsAttention)}
                    accent={panel.needsAttention > 0 ? "warning" : undefined}
                  />
                </div>

                {students.length === 0 ? (
                  <p className="text-sm text-muted">
                    {q
                      ? t("admin.noSearchResults")
                      : t("supervisor.noStudents")}
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-base">
                      <thead className="bg-muted/40">
                        <tr>
                          <th className="px-3 py-2 w-8" aria-hidden="true" />
                          <th className="px-3 py-2 text-right font-medium text-foreground whitespace-nowrap">
                            {t("supervisor.studentName")}
                          </th>
                          {canSeeContact && (
                            <th className="px-3 py-2 text-right font-medium text-foreground whitespace-nowrap">
                              {t("student.contact")}
                            </th>
                          )}
                          <th className="px-3 py-2 text-right font-medium text-foreground whitespace-nowrap">
                            {t("supervisor.consistency30")}
                          </th>
                          <th className="px-3 py-2 text-right font-medium text-foreground whitespace-nowrap">
                            {t("supervisor.last7Days")}
                          </th>
                          <th className="px-3 py-2 text-right font-medium text-foreground whitespace-nowrap">
                            {t("supervisor.memorizationPages")}
                          </th>
                          <th className="px-3 py-2 text-right font-medium text-foreground whitespace-nowrap">
                            {t("supervisor.reviewPages")}
                          </th>
                          <th className="px-3 py-2 text-right font-medium text-foreground whitespace-nowrap">
                            {t("supervisor.totalReports")}
                          </th>
                          <th className="px-3 py-2 text-right font-medium text-foreground whitespace-nowrap">
                            {t("supervisor.lastActivity")}
                          </th>
                          {canActivate && (
                            <th className="px-3 py-2 text-right font-medium text-foreground whitespace-nowrap">
                              {t("student.activation")}
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {students.map((s) => {
                          const expandKey = `${halaqah.id}:${s.id}`;
                          const isOpen = expanded.has(expandKey);
                          return (
                            <FragmentRow
                              key={s.id}
                              student={s}
                              isOpen={isOpen}
                              expandKey={expandKey}
                              onToggle={toggleExpanded}
                              tierLabel={t(tierLabelKey(s.tier))}
                              recencyLabel={formatRecency(s)}
                              showContact={canSeeContact}
                              showActivation={canActivate}
                              activationLoadingId={activationLoadingId}
                              onToggleActivation={handleToggleActivation}
                              t={t}
                            />
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                <p className="text-sm text-muted mt-3">
                  {t(uiText.getStudentLabel(halaqah.segment, "plural"))}:{" "}
                  {allStudents.length}
                </p>
              </Card>
            </PageSection>
          );
        })}
      </div>
    </DashboardLayout>
  );
}

// ---------------- Sub-components --------------------------------------

function SummaryStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "warning";
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
      <div className="text-xs text-muted mb-1">{label}</div>
      <div
        className={
          "text-base font-semibold " +
          (accent === "warning" ? "text-amber-600" : "text-foreground")
        }
      >
        {value}
      </div>
    </div>
  );
}

/** Horizontal progress bar + tier badge + raw count. */
function ConsistencyCell({
  percent,
  tier,
  tierLabel,
  reports30d,
}: {
  percent: number;
  tier: Tier;
  tierLabel: string;
  reports30d: number;
}) {
  return (
    <div className="flex flex-col gap-1 min-w-[140px]">
      <div className="flex items-center justify-between gap-2">
        <Badge variant={tierBadgeVariant(tier)}>{tierLabel}</Badge>
        <span className="text-sm text-muted tabular-nums">{reports30d}/30</span>
      </div>
      <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
        <div
          className={"h-full rounded-full transition-all " + tierBarClass(tier)}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

// ---------------- Day-of-week label table -----------------------------
// Maps Date.getDay() (0=Sunday) → existing `timeSlots.*` i18n keys so we
// reuse the project's translated weekday names instead of inventing new
// ones. Index order: Sun, Mon, Tue, Wed, Thu, Fri, Sat.
const WEEKDAY_KEYS: readonly string[] = [
  "timeSlots.sunday",
  "timeSlots.monday",
  "timeSlots.tuesday",
  "timeSlots.wednesday",
  "timeSlots.thursday",
  "timeSlots.friday",
  "timeSlots.saturday",
];

function weekdayKey(d: Date): string {
  return WEEKDAY_KEYS[d.getDay()];
}

function shortDate(d: Date): string {
  // Locale-neutral DD/MM — date itself is already absolute, no need
  // to switch on language for numerals.
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}`;
}

/**
 * Two-row fragment per student: the summary row + an optional detail
 * row when expanded. Pulled out so the loop body stays readable.
 */
function FragmentRow({
  student,
  isOpen,
  expandKey,
  onToggle,
  tierLabel,
  recencyLabel,
  showContact,
  showActivation,
  activationLoadingId,
  onToggleActivation,
  t,
}: {
  student: StudentRow;
  isOpen: boolean;
  expandKey: string;
  onToggle: (key: string) => void;
  tierLabel: string;
  recencyLabel: string;
  showContact: boolean;
  showActivation: boolean;
  activationLoadingId: string | null;
  onToggleActivation: (row: StudentRow) => void;
  t: (key: string) => string;
}) {
  // Total visible cells in the summary row (used for the expand-row
  // colSpan). 6 fixed columns + name + optional contact + optional
  // activation. Keeps the breakdown row spanning the full table width.
  const summaryColSpan = 6 + (showContact ? 1 : 0) + (showActivation ? 1 : 0);
  const isActive = student.status === "active";
  const activationLoading = activationLoadingId === student.id;
  const whatsappLink = student.phone ? buildWhatsAppLink(student.phone) : null;

  return (
    <>
      <tr
        className="hover:bg-muted/20 cursor-pointer"
        onClick={() => onToggle(expandKey)}
        aria-expanded={isOpen}
      >
        <td className="px-3 py-3 text-muted text-center select-none w-8">
          <span
            className={
              "inline-block transition-transform " + (isOpen ? "rotate-90" : "")
            }
            aria-hidden="true"
          >
            ▸
          </span>
        </td>
        <td className="px-3 py-3 font-medium text-foreground whitespace-nowrap">
          {student.fullName || student.name}
        </td>
        {showContact && (
          <td
            className="px-3 py-3 align-top"
            // Contact links shouldn't trigger row expand/collapse.
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col gap-0.5 items-end max-w-[220px]">
              {whatsappLink ? (
                <a
                  href={whatsappLink}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-primary hover:underline truncate w-full text-right"
                >
                  {student.phone}
                </a>
              ) : (
                <span className="text-sm text-muted">
                  {t("student.noPhone")}
                </span>
              )}
              {student.email && (
                <a
                  href={`mailto:${student.email}`}
                  className="text-xs text-muted hover:text-primary truncate w-full text-right"
                  title={student.email}
                >
                  {student.email}
                </a>
              )}
            </div>
          </td>
        )}
        <td className="px-3 py-3">
          <ConsistencyCell
            percent={student.consistency30}
            tier={student.tier}
            tierLabel={tierLabel}
            reports30d={student.reports30d}
          />
        </td>
        <td className="px-3 py-3">
          <DotStrip days={student.last7Days} />
        </td>
        <td className="px-3 py-3 text-foreground tabular-nums">
          {student.memorizationPages}
        </td>
        <td className="px-3 py-3 text-foreground tabular-nums">
          {student.reviewPages}
        </td>
        <td className="px-3 py-3 text-foreground tabular-nums">
          {student.totalReports}
        </td>
        <td className="px-3 py-3 text-muted whitespace-nowrap">
          {recencyLabel}
        </td>
        {showActivation && (
          <td
            className="px-3 py-3"
            // Don't bubble the click to the row's expand handler.
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              size="sm"
              variant={isActive ? "destructive" : "success"}
              loading={activationLoading}
              onClick={() => onToggleActivation(student)}
            >
              {isActive ? t("admin.suspend") : t("admin.activate")}
            </Button>
          </td>
        )}
      </tr>

      {isOpen && (
        <tr className="bg-muted/10">
          <td className="px-3 py-3" />
          <td className="px-3 py-3" colSpan={summaryColSpan}>
            <WeekBreakdown student={student} t={t} />
          </td>
        </tr>
      )}
    </>
  );
}

/**
 * Per-day breakdown shown inside the expanded row. Newest day on top —
 * supervisor's eye-level scan starts at "today", then drops down through
 * the week. Each row shows day-of-week, absolute date, submitted/missing
 * badge, memorization pages, review pages.
 */
function WeekBreakdown({
  student,
  t,
}: {
  student: StudentRow;
  t: (key: string) => string;
}) {
  // dailyBreakdown is oldest→newest from buildStudentRow; reverse for
  // top-of-list = today.
  const ordered = [...student.dailyBreakdown].reverse();
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-sm font-medium text-foreground mb-2">
        {t("supervisor.weekDetails")}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/30">
            <tr>
              <th className="px-3 py-2 text-right font-medium text-foreground whitespace-nowrap">
                {t("supervisor.dayHeader")}
              </th>
              <th className="px-3 py-2 text-right font-medium text-foreground whitespace-nowrap">
                {t("supervisor.dateHeader")}
              </th>
              <th className="px-3 py-2 text-right font-medium text-foreground whitespace-nowrap">
                {t("supervisor.reportStatus")}
              </th>
              <th className="px-3 py-2 text-right font-medium text-foreground whitespace-nowrap">
                {t("supervisor.memorizationPages")}
              </th>
              <th className="px-3 py-2 text-right font-medium text-foreground whitespace-nowrap">
                {t("supervisor.reviewPages")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {ordered.map((entry) => (
              <tr key={entry.dayKey}>
                <td className="px-3 py-2 text-foreground whitespace-nowrap">
                  {t(weekdayKey(entry.date))}
                </td>
                <td className="px-3 py-2 text-muted tabular-nums whitespace-nowrap">
                  {shortDate(entry.date)}
                </td>
                <td className="px-3 py-2">
                  <Badge variant={entry.reported ? "success" : "destructive"}>
                    {entry.reported
                      ? t("supervisor.submitted")
                      : t("supervisor.notSubmitted")}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-foreground tabular-nums">
                  {entry.reported && entry.memorization > 0
                    ? entry.memorization
                    : t("supervisor.noPages")}
                </td>
                <td className="px-3 py-2 text-foreground tabular-nums">
                  {entry.reported && entry.review > 0
                    ? entry.review
                    : t("supervisor.noPages")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** 7 dots, oldest→newest. Filled = had a report that day. */
function DotStrip({ days }: { days: boolean[] }) {
  return (
    <div className="flex items-center gap-1">
      {days.map((reported, i) => (
        <span
          key={i}
          className={
            "inline-block w-2.5 h-2.5 rounded-full " +
            (reported ? "bg-emerald-500" : "bg-muted/60")
          }
        />
      ))}
    </div>
  );
}

export default SupervisorDashboard;
