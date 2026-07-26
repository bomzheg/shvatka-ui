import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideHttpClient} from '@angular/common/http';
import {provideRouter} from '@angular/router';

import {GameLogPartComponent} from './game_log.part.component';
import {
  BonusEvent,
  BonusSource,
  FullGame,
  GameStat,
  LevelTime,
  Player,
  Team,
} from "../domain/game.models";

const AUTHOR = new Player('author', 1, true);
const START = '2024-01-01T12:00:00Z';
const GAME = new FullGame(1, AUTHOR, 'Game', 'complete', START, []);

/** Minutes after START. */
function at(minutes: number): Date {
  return new Date(Date.parse(START) + minutes * 60_000);
}

function team(id: number, name: string): Team {
  return new Team(id, name, new Player(`cap-${id}`, id, true), null);
}

function levelTime(t: Team, levelNumber: number, minutes: number): LevelTime {
  return new LevelTime(levelNumber, GAME, t, levelNumber, null, at(minutes), false);
}

function bonus(minutes: number, levelNumber: number | null, atMinutes = 1): BonusEvent {
  return new BonusEvent(
    at(atMinutes).toISOString(),
    minutes,
    BonusSource.key,
    'SHBONUS',
    null,
    levelNumber,
  );
}

function stat(
  levelTimes: Record<string, LevelTime[]>,
  bonuses: Record<string, BonusEvent[]> = {},
): GameStat {
  return new GameStat(
    levelTimes as unknown as Map<number, LevelTime[]>,
    bonuses as unknown as Map<number, BonusEvent[]>,
  );
}

function makeComponent(): GameLogPartComponent {
  return TestBed.configureTestingModule({imports: [GameLogPartComponent]})
    .createComponent(GameLogPartComponent).componentInstance;
}

describe('GameLogPartComponent bonuses', () => {
  const gryffindor = team(1, 'Gryffindor');
  const slytherin = team(2, 'Slytherin');

  /** Gryffindor: level 0 took 20 min, level 1 took 10 min, finished at 30. */
  function singleTeamStat(bonuses: BonusEvent[] = []): GameStat {
    return stat(
      {
        1: [
          levelTime(gryffindor, 0, 0),
          levelTime(gryffindor, 1, 20),
          levelTime(gryffindor, 2, 30),
        ],
      },
      bonuses.length ? {1: bonuses} : {},
    );
  }

  function componentWith(bonuses: BonusEvent[] = []): GameLogPartComponent {
    const component = makeComponent();
    component.gameStartAt = START;
    component.isCompleted = true;
    component.stat = singleTeamStat(bonuses);
    return component;
  }

  it('shows raw times by default', () => {
    const component = componentWith([bonus(5, 0)]);
    expect(component.timeMode).toBe('raw');
    expect(component.durationCell(component.pivotData[0], 0)).toBe('00:20:00');
  });

  it('hides the mode switch and total column when there are no bonuses', () => {
    const component = componentWith();
    expect(component.hasAnyBonus()).toBeFalse();
    expect(component.showTotalColumn()).toBeFalse();
  });

  it('subtracts a bonus from the level duration', () => {
    const component = componentWith([bonus(5, 0)]);
    component.setTimeMode('adjusted');
    expect(component.durationCell(component.pivotData[0], 0)).toBe('00:15:00');
  });

  it('adds a penalty to the level duration', () => {
    const component = componentWith([bonus(-5, 0)]);
    component.setTimeMode('adjusted');
    expect(component.durationCell(component.pivotData[0], 0)).toBe('00:25:00');
  });

  it('sums a bonus and a penalty on the same level', () => {
    const component = componentWith([bonus(5, 0), bonus(-3, 0)]);
    component.setTimeMode('adjusted');
    expect(component.durationCell(component.pivotData[0], 0)).toBe('00:18:00');
  });

  it('keeps a duration negative when the bonus exceeds it', () => {
    const component = componentWith([bonus(15, 1)]);
    component.setTimeMode('adjusted');
    expect(component.durationCell(component.pivotData[0], 1)).toBe('-00:05:00');
  });

  it('renders the arithmetic in expression mode', () => {
    const component = componentWith([bonus(5, 0), bonus(-3, 0)]);
    component.setTimeMode('expression');
    expect(component.durationCell(component.pivotData[0], 0)).toBe('00:20:00-00:05:00+00:03:00');
  });

  it('leaves untouched levels alone in expression mode', () => {
    const component = componentWith([bonus(5, 0)]);
    component.setTimeMode('expression');
    expect(component.durationCell(component.pivotData[0], 1)).toBe('00:10:00');
  });

  it('applies bonuses cumulatively to the wall-clock table', () => {
    const component = componentWith([bonus(5, 0), bonus(3, 1)]);
    const row = component.pivotData[0];
    const rawLevel1 = component.absoluteCell(row, 1);
    component.setTimeMode('adjusted');
    // закрытие уровня 0 сдвигается только своим бонусом, уровня 1 — обоими
    expect(component.comparableAbsoluteMs(row, 0)).toBe(
      (row.absoluteTimeMs.get(0) ?? 0) - 5 * 60_000,
    );
    expect(component.comparableAbsoluteMs(row, 1)).toBe(
      (row.absoluteTimeMs.get(1) ?? 0) - 8 * 60_000,
    );
    expect(component.absoluteCell(row, 1)).not.toBe(rawLevel1);
  });

  it('counts a bonus without a level towards the total only', () => {
    const component = componentWith([bonus(5, 0), bonus(7, null)]);
    const row = component.pivotData[0];
    expect(row.bonusMs.get(0)).toBe(5 * 60_000);
    expect(row.totalBonusMs).toBe(12 * 60_000);
    component.setTimeMode('adjusted');
    // всего 30 минут игры минус 12 минут бонусов
    expect(component.totalCell(row)).toBe('00:18:00');
  });

  it('shows the total column only outside raw mode', () => {
    const component = componentWith([bonus(5, 0)]);
    expect(component.showTotalColumn()).toBeFalse();
    component.setTimeMode('adjusted');
    expect(component.showTotalColumn()).toBeTrue();
  });

  it('lets bonuses change who wins', () => {
    // Slytherin финиширует позже, но получила бонус больше отставания
    const component = makeComponent();
    component.gameStartAt = START;
    component.isCompleted = true;
    component.stat = stat(
      {
        1: [levelTime(gryffindor, 0, 0), levelTime(gryffindor, 1, 30)],
        2: [levelTime(slytherin, 0, 0), levelTime(slytherin, 1, 40)],
      },
      {2: [bonus(15, 0)]},
    );
    expect(component.pivotData.map(row => row.teamName)).toEqual(['Gryffindor', 'Slytherin']);

    component.setTimeMode('adjusted');
    expect(component.pivotData.map(row => row.teamName)).toEqual(['Slytherin', 'Gryffindor']);
  });

  it('describes each bonus in the cell tooltip regardless of mode', () => {
    const component = componentWith([bonus(5, 0)]);
    const title = component.levelCellTitle(component.pivotData[0], 0);
    expect(title).toContain('бонус 5 мин.');
    expect(title).toContain('SHBONUS');
  });

  it('lists teams with bonuses on the bonuses tab', () => {
    const component = componentWith([bonus(5, 0)]);
    expect(component.bonusRows().map(row => row.teamName)).toEqual(['Gryffindor']);
    expect(component.showBonusesTab()).toBeFalse();
    component.setCompletedTab('bonuses');
    expect(component.showBonusesTab()).toBeTrue();
    expect(component.showPivotTable()).toBeFalse();
  });
});

