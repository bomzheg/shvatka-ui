import {ErrorHandler, Injectable, NgZone} from "@angular/core";
import {MatSnackBar} from "@angular/material/snack-bar";

@Injectable({
  providedIn: 'root'
})
export class GlobalErrorHandler implements ErrorHandler {
  constructor(
    private _snackBar: MatSnackBar,
    private _zone: NgZone,
  ) { }

  handleError(error: any): void {
    this._zone.run(() => {
      console.log(JSON.stringify(error));
      this._snackBar.open("Какая-то сетевая ошибка=(", 'Закрыть', { duration: 3000 });
    });
  }
}
