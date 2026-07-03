import {Component, EventEmitter, Input, Output} from '@angular/core';
import {FormsModule} from "@angular/forms";
import {HttpErrorResponse} from "@angular/common/http";
import {AuthService} from "./auth.service";
import {SnackbarService} from "../snackbar/snackbar.service";
import {isValidConfirmationCode} from "./auth-validation";

@Component({
  selector: 'app-email-confirm-form',
  standalone: true,
  imports: [
    FormsModule,
  ],
  templateUrl: './email-confirm-form.component.html',
  styleUrl: './email-confirm-form.component.scss',
})
export class EmailConfirmFormComponent {
  @Input({required: true}) email: string = '';
  @Output() confirmed = new EventEmitter<void>();

  code: string = '';
  codeError: string = '';
  isSubmitting: boolean = false;
  isResending: boolean = false;

  constructor(
    private authService: AuthService,
    private snackbar: SnackbarService,
  ) {
  }

  confirm() {
    const code = this.code.trim();
    if (!isValidConfirmationCode(code)) {
      this.codeError = 'Введите 6-значный код из письма';
      return;
    }

    this.codeError = '';
    this.isSubmitting = true;
    this.authService.confirmEmail(this.email, code)
      .subscribe({
        next: () => {
          this.isSubmitting = false;
          this.confirmed.emit();
        },
        error: (err) => {
          this.isSubmitting = false;
          if (err instanceof HttpErrorResponse && err.status === 400) {
            this.codeError = 'Неверный или просроченный код. Попробуйте ещё раз или запросите новый.';
            return;
          }

          this.snackbar.error('Не удалось подтвердить email');
        },
      });
  }

  resend() {
    this.isResending = true;
    this.authService.resendEmailCode(this.email)
      .subscribe({
        next: () => {
          this.isResending = false;
          this.codeError = '';
          this.snackbar.info('Если этот email зарегистрирован, код отправлен');
        },
        error: () => {
          this.isResending = false;
          this.snackbar.error('Не удалось отправить код');
        },
      });
  }
}
