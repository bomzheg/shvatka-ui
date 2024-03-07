import {Component, OnInit} from '@angular/core';
import {NgClass, NgOptimizedImage, NgStyle} from "@angular/common";
import {AuthComponent} from "../auth/auth.component";
import {AuthService} from "../auth/auth.service";
import {UserService} from "../auth/user.service";
import {RouterLink, RouterLinkActive} from "@angular/router";
import {MatIcon} from "@angular/material/icon";

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    NgOptimizedImage,
    AuthComponent,
    NgClass,
    NgStyle,
    RouterLink,
    RouterLinkActive,
    MatIcon,
  ],
  templateUrl: 'header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent implements OnInit {
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

  async ngOnInit() {
    await this.userService.loadMe();
  }

}
