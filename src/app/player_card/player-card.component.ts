import {Component, OnDestroy, OnInit} from '@angular/core';
import {DatePipe} from '@angular/common';
import {ActivatedRoute, ParamMap, RouterLink} from '@angular/router';
import {catchError, forkJoin, of, Subscription} from 'rxjs';
import {TeamService} from '../team/team.service';
import {PlayerProfile, PlayerStat, PlayerTg} from '../team/team.models';
import {SnackbarService} from '../snackbar/snackbar.service';

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

  private routeSub: Subscription | undefined;

  constructor(
    private route: ActivatedRoute,
    private teamService: TeamService,
    private snackbar: SnackbarService,
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
