import {Component, Inject, OnInit} from '@angular/core';
import {MatIconRegistry} from '@angular/material/icon';
import {APP_BASE_HREF, CommonModule, DOCUMENT} from '@angular/common';
import {NavigationEnd, Router, RouterOutlet} from '@angular/router';
import {HeaderComponent} from "./header/header.component";
import {environment} from "../environments/environment";
import {DomSanitizer} from "@angular/platform-browser";
import {ThemeService} from "./theme/theme.service";
import {filter} from "rxjs";
import {VersionInfo, VersionService} from "./version/version.service";
import {PushService} from "./push/push.service";
import {registerAppIcons} from "./ui/icons";

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
export class AppComponent implements OnInit {
  title = 'shvatka';
  frontendVersion: VersionInfo | undefined;
  backendVersion: VersionInfo | undefined;
  showDebugInfo = false;
  debugInfo = "";
  isOneTimeTokenRoute = false;
  private readonly window: (Window & typeof globalThis) | undefined;

  constructor(
    private matIconRegistry: MatIconRegistry,
    domSanitizer:DomSanitizer,
    private themeService: ThemeService,
    private versionService: VersionService,
    private router: Router,
    private pushService: PushService,
    @Inject(DOCUMENT) private document: Document,
  ) {
    this.matIconRegistry.addSvgIcon(
      "account-circle",
      domSanitizer.bypassSecurityTrustResourceUrl('/assets/account_circle.svg')
    );
    registerAppIcons(this.matIconRegistry, domSanitizer);
    this.themeService.getMode();
    this.window = this.document.defaultView ?? undefined;
  }

  ngOnInit() {
    this.updateOneTimeTokenRouteFlag();
    this.router.events.pipe(filter(event => event instanceof NavigationEnd)).subscribe(() => this.updateOneTimeTokenRouteFlag());

    this.versionService.getFrontendVersion().subscribe(version => this.frontendVersion = version);
    this.versionService.getBackendVersion().subscribe(version => this.backendVersion = version);
    this.debugInfo = this.window?.sessionStorage.getItem("debug-log") ?? "";

    // Registers the push service worker and, if permission is already granted,
    // refreshes the saved subscription. Never prompts for permission on load.
    this.pushService.init();
  }

  toggleDebugInfo() {
    this.showDebugInfo = !this.showDebugInfo;
    this.debugInfo = this.window?.sessionStorage.getItem("debug-log") ?? "";
  }



  private updateOneTimeTokenRouteFlag() {
    const pathname = this.window?.location?.pathname ?? this.router.url.split('?')[0];
    this.isOneTimeTokenRoute = pathname.endsWith('/auth/one-time-token');
  }

  formatVersionShort(version: VersionInfo | undefined): string {
    if (!version) {
      return "n/a";
    }

    const ref = version.vcs_name;
    const hash = version.vcs_hash ? version.vcs_hash.slice(0, 8) : "unknown";
    return ref ? `${ref}@${hash}` : hash;
  }

  formatVersionTime(version: VersionInfo | undefined): string {
    if (!version) {
      return "";
    }

    return version.build_at || version.commit_at || "";
  }
}
