import {Component, OnDestroy, OnInit} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {RouterLink} from '@angular/router';
import {finalize} from 'rxjs';
import {TeamService} from '../team/team.service';
import {TeamDetails} from '../team/team.models';
import {SnackbarService} from '../snackbar/snackbar.service';

@Component({
  selector: 'app-teams',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './teams.component.html',
  styleUrl: './teams.component.scss',
})
export class TeamsComponent implements OnInit, OnDestroy {
  teams: TeamDetails[] = [];
  isLoading = false;
  loadFailed = false;

  active = true;
  archive = false;
  search = '';

  private searchTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private teamService: TeamService,
    private snackbar: SnackbarService,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
  }

  onFilterChange(): void {
    this.load();
  }

  onSearchChange(value: string): void {
    this.search = value;
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.load(), 350);
  }

  load(): void {
    this.isLoading = true;
    this.loadFailed = false;
    this.teamService.listTeams({
      active: this.active,
      archive: this.archive,
      search: this.search.trim() || undefined,
    })
      .pipe(finalize(() => { this.isLoading = false; }))
      .subscribe({
        next: (res) => {
          this.teams = [...res.items].sort(
            (a, b) => (b.played_games_count ?? 0) - (a.played_games_count ?? 0),
          );
        },
        error: () => {
          this.loadFailed = true;
          this.snackbar.error('Не удалось загрузить список команд');
        },
      });
  }
}
