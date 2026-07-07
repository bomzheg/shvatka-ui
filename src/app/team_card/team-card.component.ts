import {Component, OnDestroy, OnInit} from '@angular/core';
import {ActivatedRoute, ParamMap, RouterLink} from '@angular/router';
import {Subscription} from 'rxjs';
import {TeamService} from '../team/team.service';
import {PlayedGame, TeamDetails, TeamMember} from '../team/team.models';
import {SnackbarService} from '../snackbar/snackbar.service';
import {UserService} from '../auth/user.service';
import {NotificationsService} from '../notifications/notifications.service';
import {pluralizeGames} from '../ui/plural-ru';
import {memberEmoji} from '../ui/role-emoji';

@Component({
  selector: 'app-team-card',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './team-card.component.html',
  styleUrl: './team-card.component.scss',
})
export class TeamCardComponent implements OnInit, OnDestroy {
  team: TeamDetails | null = null;
  members: TeamMember[] = [];
  games: PlayedGame[] = [];

  isLoading = false;
  notFound = false;

  isRequestingJoin = false;
  joinRequested = false;

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
      const teamId = Number(params.get('id'));
      if (Number.isNaN(teamId)) {
        this.notFound = true;
        return;
      }
      this.load(teamId);
    });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
  }

  // Captain first, then by played games count descending.
  get sortedMembers(): TeamMember[] {
    const captainId = this.team?.captain?.id;
    return [...this.members].sort((a, b) => {
      const aCap = a.id === captainId ? 0 : 1;
      const bCap = b.id === captainId ? 0 : 1;
      if (aCap !== bCap) return aCap - bCap;
      return b.played_games_count - a.played_games_count;
    });
  }

  isCaptain(member: TeamMember): boolean {
    return this.team?.captain?.id === member.id;
  }

  getMemberDisplayName(member: TeamMember): string {
    return member.username ?? `#${member.id}`;
  }

  memberEmoji(member: TeamMember): string {
    return memberEmoji(member.emoji, member.role);
  }

  playedGamesLabel(count: number): string {
    return `${count} ${pluralizeGames(count)}`;
  }

  /**
   * The ask-to-join button is shown to any authenticated non-member; the
   * backend rejects the request if the caller is already in another team.
   */
  canAskToJoin(): boolean {
    const myId = this.userService.getMe()?.id;
    if (myId === undefined || !this.team || this.joinRequested) {
      return false;
    }
    return !this.members.some(m => m.id === myId);
  }

  askToJoin(): void {
    if (!this.team || this.isRequestingJoin) return;

    this.isRequestingJoin = true;
    this.notificationsService.createTeamJoinRequest(this.team.id)
      .subscribe({
        next: () => {
          this.isRequestingJoin = false;
          this.joinRequested = true;
          this.snackbar.success('Заявка отправлена — капитан команды получит уведомление');
        },
        error: (err) => {
          this.isRequestingJoin = false;
          const backendError = (err as {error?: {type?: string; description?: string}} | null)?.error;
          if (backendError?.type === 'PlayerAlreadyInTeam') {
            this.snackbar.error('Вы уже состоите в команде');
            return;
          }
          const description = typeof backendError?.description === 'string' && backendError.description
            ? backendError.description
            : null;
          this.snackbar.error(description ?? 'Не удалось отправить заявку');
        },
      });
  }

  private load(teamId: number): void {
    this.isLoading = true;
    this.notFound = false;
    this.team = null;
    this.members = [];
    this.games = [];
    this.joinRequested = false;

    this.teamService.getTeam(teamId).subscribe({
      next: (team) => {
        this.isLoading = false;
        this.team = team;
      },
      error: () => {
        this.isLoading = false;
        this.notFound = true;
      },
    });

    this.teamService.getTeamPlayers(teamId).subscribe({
      next: (res) => { this.members = res.items; },
      error: () => { this.snackbar.error('Не удалось загрузить состав команды'); },
    });

    this.teamService.getTeamStat(teamId).subscribe({
      next: (res) => { this.games = res.items; },
      error: () => { this.snackbar.error('Не удалось загрузить сыгранные игры'); },
    });
  }
}
