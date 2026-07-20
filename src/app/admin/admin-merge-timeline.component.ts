import {Component, EventEmitter, Input, OnChanges, Output, SimpleChanges} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {TeamDetails, TeamMemberPermissions, TeamPlayerHistory} from '../team/team.models';
import {MergeTimelineItem, WaiverPoint} from './admin.models';

/** Editable timeline entry; dates are `datetime-local` values, `open` = still in the team. */
interface TimelineRow {
  uid: number;
  teamId: number | null;
  joined: string;
  left: string;
  /** "По настоящее время": the player is still in the team, `left` is ignored. */
  open: boolean;
  role: string;
  emoji: string;
  permissions: TeamMemberPermissions;
  /** Permissions panel expanded in the UI. */
  showPermissions: boolean;
  invalid: boolean;
}

function emptyPermissions(): TeamMemberPermissions {
  return {
    can_manage_waivers: false,
    can_manage_players: false,
    can_change_team_name: false,
    can_add_players: false,
    can_remove_players: false,
  };
}

/** A bar on the Gantt-style chart, positioned in percent of the time domain. */
interface ChartBar {
  /** uid of the editable row behind the bar; absent for waiver-point bars. */
  rowUid?: number;
  leftPct: number;
  widthPct: number;
  color: string;
  label: string;
  title: string;
  openEnded: boolean;
  invalid: boolean;
  /** Bar too narrow to hold its label — render the label beside it instead. */
  labelOutside: boolean;
  /** Outside label would overflow the right edge — draw it to the left of the bar. */
  labelFlipped: boolean;
}

interface ChartTick {
  leftPct: number;
  label: string;
}

export interface TimelineState {
  items: MergeTimelineItem[];
  valid: boolean;
}

