import {AfterViewInit, Component, ElementRef, OnInit, ViewChild} from '@angular/core';
import {MatSnackBar} from "@angular/material/snack-bar";
import {AuthService} from "./auth.service";
import {FormsModule} from "@angular/forms";
import {NgClass, NgIf, NgStyle} from "@angular/common";
import {UserService} from "./user.service";
import {ShvatkaConfig} from "../app.config";
import {HttpErrorResponse} from "@angular/common/http";

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
  ) {
    authService.registerCallback(this);
  }

  login(username: string | undefined, password: string | undefined) {
      this.authService.login(username!, password!)
        .subscribe({
          next: () => {this.updateUser().then(() => this.closeLoginForm())},
          error: (err) => {
            if (err instanceof HttpErrorResponse && err.status === 401) {
              console.error("auth error " + err.message);
              console.log(JSON.stringify(err));
              this.snackBar.open('Неверные имя пользователя или пароль', "ok");
            } else {
              throw err;
            }
          },
        });

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
}
