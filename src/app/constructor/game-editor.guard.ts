import {CanDeactivateFn} from "@angular/router";
import {GameEditorComponent} from "./game-editor.component";

/** Prevent router navigation from discarding an editor working copy. */
export const gameEditorUnsavedChangesGuard: CanDeactivateFn<GameEditorComponent> = component =>
  component.canLeaveEditor();
