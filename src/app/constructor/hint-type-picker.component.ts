import {Component, ElementRef, EventEmitter, Input, Output, ViewChild} from "@angular/core";
import {HintType} from "../domain/game.models";
import {ALL_HINT_TYPES, HINT_TYPE_LABELS} from "./constructor.models";
import {HINT_TYPE_EMOJI} from "../ui/emoji";

/**
 * "+ Подсказка" button that opens a menu of hint part types.
 * The type is chosen once, at creation time — existing hint parts
 * keep their type and cannot be switched.
 */
@Component({
  selector: "app-hint-type-picker",
  standalone: true,
  imports: [],
  templateUrl: "./hint-type-picker.component.html",
  styleUrl: "./hint-type-picker.component.scss",
})
export class HintTypePickerComponent {
  @Input() label = "+ Подсказка";
  @Output() picked = new EventEmitter<HintType>();

  @ViewChild("menu") menuRef: ElementRef<HTMLDetailsElement> | undefined;

  protected readonly allTypes = ALL_HINT_TYPES;
  protected readonly typeLabels = HINT_TYPE_LABELS;
  protected readonly typeEmoji = HINT_TYPE_EMOJI;

  pick(type: HintType) {
    this.picked.emit(type);
    if (this.menuRef) {
      this.menuRef.nativeElement.open = false;
    }
  }
}
