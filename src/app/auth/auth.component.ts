import {AfterViewInit, Component, ElementRef, NgZone, OnInit, ViewChild} from '@angular/core';
import {AuthService} from "./auth.service";
import {SnackbarService} from "../snackbar/snackbar.service";
import {FormsModule} from "@angular/forms";
import {NgClass} from "@angular/common";
import {UserService} from "./user.service";
import {ShvatkaConfig} from "../app.config";
import {HttpErrorResponse} from "@angular/common/http";
import {EmailConfirmFormComponent} from "./email-confirm-form.component";
import {errorDetail, isValidEmail, isValidUsername, normalizeEmail} from "./auth-validation";

export type AuthFormMode = 'login' | 'register' | 'confirm' | 'linkTg';

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
  loginIdentifier: string = '';
  loginPassword: string = '';
  loginError: string = '';

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
    private zone: NgZone,
  ) {
    authService.registerCallback(this);
  }

  // A username can't contain "@" and an email always does,
  // so one field is enough to pick the right login endpoint.
  isEmailLogin(): boolean {
    return this.loginIdentifier.includes('@');
  }

  login() {
    const identifier = this.loginIdentifier.trim();
    if (!identifier) {
      this.loginError = 'Введите имя пользователя или email';
      return;
    }
    if (this.isEmailLogin() && !isValidEmail(normalizeEmail(identifier))) {
      this.loginError = 'Введите корректный email';
      return;
    }
    if (!this.loginPassword) {
      this.loginError = 'Введите пароль';
      return;
    }

    this.loginError = '';
    this.isSubmitting = true;
    const request = this.isEmailLogin()
      ? this.authService.loginWithEmail(normalizeEmail(identifier), this.loginPassword)
      : this.authService.login(identifier, this.loginPassword);
    request.subscribe({
      next: () => {
        this.isSubmitting = false;
        this.completeLogin();
      },
      error: (err) => {
        this.isSubmitting = false;
        if (err instanceof HttpErrorResponse && err.status === 401) {
          this.loginError = this.isEmailLogin()
            ? 'Неверный email или пароль. Если вы не подтвердили email — получите код по ссылке ниже.'
            : 'Неверные имя пользователя или пароль';
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
    this.loginIdentifier = this.confirmationEmail;
    this.loginPassword = '';
    this.switchMode('login');
  }

  requestConfirmationCode() {
    const email = normalizeEmail(this.loginIdentifier);
    if (!isValidEmail(email)) {
      this.loginError = 'Введите email, чтобы получить код подтверждения';
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
    this.loginError = '';
    this.registerUsernameError = '';
    this.registerEmailError = '';
    this.registerPasswordError = '';
  }

  formTitle(): string {
    switch (this.mode) {
      case 'login':
        return 'Авторизация';
      case 'register':
        return 'Регистрация';
      case 'confirm':
        return 'Подтверждение email';
      case 'linkTg':
        return 'Привязка Telegram';
    }
  }

  closeLoginForm() {
    this.isVisible = false;
    if (this.mode === 'linkTg') {
      this.switchMode('login');
    }
  }

  public openLoginForm() {
    this.isVisible = true;
  }

  // The profile page reuses the modal's Telegram widget for account linking:
  // a second widget instance injected after page load does not render reliably.
  public openTgLinkForm() {
    this.switchMode('linkTg');
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
    // The Telegram widget calls this outside the Angular zone. In linkTg mode
    // the payload attaches Telegram to the current account instead of logging in.
    // @ts-ignore
    window["tgOnLogin"] = (user: any) => this.zone.run(() => {
      if (this.mode === 'linkTg') {
        this.linkTelegram(user);
        return;
      }
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
    });
  }

  ngAfterViewInit() {
    this.convertToScript();
  }

  private linkTelegram(tgUser: any) {
    this.authService.linkTelegram(tgUser)
      .subscribe({
        next: async () => {
          this.closeLoginForm();
          this.snackbar.success('Telegram привязан к аккаунту');
          await this.userService.loadMe();
        },
        error: (err) => {
          if (!(err instanceof HttpErrorResponse)) {
            throw err;
          }

          this.closeLoginForm();
          const detail = errorDetail(err);
          if (err.status === 409 && detail === 'player already has linked telegram') {
            this.snackbar.error('К вашему аккаунту уже привязан Telegram');
          } else if (err.status === 409 && detail === 'this telegram account is linked to another player') {
            this.snackbar.error('Этот Telegram-аккаунт уже привязан к другому игроку');
          } else if (err.status === 401) {
            this.snackbar.error('Не удалось проверить данные Telegram. Войдите в аккаунт и попробуйте ещё раз.');
          } else {
            this.snackbar.error('Не удалось привязать Telegram');
          }
        },
      });
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
