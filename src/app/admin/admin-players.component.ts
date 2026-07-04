import {Component, OnDestroy, OnInit} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {RouterLink} from '@angular/router';
import {finalize} from 'rxjs';
import {AdminService} from './admin.service';
import {AdminPlayerListItem} from './admin.models';
import {SnackbarService} from '../snackbar/snackbar.service';
import {PlayerTg} from '../team/team.models';

@Component({
  selector: 'app-admin-players',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './admin-players.component.html',
  styleUrl: './admin-players.component.scss',
})
export class AdminPlayersComponent implements OnInit, OnDestroy {
  players: AdminPlayerListItem[] = [];
  isLoading = false;
  loadFailed = false;

  username = '';
  name = '';
  active = true;
  archive = false;
  onlyAuthors = false;

  private searchTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private adminService: AdminService,
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

  onSearchChange(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.load(), 350);
  }

  tgFullName(tg: PlayerTg): string {
    return [tg.first_name, tg.last_name].filter(Boolean).join(' ');
  }

  load(): void {
    this.isLoading = true;
    this.loadFailed = false;
    this.adminService.listPlayers({
      username: this.username.trim() || undefined,
      name: this.name.trim() || undefined,
      active: this.active,
      archive: this.archive,
      can_be_author: this.onlyAuthors ? true : undefined,
    })
      .pipe(finalize(() => { this.isLoading = false; }))
      .subscribe({
        next: (res) => { this.players = res.items; },
        error: () => {
          this.loadFailed = true;
          this.snackbar.error('Не удалось загрузить список игроков');
        },
      });
  }
}
