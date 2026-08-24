import {TestBed} from '@angular/core/testing';
import {MatSnackBar} from '@angular/material/snack-bar';
import {Subject} from 'rxjs';

import {SnackbarService} from './snackbar.service';

const DOC_URL = 'https://docs.example.org/shvatka/3.7.0/player/play.html#keys';

describe('SnackbarService', () => {
  let snackBar: jasmine.SpyObj<MatSnackBar>;
  let action: Subject<void>;
  let service: SnackbarService;

  beforeEach(() => {
    action = new Subject<void>();
    snackBar = jasmine.createSpyObj<MatSnackBar>('MatSnackBar', ['open']);
    snackBar.open.and.returnValue({onAction: () => action.asObservable()} as never);
    TestBed.configureTestingModule({
      providers: [SnackbarService, {provide: MatSnackBar, useValue: snackBar}],
    });
    service = TestBed.inject(SnackbarService);
  });

  it('offers the documentation as the action of the error', () => {
    service.errorWithDoc('Это не ключ', DOC_URL);
    const [message, actionLabel] = snackBar.open.calls.mostRecent().args;
    expect(message).toBe('Это не ключ');
    expect(actionLabel).toBe('Справка');
  });

  it('opens the page when the action is pressed', () => {
    const open = spyOn(window, 'open');
    service.errorWithDoc('Это не ключ', DOC_URL);
    action.next();
    expect(open).toHaveBeenCalledWith(DOC_URL, '_blank', 'noopener');
  });

  it('shows an ordinary error when there is no page', () => {
    service.errorWithDoc('Что-то пошло не так', null);
    expect(snackBar.open.calls.mostRecent().args[1]).toBe('OK');
  });

  it('never opens a url that is not http', () => {
    service.errorWithDoc('Что-то пошло не так', 'javascript:alert(1)');
    expect(snackBar.open.calls.mostRecent().args[1]).toBe('OK');
  });
});
