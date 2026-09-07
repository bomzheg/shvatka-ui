import {TestBed} from "@angular/core/testing";
import {HttpClientTestingModule, HttpTestingController} from "@angular/common/http/testing";

import {SeasonService} from "./season.service";
import {Season} from "./season.models";

const EMPTY_SEASON: Season = {
  id: 1,
  year: 2027,
  published_at: "2026-08-01T10:00:00Z",
  updated_at: "2026-08-01T10:00:00Z",
  slots: [],
};

describe("SeasonService", () => {
  let service: SeasonService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({imports: [HttpClientTestingModule]});
    service = TestBed.inject(SeasonService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it("reads one year", () => {
    service.getSeason(2027).subscribe(season => expect(season.year).toBe(2027));

    const request = httpMock.expectOne(req => req.url.endsWith("/seasons/2027"));
    expect(request.request.method).toBe("GET");
    request.flush(EMPTY_SEASON);
  });

  it("asks for the default dates without persisting anything", () => {
    service.getDefaults(2027).subscribe(defaults => expect(defaults.dates.length).toBe(1));

    const request = httpMock.expectOne(req => req.url.includes("/seasons/defaults"));
    expect(request.request.method).toBe("GET");
    request.flush({year: 2027, dates: ["2027-05-15"]});
  });

  it("publishes the whole list in one request", () => {
    service.publish(2027, [{date: "2027-05-15"}]).subscribe();

    const request = httpMock.expectOne(req => req.url.endsWith("/seasons"));
    expect(request.request.method).toBe("POST");
    expect(request.request.body).toEqual({year: 2027, slots: [{date: "2027-05-15"}]});
    request.flush(EMPTY_SEASON);
  });

  it("takes a date for a team", () => {
    service.takeSlot(2027, 7, {author_kind: "team", team_id: 3, org_player_ids: [9]}).subscribe();

    const request = httpMock.expectOne(req => req.url.endsWith("/seasons/2027/slots/7/take"));
    expect(request.request.method).toBe("POST");
    expect(request.request.body).toEqual({
      author_kind: "team",
      team_id: 3,
      org_player_ids: [9],
    });
    request.flush({});
  });

  it("releases a date with a delete on the same path", () => {
    service.releaseSlot(2027, 7).subscribe();

    const request = httpMock.expectOne(req => req.url.endsWith("/seasons/2027/slots/7/take"));
    expect(request.request.method).toBe("DELETE");
    request.flush({});
  });

  it("moves a date with a patch", () => {
    service.editSlot(2027, 7, {date: "2027-05-22"}).subscribe();

    const request = httpMock.expectOne(req => req.url.endsWith("/seasons/2027/slots/7"));
    expect(request.request.method).toBe("PATCH");
    expect(request.request.body).toEqual({date: "2027-05-22"});
    request.flush({});
  });
});
