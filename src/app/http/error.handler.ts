import {ErrorHandler, Injectable, NgZone} from "@angular/core";
import {MatSnackBar} from "@angular/material/snack-bar";
import {HttpErrorResponse} from "@angular/common/http";

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
      if (!(error instanceof HttpErrorResponse)) {
        console.error(error)
        return
      }
      if (error.status === 401) {
        console.log("401 response: " + JSON.stringify(error));
        this._snackBar.open("Для выполнения этой операции необходимо залогиниться", 'Закрыть', {duration: 3000});
      } else {
        console.error(error);
        this._snackBar.open("Какая-то сетевая(?) ошибка=(", 'Закрыть', {duration: 3000});
      }
    });
  }
}
