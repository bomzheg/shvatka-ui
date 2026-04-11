import {Component, OnInit} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {NgIf} from '@angular/common';
import {HttpErrorResponse} from '@angular/common/http';
import {MatSnackBar} from '@angular/material/snack-bar';
import {UserService} from '../auth/user.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [FormsModule, NgIf],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent implements OnInit {
  newPassword = '';
  confirmPassword = '';
  isSubmitting = false;

  constructor(
    private userService: UserService,
    private snackBar: MatSnackBar,
  ) {
  }

  async ngOnInit() {
    if (!this.userService.isUserLoaded()) {
      await this.userService.loadMe();
    }
  }

  get isAuthenticated(): boolean {
    return this.userService.isUserLoaded();
  }

  get username(): string {
    return this.userService.getMe()?.username || '';
  }

  changePassword() {
    if (!this.newPassword || !this.confirmPassword) {
      this.snackBar.open('Заполните оба поля пароля', 'OK');
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.snackBar.open('Пароли не совпадают', 'OK');
      return;
    }

    this.isSubmitting = true;
    this.userService.changePassword(this.newPassword)
      .subscribe({
        next: () => {
          this.newPassword = '';
          this.confirmPassword = '';
          this.isSubmitting = false;
          this.snackBar.open('Пароль успешно изменён', 'OK');
        },
        error: (err) => {
          this.isSubmitting = false;
          if (err instanceof HttpErrorResponse && err.status === 401) {
            this.snackBar.open('Нужно войти в аккаунт', 'OK');
            return;
          }

          this.snackBar.open('Не удалось изменить пароль', 'OK');
        },
      });
  }
}
