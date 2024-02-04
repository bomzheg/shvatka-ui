import {Component, Inject, OnInit} from '@angular/core';
import {APP_BASE_HREF, CommonModule, DOCUMENT} from '@angular/common';
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
export class AppComponent implements OnInit{
  title = 'shvatka';
  constructor(@Inject(DOCUMENT) private document: any) {

  }
  ngOnInit(): void {
    let bases = this.document.getElementsByTagName('base');

    if (bases.length > 0) {
      bases[0].setAttribute('href', environment.baseHref);

    }
  }
}
