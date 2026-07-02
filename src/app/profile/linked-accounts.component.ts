import {AfterViewInit, Component, ElementRef, NgZone, OnInit, ViewChild} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {HttpErrorResponse} from '@angular/common/http';
import {AuthService} from '../auth/auth.service';
import {SnackbarService} from '../snackbar/snackbar.service';
import {ShvatkaConfig} from '../app.config';
import {EmailConfirmFormComponent} from '../auth/email-confirm-form.component';
import {errorDetail, isValidEmail, normalizeEmail} from '../auth/auth-validation';

@Component({
  selector: 'app-linked-accounts',
  standalone: true,
  imports: [FormsModule, EmailConfirmFormComponent],
  templateUrl: './linked-accounts.component.html',
  styleUrl: './linked-accounts.component.scss',
})
export class LinkedAccountsComponent implements OnInit, AfterViewInit {
  email = '';
  emailError = '';
  isSubmitting = false;
  isAwaitingCode = false;
  isEmailLinked = false;
  @ViewChild('linkScript', {static: true}) linkScript: ElementRef | undefined;

  constructor(
    private authService: AuthService,
    private snackbar: SnackbarService,
    private config: ShvatkaConfig,
    private zone: NgZone,
  ) {
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
        next: () => {
          this.isSubmitting = false;
          this.email = email;
          this.isAwaitingCode = true;
          this.snackbar.success(`Код подтверждения отправлен на ${email}`);
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

  onEmailConfirmed() {
    this.isAwaitingCode = false;
    this.isEmailLinked = true;
    this.snackbar.success('Email привязан к аккаунту');
  }

  cancelEmailConfirmation() {
    this.isAwaitingCode = false;
  }

  ngOnInit(): void {
    // The Telegram widget calls this callback outside the Angular zone.
    // @ts-ignore
    window['tgOnLinkTg'] = (user: any) => this.zone.run(() => this.linkTelegram(user));
  }

  ngAfterViewInit(): void {
    this.convertToScript();
  }

  private linkTelegram(tgUser: any) {
    this.authService.linkTelegram(tgUser)
      .subscribe({
        next: () => this.snackbar.success('Telegram привязан к аккаунту'),
        error: (err) => {
          if (!(err instanceof HttpErrorResponse)) {
            throw err;
          }

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

  private convertToScript() {
    const element = this.linkScript?.nativeElement;
    if (!element?.parentElement) {
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?23';
    script.setAttribute('data-telegram-login', this.config.botUsername);
    script.setAttribute('data-size', 'medium');
    script.setAttribute('data-request-access', 'write');
    script.setAttribute('data-onauth', 'tgOnLinkTg(user)');
    element.parentElement.replaceChild(script, element);
  }
}
