import {Component} from '@angular/core';
import {AuthService} from "./auth.service";
import {FormsModule} from "@angular/forms";
import {NgClass, NgIf, NgStyle} from "@angular/common";

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
export class AuthComponent {
  username: string | undefined;
  password: string | undefined;
  isVisible: boolean = false;
  constructor(public authService: AuthService) {
    authService.registerCallback(this);
  }

  login(username: string | undefined, password: string | undefined) {
    if (username === undefined || password === undefined) {
      console.log("username or password is undefined");
      return;
    }
    this.authService.login(username, password);
  }

  closeLoginForm() {
    this.isVisible = false;
  }

  public openLoginForm() {
    this.isVisible = true;
  }

}
