import {Injectable} from '@angular/core';
import {MatSnackBar, MatSnackBarRef, TextOnlySnackBar} from '@angular/material/snack-bar';

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
