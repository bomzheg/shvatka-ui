import {Component, OnInit} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {HttpErrorResponse} from '@angular/common/http';
import {UserService} from '../auth/user.service';
import {SnackbarService} from '../snackbar/snackbar.service';
import {isValidUsername} from '../auth/auth-validation';

/** The two things an account owns by itself: its name and its password. */
@Component({
  selector: 'app-profile-account',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './profile-account.component.html',
  styleUrl: './profile-account.component.scss',
})
export class ProfileAccountComponent implements OnInit {
  newUsername = '';
  usernameError = '';
  isUsernameSubmitting = false;

  newPassword = '';
  confirmPassword = '';
  passwordError = '';
  isPasswordSubmitting = false;
  isPasswordFormOpen = false;

  constructor(
    private userService: UserService,
    private snackbar: SnackbarService,
  ) {
  }

  ngOnInit(): void {
    this.newUsername = this.username;
  }

  get username(): string {
    return this.userService.getMe()?.username || '';
  }

  /** Whether a password is what the account is missing to log in without Telegram. */
  get hasVerifiedEmail(): boolean {
    return this.userService.getMe()?.email?.is_verified === true;
  }

  get isUsernameDirty(): boolean {
    return this.newUsername.trim() !== this.username;
  }

  changeUsername() {
    const username = this.newUsername.trim();
    if (!isValidUsername(username)) {
      this.usernameError = 'Латиница, цифры и подчёркивание, от 3 до 50 символов';
      return;
    }

    if (username === this.username) {
      this.usernameError = 'Имя пользователя не изменилось';
      return;
    }

    this.usernameError = '';
    this.isUsernameSubmitting = true;
    this.userService.changeUsername(username)
      .subscribe({
        next: async () => {
          await this.userService.loadMe();
          this.newUsername = this.username;
          this.isUsernameSubmitting = false;
          this.snackbar.success('Имя пользователя изменено');
        },
        error: (err) => {
          this.isUsernameSubmitting = false;
          if (err instanceof HttpErrorResponse && err.status === 401) {
            this.snackbar.error('Нужно войти в аккаунт');
            return;
          }
          if (err instanceof HttpErrorResponse && err.status === 409) {
            this.usernameError = 'Это имя уже занято';
            return;
          }

          this.snackbar.error('Не удалось изменить имя пользователя');
        },
      });
  }

  openPasswordForm() {
    this.isPasswordFormOpen = true;
  }

  cancelPasswordForm() {
    this.isPasswordFormOpen = false;
    this.newPassword = '';
    this.confirmPassword = '';
    this.passwordError = '';
  }

  changePassword() {
    if (!this.newPassword || !this.confirmPassword) {
      this.passwordError = 'Заполните оба поля';
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.passwordError = 'Пароли не совпадают';
      return;
    }

    this.passwordError = '';
    this.isPasswordSubmitting = true;
    this.userService.changePassword(this.newPassword)
      .subscribe({
        next: () => {
          this.isPasswordSubmitting = false;
          this.cancelPasswordForm();
          this.snackbar.success('Пароль изменён');
        },
        error: (err) => {
          this.isPasswordSubmitting = false;
          if (err instanceof HttpErrorResponse && err.status === 401) {
            this.snackbar.error('Нужно войти в аккаунт');
            return;
          }

          this.snackbar.error('Не удалось изменить пароль');
        },
      });
  }
}
