import {TestBed} from "@angular/core/testing";
import {provideHttpClient} from "@angular/common/http";
import {HttpTestingController, provideHttpClientTesting} from "@angular/common/http/testing";

import {SeasonService} from "./season.service";
import {SlotAuthorKind} from "./season.models";
import {AuthStateService} from "../auth/auth-state.service";

describe("SeasonService", () => {
  let service: SeasonService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SeasonService);
    httpMock = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthStateService).setAuthenticated();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it("reads a season by its year", () => {
    service.getSeason(2027).subscribe();

    const request = httpMock.expectOne(req => req.url.endsWith("/seasons/2027"));
    expect(request.request.method).toBe("GET");
    request.flush({id: 1, year: 2027, published_at: "", updated_at: "", slots: []});
  });

  it("asks the engine for the default dates rather than generating them here", () => {
    service.getDefaults(2027).subscribe();

    const request = httpMock.expectOne(req => req.url.includes("/seasons/defaults"));
    expect(request.request.urlWithParams).toContain("year=2027");
    request.flush({year: 2027, dates: []});
  });

  it("publishes the whole composed list in one request", () => {
    service.publish(2027, [{slot_date: "2027-05-15", note: null}]).subscribe();

    const request = httpMock.expectOne(req => req.url.endsWith("/seasons"));
    expect(request.request.method).toBe("POST");
    expect(request.request.body).toEqual({
      year: 2027,
      slots: [{slot_date: "2027-05-15", note: null}],
    });
    request.flush({id: 1, year: 2027, published_at: "", updated_at: "", slots: []});
  });

  it("moves a date with a PATCH that says only what changed", () => {
    service.moveSlot(2027, 8, "2027-05-22").subscribe();

    const request = httpMock.expectOne(req => req.url.endsWith("/seasons/2027/slots/8"));
    expect(request.request.method).toBe("PATCH");
    expect(request.request.body).toEqual({slot_date: "2027-05-22"});
    request.flush({});
  });

  it("clears a note with an empty string, since an omitted one leaves it alone", () => {
    service.editNote(2027, 8, null).subscribe();

    const request = httpMock.expectOne(req => req.url.endsWith("/seasons/2027/slots/8"));
    expect(request.request.body).toEqual({note: ""});
    request.flush({});
  });

  it("takes a date for a team with its orgs", () => {
    service.takeSlot(2027, 8, {
      author_kind: SlotAuthorKind.team,
      team_id: 3,
      org_player_ids: [11, 12],
    }).subscribe();

    const request = httpMock.expectOne(req => req.url.endsWith("/seasons/2027/slots/8/take"));
    expect(request.request.method).toBe("POST");
    expect(request.request.body).toEqual({author_kind: "team", team_id: 3, org_player_ids: [11, 12]});
    request.flush({});
  });

  it("releases a date by deleting the take", () => {
    service.releaseSlot(2027, 8).subscribe();

    const request = httpMock.expectOne(req => req.url.endsWith("/seasons/2027/slots/8/take"));
    expect(request.request.method).toBe("DELETE");
    request.flush({});
  });

  it("sets the orgs without re-taking the date", () => {
    service.setOrgs(2027, 8, [11]).subscribe();

    const request = httpMock.expectOne(req => req.url.endsWith("/seasons/2027/slots/8/orgs"));
    expect(request.request.method).toBe("PUT");
    expect(request.request.body).toEqual({org_player_ids: [11]});
    request.flush({});
  });

  it("reads a published season without being signed in", () => {
    TestBed.inject(AuthStateService).setUnauthenticated();

    service.getSeason(2027).subscribe();

    httpMock.expectOne(req => req.url.endsWith("/seasons/2027")).flush({
      id: 1, year: 2027, published_at: "", updated_at: "", slots: [],
    });
  });

  it("fails an edit fast while unauthenticated instead of asking the server", () => {
    TestBed.inject(AuthStateService).setUnauthenticated();
    let status = 0;

    service.releaseSlot(2027, 8).subscribe({error: err => { status = err.status; }});

    expect(status).toBe(401);
    httpMock.expectNone(req => req.url.endsWith("/seasons/2027/slots/8/take"));
  });
});
