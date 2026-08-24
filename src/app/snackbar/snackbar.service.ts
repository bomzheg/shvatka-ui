import {Injectable} from '@angular/core';
import {MatSnackBar, MatSnackBarRef, TextOnlySnackBar} from '@angular/material/snack-bar';
import {isSafeDocUrl} from '../http/api-error';

export type SnackbarType = 'success' | 'error' | 'info';

@Injectable({providedIn: 'root'})
export class SnackbarService {
  constructor(private snackBar: MatSnackBar) {}

  success(message: string, action = 'OK', duration = 3000): MatSnackBarRef<TextOnlySnackBar> {
    return this.show(message, action, duration, 'success');
  }

  error(message: string, action = 'OK', duration = 5000): MatSnackBarRef<TextOnlySnackBar> {
    return this.show(message, action, duration, 'error');
  }

  info(message: string, action = 'OK', duration = 4000): MatSnackBarRef<TextOnlySnackBar> {
    return this.show(message, action, duration, 'info');
  }

  /**
   * An error the documentation explains: the action button opens the page.
   *
   * A snackbar is text only, so the action is the only place a link can go. It
   * also stays up longer than a plain error — a link nobody has time to press
   * is no link at all. Without a usable url this is an ordinary error.
   */
  errorWithDoc(
    message: string,
    docUrl: string | null | undefined,
    duration = 10000,
  ): MatSnackBarRef<TextOnlySnackBar> {
    if (!isSafeDocUrl(docUrl)) {
      return this.error(message);
    }
    const ref = this.show(message, 'Справка', duration, 'error');
    ref.onAction().subscribe(() => window.open(docUrl, '_blank', 'noopener'));
    return ref;
  }

  private show(
    message: string,
    action: string,
    duration: number,
    type: SnackbarType,
  ): MatSnackBarRef<TextOnlySnackBar> {
    return this.snackBar.open(message, action, {
      duration,
      panelClass: [`snackbar-${type}`],
    });
  }
}
