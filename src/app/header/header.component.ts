import {Component, ViewChild} from '@angular/core';
import {NgOptimizedImage} from "@angular/common";
import {AuthComponent} from "../auth/auth.component";

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    NgOptimizedImage,
    AuthComponent,
  ],
  templateUrl: 'header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent {
  authVisible = true;


  openLoginForm() {
    this.authVisible = true;
  }

}
