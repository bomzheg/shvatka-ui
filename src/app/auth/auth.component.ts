import {Component, Input} from '@angular/core';
import {AuthService} from "./auth.service";
import {FormsModule} from "@angular/forms";
import {NgClass, NgIf} from "@angular/common";

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [
    FormsModule,
    NgClass,
    NgIf
  ],
  templateUrl: './auth.component.html',
  styleUrl: './auth.component.scss',
})
export class AuthComponent {
  username: string | undefined;
  password: string | undefined;
  @Input("visible")
  visible: boolean = false;
  constructor(private authService: AuthService) {
  }

  login(username: string | undefined, password: string | undefined) {
    if (username === undefined || password === undefined) {
      console.log("username or password is undefined");
      return;
    }
    this.authService.login(username, password);
  }

  closeLoginForm() {
    this.visible = false;
  }

  openLoginForm() {
    this.visible = true;
  }

}
