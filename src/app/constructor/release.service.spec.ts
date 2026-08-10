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
      banner: {type: HintType.photo, file_guid: "banner", caption: "тема игры"},
      hints: [{type: HintType.text, text: "карта района"}],
    });

    expect(received?.game_id).toBe(7);
    expect(received?.banner?.file_guid).toBe("banner");
    expect(received?.hints.length).toBe(1);
  });

  it("treats a game without a release as no release, not an error", () => {
    let received: GameRelease | undefined | "untouched" = "untouched";
    gamesService.getRelease(7).subscribe(release => received = release);

    httpMock.expectOne(req => req.url.endsWith("/games/7/release")).flush(null);

    expect(received).toBeUndefined();
  });

  it("saves the banner apart from the rest, leaving the announcing to the engine", () => {
    let saved: GameRelease | undefined;
    const banner = {type: HintType.photo, file_guid: "banner", caption: "тема"};
    constructorService.saveRelease(7, banner, [{type: HintType.text, text: "карта"}])
      .subscribe(release => saved = release);

    const request = httpMock.expectOne(req => req.url.endsWith("/games/my/7/release"));
    expect(request.request.method).toBe("PUT");
    expect(request.request.body).toEqual({
      banner,
      hints: [{type: HintType.text, text: "карта"}],
    });
    request.flush({
      game_id: 7,
      banner,
      hints: [{type: HintType.text, text: "карта"}],
    });

    expect(saved?.banner?.caption).toBe("тема");
  });

  it("sends an explicit null when the release has no banner", () => {
    constructorService.saveRelease(7, undefined, [{type: HintType.text, text: "только текст"}])
      .subscribe();

    const request = httpMock.expectOne(req => req.url.endsWith("/games/my/7/release"));
    expect(request.request.body.banner).toBeNull();
    request.flush({game_id: 7, banner: null, hints: []});
  });

  it("deletes the release", () => {
    constructorService.deleteRelease(7).subscribe();

    const request = httpMock.expectOne(req => req.url.endsWith("/games/my/7/release"));
    expect(request.request.method).toBe("DELETE");
    request.flush(null);
  });
});
