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
});
