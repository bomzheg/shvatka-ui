import {Component, OnInit} from '@angular/core';
import {GamePlayService, CurrentHints, TypedKeyResult} from "./game_play.service";
import {HttpAdapter} from "../http/http.adapter";
import {HintPartComponent} from "../hint.part/hint.part.component";
import {HintPart} from "../game/game.service";
import {FormsModule} from "@angular/forms";

@Component({
  selector: 'app-game-play',
  standalone: true,
  imports: [
    HintPartComponent,
    FormsModule,
  ],
  templateUrl: './game_play.component.html',
  styleUrl: './game_play.component.scss'
})
export class GamePlayComponent implements OnInit {
  keyText: string = "";
  keyResult: string | undefined;

  constructor(
    private gameService: GamePlayService,
    private http: HttpAdapter,
    ) {
  }
  ngOnInit(): void {
    this.gameService.loadHints();
  }

  getCurrentHints(): CurrentHints | undefined {
    return this.gameService.getCurrentHints()
  }

  isLoading(): boolean {
    return this.gameService.hintsLoading();
  }

  isAuthRequired(): boolean {
    return this.gameService.isAuthRequired();
  }

  hasHints(): boolean {
    return this.getCurrentHints() !== undefined;
  }

  getFileUrl(hint: HintPart) {
    if (hint.file_guid === undefined) {
      return undefined;
    }
    return this.http.getFileUrl(this.getCurrentHints()!.game_id, hint.file_guid)
  }

  toLocal(dt: string): any {
    return new Date(Date.parse(dt)).toLocaleTimeString();
  }

  onKeyTextChange(text: string) {
    this.keyText = text.toUpperCase();
  }

  submitKey() {
    if (!this.hasHints()) {
      return;
    }

    const key = this.keyText.trim();
    if (!key) {
      return;
    }

    this.gameService.submitKey(key).subscribe(result => {
      this.keyResult = this.mapResult(result);
      this.keyText = "";
    });
  }

  private mapResult(result: TypedKeyResult): string {
    if (result.is_duplicate && result.wrong) {
      return "duplicate (and wrong)";
    }
    if (result.is_duplicate) {
      return "duplicate (but ok)";
    }
    if (result.wrong) {
      return "wrong";
    }
    return "ok";
  }

  protected readonly Object = Object;
}
