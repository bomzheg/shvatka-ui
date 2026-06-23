import {Component, OnDestroy, OnInit} from '@angular/core';
import {ActivatedRoute, ParamMap, RouterLink} from '@angular/router';
import {Subscription} from 'rxjs';
import {TeamService} from '../team/team.service';
import {PlayedGame, TeamDetails, TeamMember} from '../team/team.models';
import {SnackbarService} from '../snackbar/snackbar.service';

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

  private routeSub: Subscription | undefined;

  constructor(
    private route: ActivatedRoute,
    private teamService: TeamService,
    private snackbar: SnackbarService,
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

  isCaptain(member: TeamMember): boolean {
    return this.team?.captain?.id === member.id;
  }

  getMemberDisplayName(member: TeamMember): string {
    return member.username ?? `#${member.id}`;
  }

  private load(teamId: number): void {
    this.isLoading = true;
    this.notFound = false;
    this.team = null;
    this.members = [];
    this.games = [];

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
