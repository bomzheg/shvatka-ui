import {Component} from '@angular/core';
import {NgClass, NgOptimizedImage, NgStyle} from "@angular/common";
import {AuthComponent} from "../auth/auth.component";
import {AuthService} from "../auth/auth.service";
import {UserService} from "../auth/user.service";

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    NgOptimizedImage,
    AuthComponent,
    NgClass,
    NgStyle,
  ],
  templateUrl: 'header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent {
  constructor(private authService: AuthService, private userService: UserService) {
  }


  openLoginForm() {
    this.authService.showLoginForm();
  }

  logout() {
    this.authService.logout();
    this.userService.clearUser();
  }

  getMe() {
    return this.userService.getMe();
  }

  isAuthenticated() {
    return this.userService.isUserLoaded();
  }

}
