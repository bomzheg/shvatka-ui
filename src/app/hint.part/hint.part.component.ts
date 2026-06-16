import {Component, Input} from '@angular/core';
import {HintPart, HintType} from "../domain/game.models";


@Component({
  selector: 'app-hint-part',
  standalone: true,
  imports: [],
  templateUrl: './hint.part.component.html',
  styleUrl: './hint.part.component.scss'
})
export class HintPartComponent {
  @Input()
  hint!: HintPart;
  @Input()
  fileUrl: string | undefined;

    protected readonly HintType = HintType;
    protected readonly JSON = JSON;

  /**
   * Prepares an HTML hint for rendering: normalizes line endings and turns
   * text line breaks into <br>. Newlines that sit inside a tag (e.g. between
   * attributes) are left untouched so the markup is not broken.
   */
  toHtml(value: string | undefined | null): string {
    if (!value) {
      return '';
    }

    return value
      .replace(/\r\n?/g, '\n')
      .replace(/\n(?![^<]*>)/g, '<br>');
  }
}
