import {bootstrapApplication} from '@angular/platform-browser';
import {appConfig} from './app/app.config';
import {AppComponent} from './app/app.component';
import {environment} from "./environments/environment";

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));

declare var  __webpack_public_path__: string;
__webpack_public_path__ = environment.baseHref;
