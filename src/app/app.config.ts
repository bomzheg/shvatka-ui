import {ApplicationConfig, Injectable} from '@angular/core';
import {provideRouter} from '@angular/router';

import {routes} from './app.routes';
import {provideHttpClient} from "@angular/common/http";

export const appConfig: ApplicationConfig = {
  providers: [provideRouter(routes), provideHttpClient()]
};

@Injectable({
  providedIn: "root",
})
export class ShvatkaConfig {
  apiUrl = 'https://nemesis.bomzheg.dev/shvatka_test';
  botUsername = "shvatkatestbot";
}
