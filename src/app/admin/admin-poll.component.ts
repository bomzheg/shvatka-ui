import {Component, OnInit} from '@angular/core';
import {RouterLink} from '@angular/router';
import {finalize} from 'rxjs';
import {AdminService} from './admin.service';
import {AdminPoll, PollEntry, PollTeam, PollVote} from './admin.models';
import {SnackbarService} from '../snackbar/snackbar.service';

const VOTE_LABELS: Record<PollVote, string> = {
  yes: 'играет',
  no: 'не играет',
  think: 'думает',
  revoked: 'отозван',
  not_allowed: 'не допущен',
};

@Component({
  selector: 'app-admin-poll',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './admin-poll.component.html',
  styleUrl: './admin-poll.component.scss',
})
export class AdminPollComponent implements OnInit {
  poll: AdminPoll | null = null;
  isLoading = false;
  loadFailed = false;
  removingKey = '';

  constructor(
    private adminService: AdminService,
    private snackbar: SnackbarService,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  voteLabel(vote: PollVote): string {
    return VOTE_LABELS[vote] ?? vote;
  }

  entryKey(team: PollTeam, entry: PollEntry): string {
    return `${team.team.id}:${entry.player.id}`;
  }

  removeEntry(team: PollTeam, entry: PollEntry): void {
    const playerName = entry.player.username || entry.player.name_mention;
    if (!confirm(`Удалить голос игрока ${playerName} из опроса команды «${team.team.name}»?`)) {
      return;
    }

    this.removingKey = this.entryKey(team, entry);
    this.adminService.removePollEntry(team.team.id, entry.player.id)
      .pipe(finalize(() => { this.removingKey = ''; }))
      .subscribe({
        next: () => {
          team.entries = team.entries.filter(e => e !== entry);
          if (this.poll) {
            this.poll.teams = this.poll.teams.filter(t => t.entries.length > 0);
          }
          this.snackbar.success('Голос удалён из опроса');
        },
        error: () => {
          this.snackbar.error('Не удалось удалить голос из опроса');
        },
      });
  }

  load(): void {
    this.isLoading = true;
    this.loadFailed = false;
    this.adminService.getPoll()
      .pipe(finalize(() => { this.isLoading = false; }))
      .subscribe({
        next: (poll) => { this.poll = poll; },
        error: () => {
          this.loadFailed = true;
          this.snackbar.error('Не удалось загрузить опрос');
        },
      });
  }
}
