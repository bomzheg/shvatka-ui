import {Component, Input, OnDestroy} from '@angular/core';
import {FormsModule} from "@angular/forms";
import {HttpErrorResponse} from "@angular/common/http";
import {AuthService} from "./auth.service";
import {SnackbarService} from "../snackbar/snackbar.service";
import {isValidEmail, normalizeEmail} from "./auth-validation";

// The backend allows one password-reset email per 2 minutes. After a successful
// send we mirror that window client-side so the button stays disabled until the
// next request is allowed. We do NOT start the countdown on a 429: the remaining
// wait is unknown (e.g. the user reloaded the page), so we only show an error.
const RESEND_COOLDOWN_SECONDS = 120;

@Component({
  selector: 'app-forgot-password-form',
  standalone: true,
  imports: [
    FormsModule,
  ],
  templateUrl: './forgot-password-form.component.html',
  styleUrl: './forgot-password-form.component.scss',
})
export class ForgotPasswordFormComponent implements OnDestroy {
  @Input() email: string = '';

  emailError: string = '';
  isSubmitting: boolean = false;
  cooldownSeconds: number = 0;
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(
    private authService: AuthService,
    private snackbar: SnackbarService,
  ) {
  }

  submit() {
    if (this.cooldownSeconds > 0 || this.isSubmitting) {
      return;
    }

    const email = normalizeEmail(this.email);
    if (!isValidEmail(email)) {
      this.emailError = 'Введите корректный email';
      return;
    }

    this.emailError = '';
    this.isSubmitting = true;
    this.authService.forgotPassword(email)
      .subscribe({
        next: () => {
          this.isSubmitting = false;
          this.snackbar.success('Если этот email зарегистрирован, мы отправили ссылку для сброса пароля');
          this.startCooldown(RESEND_COOLDOWN_SECONDS);
        },
        error: (err) => {
          this.isSubmitting = false;
          if (err instanceof HttpErrorResponse && err.status === 429) {
            this.emailError = 'Слишком часто. Повторите попытку через пару минут.';
            return;
          }

          this.snackbar.error('Не удалось отправить ссылку для сброса пароля');
        },
      });
  }

  cooldownLabel(): string {
    const minutes = Math.floor(this.cooldownSeconds / 60);
    const seconds = this.cooldownSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  ngOnDestroy(): void {
    this.clearTimer();
  }

  private startCooldown(seconds: number) {
    this.cooldownSeconds = seconds;
    this.clearTimer();
    this.timer = setInterval(() => {
      this.cooldownSeconds -= 1;
      if (this.cooldownSeconds <= 0) {
        this.clearTimer();
      }
    }, 1000);
  }

  private clearTimer() {
    if (this.timer !== undefined) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }
}
