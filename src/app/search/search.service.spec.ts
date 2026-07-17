import {TestBed} from '@angular/core/testing';
import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';

import {SearchService} from './search.service';
import {DEFAULT_SEARCH_SCOPE, SearchResult} from './search.models';

describe('SearchService', () => {
  let service: SearchService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SearchService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('searches everywhere without filter params by default', () => {
    let results: SearchResult[] | undefined;
    service.search('harry', DEFAULT_SEARCH_SCOPE).subscribe(r => results = r);

    const request = httpMock.expectOne(req => req.url.includes('/search?'));
    expect(request.request.method).toBe('GET');
    expect(request.request.url).toContain('query=harry');
    expect(request.request.url).not.toContain('games=');
    expect(request.request.url).not.toContain('levels=');
    expect(request.request.url).not.toContain('teams=');
    expect(request.request.url).not.toContain('players=');
    request.flush({content: [{type: 'team', team_id: 7, team_name: 'Gryffindor', snippet: 'Gryffindor'}]});

    expect(results?.length).toBe(1);
    expect(results?.[0].type).toBe('team');
  });

  it('sends only the disabled filters as false', () => {
    service.search('harry', {games: false, levels: false, teams: true, players: true}).subscribe();

    const request = httpMock.expectOne(req => req.url.includes('/search?'));
    expect(request.request.url).toContain('games=false');
    expect(request.request.url).toContain('levels=false');
    expect(request.request.url).not.toContain('teams=');
    expect(request.request.url).not.toContain('players=');
    request.flush({content: []});
  });

  it('does not hit the backend for a blank query', () => {
    let results: SearchResult[] | undefined;
    service.search('   ', DEFAULT_SEARCH_SCOPE).subscribe(r => results = r);

    httpMock.expectNone(req => req.url.includes('/search'));
    expect(results).toEqual([]);
  });
});
