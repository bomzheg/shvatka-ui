import {Component, Input} from '@angular/core';
import {GameStat, Keys, KeyType, Level, LevelTime} from "../domain/game.models";

interface LevelHeader {
  number: number;
  name: string | undefined;
}

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

  toLocal(dt: string): string {
    return new Date(Date.parse(dt)).toLocaleTimeString();
  }

  getLevelHeaders(): LevelHeader[] {
    if (this.levels.length > 0) {
      return this.levels.map(level => ({
        number: (level.number_in_game ?? 0) + 1,
        name: level.name_id,
      }));
    }

    const firstTeamWithResults = Object.values(this.stat?.level_times ?? {})
      .find(teamLevelTimes => teamLevelTimes.length > 1);

    if (!firstTeamWithResults) {
      return [];
    }

    return firstTeamWithResults
      .slice(1)
      .map((lt: LevelTime) => ({
        number: lt.level_number + 1,
        name: undefined,
      }));
  }

  protected readonly KeyType = KeyType;
  protected readonly Object = Object;
}
