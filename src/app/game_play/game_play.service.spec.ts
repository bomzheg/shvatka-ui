import {TestBed} from '@angular/core/testing';
import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';

import {GamePlayService, Played} from './game_play.service';

const PASSED_LEVELS = {
  game_id: 7,
  levels: [
    {
      level_number: 0,
      level_time_id: 11,
      started_at: "2024-05-05T10:00:00+00:00",
      finished_at: "2024-05-05T10:07:00+00:00",
      hints: [{time: 0, hint: [{type: "text", text: "загадка"}]}],
    },
  ],
};

describe('GamePlayService', () => {
  let service: GamePlayService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(GamePlayService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  /**
   * Play a started game as a player of a team, up to the current level. The
   * role is only answered on the first pass — the service caches it for the
   * whole started game.
   */
  function startPlaying(levelTimeId: number, roleCached: boolean = false): void {
    service.loadHints();
    httpMock.expectOne(req => req.url.endsWith('/games/active'))
      .flush({id: 7, name: "game", status: "started"});
    if (!roleCached) {
      httpMock.expectOne(req => req.url.endsWith('/games/active/me'))
        .flush({waiver_vote: Played.yes, team: {id: 1, name: "team"}, org: null});
    }
    httpMock.expectOne(req => req.url.endsWith('/games/running/level/current'))
      .flush({
        hints: [],
        typed_keys: [],
        events: [],
        level_number: 1,
        level_time_id: levelTimeId,
        started_at: "2024-05-05T10:07:00+00:00",
        game_id: 7,
        is_finished: false,
      });
  }

  it('does not touch the passed levels until they are asked for', () => {
    startPlaying(12);

    expect(service.getPassedLevels()).toBeUndefined();
    httpMock.expectNone(req => req.url.endsWith('/games/running/level/passed'));
  });

  it('loads the passed levels once and serves the next ask from the cache', () => {
    startPlaying(12);

    service.loadPassedLevels();
    httpMock.expectOne(req => req.url.endsWith('/games/running/level/passed'))
      .flush(PASSED_LEVELS);

    expect(service.getPassedLevels()?.levels.length).toBe(1);
    expect(service.isPassedLevelsDataLoading()).toBeFalse();

    service.loadPassedLevels();
    httpMock.expectNone(req => req.url.endsWith('/games/running/level/passed'));
  });

  it('refreshes the passed levels of a player who opened them once the team levels up', () => {
    startPlaying(12);
    service.loadPassedLevels();
    httpMock.expectOne(req => req.url.endsWith('/games/running/level/passed'))
      .flush(PASSED_LEVELS);

    // the same page, one level later
    startPlaying(13, true);

    httpMock.expectOne(req => req.url.endsWith('/games/running/level/passed'))
      .flush(PASSED_LEVELS);
    expect(service.getPassedLevels()?.levels.length).toBe(1);
  });
});
