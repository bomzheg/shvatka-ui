import {Component, OnInit} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {NgIf} from '@angular/common';
import {HttpErrorResponse} from '@angular/common/http';
import {UserService} from '../auth/user.service';
import {SnackbarService} from '../snackbar/snackbar.service';
import {PushToggleComponent} from '../push/push-toggle.component';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [FormsModule, NgIf, PushToggleComponent],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent implements OnInit {
  newUsername = '';
  isUsernameSubmitting = false;
  newPassword = '';
  confirmPassword = '';
  isSubmitting = false;

  constructor(
    private userService: UserService,
    private snackbar: SnackbarService,
  ) {
  }

  async ngOnInit() {
    if (!this.userService.isUserLoaded()) {
      await this.userService.loadMe();
    }
    this.newUsername = this.username;
  }

  get isAuthenticated(): boolean {
    return this.userService.isUserLoaded();
  }

  get username(): string {
    return this.userService.getMe()?.username || this.userService.getMe()?.name_mention || '';
  }

  changeUsername() {
    const username = this.newUsername.trim();
    if (!username) {
      this.snackbar.error('Введите новое имя пользователя');
      return;
    }

    if (username === this.username) {
      this.snackbar.error('Имя пользователя не изменилось');
      return;
    }

    this.isUsernameSubmitting = true;
    this.userService.changeUsername(username)
      .subscribe({
        next: async () => {
          await this.userService.loadMe();
          this.newUsername = this.username;
          this.isUsernameSubmitting = false;
          this.snackbar.success('Имя пользователя успешно изменено');
        },
        error: (err) => {
          this.isUsernameSubmitting = false;
          if (err instanceof HttpErrorResponse && err.status === 401) {
            this.snackbar.error('Нужно войти в аккаунт');
            return;
          }

          this.snackbar.error('Не удалось изменить имя пользователя');
        },
      });
  }

  changePassword() {
    if (!this.newPassword || !this.confirmPassword) {
      this.snackbar.error('Заполните оба поля пароля');
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.snackbar.error('Пароли не совпадают');
      return;
    }

    this.isSubmitting = true;
    this.userService.changePassword(this.newPassword)
      .subscribe({
        next: () => {
          this.newPassword = '';
          this.confirmPassword = '';
          this.isSubmitting = false;
          this.snackbar.success('Пароль успешно изменён');
        },
        error: (err) => {
          this.isSubmitting = false;
          if (err instanceof HttpErrorResponse && err.status === 401) {
            this.snackbar.error('Нужно войти в аккаунт');
            return;
          }

          this.snackbar.error('Не удалось изменить пароль');
        },
      });
  }
}
