import {TestBed} from "@angular/core/testing";
import {provideHttpClient} from "@angular/common/http";
import {HttpTestingController, provideHttpClientTesting} from "@angular/common/http/testing";

import {ConstructorService} from "./constructor.service";
import {GamesService} from "../games/games.service";
import {GameRelease, HintType} from "../domain/game.models";

describe("game release", () => {
  let constructorService: ConstructorService;
  let gamesService: GamesService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    constructorService = TestBed.inject(ConstructorService);
    gamesService = TestBed.inject(GamesService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it("reads the release of a game", () => {
    let received: GameRelease | undefined;
    gamesService.getRelease(7).subscribe(release => received = release);

    const request = httpMock.expectOne(req => req.url.endsWith("/games/7/release"));
    expect(request.request.method).toBe("GET");
    request.flush({
      game_id: 7,
      hints: [{type: HintType.text, text: "тема игры"}],
      is_published: true,
    });

    expect(received?.game_id).toBe(7);
    expect(received?.hints.length).toBe(1);
    expect(received?.is_published).toBeTrue();
  });

  it("treats a game without a release as no release, not an error", () => {
    let received: GameRelease | undefined | "untouched" = "untouched";
    gamesService.getRelease(7).subscribe(release => received = release);

    httpMock.expectOne(req => req.url.endsWith("/games/7/release")).flush(null);

    expect(received).toBeUndefined();
  });

  it("saves the release, leaving it to the engine when to announce it", () => {
    let saved: GameRelease | undefined;
    constructorService.saveRelease(7, [{type: HintType.photo, file_guid: "banner"}])
      .subscribe(release => saved = release);

    const request = httpMock.expectOne(req => req.url.endsWith("/games/my/7/release"));
    expect(request.request.method).toBe("PUT");
    expect(request.request.body).toEqual({hints: [{type: HintType.photo, file_guid: "banner"}]});
    request.flush({
      game_id: 7,
      hints: [{type: HintType.photo, file_guid: "banner"}],
      is_published: false,
    });

    expect(saved?.is_published).toBeFalse();
  });

  it("deletes the release", () => {
    constructorService.deleteRelease(7).subscribe();

    const request = httpMock.expectOne(req => req.url.endsWith("/games/my/7/release"));
    expect(request.request.method).toBe("DELETE");
    request.flush(null);
  });
});
