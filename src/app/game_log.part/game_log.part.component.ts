import {Component, Input} from '@angular/core';
import {GameStat, Keys, KeyType, Level, LevelTime} from "../domain/game.models";

@Component({
  selector: 'app-game-log-part',
  standalone: true,
  templateUrl: './game_log.part.component.html',
  styleUrl: './game_log.part.component.scss',
})
export class GameLogPartComponent {
  @Input() keys: Keys | undefined;
  @Input() stat: GameStat | undefined;
  @Input() levels: Level[] = [];
  @Input() openKeys = false;
  @Input() openStat = false;

  toLocal(dt: string): string {
    return new Date(Date.parse(dt)).toLocaleTimeString();
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