const TEAM_COLORS = ['#2563eb', '#16a34a', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#65a30d', '#dc2626'];

/** Sentinel for "still in the team" interval ends. */
const OPEN_END = Number.MAX_SAFE_INTEGER;

const HOUR_MS = 3600 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** A resolved membership segment of the auto-built timeline. */
interface AutoSegment {
  teamId: number;
  from: number;
  to: number;
}

/**
 * Editor for the manual merge timeline: a chart of the proposed membership
 * intervals against the waiver-locked intervals, plus editable rows.
 * Presentational — the parent owns loading and submission.
 */
@Component({
  selector: 'app-admin-merge-timeline',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './admin-merge-timeline.component.html',
  styleUrl: './admin-merge-timeline.component.scss',
})
export class AdminMergeTimelineComponent implements OnChanges {
  /** Combined team history of both players, used to prefill the editable rows. */
  @Input({required: true}) history: TeamPlayerHistory[] = [];
  /** Waiver points of both players — locked intervals the timeline must respect. */
  @Input({required: true}) points: WaiverPoint[] = [];
  /** Last merge rejection from the server, shown next to the editor. */
  @Input() serverError: string | null = null;

  @Output() timelineChange = new EventEmitter<TimelineState>();

  rows: TimelineRow[] = [];
  teams: TeamDetails[] = [];
  issues: string[] = [];
  rowBars: ChartBar[] = [];
  pointBars: ChartBar[] = [];
  ticks: ChartTick[] = [];
  skippedDeletedTeams = false;
  /** uids of rows selected on the chart (click), for the join action. */
  selected = new Set<number>();

  readonly permissionDefs: {key: keyof TeamMemberPermissions; label: string}[] = [
    {key: 'can_manage_waivers', label: 'подавать вейверы'},
    {key: 'can_manage_players', label: 'управлять игроками'},
    {key: 'can_change_team_name', label: 'менять название'},
    {key: 'can_add_players', label: 'добавлять игроков'},
    {key: 'can_remove_players', label: 'удалять игроков'},
  ];

  private nextUid = 1;
  private teamColors = new Map<number, string>();
  /** Time domain of the chart in ms; frozen while a resize drag is active. */
  private chartStart = 0;
  private chartSpan = 0;
  private resizing: {uid: number; edge: 'left' | 'right'; rect: DOMRect} | null = null;
  /** Swallow the synthetic click that follows a resize drag so it doesn't toggle selection. */
  private suppressClick = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['history'] || changes['points']) {
      this.reset();
    }
  }

  /** Rebuild the rows from the players' current histories, dropping any edits. */
  reset(): void {
    this.selected.clear();
    this.collectTeams();
    this.skippedDeletedTeams = this.history.some((entry) => entry.team === null);
    this.rows = this.history
      .filter((entry) => entry.team !== null)
      .sort((a, b) => Date.parse(a.date_joined) - Date.parse(b.date_joined))
      .map((entry) => ({
        uid: this.nextUid++,
        teamId: entry.team!.id,
        joined: isoToLocalInput(entry.date_joined),
        left: entry.date_left ? isoToLocalInput(entry.date_left) : '',
        open: !entry.date_left,
        role: entry.role ?? '',
        emoji: entry.emoji ?? '',
        permissions: emptyPermissions(),
        showPermissions: false,
        invalid: false,
      }));
    this.rebuild();
  }

  /**
   * Build a default timeline automatically: waiver points are coalesced into
   * blocks (adjacent points of the same team are joined) that override the
   * membership, and the time around them is filled from the players' original
   * histories — earlier entries in `history` (the primary player) win overlaps.
   * E.g. team1 2010—2020 with a team2 game in June 2015 becomes
   * team1 → team2 (waiver block) → team1.
   */
  autoBuild(): void {
    this.selected.clear();
    this.rows = this.buildAutoTimeline().map((seg) => {
      const source = this.latestHistoryEntry(seg.teamId);
      return {
        uid: this.nextUid++,
        teamId: seg.teamId,
        joined: isoToLocalInput(new Date(seg.from).toISOString()),
        left: seg.to === OPEN_END ? '' : isoToLocalInput(new Date(seg.to).toISOString()),
        open: seg.to === OPEN_END,
        role: source?.role ?? '',
        emoji: source?.emoji ?? '',
        permissions: emptyPermissions(),
        showPermissions: false,
        invalid: false,
      };
    });
    this.rebuild();
  }

  addRow(): void {
    this.rows.push({
      uid: this.nextUid++, teamId: null, joined: '', left: '', open: false,
      role: '', emoji: '', permissions: emptyPermissions(), showPermissions: false, invalid: false,
    });
    this.rebuild();
  }

  /** Keep the rows in chronological order; rows without a start date go last. */
  resortRows(): void {
    this.rows.sort((a, b) => {
      const aMs = a.joined ? Date.parse(a.joined) : Number.POSITIVE_INFINITY;
      const bMs = b.joined ? Date.parse(b.joined) : Number.POSITIVE_INFINITY;
      return aMs - bMs;
    });
    this.rebuild();
  }

  removeRow(row: TimelineRow): void {
    this.rows = this.rows.filter((r) => r !== row);
    this.selected.delete(row.uid);
    this.rebuild();
  }

  onRowChange(): void {
    this.rebuild();
  }

  isSelected(bar: ChartBar): boolean {
    return bar.rowUid !== undefined && this.selected.has(bar.rowUid);
  }

  isRowSelected(row: TimelineRow): boolean {
    return this.selected.has(row.uid);
  }

  /** Click on a bar toggles its selection (Ctrl not required, so it also works on touch). */
  onBarClick(bar: ChartBar): void {
    if (this.suppressClick) {
      this.suppressClick = false;
      return;
    }
    if (bar.rowUid === undefined) return;
    if (this.selected.has(bar.rowUid)) {
      this.selected.delete(bar.rowUid);
    } else {
      this.selected.add(bar.rowUid);
    }
  }

  /** Double-click on a bar splits its interval in two at the cursor position. */
  onBarDblClick(bar: ChartBar, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (bar.rowUid === undefined) return;
    const row = this.rows.find((r) => r.uid === bar.rowUid);
    const at = this.timeAtEvent(event);
    if (!row || at === null) return;

    const joinedMs = Date.parse(row.joined);
    const leftMs = !row.open && row.left ? Date.parse(row.left) : null;
    let split = snapToHour(at);
    split = Math.max(split, joinedMs + HOUR_MS);
    if (leftMs !== null) split = Math.min(split, leftMs - HOUR_MS);
    if (split <= joinedMs || (leftMs !== null && split >= leftMs)) return; // too narrow to split

    // Both halves keep the original interval's team, role, emoji and permissions.
    const splitValue = isoToLocalInput(new Date(split).toISOString());
    const second: TimelineRow = {
      uid: this.nextUid++, teamId: row.teamId, joined: splitValue, left: row.left, open: row.open,
      role: row.role, emoji: row.emoji, permissions: {...row.permissions}, showPermissions: false, invalid: false,
    };
    row.left = splitValue;
    row.open = false;
    this.rows.splice(this.rows.indexOf(row) + 1, 0, second);
    this.rebuild();
  }

  /** Double-click on empty chart space adds a month-long interval starting there. */
  onChartDblClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).closest('.chart-bar, .bar-outside-label')) return;
    const at = this.timeAtEvent(event);
    if (at === null) return;
    const from = snapToHour(at);
    this.rows.push({
      uid: this.nextUid++,
      teamId: null,
      joined: isoToLocalInput(new Date(from).toISOString()),
      left: isoToLocalInput(new Date(from + 30 * DAY_MS).toISOString()),
      open: false,
      role: '',
      emoji: '',
      permissions: emptyPermissions(),
      showPermissions: false,
      invalid: false,
    });
    this.resortRows();
  }

  /**
   * Merge the selected intervals into one: min start, max end (open if any is
   * open); team, role, emoji and permissions are taken from the latest interval.
   */
  joinSelected(): void {
    const chosen = this.rows
      .filter((row) => this.selected.has(row.uid) && row.joined)
      .sort((a, b) => Date.parse(a.joined) - Date.parse(b.joined));
    if (chosen.length < 2) return;
    const target = chosen[0];
    const latest = chosen[chosen.length - 1];
    if (chosen.some((row) => row.open || !row.left)) {
      target.left = '';
      target.open = true;
    } else {
      // datetime-local strings compare lexicographically in chronological order
      target.left = chosen.map((row) => row.left).sort().pop()!;
      target.open = false;
    }
    target.teamId = latest.teamId;
    target.role = latest.role;
    target.emoji = latest.emoji;
    target.permissions = {...latest.permissions};
    this.rows = this.rows.filter((row) => row === target || !this.selected.has(row.uid));
    this.selected.clear();
    this.rebuild();
  }

  clearSelection(): void {
    this.selected.clear();
  }

  startResize(bar: ChartBar, edge: 'left' | 'right', event: PointerEvent): void {
    if (bar.rowUid === undefined) return;
    const chart = (event.target as HTMLElement).closest('.chart');
    if (!chart) return;
    event.preventDefault();
    event.stopPropagation();
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    this.resizing = {uid: bar.rowUid, edge, rect: chart.getBoundingClientRect()};
  }

  onResizeMove(event: PointerEvent): void {
    if (!this.resizing || this.chartSpan <= 0) return;
    const {uid, edge, rect} = this.resizing;
    const row = this.rows.find((r) => r.uid === uid);
    if (!row) return;
    const at = snapToHour(this.chartStart + ((event.clientX - rect.left) / rect.width) * this.chartSpan);
    if (edge === 'left') {
      const leftMs = !row.open && row.left ? Date.parse(row.left) : null;
      const clamped = leftMs !== null ? Math.min(at, leftMs - HOUR_MS) : at;
      row.joined = isoToLocalInput(new Date(clamped).toISOString());
    } else {
      const clamped = Math.max(at, Date.parse(row.joined) + HOUR_MS);
      row.left = isoToLocalInput(new Date(clamped).toISOString());
      row.open = false;
    }
    this.rebuild();
  }

  endResize(): void {
    if (!this.resizing) return;
    this.resizing = null;
    // The click that follows the drag may or may not reach the bar depending on
    // pointer-capture retargeting — swallow it if it does, self-clear if it doesn't.
    this.suppressClick = true;
    setTimeout(() => (this.suppressClick = false));
    this.resortRows(); // dates changed — reorder and recompute the un-frozen time domain
  }

  /** Timestamp under the cursor, or null when the chart geometry is unknown. */
  private timeAtEvent(event: MouseEvent): number | null {
    const chart = (event.target as HTMLElement).closest('.chart');
    if (!chart || this.chartSpan <= 0) return null;
    const rect = chart.getBoundingClientRect();
    return this.chartStart + ((event.clientX - rect.left) / rect.width) * this.chartSpan;
  }

  hasPermissions(row: TimelineRow): boolean {
    return Object.values(row.permissions).some(Boolean);
  }

  togglePermissions(row: TimelineRow): void {
    row.showPermissions = !row.showPermissions;
  }

  /** Latest membership of either player in the team — the source for default role/emoji. */
  private latestHistoryEntry(teamId: number): TeamPlayerHistory | null {
    let latest: TeamPlayerHistory | null = null;
    for (const entry of this.history) {
      if (entry.team?.id !== teamId) continue;
      if (!latest || Date.parse(entry.date_joined) > Date.parse(latest.date_joined)) {
        latest = entry;
      }
    }
    return latest;
  }

  teamColor(teamId: number | null): string {
    return (teamId !== null && this.teamColors.get(teamId)) || 'var(--tg-theme-hint-color, #6b7280)';
  }

  teamName(teamId: number | null): string {
    return this.teams.find((t) => t.id === teamId)?.name ?? '?';
  }

  pointLabel(point: WaiverPoint): string {
    return `«${point.game.name}» — ${point.team.name}`;
  }

  /** Teams the admin can pick: everything seen in either history plus waiver-point teams. */
  private collectTeams(): void {
    const byId = new Map<number, TeamDetails>();
    for (const entry of this.history) {
      if (entry.team) byId.set(entry.team.id, entry.team);
    }
    for (const point of this.points) {
      byId.set(point.team.id, point.team);
    }
    this.teams = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
    this.teamColors = new Map(this.teams.map((team, i) => [team.id, TEAM_COLORS[i % TEAM_COLORS.length]]));
  }

  /** Revalidate, redraw the chart and notify the parent about the current timeline. */
  private rebuild(): void {
    this.validate();
    this.buildChart();
    this.timelineChange.emit({
      items: this.sortedCompleteRows().map((row) => {
        const item: MergeTimelineItem = {
          team_id: row.teamId!,
          date_joined: localInputToIso(row.joined),
          date_left: !row.open && row.left ? localInputToIso(row.left) : null,
        };
        if (row.role.trim()) item.role = row.role.trim();
        if (row.emoji.trim()) item.emoji = row.emoji.trim();
        if (Object.values(row.permissions).some(Boolean)) item.permissions = {...row.permissions};
        return item;
      }),
      valid: this.issues.length === 0 && this.rows.length > 0,
    });
  }

  /** Client-side mirror of the backend validation rules, for instant feedback. */
  private validate(): void {
    const issues: string[] = [];
    for (const row of this.rows) {
      row.invalid = false;
    }

    if (this.rows.length === 0) {
      issues.push('Таймлайн пуст — добавьте хотя бы один интервал.');
    }

    const incomplete = (row: TimelineRow) => row.teamId === null || !row.joined || (!row.open && !row.left);
    for (const row of this.rows) {
      if (incomplete(row)) {
        row.invalid = true;
      } else if (!row.open && Date.parse(row.left) <= Date.parse(row.joined)) {
        row.invalid = true;
        issues.push(`Интервал «${this.teamName(row.teamId)}» заканчивается раньше, чем начинается.`);
      }
    }
    if (this.rows.some(incomplete)) {
      issues.push('У каждого интервала должны быть команда, дата вступления и дата выхода (или отметка «по настоящее время»).');
    }

    const sorted = this.sortedCompleteRows();
    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i];
      const next = sorted[i + 1];
      if (!current.open && !current.left) continue; // already flagged as incomplete
      if (current.open || Date.parse(current.left) > Date.parse(next.joined)) {
        current.invalid = true;
        next.invalid = true;
        issues.push(
          `Интервалы «${this.teamName(current.teamId)}» и «${this.teamName(next.teamId)}» пересекаются `
          + '(«по настоящее время» может быть только последний).',
        );
      }
    }

    for (const point of this.points) {
      const covered = sorted.some((row) =>
        row.teamId === point.team.id
        && Date.parse(row.joined) <= Date.parse(point.at_since)
        && (row.open || (row.left !== '' && Date.parse(row.left) >= Date.parse(point.at_until))),
      );
      if (!covered) {
        issues.push(
          `Вейвер игры «${point.game.name}»: с ${formatMoment(point.at_since)} по ${formatMoment(point.at_until)} `
          + `игрок должен состоять в команде «${point.team.name}».`,
        );
      }
    }

    this.issues = issues;
  }

  private buildAutoTimeline(): AutoSegment[] {
    // Waiver blocks: sorted points, adjacent points of the same team joined into one block.
    // Bounds are snapped outward to whole minutes (datetime-local precision) so the
    // resulting intervals still cover the exact point timestamps.
    const blocks: AutoSegment[] = [];
    const sortedPoints = [...this.points].sort((a, b) => Date.parse(a.at_since) - Date.parse(b.at_since));
    for (const point of sortedPoints) {
      const since = floorToMinute(Date.parse(point.at_since));
      const until = ceilToMinute(Date.parse(point.at_until));
      const last = blocks[blocks.length - 1];
      if (last && last.teamId === point.team.id) {
        last.to = Math.max(last.to, until);
      } else {
        blocks.push({teamId: point.team.id, from: since, to: until});
      }
    }

    // History entries in input order: the primary player's entries come first and win overlaps.
    const memberships = this.history
      .filter((entry) => entry.team !== null)
      .map((entry) => ({
        teamId: entry.team!.id,
        from: floorToMinute(Date.parse(entry.date_joined)),
        to: entry.date_left ? floorToMinute(Date.parse(entry.date_left)) : OPEN_END,
      }));

    // Sweep over elementary intervals between all boundaries; a waiver block dictates
    // the team inside it, otherwise the first covering membership does.
    const bounds = new Set<number>();
    for (const seg of [...blocks, ...memberships]) {
      bounds.add(seg.from);
      if (seg.to !== OPEN_END) bounds.add(seg.to);
    }
    const sortedBounds = [...bounds].sort((a, b) => a - b);
    if (memberships.some((m) => m.to === OPEN_END)) sortedBounds.push(OPEN_END);

    const segments: AutoSegment[] = [];
    for (let i = 0; i < sortedBounds.length - 1; i++) {
      const from = sortedBounds[i];
      const to = sortedBounds[i + 1];
      const covering = blocks.find((b) => b.from <= from && b.to >= to)
        ?? memberships.find((m) => m.from <= from && m.to >= to);
      if (!covering) continue;
      const last = segments[segments.length - 1];
      if (last && last.teamId === covering.teamId && last.to === from) {
        last.to = to;
      } else {
        segments.push({teamId: covering.teamId, from, to});
      }
    }
    return segments;
  }

  private sortedCompleteRows(): TimelineRow[] {
    return this.rows
      .filter((row) => row.teamId !== null && row.joined)
      .sort((a, b) => Date.parse(a.joined) - Date.parse(b.joined));
  }

  private buildChart(): void {
    const stamps: number[] = [];
    for (const row of this.rows) {
      if (row.joined) stamps.push(Date.parse(row.joined));
      if (!row.open && row.left) stamps.push(Date.parse(row.left));
    }
    for (const point of this.points) {
      stamps.push(Date.parse(point.at_since), Date.parse(point.at_until));
    }
    if (stamps.length === 0) {
      this.rowBars = [];
      this.pointBars = [];
      this.ticks = [];
      this.chartSpan = 0;
      return;
    }

    // Keep the domain frozen during a resize drag, otherwise the domain would
    // follow the dragged edge and the bar would chase the cursor.
    if (!this.resizing || this.chartSpan <= 0) {
      const min = Math.min(...stamps);
      const max = Math.max(Math.max(...stamps), Date.now());
      const pad = Math.max((max - min) * 0.04, DAY_MS);
      this.chartStart = min - pad;
      this.chartSpan = max + pad - this.chartStart;
    }
    const start = this.chartStart;
    const span = this.chartSpan;
    const domainEnd = start + span;
    const toPct = (ms: number) => Math.min(Math.max(((ms - start) / span) * 100, 0), 100);

    this.rowBars = this.rows
      .filter((row) => row.joined)
      .map((row) => {
        const from = Date.parse(row.joined);
        const openEnded = row.open || !row.left;
        const to = openEnded ? domainEnd : Date.parse(row.left);
        const name = this.teamName(row.teamId);
        const label = row.emoji.trim() ? `${row.emoji.trim()} ${name}` : name;
        return withLabelPlacement({
          rowUid: row.uid,
          leftPct: toPct(from),
          widthPct: Math.max(toPct(Math.max(to, from)) - toPct(from), 0.8),
          color: this.teamColor(row.teamId),
          label,
          title: `${label}: ${formatMoment(row.joined)} — ${openEnded ? 'по настоящее время' : formatMoment(row.left)}`
            + (row.role.trim() ? ` · ${row.role.trim()}` : ''),
          openEnded,
          invalid: row.invalid,
        });
      });

    this.pointBars = this.points.map((point) => {
      const from = Date.parse(point.at_since);
      const to = Date.parse(point.at_until);
      return withLabelPlacement({
        leftPct: toPct(from),
        widthPct: Math.max(toPct(to) - toPct(from), 0.8),
        color: this.teamColor(point.team.id),
        label: this.pointLabel(point),
        title: `${this.pointLabel(point)}: ${formatMoment(point.at_since)} — ${formatMoment(point.at_until)}`,
        openEnded: false,
        invalid: false,
      });
    });

    this.ticks = [];
    const tickCount = 5;
    for (let i = 0; i <= tickCount; i++) {
      const ms = start + (span * i) / tickCount;
      this.ticks.push({leftPct: (i / tickCount) * 100, label: formatDay(ms)});
    }
  }
}

function floorToMinute(ms: number): number {
  return Math.floor(ms / 60000) * 60000;
}

function snapToHour(ms: number): number {
  return Math.round(ms / HOUR_MS) * HOUR_MS;
}

function ceilToMinute(ms: number): number {
  return Math.ceil(ms / 60000) * 60000;
}

function withLabelPlacement(bar: Omit<ChartBar, 'labelOutside' | 'labelFlipped'>): ChartBar {
  const labelOutside = bar.widthPct < 15;
  return {...bar, labelOutside, labelFlipped: labelOutside && bar.leftPct + bar.widthPct > 65};
}

/** ISO datetime (UTC) → value for `<input type="datetime-local">` in the admin's timezone. */
function isoToLocalInput(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    + `T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** `datetime-local` value (admin's timezone) → ISO datetime with explicit UTC offset. */
function localInputToIso(value: string): string {
  return new Date(value).toISOString();
}

function formatMoment(value: string): string {
  return new Date(value).toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function formatDay(ms: number): string {
  return new Date(ms).toLocaleDateString('ru-RU', {day: '2-digit', month: '2-digit', year: '2-digit'});
}
