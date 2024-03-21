import {AfterViewInit, Component, ElementRef, OnInit, ViewChild} from '@angular/core';
import {MatSnackBar} from "@angular/material/snack-bar";
import {AuthService} from "./auth.service";
import {FormsModule} from "@angular/forms";
import {NgClass, NgIf, NgStyle} from "@angular/common";
import {UserService} from "./user.service";
import {ShvatkaConfig} from "../app.config";
import {AuthCallbackService, UserTgAuth} from "./auth-callback.service";

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [
    FormsModule,
    NgClass,
    NgIf,
    NgStyle
  ],
  templateUrl: './auth.component.html',
  styleUrl: './auth.component.scss',
})
export class AuthComponent implements AfterViewInit, OnInit {
  username: string | undefined;
  password: string | undefined;
  isVisible: boolean = false;
  @ViewChild('script', {static: true}) script: ElementRef | undefined;

  constructor(
    public authService: AuthService,
    private userService: UserService,
    private config: ShvatkaConfig,
    private snackBar: MatSnackBar,
    private authCallbackService: AuthCallbackService,
  ) {
    authService.registerCallback(this);
  }

  login(username: string | undefined, password: string | undefined) {
    try {
      this.authService.login(username!, password!);
    } catch (e) {
     this.snackBar.open('Ошибка логина' + e, "ok");
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
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', this.config.botUsername);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-request-access', 'write');
    script.setAttribute('data-onauth', "tgOnLogin(user)")
    element.parentElement.replaceChild(script, element);
  }

  ngOnInit(): void {
    // @ts-ignore
    window["tgOnLogin"] = (user: UserTgAuth) => {
      this.authCallbackService.authenticate(user);
      this.closeLoginForm()
    };
  }
  ngAfterViewInit() {
    this.convertToScript();
  }
}
