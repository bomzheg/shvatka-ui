import {TestBed} from '@angular/core/testing';
import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';

import {AdminService} from './admin.service';
import {AuthStateService} from '../auth/auth-state.service';
import {FileGarbage} from './admin.models';

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

  it('deletes only when explicitly told to', () => {
    service.collectFileGarbage(false).subscribe();

    const request = httpMock.expectOne(req => req.url.includes('/admin/files/gc'));
    expect(request.request.url).toContain('dry_run=false');
    request.flush({dry_run: false, game_links: [], file_guids: [], stored_files: []});
  });
});
