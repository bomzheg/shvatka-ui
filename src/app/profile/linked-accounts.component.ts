import {Component} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {HttpErrorResponse} from '@angular/common/http';
import {AuthService} from '../auth/auth.service';
import {EmailIdentity, TgIdentity, UserService} from '../auth/user.service';
import {SnackbarService} from '../snackbar/snackbar.service';
import {EmailConfirmFormComponent} from '../auth/email-confirm-form.component';
import {isValidEmail, normalizeEmail} from '../auth/auth-validation';

@Component({
  selector: 'app-linked-accounts',
  standalone: true,
  imports: [FormsModule, EmailConfirmFormComponent],
  templateUrl: './linked-accounts.component.html',
  styleUrl: './linked-accounts.component.scss',
})
export class LinkedAccountsComponent {
  email = '';
  emailError = '';
  isSubmitting = false;
  // Set when the user wants to replace a pending (unverified) email with another one.
  showEmailForm = false;

  constructor(
    private authService: AuthService,
    private userService: UserService,
    private snackbar: SnackbarService,
  ) {
  }

  get linkedEmail(): EmailIdentity | null {
    return this.userService.getMe()?.email ?? null;
  }

  get linkedTg(): TgIdentity | null {
    return this.userService.getMe()?.tg ?? null;
  }

  get forumName(): string | null {
    return this.userService.getMe()?.forum?.name ?? null;
  }

  tgDisplayName(): string {
    const tg = this.linkedTg;
    if (!tg) {
      return '';
    }
    if (tg.username) {
      return `@${tg.username}`;
    }
    return [tg.first_name, tg.last_name].filter(v => !!v).join(' ') || `ID ${tg.tg_id}`;
  }

  linkEmail() {
    const email = normalizeEmail(this.email);
    if (!isValidEmail(email)) {
      this.emailError = 'Введите корректный email';
      return;
    }

    this.emailError = '';
    this.isSubmitting = true;
    this.authService.linkEmail(email)
      .subscribe({
        next: async () => {
          this.isSubmitting = false;
          this.showEmailForm = false;
          this.snackbar.success(`Код подтверждения отправлен на ${email}`);
          // Refresh identities: the unverified email now renders the confirm form.
          await this.userService.loadMe();
        },
        error: (err) => {
          this.isSubmitting = false;
          if (!(err instanceof HttpErrorResponse)) {
            throw err;
          }

          if (err.status === 401) {
            this.snackbar.error('Нужно войти в аккаунт');
          } else if (err.status === 409) {
            this.emailError = 'Этот email уже используется';
          } else if (err.status === 422) {
            this.emailError = 'Введите корректный email';
          } else {
            this.snackbar.error('Не удалось привязать email');
          }
        },
      });
  }

  async onEmailConfirmed() {
    this.snackbar.success('Email привязан к аккаунту');
    await this.userService.loadMe();
  }

  changeEmail() {
    this.email = '';
    this.showEmailForm = true;
  }

  openTgLinkForm() {
    this.authService.showTgLinkForm();
  }
}
