import {Component, Input} from '@angular/core';
import {GameStat, Level, LevelTime} from "../domain/game.models";

/** A single time-hint that fired while a team sat on a level. */
interface FiredHint {
  /** Elapsed minutes (from game start) when the hint was shown. */
  atMin: number;
  /** The hint's own schedule, i.e. minutes after entering the level. */
  minute: number;
  /** Line height (level units) right after this hint's stair. */
  yAfter: number;
}

/** One level a team occupied, used for snap-to-line hit testing. */
interface LevelSpan {
  /** Displayed level number (1-based). */
  level: number;
  startMin: number;
  /** Elapsed minutes when the team left the level, or undefined for the last. */
  endMin: number | undefined;
  firedHints: FiredHint[];
}

/** A polyline for one team's progress, plus its legend entry and hit-test data. */
interface ChartSeries {
  teamId: number;
  teamName: string;
  color: string;
  /** SVG path data in plot coordinates. */
  d: string;
  spans: LevelSpan[];
}

/** A gridline + label on an axis, already placed in SVG coordinates. */
interface AxisTick {
  pos: number;
  label: string;
}

/** Snapped crosshair readout for the team line nearest the cursor. */
interface HoverInfo {
  x: number;
  y: number;
  color: string;
  team: string;
  time: string;
  level: string;
  labelX: number;
  labelAnchor: 'start' | 'end';
}

interface ChartModel {
  series: ChartSeries[];
  xTicks: AxisTick[];
  yTicks: AxisTick[];
  width: number;
  height: number;
  plotLeft: number;
  plotRight: number;
  plotTop: number;
  plotBottom: number;
  /** Inverse-scale inputs so pointer coordinates can be mapped back to data. */
  xMaxDomain: number;
  yMaxDomain: number;
  originMs: number;
  hasData: boolean;
}

const PAD_LEFT = 46;
const PAD_RIGHT = 16;
const PAD_TOP = 16;
const PAD_BOTTOM = 44;
const PLOT_W = 620;
const PLOT_H = 380;

const MIN_MS = 60_000;

// matplotlib's default "tab10" cycle, so the result reads like the reference charts.
const PALETTE = [
  '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
  '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
];

/**
 * Draws each team's level progress over a completed game as a step line:
 * x is wall-clock time (the plot is anchored at the game's start_at and the
 * gridlines fall on round clock boundaries), y is the level the team is on.
 * While a team sits on a level, every time-hint it was shown raises the line a
 * little — a small "stair" — so a long climb of stairs reads as a team stuck.
 *
 * Hint stair height follows the game rules: 0.1 of a level per hint when a level
 * has up to 5 hints, otherwise the hints share 0.5 of a level between them. The
 * level-prompt hint at minute 0 is not counted.
 *
 * Everything is computed from data already on the client (game start, per-team
 * {@link LevelTime}s, and each level's `time_hints`), so no extra request is made.
 */
@Component({
  selector: 'app-game-chart-part',
  standalone: true,
  imports: [],
  templateUrl: './game_chart.part.component.html',
  styleUrl: './game_chart.part.component.scss',
})
export class GameChartPartComponent {
  private _stat: GameStat | undefined;
  private _levels: Level[] = [];
  private _gameStartAt: string | undefined;

  private cachedKey: string | undefined;
  private cachedModel: ChartModel | undefined;

  @Input()
  set stat(value: GameStat | undefined) {
    this._stat = value;
    this.invalidate();
  }

  @Input()
  set levels(value: Level[]) {
    this._levels = value ?? [];
    this.invalidate();
  }

  @Input()
  set gameStartAt(value: string | undefined) {
    this._gameStartAt = value;
    this.invalidate();
  }

  get model(): ChartModel {
    if (this.cachedModel === undefined) {
      this.cachedModel = this.build();
    }
    return this.cachedModel;
  }

  hasData(): boolean {
    return this.model.hasData;
  }

  /** Teams the user has isolated via the legend. Empty means "show all". */
  private selectedTeams = new Set<number>();

