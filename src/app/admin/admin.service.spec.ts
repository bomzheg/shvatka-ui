import {TestBed} from '@angular/core/testing';
import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';

import {AdminService} from './admin.service';
import {AuthStateService} from '../auth/auth-state.service';
import {AdminGame, FileGarbage} from './admin.models';

describe('AdminService', () => {
  let service: AdminService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    TestBed.inject(AuthStateService).setAuthenticated();
    service = TestBed.inject(AdminService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('asks for a dry run by default', () => {
    let received: FileGarbage | undefined;
    service.collectFileGarbage().subscribe(garbage => received = garbage);

    const request = httpMock.expectOne(req => req.url.includes('/admin/files/gc'));
    expect(request.request.method).toBe('POST');
    expect(request.request.url).toContain('dry_run=true');

    const garbage: FileGarbage = {
      dry_run: true,
      game_links: [{game_id: 1, file_id: 2}],
      file_guids: ['the-guid'],
      stored_files: ['the-guid.txt'],
    };
    request.flush(garbage);

    expect(received).toEqual(garbage);
  });

  it('lists the games an admin may act on from the admin endpoint', () => {
    let received: AdminGame[] | undefined;
    service.listAdminGames().subscribe(page => received = page.content);

    const request = httpMock.expectOne(req => req.url.endsWith('/admin/games'));
    expect(request.request.method).toBe('GET');

    const game: AdminGame = {
      id: 4,
      author: {id: 1, can_be_author: true, name_mention: 'author', username: 'author'},
      name: 'бегущая игра',
      status: 'started',
      start_at: null,
      number: null,
    };
    request.flush({content: [game]});

    expect(received).toEqual([game]);
    // the answer carries no scenario: what the panel shows is the status
    expect(Object.keys(received![0])).not.toContain('levels');
  });

  it('changes only the status of a game', () => {
    service.changeGameStatus(4, 'underconstruction').subscribe();

    const request = httpMock.expectOne(req => req.url.endsWith('/admin/games/4/status'));
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({status: 'underconstruction'});
    request.flush({
      id: 4,
      author: {id: 1, can_be_author: true, name_mention: 'author', username: 'author'},
      name: 'бегущая игра',
      status: 'underconstruction',
      start_at: null,
      number: null,
    });
  });

  it('resends the running level without learning anything about it', () => {
    let received: {id: number; name: string}[] | undefined;
    service.resendCurrentLevel(3).subscribe(sent => received = sent.items);

    const request = httpMock.expectOne(req => req.url.endsWith('/admin/games/running/resend'));
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({team_id: 3});

    request.flush({items: [{id: 3, name: 'Гриффиндор', description: null, captain_id: null}]});

    expect(received!.map(t => t.name)).toEqual(['Гриффиндор']);
    // the answer names the team and nothing of the level it was sent
    expect(Object.keys(received![0])).toEqual(['id', 'name', 'description', 'captain_id']);
  });

  it('resends to every team when no team is named', () => {
    service.resendCurrentLevel().subscribe();

    const request = httpMock.expectOne(req => req.url.endsWith('/admin/games/running/resend'));
    expect(request.request.body).toEqual({team_id: null});
    request.flush({items: []});
  });

  it('deletes only when explicitly told to', () => {
    service.collectFileGarbage(false).subscribe();

    const request = httpMock.expectOne(req => req.url.includes('/admin/files/gc'));
    expect(request.request.url).toContain('dry_run=false');
    request.flush({dry_run: false, game_links: [], file_guids: [], stored_files: []});
  });
});
