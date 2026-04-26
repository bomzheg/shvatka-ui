import {Component, Input} from '@angular/core';
import {HintPart, HintType} from "../domain/game.models";
import {HttpAdapter} from "../http/http.adapter";


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
  gameId: number | undefined;
  
  constructor(private http: HttpAdapter) {
  }

  getFileUrl(): string | undefined {
    if (this.hint.file_guid === undefined || this.gameId === undefined) {
      return undefined;
    }

    return this.http.getFileUrl(this.gameId, this.hint.file_guid);
  }

    protected readonly HintType = HintType;
    protected readonly JSON = JSON;
}
