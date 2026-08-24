import {HttpErrorResponse} from '@angular/common/http';
import {NgZone} from '@angular/core';
import {TestBed} from '@angular/core/testing';

import {AuthService} from '../auth/auth.service';
import {DebugLogService} from '../debug/debug-log.service';
import {SnackbarService} from '../snackbar/snackbar.service';
import {GlobalErrorHandler} from './error.handler';

const DOC_URL = 'https://docs.example.org/shvatka/3.7.0/player/play.html#keys';

describe('GlobalErrorHandler', () => {
  let snackbar: jasmine.SpyObj<SnackbarService>;
  let handler: GlobalErrorHandler;

  beforeEach(() => {
    snackbar = jasmine.createSpyObj<SnackbarService>('SnackbarService', ['error', 'errorWithDoc']);
    TestBed.configureTestingModule({
      providers: [
        GlobalErrorHandler,
        {provide: SnackbarService, useValue: snackbar},
        {provide: AuthService, useValue: jasmine.createSpyObj('AuthService', ['showLoginForm'])},
        {provide: DebugLogService, useValue: jasmine.createSpyObj('DebugLogService', ['error'])},
        {provide: NgZone, useValue: new NgZone({enableLongStackTrace: false})},
      ],
    });
    handler = TestBed.inject(GlobalErrorHandler);
  });

  function fail(body: unknown, status = 422): void {
    handler.handleError(new HttpErrorResponse({status, error: body, url: '/games/1/keys'}));
  }

  it('hands the documentation link to the snackbar', () => {
    fail({type: 'InvalidKey', text: '', description: 'Это не ключ', docUrl: DOC_URL});
    const [message, docUrl] = snackbar.errorWithDoc.calls.mostRecent().args;
    expect(docUrl).toBe(DOC_URL);
    expect(message).toContain('Неверный ключ');
    expect(message).toContain('Это не ключ');
  });

  it('shows an error with no link when the backend sent no page', () => {
    fail({type: 'GameNotFound', text: '', description: 'Игра не найдена'});
    expect(snackbar.errorWithDoc.calls.mostRecent().args[1]).toBeNull();
  });

  it('leaves a body it cannot read to the plain error message', () => {
    fail('<html>502</html>', 502);
    expect(snackbar.errorWithDoc).not.toHaveBeenCalled();
    expect(snackbar.error).toHaveBeenCalled();
  });
});
