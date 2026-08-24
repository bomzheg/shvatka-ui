import {ApplicationConfig, ErrorHandler, Injectable} from '@angular/core';
import {provideRouter, withRouterConfig} from '@angular/router';

import {routes} from './app.routes';
import {provideHttpClient} from "@angular/common/http";
import {environment} from "../environments/environment";
import {provideAnimationsAsync} from '@angular/platform-browser/animations/async';
import {GlobalErrorHandler} from "./http/error.handler";

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withRouterConfig({onSameUrlNavigation: 'reload'})),
    provideHttpClient(),
    provideAnimationsAsync(),
    { provide: ErrorHandler, useClass: GlobalErrorHandler }
  ]
};

/** Where the documentation lives when the deployment names no other place. */
export const DEFAULT_DOCS_URL = "https://bomzheg.github.io/Shvatka/shvatka/master";

@Injectable({
  providedIn: "root",
})
export class ShvatkaConfig {
  apiUrl: string;
  cdnUrl: string;
  botUsername: string;
  mainUrl: string;
  /**
   * The root of the published documentation, version included. A deployment
   * running a released engine points it at that tag; unset, the links go to the
   * docs of master, which never go stale.
   */
  docsUrl: string;
  constructor() {
    this.apiUrl = environment.apiUrl
    this.cdnUrl = environment.cdnUrl
    this.botUsername = environment.botUsername
    this.mainUrl = environment.mainUrl
    this.docsUrl = environment.docsUrl || DEFAULT_DOCS_URL
  }
}
