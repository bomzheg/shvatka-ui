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

function keyEvent(id: number, at: string, key: string, effects?: Effect[]): GameEvent {
  return {id, level_time_id: 11, at, is_timer: false, key, effects};
}

function hintEffect(id: string, text: string, bonusMinutes = 0): Effect {
  return new Effect(id, [HintPart.create({type: HintType.text, text})], bonusMinutes);
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

  it('threads every hint of this level into one feed, whatever brought it', () => {
    spyOn(gameService, 'getCurrentHints').and.returnValue(currentHints(
      [new TimeHint(0, []), new TimeHint(10, [])],
      [
        timerEvent(1, "2024-05-05T10:05:00+00:00", [hintEffect("e1", "от таймера", 5)]),
        keyEvent(2, "2024-05-05T10:06:00+00:00", "ЛОМ", [hintEffect("e2", "за ключ")]),
        // a timer that fired several effects: only its last event is linked back
        {id: 3, level_time_id: 11, at: "2024-05-05T10:07:00+00:00", is_timer: false,
          effects: [hintEffect("e3", "без источника")]},
        // no hints — this one stays in the log
        timerEvent(4, "2024-05-05T10:08:00+00:00", [new Effect("e4", [], -10)]),
        // another level entirely
        {id: 5, level_time_id: 12, at: "2024-05-05T10:09:00+00:00", is_timer: true,
          effects: [hintEffect("e5", "прошлый уровень")]},
      ],
    ));

    const feed = component.getLevelFeed();

    expect(feed.map(item => item.id))
      .toEqual(["hint:0", "event:1", "event:2", "event:3", "hint:10"]);
    expect(feed.map(item => item.source))
      .toEqual(["hint", "timer", "key", "effect", "hint"]);
    expect(feed[1].label).toContain("Таймер 5 мин.");
    expect(feed[1].tags.map(tag => tag.text)).toEqual(["бонус 5 мин.", "бонусные подсказки: 1"]);
    expect(feed[2].label).toContain("Ключ «ЛОМ» 6 мин.");
    expect(feed[3].label).toContain("Эффект 7 мин.");
    expect(feed[2].hints.map(hint => hint.text)).toEqual(["за ключ"]);
  });

  it('orders a key and a timer of the same minute by when they landed', () => {
    spyOn(gameService, 'getCurrentHints').and.returnValue(currentHints(
      [new TimeHint(5, [])],
      [
        timerEvent(1, "2024-05-05T10:05:40+00:00", [hintEffect("e1", "таймер")]),
        keyEvent(2, "2024-05-05T10:05:10+00:00", "ЛОМ", [hintEffect("e2", "ключ")]),
      ],
    ));

    expect(component.getLevelFeed().map(item => item.id)).toEqual(["hint:5", "event:2", "event:1"]);
  });

  it('keeps the events without hints out of the feed, but logs every one of them', () => {
    spyOn(gameService, 'getCurrentHints').and.returnValue(currentHints(
      [],
      [
        timerEvent(1, "2024-05-05T10:05:00+00:00", [hintEffect("e1", "подсказка")]),
        timerEvent(2, "2024-05-05T10:06:00+00:00", [new Effect("e2", [], -10)]),
        keyEvent(3, "2024-05-05T10:07:00+00:00", "ЛОМ", [new Effect("e3", [], 0, true)]),
      ],
    ));

    expect(component.getLevelFeed().map(item => item.id)).toEqual(["event:1"]);
    expect(component.getCurrentLevelEvents().map(event => event.id)).toEqual([1, 2, 3]);
    expect(component.hasAnyEvents()).toBeTrue();
  });

  it('alerts about the newest unclosed timer of the last three minutes', () => {
    const now = Date.now();
    const ago = (minutes: number) => new Date(now - minutes * 60_000).toISOString();
    spyOn(gameService, 'getCurrentHints').and.returnValue(currentHints(
      [],
      [
        timerEvent(1, ago(10), [new Effect("e1", [], -10)]),
        timerEvent(2, ago(2), [hintEffect("e2", "подсказка", 5)]),
        keyEvent(3, ago(1), "ЛОМ", [new Effect("e3", [], 5)]),
      ],
    ));

    const alert = component.getRecentTimerEvent();

    expect(alert?.id).toBe(2);
    // the alert names the effects, never the hints themselves — those are in the feed
    expect(component.getEventEffects(alert!).map(tag => tag.text))
      .toEqual(["бонус 5 мин.", "бонусные подсказки: 1"]);

    component.closeRecentTimerEvent(alert!);

    expect(component.getRecentTimerEvent()).toBeUndefined();
  });

  it('keeps an event with a broken time at the end of the feed', () => {
    spyOn(gameService, 'getCurrentHints').and.returnValue(currentHints(
      [new TimeHint(30, [])],
      [timerEvent(1, "not a date", [hintEffect("e1", "подсказка")])],
    ));

    const feed = component.getLevelFeed();

    expect(feed.map(item => item.id)).toEqual(["hint:30", "event:1"]);
    expect(feed[1].label).toBe("Таймер");
  });
});
