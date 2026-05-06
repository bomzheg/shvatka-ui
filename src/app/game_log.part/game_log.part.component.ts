import {Component, Input} from '@angular/core';
import {GameStat, Keys, KeyTime, KeyType, Level, LevelTime} from "../domain/game.models";

@Component({
  selector: 'app-game-log-part',
  standalone: true,
  templateUrl: './game_log.part.component.html',
  styleUrl: './game_log.part.component.scss',
})
export class GameLogPartComponent {
  private _keys: Keys | undefined;
  private _stat: GameStat | undefined;

  @Input()
  set keys(value: Keys | undefined) {
    this._keys = value;
    this.sortedTeamKeysEntries = this.buildSortedTeamKeysEntries(value);
  }

  get keys(): Keys | undefined {
    return this._keys;
  }

  @Input()
  set stat(value: GameStat | undefined) {
    this._stat = value;
    this.sortedStatEntries = this.buildSortedStatEntries(value);
  }

  get stat(): GameStat | undefined {
    return this._stat;
  }

  @Input() levels: Level[] = [];
  @Input() openKeys = false;
  @Input() openStat = false;

  sortedTeamKeysEntries: [string, KeyTime[]][] = [];
  sortedStatEntries: [string, LevelTime[]][] = [];

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

  shouldOpenTeamKeys(teamKeysCount: number): boolean {
    return teamKeysCount <= 10;
  }

  toLocal(dt: string): string {
    return new Date(Date.parse(dt)).toLocaleTimeString();
  }

  toLocalHm(dt: string): string {
    return new Date(Date.parse(dt)).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
  }

  keyTypeEmoji(key: KeyTime): string {
    if (key.is_duplicate) {
      return "💤";
    }

    switch (key.type_) {
      case KeyType.simple:
        return "✅";
      case KeyType.wrong:
        return "❌";
      case KeyType.bonus:
        return "💰";
      case KeyType.effects:
        return "✨"
      default:
        return "❔";
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

  protected readonly KeyType = KeyType;
  protected readonly Object = Object;
}
