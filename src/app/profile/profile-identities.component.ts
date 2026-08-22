import {Component} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {HttpErrorResponse} from '@angular/common/http';
import {MatIcon} from '@angular/material/icon';
import {AuthService} from '../auth/auth.service';
import {EmailIdentity, TgIdentity, UserService} from '../auth/user.service';
import {SnackbarService} from '../snackbar/snackbar.service';
import {EmailConfirmFormComponent} from '../auth/email-confirm-form.component';
import {isValidEmail, normalizeEmail} from '../auth/auth-validation';
import {AppIcon} from '../ui/icons';

/**
 * Everything the account can be signed in with: email, Telegram, forum.
 *
 * The email is the only one that can be changed here. A verified address keeps
 * working while the new one waits for its code, so the backend reports the move
 * separately, as `pending_email`, and this component follows that state rather
 * than guessing from what was typed.
 */
@Component({
  selector: 'app-profile-identities',
  standalone: true,
  imports: [FormsModule, EmailConfirmFormComponent, MatIcon],
  templateUrl: './profile-identities.component.html',
  styleUrl: './profile-identities.component.scss',
})
export class ProfileIdentitiesComponent {
  protected readonly AppIcon = AppIcon;

  email = '';
  emailError = '';
  isSubmitting = false;
  /** Set while the user is typing another address over an existing one. */
  isEditingEmail = false;

  constructor(
    private authService: AuthService,
    private userService: UserService,
    private snackbar: SnackbarService,
  ) {
  }

  get linkedEmail(): EmailIdentity | null {
    return this.userService.getMe()?.email ?? null;
  }

  /** An address being moved to, while {@link linkedEmail} still works. */
  get pendingEmail(): string | null {
    return this.userService.getMe()?.pending_email ?? null;
  }

  get isEmailVerified(): boolean {
    return this.linkedEmail?.is_verified === true;
  }

  /** The address whose code is being asked for, if any. */
  get emailAwaitingCode(): string | null {
    if (this.pendingEmail) {
      return this.pendingEmail;
    }
    if (this.linkedEmail && !this.isEmailVerified) {
      return this.linkedEmail.email ?? null;
    }
    return null;
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

  /** Open the input — either to link the first email or to move to another one. */
  startEditingEmail() {
    this.email = '';
    this.emailError = '';
    this.isEditingEmail = true;
  }

  cancelEditingEmail() {
    this.isEditingEmail = false;
    this.emailError = '';
  }

  submitEmail() {
    const email = normalizeEmail(this.email);
    if (!isValidEmail(email)) {
      this.emailError = 'Введите корректный email';
      return;
    }

    if (this.isEmailVerified && email === this.linkedEmail?.email) {
      this.emailError = 'Этот email уже привязан к аккаунту';
      return;
    }

    this.emailError = '';
    this.isSubmitting = true;
    this.authService.linkEmail(email)
      .subscribe({
        next: async () => {
          this.isSubmitting = false;
          this.isEditingEmail = false;
          this.snackbar.success(`Код подтверждения отправлен на ${email}`);
          // The server decides what happened: a pending address is replaced,
          // a verified one is only scheduled to change.
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
            this.snackbar.error('Не удалось сохранить email');
          }
        },
      });
  }

  async onEmailConfirmed() {
    this.snackbar.success('Email подтверждён');
    await this.userService.loadMe();
  }

  openTgLinkForm() {
    this.authService.showTgLinkForm();
  }
}
