import {Component} from '@angular/core';
import {APP_BASE_HREF, CommonModule} from '@angular/common';
import {RouterOutlet} from '@angular/router';
import {HeaderComponent} from "./header/header.component";
import {environment} from "../environments/environment";

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, HeaderComponent],
  providers: [
    {provide: APP_BASE_HREF, useValue: environment.baseHref}
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  title = 'shvatka';
}
