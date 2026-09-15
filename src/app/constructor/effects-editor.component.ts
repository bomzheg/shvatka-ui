import {Component, EventEmitter, Input, Output} from "@angular/core";
import {CdkDragDrop, DragDropModule, moveItemInArray} from "@angular/cdk/drag-drop";
import {FormsModule} from "@angular/forms";
import {HintType} from "../domain/game.models";
import {EffectsPayload, HintPayload, UploadedFile} from "./constructor.models";
import {HintEditorComponent} from "./hint-editor.component";
import {HintTypePickerComponent} from "./hint-type-picker.component";
import {MatIcon} from "@angular/material/icon";
import {AppIcon} from "../ui/icons";

@Component({
  selector: "app-effects-editor",
  standalone: true,
  imports: [FormsModule, DragDropModule, HintEditorComponent, HintTypePickerComponent, MatIcon],
  templateUrl: "./effects-editor.component.html",
  styleUrl: "./effects-editor.component.scss",
})
export class EffectsEditorComponent {
  @Input({required: true}) effects!: EffectsPayload;
  @Input() files: UploadedFile[] = [];
  @Input() gameId: number | undefined;
  @Input() objectUrls?: Map<string, string>;
  @Input() disabled = false;
  /** Upload through the superuser endpoint (completed-game editing). */
  @Input() adminUpload = false;
  /** Whether the level-up ("завершение уровня") toggle is shown. */
  @Input() allowLevelUp = true;
  /** Ids of the other levels — targets for the next_level jump. */
  @Input() levelIds: string[] = [];
  @Output() fileUploaded = new EventEmitter<UploadedFile>();
  @Output() fileRenamed = new EventEmitter<UploadedFile>();

  protected readonly AppIcon = AppIcon;

  onLevelUpChange() {
    if (!this.effects.level_up) {
      this.effects.next_level = null;
    }
  }

  addHint(type: HintType) {
    this.effects.hints.push({type});
  }

  removeHint(index: number) {
    this.effects.hints.splice(index, 1);
  }

  /** A lone part has nowhere to go, so the grip and arrows stay away. */
  canReorder(): boolean {
    return !this.disabled && this.effects.hints.length > 1;
  }

  moveHint(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= this.effects.hints.length) {
      return;
    }
    moveItemInArray(this.effects.hints, index, target);
  }

  onHintDrop(event: CdkDragDrop<HintPayload[]>) {
    moveItemInArray(this.effects.hints, event.previousIndex, event.currentIndex);
  }

  onFileUploaded(file: UploadedFile) {
    this.fileUploaded.emit(file);
  }

  onFileRenamed(file: UploadedFile) {
    this.fileRenamed.emit(file);
  }
}
