import {ApplicationConfig, Injectable} from '@angular/core';
import {provideRouter} from '@angular/router';

import {routes} from './app.routes';
import {provideHttpClient} from "@angular/common/http";
import {environment} from "../environments/environment";

export const appConfig: ApplicationConfig = {
  providers: [provideRouter(routes), provideHttpClient()]
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
