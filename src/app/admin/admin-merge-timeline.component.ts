import {Component, EventEmitter, Input, OnChanges, Output, SimpleChanges} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {TeamDetails, TeamPlayerHistory} from '../team/team.models';
import {MergeTimelineItem, WaiverPoint} from './admin.models';

/** Editable timeline entry; dates are `datetime-local` values, empty `left` = still in the team. */
interface TimelineRow {
  uid: number;
  teamId: number | null;
  joined: string;
  left: string;
  invalid: boolean;
}

/** A bar on the Gantt-style chart, positioned in percent of the time domain. */
interface ChartBar {
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

  private nextUid = 1;
  private teamColors = new Map<number, string>();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['history'] || changes['points']) {
      this.reset();
    }
  }

  /** Rebuild the rows from the players' current histories, dropping any edits. */
  reset(): void {
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
    this.rows = this.buildAutoTimeline().map((seg) => ({
      uid: this.nextUid++,
      teamId: seg.teamId,
      joined: isoToLocalInput(new Date(seg.from).toISOString()),
      left: seg.to === OPEN_END ? '' : isoToLocalInput(new Date(seg.to).toISOString()),
      invalid: false,
    }));
    this.rebuild();
  }

  addRow(): void {
    this.rows.push({uid: this.nextUid++, teamId: null, joined: '', left: '', invalid: false});
    this.rebuild();
  }

  removeRow(row: TimelineRow): void {
    this.rows = this.rows.filter((r) => r !== row);
    this.rebuild();
  }

  onRowChange(): void {
    this.rebuild();
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
      items: this.sortedCompleteRows().map((row) => ({
        team_id: row.teamId!,
        date_joined: localInputToIso(row.joined),
        date_left: row.left ? localInputToIso(row.left) : null,
      })),
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

    for (const row of this.rows) {
      if (row.teamId === null || !row.joined) {
        row.invalid = true;
      } else if (row.left && Date.parse(row.left) <= Date.parse(row.joined)) {
        row.invalid = true;
        issues.push(`Интервал «${this.teamName(row.teamId)}» заканчивается раньше, чем начинается.`);
      }
    }
    if (this.rows.some((row) => row.teamId === null || !row.joined)) {
      issues.push('У каждого интервала должны быть команда и дата вступления.');
    }

    const sorted = this.sortedCompleteRows();
    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i];
      const next = sorted[i + 1];
      if (!current.left || Date.parse(current.left) > Date.parse(next.joined)) {
        current.invalid = true;
        next.invalid = true;
        issues.push(
          `Интервалы «${this.teamName(current.teamId)}» и «${this.teamName(next.teamId)}» пересекаются `
          + '(открытым может быть только последний).',
        );
      }
    }

    for (const point of this.points) {
      const covered = sorted.some((row) =>
        row.teamId === point.team.id
        && Date.parse(row.joined) <= Date.parse(point.at_since)
        && (!row.left || Date.parse(row.left) >= Date.parse(point.at_until)),
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
      if (row.left) stamps.push(Date.parse(row.left));
    }
    for (const point of this.points) {
      stamps.push(Date.parse(point.at_since), Date.parse(point.at_until));
    }
    if (stamps.length === 0) {
      this.rowBars = [];
      this.pointBars = [];
      this.ticks = [];
      return;
    }

    const min = Math.min(...stamps);
    const max = Math.max(Math.max(...stamps), Date.now());
    const pad = Math.max((max - min) * 0.04, 24 * 3600 * 1000);
    const start = min - pad;
    const span = max + pad - start;
    const toPct = (ms: number) => ((ms - start) / span) * 100;

    this.rowBars = this.rows
      .filter((row) => row.joined)
      .map((row) => {
        const from = Date.parse(row.joined);
        const to = row.left ? Date.parse(row.left) : max + pad;
        const name = this.teamName(row.teamId);
        return withLabelPlacement({
          leftPct: toPct(from),
          widthPct: Math.max(toPct(Math.max(to, from)) - toPct(from), 0.8),
          color: this.teamColor(row.teamId),
          label: name,
          title: `${name}: ${formatMoment(row.joined)} — ${row.left ? formatMoment(row.left) : 'по настоящее время'}`,
          openEnded: !row.left,
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
