import type { EnerGovClient } from "@/lib/sources/energov";

/**
 * Editorial items are hand-authored pages for proposals that either aren't
 * captured by a structured feed yet (e.g. neighborhood-meeting notices mailed
 * by a developer before anything is filed with the city) or deserve a
 * curator's commentary on top of the raw data.
 */
export type EditorialItem = {
  kind: "editorial";
  /** URL slug under the locality, e.g. "toll-brothers-amity-happy-valley". */
  slug: string;
  label: string;
  blurb?: string;
  /** Related city application numbers, linked from the hub. */
  caseIds?: string[];
};

export type TrackedItem = EditorialItem;

/**
 * Normalised "hearing" / planning application surfaced from a locality's GIS
 * feed or case-management system. Shape is intentionally generic so other
 * cities can populate it from whatever upstream source they use.
 */
export type HearingPhase =
  | "Review"
  | "Notification"
  | "PZ Commission"
  | "City Council"
  | "Recording"
  | "Other";

/**
 * A scheduled public-hearing appearance for a single application. One hearing
 * may have several — e.g. an item continued from P&Z to a later P&Z, or that
 * passes P&Z and then goes on to City Council.
 */
export type AgendaItem = {
  title: string;
  caseIds: string[];
  agendaUrl: string;
  staffReports: { label: string; url: string }[];
};

export type AgendaMeeting = {
  id: string;
  body: string;
  bodyLabel: string;
  title: string;
  date: string;
  dateLabel: string;
  timeLabel?: string;
  location?: string;
  sourceUrl: string;
  agendaUrl?: string;
  htmlAgendaUrl?: string;
  packetUrl?: string;
  items: AgendaItem[];
};

export type ScheduledMeeting = {
  agendaUrl?: string;
  staffReports?: AgendaItem["staffReports"];
  /** Canonical body identifier, e.g. "P&Z" or "City Council". */
  body: string;
  /** Human label for the body, e.g. "Planning & Zoning Commission". */
  bodyLabel: string;
  /** ISO date (YYYY-MM-DD) the meeting is scheduled for. */
  date: string;
  /** Human-facing label, e.g. "April 28, 2026". */
  dateLabel: string;
  /** Upstream "continued to …" note, if any. */
  continuedNote: string | null;
  /** Source URL where this schedule was published. */
  sourceUrl: string;
};

export type Hearing = {
  /** True when supplied by the city’s completed-applications layer. */
  decisionRecorded?: boolean;
  /** Stable application id as displayed by the jurisdiction, e.g. "ANN-00352-2026". */
  appId: string;
  /** Short type code ("ZMA"). */
  appType: string;
  /** Human label for the type ("Zoning Map Amendment or Rezone"). */
  appTypeLabel: string;
  /** Free-form status as reported upstream. */
  appStatus: string;
  /** Normalised phase. Unknown values are mapped to "Other". */
  appPhase: HearingPhase;
  /** Raw upstream phase string if different from the normalised value. */
  appPhaseRaw: string;
  /** Project / subdivision / scope description. */
  appScope: string | null;
  /** Parcel area in acres, if known. */
  appAcres: number | null;
  /** External detail URL (typically the EnerGov portal). */
  externalUrl: string | null;
  /** EnerGov PlanId (GUID) if we can resolve one; powers on-site plan pages. */
  energovPlanId: string | null;
  /** Scheduled public-hearing appearances, sorted ascending by date. */
  meetings: ScheduledMeeting[];
};

export type HearingFeed = {
  /** Timestamp of this cached application-data snapshot. */
  refreshedAt?: string;
  scheduleUnavailable?: boolean;
  agendaMeetings?: AgendaMeeting[];
  active: Hearing[];
  completed: Hearing[];
  /**
   * Hearings that appear on the CivicPlus upcoming-hearings page but have not
   * yet been added to the ArcGIS active layer.  They are surfaced on hero cards
   * but excluded from the pipeline phase sections.
   */
  upcomingOnly?: Hearing[];
};

/**
 * Placeholder for future meeting-source integrations (P&Z agendas, city
 * council). Kept as `unknown[]` until we wire up the first provider so we
 * don't lock in an API shape prematurely.
 */
export type MeetingSourceConfig = {
  /** e.g. "civicengage", "civicclerk", ... */
  provider: string;
  /** Provider-specific config; typed per-provider when implemented. */
  config: Record<string, unknown>;
};

export type Locality = {
  slug: string;
  displayName: string;
  /** Descriptive full name for page copy ("Nampa, Idaho"). */
  fullName: string;
  /** Canonical public-portal URL, shown on listings for attribution. */
  portalUrl?: string;
  /** Attribution line rendered on pages that surface this locality's data. */
  dataAttribution?: string;
  energov?: EnerGovClient;
  /** Editorial items pinned at the top of the hub. */
  tracked: TrackedItem[];
  /** Live hearings / applications feed, if the locality provides one. */
  getHearings?: () => Promise<HearingFeed>;
  /** Reserved for future meeting providers (P&Z, city council). */
  meetingSources?: MeetingSourceConfig[];
};
