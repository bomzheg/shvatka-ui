import {Component, Input} from '@angular/core';
import {GameStat, Keys, KeyTime, KeyType, Level, LevelTime} from "../domain/game.models";
import {MatIcon} from "@angular/material/icon";
import {AppIcon} from "../ui/icons";

interface TeamPivotData {
  teamName: string;
  absoluteTimes: Map<number, string>;
  absoluteTimeMs: Map<number, number>;
  durations: Map<number, string>;
  durationMs: Map<number, number>;
}

@Component({
  selector: 'app-game-log-part',
  standalone: true,
  imports: [MatIcon],
  templateUrl: './game_log.part.component.html',
  styleUrl: './game_log.part.component.scss',
})
export class GameLogPartComponent {
  protected readonly AppIcon = AppIcon;
  private _keys: Keys | undefined;
  private _stat: GameStat | undefined;

  @Input()
  set keys(value: Keys | undefined) {
    this._keys = value;
    this.sortedTeamKeysEntries = this.buildSortedTeamKeysEntries(value);
    if (value) {
      this.keysDetailsOpen = this.keysDetailsOpen || this.openKeys;
    }
  }

  get keys(): Keys | undefined {
    return this._keys;
  }

  @Input()
  set stat(value: GameStat | undefined) {
    this._stat = value;
    this.sortedStatEntries = this.buildSortedStatEntries(value);
    this.buildPivotData();
    if (value) {
      this.statDetailsOpen = this.statDetailsOpen || this.openStat;
      this.pivotDetailsOpen = this.pivotDetailsOpen || this.openStat;
    }
  }

  get stat(): GameStat | undefined {
    return this._stat;
  }

  @Input() levels: Level[] = [];
  @Input() openKeys = false;
  @Input() openStat = false;
  @Input() isCompleted = false;

  sortedTeamKeysEntries: [string, KeyTime[]][] = [];
  sortedStatEntries: [string, LevelTime[]][] = [];
  pivotData: TeamPivotData[] = [];
  allLevelNumbers: number[] = [];
  minDurationPerLevel: Map<number, number> = new Map();
  minAbsoluteTimePerLevel: Map<number, number> = new Map();
  levelNameIds: Map<number, string> = new Map();

  keysDetailsOpen = false;
  statDetailsOpen = false;
  pivotDetailsOpen = false;
  private teamKeysOpenState: Record<string, boolean> = {};

  private buildSortedTeamKeysEntries(keys: Keys | undefined): [string, KeyTime[]][] {
    if (!keys) {
      return [];
    }

    const entries = Object.entries(keys as unknown as Record<string, KeyTime[]>);
    return entries
      .map(([teamId, teamKeys]) => [
        teamId,
        [...teamKeys].sort((a, b) => (this.parseDate(b.at) ?? 0) - (this.parseDate(a.at) ?? 0)),
      ]);
  }

  private buildSortedStatEntries(stat: GameStat | undefined): [string, LevelTime[]][] {
    if (!stat?.level_times) {
      return [];
    }

    return Object.entries(stat.level_times as unknown as Record<string, LevelTime[]>)
      .map(([teamId, levelTimes]) => [teamId, [...levelTimes]] as [string, LevelTime[]])
      .sort((a, b) => {
        const aTimes = a[1];
        const bTimes = b[1];
        const levelsDiff = bTimes.length - aTimes.length;
        if (levelsDiff !== 0) {
          return levelsDiff;
        }

        const aStartedAt = this.parseDate(aTimes[0]?.start_at) ?? Number.MAX_SAFE_INTEGER;
        const bStartedAt = this.parseDate(bTimes[0]?.start_at) ?? Number.MAX_SAFE_INTEGER;
        return aStartedAt - bStartedAt;
      });
  }

