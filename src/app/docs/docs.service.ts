import {Injectable} from "@angular/core";

import {ShvatkaConfig} from "../app.config";
import {DocPage} from "./doc-pages";

/**
 * Builds links into the published documentation.
 *
 * The engine sends a ready `docUrl` with the errors it refuses a request with;
 * this is the other half — the pages the ui points at on its own, from a hint
 * next to a form rather than from a failure.
 */
@Injectable({providedIn: "root"})
export class DocsService {
  constructor(private config: ShvatkaConfig) {}

  pageUrl(page: DocPage): string {
    return `${this.config.docsUrl.replace(/\/+$/, "")}/${page}.html`;
  }
}
