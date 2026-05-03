import {Component, OnDestroy, OnInit} from '@angular/core';
import {
  GamePlayService,
  CurrentHints,
  TypedKeyResult,
  KeyEffect,
  TypedKeyLog,
  CurrentWaivers,
  WaiversTeam,
  WaiverEntry,
  Played,
  OrganizerDto
} from "./game_play.service";
import {HttpAdapter} from "../http/http.adapter";
import {HintPartComponent} from "../hint.part/hint.part.component";
import {FullGame, GameStat, HintPart, KeyType, Keys} from "../domain/game.models";
import {FormsModule} from "@angular/forms";
import {finalize, Subscription} from "rxjs";
import {ActiveGame} from "../games/games.service";
import {GameLogPartComponent} from "../game_log.part/game_log.part.component";
import {EffectsPartComponent} from "../effects.part/effects.part.component";
import {UserService} from "../auth/user.service";
import {GameScenarioPartComponent} from "../game_scenario.part/game_scenario.part.component";

@Component({
  selector: 'app-game-play',
  standalone: true,
  imports: [
    HintPartComponent,
    FormsModule,
    GameLogPartComponent,
    EffectsPartComponent,
    GameScenarioPartComponent,
  ],
  templateUrl: './game_play.component.html',
  styleUrl: './game_play.component.scss'
})
export class GamePlayComponent implements OnInit, OnDestroy {
  activeGame: ActiveGame | undefined;
  countdownToStart: string | undefined;
  keyText: string = "";
  keyResult: string | undefined;
  keyResultData: TypedKeyResult | undefined;
  keySubmitError: string | undefined;
  isSubmitting = false;
  authorScenario: FullGame | undefined;
  isAuthorScenarioLoading = false;
  private activeGameSubscription: Subscription | undefined;
  private countdownInterval: ReturnType<typeof setInterval> | undefined;
  private keyResultTimer: ReturnType<typeof setTimeout> | undefined;
  private autoRefreshTicker: ReturnType<typeof setInterval> | undefined;
  private lastAutoRefreshMark: number | undefined;
  private waiversStartReloadedGameId: number | undefined;

  constructor(
    private gameService: GamePlayService,
    private http: HttpAdapter,
    private userService: UserService,
    ) {
  }

  ngOnInit(): void {
    this.activeGameSubscription = this.gameService.getActiveGame(true).subscribe(game => {
      this.activeGame = game;
      this.startCountdownTicker();
      this.loadAuthorScenario(game);
    });
    this.gameService.loadHints();
    this.startAutoRefreshTicker();
  }

