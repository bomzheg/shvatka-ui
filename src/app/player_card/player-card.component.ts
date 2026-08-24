import {Component, OnDestroy, OnInit} from '@angular/core';
import {DatePipe} from '@angular/common';
import {ActivatedRoute, ParamMap, RouterLink} from '@angular/router';
import {catchError, finalize, forkJoin, of, Subscription} from 'rxjs';
import {HttpErrorResponse} from '@angular/common/http';
import {TeamService} from '../team/team.service';
import {PlayerProfile, PlayerStat, PlayerTg} from '../team/team.models';
import {SnackbarService} from '../snackbar/snackbar.service';
import {UserService} from '../auth/user.service';
import {NotificationsService} from '../notifications/notifications.service';
import {readApiError} from '../http/api-error';

/** Shown before an author confirms granting author rights ("аппрув"). */
const PROMOTION_WARNING =
  "Аппрув нужен игрокам, которые хотят создавать свою команду или писать свои игры.\n\n" +
  "Пожалуйста, прежде чем кого-то аппрувить - убедитесь, что знаете этого схватчика лично, " +
  "и он справится с возложенной ответственностью! Люди с аппрувом могут портить всем игру.";

@Component({
  selector: 'app-player-card',
  standalone: true,
  imports: [RouterLink, DatePipe],
  templateUrl: './player-card.component.html',
  styleUrl: './player-card.component.scss',
})
export class PlayerCardComponent implements OnInit, OnDestroy {
  profile: PlayerProfile | null = null;
  stat: PlayerStat | null = null;

  isLoading = false;
  notFound = false;

  /** Promotion ("аппрув") invite state for the current author viewing this card. */
  promotionSending = false;
  promotionSent = false;

  private routeSub: Subscription | undefined;

  constructor(
    private route: ActivatedRoute,
    private teamService: TeamService,
    private snackbar: SnackbarService,
    private userService: UserService,
    private notificationsService: NotificationsService,
  ) {}

  ngOnInit(): void {
    this.routeSub = this.route.paramMap.subscribe((params: ParamMap) => {
      const playerId = Number(params.get('id'));
      if (Number.isNaN(playerId)) {
        this.notFound = true;
        return;
      }
      this.load(playerId);
    });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
  }

  get displayName(): string {
    const id = this.profile?.id ?? this.stat?.id;
    return this.profile?.username ?? this.stat?.username ?? (id !== undefined ? `#${id}` : 'Игрок');
  }

  get canBeAuthor(): boolean {
    return this.profile?.can_be_author ?? this.stat?.can_be_author ?? false;
  }

  /** The player currently shown, whichever source loaded. */
  private get playerId(): number | undefined {
    return this.profile?.id ?? this.stat?.id;
  }

  /**
   * Whether to offer the "аппрувнуть" action: the viewer must be an author,
   * the viewed player must lack author rights, and it must not be the viewer
   * themselves.
   */
  get canPromote(): boolean {
    if (this.canBeAuthor || this.promotionSent) {
      return false;
    }
    const me = this.userService.getMe();
    if (me?.can_be_author !== true) {
      return false;
    }
    const id = this.playerId;
    return id !== undefined && id !== me.id;
  }

  promote(): void {
    const id = this.playerId;
    if (id === undefined || this.promotionSending || this.promotionSent) {
      return;
    }
    if (!confirm(PROMOTION_WARNING)) {
      return;
    }
    this.promotionSending = true;
    this.notificationsService.createPromotionInvite(id)
      .pipe(finalize(() => {
        this.promotionSending = false;
      }))
      .subscribe({
        next: () => {
          this.promotionSent = true;
          this.notificationsService.refreshUnreadCount();
          this.snackbar.success("Приглашение стать автором отправлено");
        },
        error: error => {
          // Target already has author rights: reflect it instead of erroring.
          if (error instanceof HttpErrorResponse && error.error?.type === "PromoteError") {
            if (this.profile) {
              this.profile.can_be_author = true;
            }
            if (this.stat) {
              this.stat.can_be_author = true;
            }
            this.snackbar.info("У игрока уже есть аппрув");
            return;
          }
          const backendError = readApiError(error);
          this.snackbar.errorWithDoc(
            backendError?.description || "Не удалось отправить приглашение",
            backendError?.docUrl,
          );
        },
      });
  }

  get correctKeysPercent(): number {
    const total = this.stat?.typed_keys_count ?? 0;
    if (total === 0) return 0;
    return Math.round(((this.stat?.typed_correct_keys_count ?? 0) / total) * 100);
  }

  tgLink(tg: PlayerTg): string | null {
    if (tg.username) return `https://t.me/${tg.username}`;
    if (tg.tg_id) return `tg://user?id=${tg.tg_id}`;
    return null;
  }

  tgFullName(tg: PlayerTg): string {
    return [tg.first_name, tg.last_name].filter(Boolean).join(' ');
  }

  private load(playerId: number): void {
    this.isLoading = true;
    this.notFound = false;
    this.profile = null;
    this.stat = null;
    this.promotionSending = false;
    this.promotionSent = false;

    forkJoin({
      profile: this.teamService.getPlayer(playerId).pipe(catchError(() => of(null))),
      stat: this.teamService.getPlayerStat(playerId).pipe(catchError(() => of(null))),
    }).subscribe({
      next: ({profile, stat}) => {
        this.isLoading = false;
        this.profile = profile;
        this.stat = stat;
        if (!profile && !stat) {
          this.notFound = true;
        }
      },
      error: () => {
        this.isLoading = false;
        this.notFound = true;
        this.snackbar.error('Не удалось загрузить профиль игрока');
      },
    });
  }
}
