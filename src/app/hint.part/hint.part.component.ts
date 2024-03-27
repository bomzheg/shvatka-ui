import {Component, Input} from '@angular/core';
import {HintPart, HintType} from "../game/game.service";


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
}