  ngOnDestroy(): void {
    this.clearResultTimer();
    this.activeGameSubscription?.unsubscribe();
    this.clearCountdownTicker();
    this.clearAutoRefreshTicker();
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

  hasWaivers(): boolean {
    return this.getCurrentWaivers() !== undefined;
  }

  hasMyRole(): boolean {
    return !!this.gameService.getMyRole();
  }

  hasOrgRole(): boolean {
    return !!this.gameService.getMyRole()?.org;
  }

  hasTeamRole(): boolean {
    return !!this.gameService.getMyRole()?.team;
  }

  getMyTeamName(): string | undefined {
    return this.gameService.getMyRole()?.team?.name ?? undefined;
  }

  getMyOrg(): OrganizerDto | undefined {
    return this.gameService.getMyRole()?.org ?? undefined;
  }

  getMyRoleVoteText(): string {
    const vote = this.gameService.getMyRole()?.waiver_vote;
    switch (vote) {
      case Played.yes:
        return "Играю";
      case Played.no:
        return "Я отказался";
      case Played.think:
        return "Я ещё не решил";
      case Played.revoked:
        return "Не допущен капитаном";
      case Played.not_allowed:
        return "Не допущен организаторами";
      default:
        return "Нет вейвера (не играю)";
    }
  }

  getActiveGameName(): string {
    return this.activeGame?.name ?? "Текущая игра";
  }

  isCurrentUserGameAuthor(): boolean {
    const myId = this.userService.getMe()?.id;
    const authorId = this.activeGame?.author?.id;
    return myId !== undefined && authorId !== undefined && myId === authorId;
  }

  shouldShowAuthorScenario(): boolean {
    return this.isCurrentUserGameAuthor() && !!this.authorScenario;
  }

  getCountdownToStart(): string | undefined {
    return this.countdownToStart;
  }

  getCurrentWaivers(): CurrentWaivers | undefined {
    return this.gameService.getCurrentWaivers();
  }

  getTeamWaivers(teamId: number): WaiverEntry[] {
    const waiversMap = this.getCurrentWaivers()?.waivers;
    if (!waiversMap) {
      return [];
    }

    return waiversMap[String(teamId)] ?? [];
  }

  hasTeamWaivers(team: WaiversTeam): boolean {
    return this.getTeamWaivers(team.id).length > 0;
  }

  getTeamWaiversCount(team: WaiversTeam): number {
    return this.getTeamWaivers(team.id).length;
  }

  isCurrentUserWaiver(entry: WaiverEntry): boolean {
    const myRole = this.gameService.getMyRole();
    if (!myRole) {
      return false;
    }

    const teamCaptainId = myRole.team?.captain?.id;
    const myOrgId = myRole.org?.player.id;
    return entry.player.id === teamCaptainId || entry.player.id === myOrgId;
  }

  canOpenSpyTab(): boolean {
    const org = this.gameService.getMyRole()?.org;
    return !!org && !org.deleted && (org.can_spy || org.can_see_log_keys);
  }

  loadSpyData(forceRefresh: boolean = false) {
    if (!this.activeGame?.id || !this.canOpenSpyTab()) {
      return;
    }

    this.gameService.loadSpyData(this.activeGame.id, forceRefresh);
  }

  isSpyDataLoading(): boolean {
    return this.gameService.isSpyDataLoading();
  }

  isSpyKeysDataLoading(): boolean {
    return this.gameService.isSpyKeysDataLoading();
  }

  isSpyStatDataLoading(): boolean {
    return this.gameService.isSpyStatDataLoading();
  }

  canSeeSpyKeys(): boolean {
    const org = this.gameService.getMyRole()?.org;
    return !!org && !org.deleted && org.can_see_log_keys;
  }

  canSeeSpyStat(): boolean {
    const org = this.gameService.getMyRole()?.org;
    return !!org && !org.deleted && org.can_spy;
  }

  getSpyKeys(): Keys | undefined {
    return this.gameService.getSpyKeys();
  }

  getSpyStat(): GameStat | undefined {
    return this.gameService.getSpyStat();
  }

  getFileUrl(hint: HintPart) {
    if (hint.file_guid === undefined) {
      return undefined;
    }
    return this.http.getFileUrl(this.getCurrentHints()!.game_id, hint.file_guid)
  }

  toLocal(dt: string): string {
    return new Date(Date.parse(dt)).toLocaleTimeString();
  }

  getLevelElapsed(startedAt: string | undefined): string {
    if (!startedAt) {
      return "—";
    }

    const startedAtMs = Date.parse(startedAt);
    if (Number.isNaN(startedAtMs)) {
      return "—";
    }

    const totalSeconds = Math.max(Math.floor((Date.now() - startedAtMs) / 1000), 0);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}ч ${minutes}м ${seconds}с`;
    }

    return `${minutes}м ${seconds}с`;
  }

  onKeyTextChange(text: string) {
    this.keyText = text.toUpperCase();
  }

  submitKey() {
    if (!this.hasHints() || this.isSubmitting) {
      return;
    }

    const key = this.keyText.trim();
    if (!key) {
      return;
    }

    this.isSubmitting = true;
    this.keySubmitError = undefined;

    this.gameService.submitKey(key)
      .pipe(finalize(() => {
        this.isSubmitting = false;
      }))
      .subscribe({
        next: result => {
          this.keyResult = this.mapResult(result);
          this.keyResultData = result;
          this.startResultTimer();
          this.keyText = "";
        },
        error: () => {
          this.keySubmitError = "Не удалось отправить ключ";
        }
      });
  }

  isLevelCompleted(result: TypedKeyResult): boolean {
    return result.effects?.some(effect => effect.level_up) ?? false;
  }

  getEffectTags(effect: KeyEffect): string[] {
    const tags: string[] = [];

    if (effect.bonus_minutes > 0) {
      tags.push(`бонус ${effect.bonus_minutes} мин.`);
    } else if (effect.bonus_minutes < 0) {
      tags.push(`штраф ${-effect.bonus_minutes} мин.`);
    }
    if (effect.level_up) {
      if (effect.next_level) {
        tags.push(`переход на ${effect.next_level}`);
      } else {
        tags.push('переход на следующий уровень');
      }
    }

    if (Array.isArray(effect.hints_) && effect.hints_.length > 0) {
      tags.push(`бонусные подсказки: ${effect.hints_.length}`);
    }

    return tags;
  }

  getTypedKeyEffects(typedKey: TypedKeyLog): string[] {
    const effects = typedKey?.effects;
    if (!Array.isArray(effects)) {
      return [];
    }

    return effects
      .flatMap((effect: KeyEffect) => this.getEffectTags(effect))
      .filter((tag, idx, arr) => arr.indexOf(tag) === idx);
  }

  hasAnyTypedKeys(): boolean {
    const typedKeys = this.getCurrentHints()?.typed_keys;
    return Array.isArray(typedKeys) && typedKeys.length > 0;
  }

  typedKeyStatusClass(typedKey: TypedKeyLog): string {
    const isWrong = this.isWrongTypedKey(typedKey);
    if (isWrong && typedKey?.is_duplicate) {
      return 'typed-key-bad-duplicate';
    }
    if (isWrong) {
      return 'typed-key-wrong';
    }
    if (typedKey?.is_duplicate) {
      return 'typed-key-duplicate';
    }
    return 'typed-key-ok';
  }

  typedKeyEmoji(typedKey: TypedKeyLog): string {
    const isWrong = this.isWrongTypedKey(typedKey);
    if (isWrong && typedKey?.is_duplicate) {
      return '⚠️🔁';
    }
    if (isWrong) {
      return '❌';
    }
    if (typedKey?.is_duplicate) {
      return '🔁';
    }
    return '✅';
  }

  typedKeyStatusText(typedKey: TypedKeyLog): string {
    const isWrong = this.isWrongTypedKey(typedKey);
    if (isWrong && typedKey?.is_duplicate) {
      return 'дубликат + ошибка';
    }
    if (isWrong) {
      return 'ошибка';
    }
    if (typedKey?.is_duplicate) {
      return 'дубликат';
    }
    return 'корректный';
  }

  private mapResult(result: TypedKeyResult): string {
    if (result.is_duplicate && result.wrong) {
      return "дубликат + ошибка";
    }
    if (result.is_duplicate) {
      return "дубликат";
    }
    if (result.wrong) {
      return "ошибка";
    }
    return "корректный";
  }

  private isWrongTypedKey(typedKey: TypedKeyLog): boolean {
    return typedKey?.type_ === KeyType.wrong;
  }

  private startResultTimer() {
    this.clearResultTimer();
    this.keyResultTimer = setTimeout(() => {
      this.closeResultKeyPanel()
    }, 60_000);
  }

  private clearResultTimer() {
    if (this.keyResultTimer) {
      clearTimeout(this.keyResultTimer);
      this.keyResultTimer = undefined;
    }
  }


  public closeResultKeyPanel() {
    this.clearResultTimer();
    this.keyResult = undefined;
    this.keyResultData = undefined;
    this.keySubmitError = undefined;
  }


  private startAutoRefreshTicker() {
    this.clearAutoRefreshTicker();
    this.autoRefreshTicker = setInterval(() => {
      this.tryAutoRefreshCurrentGame();
    }, 1000);
  }

  private clearAutoRefreshTicker() {
    if (this.autoRefreshTicker) {
      clearInterval(this.autoRefreshTicker);
      this.autoRefreshTicker = undefined;
    }

    this.lastAutoRefreshMark = undefined;
  }

  private tryAutoRefreshCurrentGame() {
    if (this.activeGame?.status !== "started") {
      this.lastAutoRefreshMark = undefined;
      return;
    }

    const hints = this.getCurrentHints();
    if (!hints?.started_at) {
      this.lastAutoRefreshMark = undefined;
      return;
    }

    const startedAtMs = Date.parse(hints.started_at);
    if (Number.isNaN(startedAtMs)) {
      this.lastAutoRefreshMark = undefined;
      return;
    }

    const elapsedSeconds = Math.floor((Date.now() - startedAtMs) / 1000);
    if (elapsedSeconds < 61) {
      this.lastAutoRefreshMark = undefined;
      return;
    }

    const refreshMark = Math.floor((elapsedSeconds - 1) / 60);
    if (this.lastAutoRefreshMark === refreshMark) {
      return;
    }

    this.lastAutoRefreshMark = refreshMark;
    this.gameService.loadHints();

    if (this.activeGame?.id && this.canOpenSpyTab()) {
      this.gameService.loadSpyData(this.activeGame.id, true);
    }
  }

  private startCountdownTicker() {
    this.clearCountdownTicker();
    this.countdownToStart = this.buildCountdown();
    this.reloadAfterWaiversStartReached();

    if (!this.activeGame?.start_at || this.isStartTimeReached()) {
      return;
    }

    this.countdownInterval = setInterval(() => {
      this.countdownToStart = this.buildCountdown();
      this.reloadAfterWaiversStartReached();
      if (!this.countdownToStart) {
        this.clearCountdownTicker();
      }
    }, 1000);
  }

  private reloadAfterWaiversStartReached() {
    if (
      this.activeGame?.status !== "getting_waivers"
      || !this.activeGame.id
      || this.waiversStartReloadedGameId === this.activeGame.id
      || !this.activeGame.start_at
      || Date.parse(this.activeGame.start_at) > Date.now()
    ) {
      return;
    }

    this.waiversStartReloadedGameId = this.activeGame.id;
    this.gameService.loadHints();
  }

  private clearCountdownTicker() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = undefined;
    }
  }

  private isStartTimeReached(): boolean {
    if (!this.activeGame?.start_at) {
      return true;
    }

    return Date.parse(this.activeGame.start_at) <= Date.now();
  }

  private buildCountdown(): string | undefined {
    if (!this.activeGame?.start_at) {
      return undefined;
    }

    const startAtMs = Date.parse(this.activeGame.start_at);
    const totalSeconds = Math.floor(Math.max(startAtMs - Date.now(), 0) / 1000);

    if (totalSeconds <= 0) {
      return undefined;
    }

    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (days > 0) {
      return `${days} дн. ${hours} ч.`;
    }

    if (hours > 0) {
      return `${hours} ч. ${minutes} мин.`;
    }

    return `${minutes} мин. ${seconds} сек.`;
  }

  private loadAuthorScenario(game: ActiveGame | undefined) {
    this.authorScenario = undefined;
    this.isAuthorScenarioLoading = false;

    if (!game || !this.isCurrentUserGameAuthor()) {
      return;
    }

    this.isAuthorScenarioLoading = true;
    this.http.get<FullGame>(`/games/${game.id}`)
      .pipe(finalize(() => {
        this.isAuthorScenarioLoading = false;
      }))
      .subscribe({
        next: fullGame => {
          this.authorScenario = fullGame;
        },
        error: () => {
          this.authorScenario = undefined;
        }
      });
  }
}
