import {Component, Input} from '@angular/core';
import {GameStat, Level, LevelTime} from "../domain/game.models";

/** A polyline for one team's progress, plus its legend entry. */
interface ChartSeries {
  teamId: number;
  teamName: string;
  color: string;
  /** SVG path data in plot coordinates. */
  d: string;
}

/** A gridline + label on an axis, already placed in SVG coordinates. */
interface AxisTick {
  pos: number;
  label: string;
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

const X_STEPS_MIN = [5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240, 360];

/**
 * Draws each team's level progress over a completed game as a step line:
 * x is minutes since the game start, y is the level the team is on. While a team
 * sits on a level, every time-hint it was shown raises the line a little — a small
 * "stair" — so a long climb of stairs reads as a team that was stuck.
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

  private invalidate(): void {
    this.cachedModel = undefined;
  }

  private emptyModel(): ChartModel {
    return {
      series: [], xTicks: [], yTicks: [],
      width: PAD_LEFT + PLOT_W + PAD_RIGHT,
      height: PAD_TOP + PLOT_H + PAD_BOTTOM,
      plotLeft: PAD_LEFT, plotRight: PAD_LEFT + PLOT_W,
      plotTop: PAD_TOP, plotBottom: PAD_TOP + PLOT_H,
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
    const raw: {teamId: number; teamName: string; points: [number, number][]}[] = [];

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
        }

        if (nextMs !== undefined) {
          const xNext = (nextMs - origin) / MIN_MS;
          xMax = Math.max(xMax, xNext);
          // Carry the (possibly raised) line to the moment they level up; the next
          // iteration's first point at xNext draws the vertical jump.
          points.push([xNext, curY]);
        }
      }

      if (points.length > 0) {
        raw.push({teamId: this.teamIdOf(levelTimes), teamName: this.teamNameOf(levelTimes), points});
      }
    }

    if (raw.length === 0 || xMax <= 0) {
      return this.emptyModel();
    }

    const xStep = this.niceXStep(xMax);
    const xMaxDomain = Math.max(Math.ceil(xMax / xStep) * xStep, xStep);
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
    }));

    const xTicks: AxisTick[] = [];
    for (let t = 0; t <= xMaxDomain + 1e-6; t += xStep) {
      xTicks.push({pos: sx(t), label: this.formatElapsed(t)});
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

  private niceXStep(xMax: number): number {
    for (const step of X_STEPS_MIN) {
      if (xMax / step <= 8) {
        return step;
      }
    }
    return X_STEPS_MIN[X_STEPS_MIN.length - 1];
  }

  /** Elapsed minutes since start, formatted as H:MM (e.g. 90 -> "1:30"). */
  private formatElapsed(minutes: number): string {
    const total = Math.round(minutes);
    const h = Math.floor(total / 60);
    const m = total % 60;
    return `${h}:${String(m).padStart(2, '0')}`;
  }

  private parseMs(value: string | Date | undefined): number | undefined {
    if (!value) {
      return undefined;
    }
    const parsed = Date.parse(String(value));
    return Number.isNaN(parsed) ? undefined : parsed;
  }
}
