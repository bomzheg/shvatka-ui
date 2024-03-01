import {TestBed} from '@angular/core/testing';

import {AuthCallbackService} from './auth-callback.service';

describe('AuthCallbackService', () => {
  let service: AuthCallbackService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AuthCallbackService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
