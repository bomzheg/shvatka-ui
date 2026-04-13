import {Component} from '@angular/core';
import {MatIconRegistry} from '@angular/material/icon';
import {APP_BASE_HREF, CommonModule} from '@angular/common';
import {RouterOutlet} from '@angular/router';
import {HeaderComponent} from "./header/header.component";
import {environment} from "../environments/environment";
import {DomSanitizer} from "@angular/platform-browser";
import {ThemeService} from "./theme/theme.service";

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
  constructor(
    private matIconRegistry: MatIconRegistry,
    domSanitizer:DomSanitizer,
    private themeService: ThemeService,
  ) {
    this.matIconRegistry.addSvgIcon(
      "account-circle",
      domSanitizer.bypassSecurityTrustResourceUrl('/assets/account_circle.svg')
    );
    this.themeService.getMode();
  }

}
