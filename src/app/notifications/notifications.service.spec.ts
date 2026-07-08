import {TestBed} from '@angular/core/testing';
import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';

import {NotificationsService} from './notifications.service';
import {AuthStateService} from '../auth/auth-state.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(NotificationsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('starts with no unread notifications', () => {
    expect(service.unreadCount()).toBe(0);
  });

  it('updates the unread counter from the backend', () => {
    TestBed.inject(AuthStateService).setAuthenticated();

    service.refreshUnreadCount();

    const request = httpMock.expectOne(req => req.url.endsWith('/notifications/unread-count'));
    expect(request.request.method).toBe('GET');
    request.flush({count: 7});

    expect(service.unreadCount()).toBe(7);
  });

  it('does not poll while unauthenticated', () => {
    TestBed.inject(AuthStateService).setUnauthenticated();

    service.refreshUnreadCount();

    httpMock.expectNone(req => req.url.endsWith('/notifications/unread-count'));
    expect(service.unreadCount()).toBe(0);
  });

  it('builds the feed query from options', () => {
    service.getNotifications({unread: true, limit: 10, offset: 20}).subscribe();

    const request = httpMock.expectOne(req => req.url.includes('/notifications?'));
    expect(request.request.urlWithParams).toContain('unread=true');
    expect(request.request.urlWithParams).toContain('limit=10');
    expect(request.request.urlWithParams).toContain('offset=20');
    request.flush({items: [], limit: 10, offset: 20, unread_only: true});
  });

  it('marks notifications read via POST', () => {
    service.markRead([1, 2]).subscribe();

    const request = httpMock.expectOne(req => req.url.endsWith('/notifications/read'));
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ids: [1, 2]});
    request.flush(null);
  });

  it('creates requests via the creation endpoints', () => {
    service.createTeamJoinInvite(7, 42, 'seeker', '🔦').subscribe();
    const invite = httpMock.expectOne(req => req.url.endsWith('/requests/team-join-invite'));
    expect(invite.request.body).toEqual({team_id: 7, player_id: 42, role: 'seeker', emoji: '🔦'});
    invite.flush({});

    service.createTeamJoinInvite(7, 42).subscribe();
    const inviteNoRole = httpMock.expectOne(req => req.url.endsWith('/requests/team-join-invite'));
    expect(inviteNoRole.request.body).toEqual({team_id: 7, player_id: 42});
    inviteNoRole.flush({});

    service.createTeamJoinRequest(7).subscribe();
    const ask = httpMock.expectOne(req => req.url.endsWith('/requests/team-join'));
    expect(ask.request.body).toEqual({team_id: 7});
    ask.flush({});

    service.createOrgInvite(5, 42).subscribe();
    const orgInvite = httpMock.expectOne(req => req.url.endsWith('/requests/org-invite'));
    expect(orgInvite.request.body).toEqual({game_id: 5, player_id: 42});
    orgInvite.flush({});
  });

  it('responds to requests via the action endpoints', () => {
    service.acceptRequest(45).subscribe();
    const accept = httpMock.expectOne(req => req.url.endsWith('/requests/45/accept'));
    expect(accept.request.method).toBe('POST');
    accept.flush({});

    service.declineRequest(46).subscribe();
    const decline = httpMock.expectOne(req => req.url.endsWith('/requests/46/decline'));
    expect(decline.request.method).toBe('POST');
    decline.flush({});

    service.cancelRequest(47).subscribe();
    const cancel = httpMock.expectOne(req => req.url.endsWith('/requests/47/cancel'));
    expect(cancel.request.method).toBe('POST');
    cancel.flush({});
  });
});
