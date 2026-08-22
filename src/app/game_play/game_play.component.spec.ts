import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideHttpClient} from '@angular/common/http';
import {provideHttpClientTesting} from '@angular/common/http/testing';

import {GamePlayComponent} from './game_play.component';
import {CurrentHints, GameEvent, GamePlayService, PassedLevel} from './game_play.service';
import {Effect, HintPart, HintType, TimeHint} from '../domain/game.models';

const LEVEL_STARTED_AT = "2024-05-05T10:00:00+00:00";

function timerEvent(id: number, at: string, effects?: Effect[]): GameEvent {
  return {id, level_time_id: 11, at, is_timer: true, effects};
}

function currentHints(hints: TimeHint[], events: GameEvent[]): CurrentHints {
  return new CurrentHints(hints, [], events, 0, 11, LEVEL_STARTED_AT, 7, false);
}

describe('GamePlayComponent', () => {
  let component: GamePlayComponent;
  let fixture: ComponentFixture<GamePlayComponent>;
  let gameService: GamePlayService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GamePlayComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    })
    .compileComponents();

    gameService = TestBed.inject(GamePlayService);
    fixture = TestBed.createComponent(GamePlayComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows how long the team stayed on a passed level', () => {
    const level = new PassedLevel(
      0,
      11,
      "2024-05-05T10:00:00+00:00",
      "2024-05-05T10:07:30+00:00",
      [],
    );

    expect(component.getPassedLevelDuration(level)).toBe("7м 30с");
  });

  it('reads no duration out of a broken timestamp', () => {
    const level = new PassedLevel(0, 11, "not a date", "2024-05-05T10:07:30+00:00", []);

    expect(component.getPassedLevelDuration(level)).toBe("—");
  });

  it('puts the timers of this level between the hints of the feed', () => {
    const bonusHint = HintPart.create({type: HintType.text, text: "бонусная подсказка"});
    spyOn(gameService, 'getCurrentHints').and.returnValue(currentHints(
      [new TimeHint(0, []), new TimeHint(10, [])],
      [
        timerEvent(1, "2024-05-05T10:05:00+00:00", [new Effect("e1", [bonusHint], 5)]),
        {id: 2, level_time_id: 11, at: "2024-05-05T10:06:00+00:00", is_timer: false, key: "КЛЮЧ"},
        timerEvent(3, "2024-05-05T10:07:00+00:00"),
      ],
    ));

    const feed = component.getLevelFeed();

    expect(feed.map(item => item.id)).toEqual(["hint:0", "timer:1", "timer:3", "hint:10"]);
    const timer = feed[1];
    expect(timer.label).toContain("Таймер 5 мин.");
    expect(timer.hints).toEqual([bonusHint]);
    expect(timer.tags.map(tag => tag.text)).toEqual(["бонус 5 мин.", "бонусные подсказки: 1"]);
  });

  it('leaves the timers out of the event log they moved from', () => {
    spyOn(gameService, 'getCurrentHints').and.returnValue(currentHints(
      [],
      [
        timerEvent(1, "2024-05-05T10:05:00+00:00"),
        {id: 2, level_time_id: 11, at: "2024-05-05T10:06:00+00:00", is_timer: false, key: "КЛЮЧ"},
      ],
    ));

    expect(component.getCurrentLevelLogEvents().map(event => event.id)).toEqual([2]);
  });

  it('shows no event log when this level only had timers', () => {
    spyOn(gameService, 'getCurrentHints').and.returnValue(currentHints(
      [],
      [timerEvent(1, "2024-05-05T10:05:00+00:00")],
    ));

    expect(component.hasAnyEvents()).toBeFalse();
  });

  it('keeps a timer with a broken time at the end of the feed', () => {
    spyOn(gameService, 'getCurrentHints').and.returnValue(currentHints(
      [new TimeHint(30, [])],
      [timerEvent(1, "not a date")],
    ));

    const feed = component.getLevelFeed();

    expect(feed.map(item => item.id)).toEqual(["hint:30", "timer:1"]);
    expect(feed[1].label).toBe("Сработал таймер");
  });
});