  /**
   * Legend click filtering:
   * - plain click on an unselected team isolates it (shows only that team);
   * - plain click on an already-selected team clears the filter (shows all);
   * - ctrl/⌘+click toggles a team in or out of the current selection.
   */
  onLegendClick(teamId: number, event: MouseEvent): void {
    const multi = event.ctrlKey || event.metaKey;
    if (multi) {
      const next = new Set(this.selectedTeams);
      if (next.has(teamId)) {
        next.delete(teamId);
      } else {
        next.add(teamId);
      }
      this.selectedTeams = next;
      return;
    }

    this.selectedTeams = this.selectedTeams.has(teamId) ? new Set() : new Set([teamId]);
    this.hover = null;
  }

  hasSelection(): boolean {
    return this.selectedTeams.size > 0;
  }

  isSelected(teamId: number): boolean {
    return this.selectedTeams.has(teamId);
  }

  /** A team's line is drawn when nothing is filtered, or it is in the selection. */
  isVisible(teamId: number): boolean {
    return this.selectedTeams.size === 0 || this.selectedTeams.has(teamId);
  }

  private invalidate(): void {
    this.cachedModel = undefined;
    this.selectedTeams = new Set();
    this.hover = null;
  }

  /** Snapped crosshair readout, or null when the pointer is off the plot. */
  hover: HoverInfo | null = null;

  /**
   * Tracks the pointer over the plot, snaps to the nearest visible team line at
   * the cursor's time, and builds the crosshair readout (team, clock time, level
   * and active hint). Works for mouse and for touch-drag.
   */
  onPointerMove(event: PointerEvent): void {
    const model = this.model;
    if (!model.hasData) {
      return;
    }
    const svg = event.currentTarget as SVGSVGElement;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return;
    }
    const svgX = (event.clientX - rect.left) * (model.width / rect.width);
    const svgY = (event.clientY - rect.top) * (model.height / rect.height);
    if (svgX < model.plotLeft || svgX > model.plotRight || svgY < model.plotTop || svgY > model.plotBottom) {
      this.hover = null;
      return;
    }

    const plotW = model.plotRight - model.plotLeft;
    const plotH = model.plotBottom - model.plotTop;
    const xMin = ((svgX - model.plotLeft) / plotW) * model.xMaxDomain;
    const toSvgY = (level: number) => model.plotBottom - ((level - 1) / (model.yMaxDomain - 1)) * plotH;

    let best: {series: ChartSeries; y: number; level: number; hintMinute: number | null; svgY: number} | null = null;
    for (const series of model.series) {
      if (!this.isVisible(series.teamId)) {
        continue;
      }
      const at = this.evalAt(series, xMin);
      if (!at) {
        continue;
      }
      const candidateSvgY = toSvgY(at.y);
      if (best === null || Math.abs(candidateSvgY - svgY) < Math.abs(best.svgY - svgY)) {
        best = {series, y: at.y, level: at.level, hintMinute: at.hintMinute, svgY: candidateSvgY};
      }
    }
    if (best === null) {
      this.hover = null;
      return;
    }

