import {Component} from '@angular/core';
import {AuthService} from "./auth.service";
import {FormsModule} from "@angular/forms";
import {NgClass, NgIf, NgStyle} from "@angular/common";
import {UserService} from "./user.service";

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
  constructor(public authService: AuthService, private userService: UserService) {
    authService.registerCallback(this);
  }

  async login(username: string | undefined, password: string | undefined) {
    await this.authService.login(username!, password!);
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
}