  private buildPivotData(): void {
    if (!this.sortedStatEntries.length) {
      this.pivotData = [];
      this.allLevelNumbers = [];
      this.minDurationPerLevel = new Map();
      this.minAbsoluteTimePerLevel = new Map();
      this.levelNameIds = new Map();
      return;
    }

    const allLevels = new Set<number>();
    const levelNameIds = new Map<number, string>();
    const pivotRows: TeamPivotData[] = [];

    for (const [, teamLevelTimes] of this.sortedStatEntries) {
      if (teamLevelTimes.length === 0) continue;

      const sorted = [...teamLevelTimes].sort((a, b) => a.level_number - b.level_number);
      const absoluteTimes = new Map<number, string>();
      const absoluteTimeMs = new Map<number, number>();
      const durations = new Map<number, string>();
      const durationMs = new Map<number, number>();

      for (let i = 0; i < sorted.length; i++) {
        const lt = sorted[i];
        allLevels.add(lt.level_number);
        if (lt.name_id) {
          levelNameIds.set(lt.level_number, lt.name_id);
        }

        const ms = this.parseDate(lt.start_at);

        if (i < sorted.length - 1) {
          const nextMs = this.parseDate(sorted[i + 1].start_at);
          if (nextMs !== undefined) {
            absoluteTimes.set(lt.level_number, this.toLocalHms(String(sorted[i + 1].start_at)));
            absoluteTimeMs.set(lt.level_number, nextMs);
          }
          if (ms !== undefined && nextMs !== undefined) {
            const diffMs = nextMs - ms;
            durationMs.set(lt.level_number, diffMs);
            durations.set(lt.level_number, this.formatDuration(diffMs));
          }
        }
      }

      pivotRows.push({
        teamName: sorted[0].team.name,
        absoluteTimes,
        absoluteTimeMs,
        durations,
        durationMs,
      });
    }

    const sortedLevels = [...allLevels].sort((a, b) => a - b);
    const hasData = (lvl: number) => pivotRows.some(
      row => row.absoluteTimes.has(lvl) || row.durations.has(lvl)
    );
    this.allLevelNumbers = sortedLevels.filter(hasData);
    this.pivotData = pivotRows;
    this.levelNameIds = levelNameIds;

    const minDurations = new Map<number, number>();
    const minAbsTimes = new Map<number, number>();
    for (const lvl of this.allLevelNumbers) {
      let minDur = Number.MAX_SAFE_INTEGER;
      let minAbs = Number.MAX_SAFE_INTEGER;
      for (const row of pivotRows) {
        const d = row.durationMs.get(lvl);
        if (d !== undefined && d < minDur) {
          minDur = d;
        }
        const a = row.absoluteTimeMs.get(lvl);
        if (a !== undefined && a < minAbs) {
          minAbs = a;
        }
      }
      if (minDur < Number.MAX_SAFE_INTEGER) {
        minDurations.set(lvl, minDur);
      }
      if (minAbs < Number.MAX_SAFE_INTEGER) {
        minAbsTimes.set(lvl, minAbs);
      }
    }
    this.minDurationPerLevel = minDurations;
    this.minAbsoluteTimePerLevel = minAbsTimes;
  }

  shouldOpenTeamKeys(teamKeysCount: number): boolean {
    return teamKeysCount <= 10;
  }

  toLocal(dt: string): string {
    return new Date(Date.parse(dt)).toLocaleTimeString();
  }

  toLocalHm(dt: string): string {
    return new Date(Date.parse(dt)).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
  }

  toLocalHms(dt: string): string {
    return new Date(Date.parse(dt)).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', second: '2-digit'});
  }

