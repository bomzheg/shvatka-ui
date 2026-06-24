import {TestBed} from '@angular/core/testing';

import {GameChartPartComponent} from './game_chart.part.component';
import {
  FullGame,
  GameStat,
  Level,
  LevelTime,
  Player,
  Scenario,
  Team,
  TimeHint,
} from "../domain/game.models";

const AUTHOR = new Player('author', 1, true);
const START = '2024-01-01T12:00:00Z';

function level(numberInGame: number, hintMinutes: number[]): Level {
  const hints = hintMinutes.map(m => new TimeHint(m, []));
  return new Level(numberInGame + 1, `lvl-${numberInGame}`, AUTHOR, new Scenario(`s-${numberInGame}`, hints, []), 1, numberInGame);
}

function game(levels: Level[]): FullGame {
  return new FullGame(1, AUTHOR, 'Game', 'complete', START, levels);
}

function team(id: number, name: string): Team {
  return new Team(id, name, new Player(`cap-${id}`, id, true), null);
}

/** Minutes after START. */
function at(minutes: number): Date {
  return new Date(Date.parse(START) + minutes * 60_000);
}

function levelTime(t: Team, levelNumber: number, nameId: string | null, minutes: number): LevelTime {
  return new LevelTime(levelNumber, game([]), t, levelNumber, nameId, at(minutes), false);
}

function stat(entries: Record<string, LevelTime[]>): GameStat {
  return new GameStat(entries as unknown as Map<number, LevelTime[]>);
}

function makeComponent(): GameChartPartComponent {
  return TestBed.configureTestingModule({imports: [GameChartPartComponent]})
    .createComponent(GameChartPartComponent).componentInstance;
}

describe('GameChartPartComponent', () => {
  it('reports no data when stat is empty', () => {
    const c = makeComponent();
    c.stat = undefined;
    c.levels = [];
    expect(c.hasData()).toBeFalse();
  });

  it('builds one series per team plus integer level ticks', () => {
    const a = team(1, 'Alpha');
    const b = team(2, 'Bravo');
    const c = makeComponent();
    c.levels = [level(0, [0, 30]), level(1, [0]), level(2, [0])];
    c.gameStartAt = START;
    c.stat = stat({
      '1': [levelTime(a, 0, 'lvl-0', 0), levelTime(a, 1, 'lvl-1', 20), levelTime(a, 2, 'lvl-2', 50)],
      '2': [levelTime(b, 0, 'lvl-0', 0), levelTime(b, 1, 'lvl-1', 40)],
    });

    const model = c.model;
    expect(model.hasData).toBeTrue();
    expect(model.series.map(s => s.teamName)).toEqual(['Alpha', 'Bravo']);
    // Highest level reached is number 2 -> displayed level 3.
    expect(model.yTicks.map(t => t.label)).toEqual(['1', '2', '3']);
    // Distinct colours per team.
    expect(model.series[0].color).not.toBe(model.series[1].color);
  });

  it('ignores the minute-0 prompt when drawing hint stairs', () => {
    const a = team(1, 'Alpha');
    // Level 0 has a prompt at 0 and a real hint at 10 min; team stays 30 min.
    const withHint = makeComponent();
    withHint.levels = [level(0, [0, 10]), level(1, [0])];
    withHint.gameStartAt = START;
    withHint.stat = stat({'1': [levelTime(a, 0, 'lvl-0', 0), levelTime(a, 1, 'lvl-1', 30)]});

    const noHint = makeComponent();
    noHint.levels = [level(0, [0]), level(1, [0])];
    noHint.gameStartAt = START;
    noHint.stat = stat({'1': [levelTime(a, 0, 'lvl-0', 0), levelTime(a, 1, 'lvl-1', 30)]});

    // The extra (minute-10) hint adds two stair vertices; the minute-0 one does not.
    const segments = (d: string) => d.split(/(?=[ML])/).length;
    expect(segments(withHint.model.series[0].d)).toBe(segments(noHint.model.series[0].d) + 2);
  });

  it('isolates / multi-selects / clears teams from the legend', () => {
    const a = team(1, 'Alpha');
    const b = team(2, 'Bravo');
    const c = team(3, 'Charlie');
    const cmp = makeComponent();
    cmp.levels = [level(0, [0]), level(1, [0])];
    cmp.gameStartAt = START;
    cmp.stat = stat({
      '1': [levelTime(a, 0, 'lvl-0', 0), levelTime(a, 1, 'lvl-1', 10)],
      '2': [levelTime(b, 0, 'lvl-0', 0), levelTime(b, 1, 'lvl-1', 20)],
      '3': [levelTime(c, 0, 'lvl-0', 0), levelTime(c, 1, 'lvl-1', 30)],
    });

    // No selection: everything visible.
    expect([1, 2, 3].every(id => cmp.isVisible(id))).toBeTrue();
    expect(cmp.hasSelection()).toBeFalse();

    // Plain click isolates one team.
    cmp.onLegendClick(1, new MouseEvent('click'));
    expect(cmp.isVisible(1)).toBeTrue();
    expect(cmp.isVisible(2)).toBeFalse();
    expect(cmp.isVisible(3)).toBeFalse();

    // Ctrl+click adds a second team.
    cmp.onLegendClick(3, new MouseEvent('click', {ctrlKey: true}));
    expect(cmp.isVisible(1)).toBeTrue();
    expect(cmp.isVisible(3)).toBeTrue();
    expect(cmp.isVisible(2)).toBeFalse();

    // Ctrl+click an active team removes it again.
    cmp.onLegendClick(3, new MouseEvent('click', {ctrlKey: true}));
    expect(cmp.isVisible(3)).toBeFalse();

    // Plain click on the (now sole) selected team clears the filter -> all shown.
    cmp.onLegendClick(1, new MouseEvent('click'));
    expect(cmp.hasSelection()).toBeFalse();
    expect([1, 2, 3].every(id => cmp.isVisible(id))).toBeTrue();
  });

  it('drops hints the team never reached before leveling up', () => {
    const a = team(1, 'Alpha');
    // Hint scheduled at 40 min but the team solves the level after 20 min.
    const c = makeComponent();
    c.levels = [level(0, [0, 40]), level(1, [0])];
    c.gameStartAt = START;
    c.stat = stat({'1': [levelTime(a, 0, 'lvl-0', 0), levelTime(a, 1, 'lvl-1', 20)]});

    const noHint = makeComponent();
    noHint.levels = [level(0, [0]), level(1, [0])];
    noHint.gameStartAt = START;
    noHint.stat = stat({'1': [levelTime(a, 0, 'lvl-0', 0), levelTime(a, 1, 'lvl-1', 20)]});

    expect(c.model.series[0].d).toBe(noHint.model.series[0].d);
  });
});
