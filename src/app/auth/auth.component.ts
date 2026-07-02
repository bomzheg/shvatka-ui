import {AfterViewInit, Component, ElementRef, OnInit, ViewChild} from '@angular/core';
import {AuthService} from "./auth.service";
import {SnackbarService} from "../snackbar/snackbar.service";
import {FormsModule} from "@angular/forms";
import {NgClass} from "@angular/common";
import {UserService} from "./user.service";
import {ShvatkaConfig} from "../app.config";
import {HttpErrorResponse} from "@angular/common/http";
import {EmailConfirmFormComponent} from "./email-confirm-form.component";
import {errorDetail, isValidEmail, isValidUsername, normalizeEmail} from "./auth-validation";

export type AuthFormMode = 'login' | 'emailLogin' | 'register' | 'confirm';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [
    FormsModule,
    NgClass,
    EmailConfirmFormComponent,
  ],
  templateUrl: './auth.component.html',
  styleUrl: './auth.component.scss',
})
export class AuthComponent implements AfterViewInit, OnInit {
  username: string | undefined;
  password: string | undefined;

  loginEmail: string = '';
  loginEmailPassword: string = '';
  loginEmailError: string = '';

  registerUsername: string = '';
  registerEmail: string = '';
  registerPassword: string = '';
  registerUsernameError: string = '';
  registerEmailError: string = '';
  registerPasswordError: string = '';

  confirmationEmail: string = '';

  mode: AuthFormMode = 'login';
  isVisible: boolean = false;
  isSubmitting: boolean = false;
  @ViewChild('script', {static: true}) script: ElementRef | undefined;

  constructor(
    public authService: AuthService,
    private userService: UserService,
    private config: ShvatkaConfig,
    private snackbar: SnackbarService,
  ) {
    authService.registerCallback(this);
  }

  login(username: string | undefined, password: string | undefined) {
      this.authService.login(username!, password!)
        .subscribe({
          next: () => {
            this.completeLogin();
          },
          error: (err) => {
            if (err instanceof HttpErrorResponse && err.status === 401) {
              console.error("auth error " + err.message);
              console.log(JSON.stringify(err));
              this.snackbar.error('Неверные имя пользователя или пароль');
            } else {
              throw err;
            }
          },
        });

  }

  loginWithEmail() {
    const email = normalizeEmail(this.loginEmail);
    if (!isValidEmail(email)) {
      this.loginEmailError = 'Введите корректный email';
      return;
    }
    if (!this.loginEmailPassword) {
      this.loginEmailError = 'Введите пароль';
      return;
    }

    this.loginEmailError = '';
    this.isSubmitting = true;
    this.authService.loginWithEmail(email, this.loginEmailPassword)
      .subscribe({
        next: () => {
          this.isSubmitting = false;
          this.completeLogin();
        },
        error: (err) => {
          this.isSubmitting = false;
          if (err instanceof HttpErrorResponse && err.status === 401) {
            this.loginEmailError = 'Неверный email или пароль. Если вы не подтвердили email — получите код по ссылке ниже.';
            return;
          }

          this.snackbar.error('Не удалось войти');
        },
      });
  }

  register() {
    const username = this.registerUsername.trim();
    const email = normalizeEmail(this.registerEmail);

    this.registerUsernameError = isValidUsername(username)
      ? ''
      : 'Имя пользователя: 3-50 символов, только латиница, цифры и «_»';
    this.registerEmailError = isValidEmail(email) ? '' : 'Введите корректный email';
    this.registerPasswordError = this.registerPassword ? '' : 'Введите пароль';
    if (this.registerUsernameError || this.registerEmailError || this.registerPasswordError) {
      return;
    }

    this.isSubmitting = true;
    this.authService.registerWithEmail(username, email, this.registerPassword)
      .subscribe({
        next: () => {
          this.isSubmitting = false;
          this.snackbar.success(`Код подтверждения отправлен на ${email}`);
          this.openConfirmation(email);
        },
        error: (err) => {
          this.isSubmitting = false;
          if (!(err instanceof HttpErrorResponse)) {
            throw err;
          }

          const detail = errorDetail(err);
          if (err.status === 409 && detail === 'email already exists') {
            this.registerEmailError = 'Этот email уже используется';
          } else if (err.status === 409 && detail === 'username already occupied') {
            this.registerUsernameError = 'Это имя пользователя уже занято';
          } else if (err.status === 422 && detail === 'invalid email') {
            this.registerEmailError = 'Введите корректный email';
          } else if (err.status === 422 && detail === 'invalid username') {
            this.registerUsernameError = 'Имя пользователя: 3-50 символов, только латиница, цифры и «_»';
          } else {
            this.snackbar.error('Не удалось зарегистрироваться');
          }
        },
      });
  }

  onEmailConfirmed() {
    this.snackbar.success('Email подтверждён — теперь можно войти');
    this.loginEmail = this.confirmationEmail;
    this.loginEmailPassword = '';
    this.switchMode('emailLogin');
  }

  requestConfirmationCode() {
    const email = normalizeEmail(this.loginEmail);
    if (!isValidEmail(email)) {
      this.loginEmailError = 'Введите email, чтобы получить код подтверждения';
      return;
    }

    this.authService.resendEmailCode(email)
      .subscribe({
        next: () => {
          this.snackbar.info('Если этот email зарегистрирован, код отправлен');
          this.openConfirmation(email);
        },
        error: () => this.snackbar.error('Не удалось отправить код'),
      });
  }

  switchMode(mode: AuthFormMode) {
    this.mode = mode;
    this.loginEmailError = '';
    this.registerUsernameError = '';
    this.registerEmailError = '';
    this.registerPasswordError = '';
  }

  formTitle(): string {
    switch (this.mode) {
      case 'login':
        return 'Авторизация';
      case 'emailLogin':
        return 'Вход по email';
      case 'register':
        return 'Регистрация';
      case 'confirm':
        return 'Подтверждение email';
    }
  }

  closeLoginForm() {
    this.isVisible = false;
  }

  public openLoginForm() {
    this.isVisible = true;
  }

  async updateUser() {
    await this.userService.loadMe()
  }

  convertToScript() {
    const element = this.script?.nativeElement;
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?23';
    script.setAttribute('data-telegram-login', this.config.botUsername);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-request-access', 'write');
    script.setAttribute('data-onauth', "tgOnLogin(user)")
    element.parentElement.replaceChild(script, element);
  }

  ngOnInit(): void {
    // @ts-ignore
    window["tgOnLogin"] = (user: any) => {
      this.authService.authenticate(user)
        .subscribe(() => {
          this.updateUser()
            .then(() => {
              this.closeLoginForm();
              const el = document.getElementById("loginFormBackCover")!;
              el.setAttribute("class", "hidden");
              window.location.reload();
            });
        });
    };
  }

  ngAfterViewInit() {
    this.convertToScript();
  }

  private openConfirmation(email: string) {
    this.confirmationEmail = email;
    this.switchMode('confirm');
  }

  private completeLogin() {
    this.updateUser().then(() => {
      this.closeLoginForm();
      window.location.reload();
    });
  }
}
