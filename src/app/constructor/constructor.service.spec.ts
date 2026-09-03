import {TestBed} from '@angular/core/testing';
import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';

import {ConstructorService} from './constructor.service';
import {AuthStateService} from '../auth/auth-state.service';

describe('ConstructorService', () => {
  let service: ConstructorService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    TestBed.inject(AuthStateService).setAuthenticated();
    service = TestBed.inject(ConstructorService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('downloads the keys to print as a pdf blob', () => {
    let received: Blob | undefined;
    service.keysToPrint(42).subscribe(blob => received = blob);

    const request = httpMock.expectOne(req => req.url.endsWith('/games/my/42/keys/print'));
    expect(request.request.method).toBe('GET');
    expect(request.request.responseType).toBe('blob');
    expect(request.request.withCredentials).toBeTrue();

    const pdf = new Blob(['%PDF-1.4'], {type: 'application/pdf'});
    request.flush(pdf);

    expect(received).toBe(pdf);
  });

  it('renames a game without touching its scenario', () => {
    let renamed: {name: string} | undefined;
    service.renameGame(42, 'новое имя').subscribe(game => renamed = game);

    const request = httpMock.expectOne(req => req.url.endsWith('/games/my/42/name'));
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({name: 'новое имя'});
    expect(request.request.withCredentials).toBeTrue();
    request.flush({id: 42, name: 'новое имя', status: 'underconstruction'});

    expect(renamed?.name).toBe('новое имя');
  });

  it('downloads the game as a zip package', () => {
    let received: Blob | undefined;
    service.exportZip(42).subscribe(blob => received = blob);

    const request = httpMock.expectOne(req => req.url.endsWith('/games/my/42/scenario/zip'));
    expect(request.request.method).toBe('GET');
    expect(request.request.responseType).toBe('blob');
    expect(request.request.withCredentials).toBeTrue();

    const zip = new Blob(['PK'], {type: 'application/zip'});
    request.flush(zip);

    expect(received).toBe(zip);
  });

  it('imports a zip package as multipart form data', () => {
    const file = new File([new Uint8Array([80, 75])], 'game.zip', {type: 'application/zip'});
    let imported: {name: string} | undefined;
    service.importZip(file).subscribe(game => imported = game);

    const request = httpMock.expectOne(req => req.url.endsWith('/games/my/zip'));
    expect(request.request.method).toBe('POST');
    expect(request.request.withCredentials).toBeTrue();
    const body = request.request.body as FormData;
    expect(body instanceof FormData).toBeTrue();
    expect((body.get('file') as File).name).toBe('game.zip');
    request.flush({id: 7, name: 'из архива', levels: []});

    expect(imported?.name).toBe('из архива');
  });

  it('asks the server to overwrite only when told to', () => {
    const file = new File([new Uint8Array([80, 75])], 'game.zip', {type: 'application/zip'});
    service.importZip(file, true).subscribe();

    const request = httpMock.expectOne(req => req.url.endsWith('/games/my/zip?overwrite=true'));
    expect(request.request.method).toBe('POST');
    request.flush({id: 7, name: 'из архива', levels: []});
  });

  it('deletes a game file through the cdn', () => {
    let done = false;
    service.deleteFile(42, 'the-guid').subscribe(() => done = true);

    const request = httpMock.expectOne(req => req.url.endsWith('/games/42/files/the-guid'));
    expect(request.request.method).toBe('DELETE');
    expect(request.request.withCredentials).toBeTrue();
    request.flush(null);

    expect(done).toBeTrue();
  });
});