  formatDuration(ms: number): string {
    const totalSeconds = Math.max(Math.floor(ms / 1000), 0);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  isMinDuration(levelNumber: number, durationMs: number | undefined): boolean {
    if (durationMs === undefined) return false;
    return this.minDurationPerLevel.get(levelNumber) === durationMs;
  }

  isMinAbsoluteTime(levelNumber: number, timeMs: number | undefined): boolean {
    if (timeMs === undefined) return false;
    return this.minAbsoluteTimePerLevel.get(levelNumber) === timeMs;
  }

  keyTypeIcon(key: KeyTime): AppIcon {
    if (key.is_duplicate) {
      return AppIcon.duplicate;
    }

    switch (key.type_) {
      case KeyType.simple:
        return AppIcon.levelUp;
      case KeyType.wrong:
        return AppIcon.cancel;
      case KeyType.bonus:
        return AppIcon.bonus;
      case KeyType.effects:
        return AppIcon.effects;
      default:
        return AppIcon.unknown;
    }
  }

  /** Color class for a key in the log: correct / wrong / duplicate. */
  keyTypeClass(key: KeyTime): string {
    if (key.is_duplicate) {
      return "key-type-duplicate";
    }
    switch (key.type_) {
      case KeyType.wrong:
        return "key-type-wrong";
      case KeyType.simple:
      case KeyType.bonus:
      case KeyType.effects:
        return "key-type-correct";
      default:
        return "";
    }
  }

  isLevelChanged(keys: KeyTime[], index: number): boolean {
    if (index >= keys.length - 1) {
      return false;
    }

    return keys[index].level_number !== keys[index + 1].level_number;
  }

  getCurrentLevelNumber(teamLevelTimes: LevelTime[]): number {
    const currentLevel = teamLevelTimes[teamLevelTimes.length - 1];
    return (currentLevel?.level_number ?? 0) + 1;
  }

  getCurrentLevelNameId(teamLevelTimes: LevelTime[]): string | null {
    const currentLevel = teamLevelTimes[teamLevelTimes.length - 1];
    return currentLevel?.name_id ?? null;
  }

  getCurrentLevelLabel(teamLevelTimes: LevelTime[]): string {
    const number = this.getCurrentLevelNumber(teamLevelTimes);
    const nameId = this.getCurrentLevelNameId(teamLevelTimes);
    return nameId ? `${number}(${nameId})` : `${number}`;
  }

  getLevelNameId(levelNumber: number): string | null {
    return this.levelNameIds.get(levelNumber) ?? null;
  }

  getCurrentLevelDuration(teamLevelTimes: LevelTime[]): string {
    const currentLevel = teamLevelTimes[teamLevelTimes.length - 1];
    const startedAtMs = this.parseDate(currentLevel?.start_at);
    if (startedAtMs === undefined) {
      return "—";
    }

    const totalSeconds = Math.max(Math.floor((Date.now() - startedAtMs) / 1000), 0);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}ч ${minutes}м ${seconds}с`;
    }

    return `${minutes}м ${seconds}с`;
  }

  getLevelStartedAtTitle(teamLevelTimes: LevelTime[]): string {
    const currentLevel = teamLevelTimes[teamLevelTimes.length - 1];
    const startedAtMs = this.parseDate(currentLevel?.start_at);
    if (startedAtMs === undefined) {
      return "";
    }

    return `Уровень начался: ${new Date(startedAtMs).toLocaleTimeString()}`;
  }

  private parseDate(value: string | Date | undefined): number | undefined {
    if (!value) {
      return undefined;
    }

    const parsed = Date.parse(String(value));
    return Number.isNaN(parsed) ? undefined : parsed;
  }

  onKeysDetailsToggle(isOpen: boolean) {
    this.keysDetailsOpen = isOpen;
  }

  onStatDetailsToggle(isOpen: boolean) {
    this.statDetailsOpen = isOpen;
  }

  onPivotDetailsToggle(isOpen: boolean) {
    this.pivotDetailsOpen = isOpen;
  }

  onTeamKeysToggle(teamId: string, isOpen: boolean) {
    this.teamKeysOpenState[teamId] = isOpen;
  }

  isTeamKeysOpen(teamId: string, teamKeysCount: number): boolean {
    if (this.teamKeysOpenState[teamId] !== undefined) {
      return this.teamKeysOpenState[teamId];
    }

    const shouldOpen = this.shouldOpenTeamKeys(teamKeysCount);
    this.teamKeysOpenState[teamId] = shouldOpen;
    return shouldOpen;
  }

  protected readonly KeyType = KeyType;
  protected readonly Object = Object;
}