describe('GameLogPartComponent bonuses rendering', () => {
  const gryffindor = team(1, 'Gryffindor');

  function renderWith(bonuses: BonusEvent[]): ComponentFixture<GameLogPartComponent> {
    const fixture = TestBed.configureTestingModule({
      imports: [GameLogPartComponent],
      providers: [provideHttpClient(), provideRouter([])],
    }).createComponent(GameLogPartComponent);
    fixture.componentInstance.gameStartAt = START;
    fixture.componentInstance.isCompleted = true;
    fixture.componentInstance.statDetailsOpen = true;
    fixture.componentInstance.stat = stat(
      {1: [levelTime(gryffindor, 0, 0), levelTime(gryffindor, 1, 20), levelTime(gryffindor, 2, 30)]},
      bonuses.length ? {1: bonuses} : {},
    );
    fixture.detectChanges();
    return fixture;
  }

  /** Ячейки «Время на уровне» — вторая сводная таблица. */
  function durationCells(fixture: ComponentFixture<GameLogPartComponent>): string[] {
    const tables = fixture.nativeElement.querySelectorAll('.pivot-table');
    const cells = tables[tables.length - 1].querySelectorAll('tbody td:not(.team-name-cell)');
    return [...cells].map((cell: Element) => (cell.textContent ?? '').trim());
  }

  it('renders no mode switch when the game had no bonuses', () => {
    const fixture = renderWith([]);
    expect(fixture.nativeElement.querySelector('.time-mode-btn')).toBeNull();
    expect(durationCells(fixture)).toEqual(['00:20:00', '00:10:00']);
  });

  it('renders the mode switch and marks the selected mode active', () => {
    const fixture = renderWith([bonus(5, 0)]);
    const buttons = fixture.nativeElement.querySelectorAll('.time-mode-btn');
    expect(buttons.length).toBe(3);
    expect(buttons[0].classList).toContain('stat-tab-active');
    expect(buttons[1].classList).not.toContain('stat-tab-active');

    buttons[1].click();
    fixture.detectChanges();
    expect(buttons[0].classList).not.toContain('stat-tab-active');
    expect(buttons[1].classList).toContain('stat-tab-active');
  });

  it('updates the cells and adds the total column when switching mode', () => {
    const fixture = renderWith([bonus(5, 0)]);
    expect(durationCells(fixture)).toEqual(['00:20:00', '00:10:00']);

    fixture.nativeElement.querySelectorAll('.time-mode-btn')[1].click();
    fixture.detectChanges();
    // третья ячейка — колонка «Итого»: 30 минут игры минус 5 минут бонуса
    expect(durationCells(fixture)).toEqual(['00:15:00', '00:10:00', '00:25:00']);
    expect(fixture.nativeElement.querySelector('.total-cell')).not.toBeNull();
  });

  it('marks a bonus cell so it stands out', () => {
    const fixture = renderWith([bonus(-5, 0)]);
    const tables = fixture.nativeElement.querySelectorAll('.pivot-table');
    const cell = tables[tables.length - 1].querySelector('tbody td:not(.team-name-cell)');
    expect(cell.classList).toContain('has-penalty');
    expect(cell.getAttribute('title')).toContain('штраф 5 мин.');
  });

  it('renders the bonuses tab with every event', () => {
    const fixture = renderWith([bonus(5, 0), bonus(-3, 1)]);
    fixture.componentInstance.setCompletedTab('bonuses');
    fixture.detectChanges();
    const rows = fixture.nativeElement.querySelectorAll('.pivot-table tbody tr');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('+5');
    expect(rows[1].textContent).toContain('-3');
    expect(fixture.nativeElement.querySelector('.bonus-total').textContent).toContain('00:02:00');
  });
});
