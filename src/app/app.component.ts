import {AfterViewInit, Component, ElementRef, ViewChild} from '@angular/core';
import {MatIconRegistry} from '@angular/material/icon';
import {APP_BASE_HREF, CommonModule} from '@angular/common';
import {RouterOutlet} from '@angular/router';
import {HeaderComponent} from "./header/header.component";
import {environment} from "../environments/environment";
import {DomSanitizer} from "@angular/platform-browser";

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
export class AppComponent implements AfterViewInit {
  title = 'shvatka';
  @ViewChild('WebAppScript', {static: true}) script: ElementRef | undefined;
  constructor(
    private matIconRegistry: MatIconRegistry,
    private domSanitizer:DomSanitizer,
  ) {
    this.matIconRegistry.addSvgIcon(
      "account-circle",
      domSanitizer.bypassSecurityTrustResourceUrl('/assets/account_circle.svg')
    )
  }

  convertToScript() {
    const element = this.script?.nativeElement;
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-web-app.js';
    element.parentElement.replaceChild(script, element);
  }


  ngAfterViewInit() {
    this.convertToScript();
  }

}