    const snapX = model.plotLeft + (xMin / model.xMaxDomain) * plotW;
    const nearRightEdge = snapX > model.plotRight - 140;
    this.hover = {
      x: snapX,
      y: best.svgY,
      color: best.series.color,
      team: best.series.teamName,
      time: this.formatClock(model.originMs + xMin * MIN_MS),
      level: `Ур.${best.level}` + (best.hintMinute !== null ? ` h${best.hintMinute}` : ''),
      labelX: nearRightEdge ? snapX - 8 : snapX + 8,
      labelAnchor: nearRightEdge ? 'end' : 'start',
    };
  }

  onPointerLeave(): void {
    this.hover = null;
  }

  /** Level height (and active hint) of a team's step line at a given elapsed minute. */
  private evalAt(series: ChartSeries, xMin: number): {y: number; level: number; hintMinute: number | null} | null {
    const spans = series.spans;
    if (spans.length === 0) {
      return null;
    }
    if (xMin < spans[0].startMin) {
      return {y: spans[0].level, level: spans[0].level, hintMinute: null};
    }

    let span = spans[spans.length - 1];
    for (const candidate of spans) {
      const end = candidate.endMin ?? Number.POSITIVE_INFINITY;
      if (xMin >= candidate.startMin && xMin < end) {
        span = candidate;
        break;
      }
    }

    let y = span.level;
    let hintMinute: number | null = null;
    for (const fired of span.firedHints) {
      if (fired.atMin <= xMin) {
        y = fired.yAfter;
        hintMinute = fired.minute;
      } else {
        break;
      }
    }
    return {y, level: span.level, hintMinute};
  }

  private emptyModel(): ChartModel {
    return {
      series: [], xTicks: [], yTicks: [],
      width: PAD_LEFT + PLOT_W + PAD_RIGHT,
      height: PAD_TOP + PLOT_H + PAD_BOTTOM,
      plotLeft: PAD_LEFT, plotRight: PAD_LEFT + PLOT_W,
      plotTop: PAD_TOP, plotBottom: PAD_TOP + PLOT_H,
      xMaxDomain: 1, yMaxDomain: 2, originMs: 0,
      hasData: false,
    };
  }

  private build(): ChartModel {
    const entries = this.statEntries();
    if (entries.length === 0) {
      return this.emptyModel();
    }

    const hintTimesByName = new Map<string, number[]>();
    const hintTimesByNumber = new Map<number, number[]>();
    this._levels.forEach((level, index) => {
      // Minutes after a team enters the level, excluding the minute-0 prompt.
      const times = (level.scenario?.time_hints ?? [])
        .map(th => th.time)
        .filter(t => t > 0)
        .sort((a, b) => a - b);
      if (level.name_id) {
        hintTimesByName.set(level.name_id, times);
      }
      const numberKey = typeof level.number_in_game === 'number' ? level.number_in_game : index;
      hintTimesByNumber.set(numberKey, times);
    });

    const origin = this.resolveOrigin(entries);

    let xMax = 0;
    let yMax = 1;
    const raw: {teamId: number; teamName: string; points: [number, number][]; spans: LevelSpan[]}[] = [];

    for (const [, levelTimes] of entries) {
      const sorted = [...levelTimes].sort((a, b) => {
        const at = this.parseMs(a.start_at) ?? 0;
        const bt = this.parseMs(b.start_at) ?? 0;
        return at - bt || a.level_number - b.level_number;
      });
      if (sorted.length === 0) {
        continue;
      }

      const points: [number, number][] = [];
      const spans: LevelSpan[] = [];
      for (let i = 0; i < sorted.length; i++) {
        const lt = sorted[i];
        const startMs = this.parseMs(lt.start_at);
        if (startMs === undefined) {
          continue;
        }
        const x = (startMs - origin) / MIN_MS;
        const base = lt.level_number + 1;
        yMax = Math.max(yMax, base);
        xMax = Math.max(xMax, x);

        // Horizontal run for this level starts at its entry.
        points.push([x, base]);

        const nextMs = i + 1 < sorted.length ? this.parseMs(sorted[i + 1].start_at) : undefined;
        const hints = (lt.name_id ? hintTimesByName.get(lt.name_id) : undefined)
          ?? hintTimesByNumber.get(lt.level_number)
          ?? [];
        const n = hints.length;
        const inc = n <= 5 ? 0.1 : 0.5 / n;

        const span: LevelSpan = {
          level: base,
          startMin: x,
          endMin: nextMs !== undefined ? (nextMs - origin) / MIN_MS : undefined,
          firedHints: [],
        };

        let curY = base;
        for (const minute of hints) {
          const hintMs = startMs + minute * MIN_MS;
          // Only count hints the team actually saw before leaving the level.
          if (nextMs !== undefined && hintMs >= nextMs) {
            break;
          }
          const hx = (hintMs - origin) / MIN_MS;
          xMax = Math.max(xMax, hx);
          points.push([hx, curY]);
          curY += inc;
          points.push([hx, curY]);
          span.firedHints.push({atMin: hx, minute, yAfter: curY});
        }
        spans.push(span);

        if (nextMs !== undefined) {
          const xNext = (nextMs - origin) / MIN_MS;
          xMax = Math.max(xMax, xNext);
          // Carry the (possibly raised) line to the moment they level up; the next
          // iteration's first point at xNext draws the vertical jump.
          points.push([xNext, curY]);
        }
      }

      if (points.length > 0) {
        raw.push({teamId: this.teamIdOf(levelTimes), teamName: this.teamNameOf(levelTimes), points, spans});
      }
    }

    if (raw.length === 0 || xMax <= 0) {
      return this.emptyModel();
    }

    const xStep = this.niceXStep(xMax);
    // Domain spans from the game start (elapsed 0) to a little past the last point.
    const xMaxDomain = Math.max(xMax * 1.02, xStep / 4, 1);
    const yMaxDomain = Math.max(yMax, 2);

    const plotLeft = PAD_LEFT;
    const plotRight = PAD_LEFT + PLOT_W;
    const plotTop = PAD_TOP;
    const plotBottom = PAD_TOP + PLOT_H;

    const sx = (min: number) => plotLeft + (min / xMaxDomain) * PLOT_W;
    const sy = (level: number) => plotBottom - ((level - 1) / (yMaxDomain - 1)) * PLOT_H;

    const series: ChartSeries[] = raw.map((s, i) => ({
      teamId: s.teamId,
      teamName: s.teamName,
      color: PALETTE[i % PALETTE.length],
      d: s.points
        .map(([x, y], k) => `${k === 0 ? 'M' : 'L'} ${sx(x).toFixed(1)} ${sy(y).toFixed(1)}`)
        .join(' '),
      spans: s.spans,
    }));

    // Gridlines sit on round clock boundaries (e.g. whole hours), not on the
    // game start: a 9:37 start still gets its first tick at 10:00, then 11:00…
    const xTicks: AxisTick[] = [];
    const stepMs = xStep * MIN_MS;
    const originDate = new Date(origin);
    const localMidnight = new Date(
      originDate.getFullYear(), originDate.getMonth(), originDate.getDate(),
    ).getTime();
    const domainEndMs = origin + xMaxDomain * MIN_MS;
    let tickMs = localMidnight + Math.ceil((origin - localMidnight) / stepMs) * stepMs;
    for (; tickMs <= domainEndMs + 1; tickMs += stepMs) {
      const elapsed = (tickMs - origin) / MIN_MS;
      if (elapsed < -1e-6) {
        continue;
      }
      xTicks.push({pos: sx(elapsed), label: this.formatClock(tickMs)});
    }

    const yTicks: AxisTick[] = [];
    for (let lvl = 1; lvl <= yMaxDomain; lvl++) {
      yTicks.push({pos: sy(lvl), label: String(lvl)});
    }

    return {
      series, xTicks, yTicks,
      width: PAD_LEFT + PLOT_W + PAD_RIGHT,
      height: PAD_TOP + PLOT_H + PAD_BOTTOM,
      plotLeft, plotRight, plotTop, plotBottom,
      xMaxDomain, yMaxDomain, originMs: origin,
      hasData: true,
    };
  }

  private statEntries(): [string, LevelTime[]][] {
    const levelTimes = this._stat?.level_times;
    if (!levelTimes) {
      return [];
    }
    return Object.entries(levelTimes as unknown as Record<string, LevelTime[]>)
      .filter(([, times]) => Array.isArray(times) && times.length > 0);
  }

  private resolveOrigin(entries: [string, LevelTime[]][]): number {
    const fromGame = this.parseMs(this._gameStartAt);
    if (fromGame !== undefined) {
      return fromGame;
    }
    let min = Number.MAX_SAFE_INTEGER;
    for (const [, times] of entries) {
      for (const lt of times) {
        const ms = this.parseMs(lt.start_at);
        if (ms !== undefined && ms < min) {
          min = ms;
        }
      }
    }
    return min === Number.MAX_SAFE_INTEGER ? 0 : min;
  }

  private teamIdOf(times: LevelTime[]): number {
    return times[0]?.team?.id ?? 0;
  }

  private teamNameOf(times: LevelTime[]): string {
    return times[0]?.team?.name ?? '—';
  }

  /**
   * Picks a clock-friendly tick interval (minutes). Every candidate divides a
   * day, so ticks land on round clock times — half hours (10:00, 10:30, 11:00…)
   * for a few-hour game, whole hours for longer ones, finer steps for short ones.
   */
  private niceXStep(xMax: number): number {
    const candidates = [5, 10, 15, 30, 60, 120, 180, 240, 360];
    for (const step of candidates) {
      if (xMax / step <= 8) {
        return step;
      }
    }
    return candidates[candidates.length - 1];
  }

  /** Local wall-clock time of an absolute instant, as HH:MM (e.g. "13:00"). */
  private formatClock(ms: number): string {
    const d = new Date(ms);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  private parseMs(value: string | Date | undefined): number | undefined {
    if (!value) {
      return undefined;
    }
    const parsed = Date.parse(String(value));
    return Number.isNaN(parsed) ? undefined : parsed;
  }
}
