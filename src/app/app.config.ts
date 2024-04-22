import {ApplicationConfig, ErrorHandler, Injectable} from '@angular/core';
import {provideRouter} from '@angular/router';

import {routes} from './app.routes';
import {provideHttpClient} from "@angular/common/http";
import {environment} from "../environments/environment";
import {provideAnimationsAsync} from '@angular/platform-browser/animations/async';
import {GlobalErrorHandler} from "./http/error.handler";

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(),
    provideAnimationsAsync(),
    { provide: ErrorHandler, useClass: GlobalErrorHandler }
  ]
};

@Injectable({
  providedIn: "root",
})
export class ShvatkaConfig {
  apiUrl: string;
  botUsername: string;
  mainUrl: string;
  constructor() {
    this.apiUrl = environment.apiUrl
    this.botUsername = environment.botUsername
    this.mainUrl = environment.mainUrl
  }
}
