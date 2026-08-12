import {Component} from '@angular/core';
import {finalize} from 'rxjs';
import {AdminService} from './admin.service';
import {FileGarbage} from './admin.models';
import {SnackbarService} from '../snackbar/snackbar.service';

/**
 * The file broom: a game link no level uses, a meta row left without a link,
 * content no meta points at. It runs when asked, never on a schedule, so the
 * page always shows a dry run first and deletes only on a second, explicit
 * click.
 */
@Component({
  selector: 'app-admin-files',
  standalone: true,
  imports: [],
  templateUrl: './admin-files.component.html',
  styleUrl: './admin-files.component.scss',
})
export class AdminFilesComponent {
  garbage: FileGarbage | null = null;
  isRunning = false;

  constructor(
    private adminService: AdminService,
    private snackbar: SnackbarService,
  ) {}

  get total(): number {
    if (!this.garbage) {
      return 0;
    }
    return this.garbage.game_links.length
      + this.garbage.file_guids.length
      + this.garbage.stored_files.length;
  }

  /** Something was found by a dry run, so there is something to delete. */
  get canCollect(): boolean {
    return !!this.garbage && this.garbage.dry_run && this.total > 0;
  }

  preview(): void {
    this.run(true);
  }

  collect(): void {
    if (!confirm(`Удалить безвозвратно: ${this.describeTotals()}?`)) {
      return;
    }
    this.run(false);
  }

  describeTotals(): string {
    if (!this.garbage) {
      return '';
    }
    return `связей с играми — ${this.garbage.game_links.length}, `
      + `записей о файлах — ${this.garbage.file_guids.length}, `
      + `файлов в хранилище — ${this.garbage.stored_files.length}`;
  }

  private run(dryRun: boolean): void {
    this.isRunning = true;
    this.adminService.collectFileGarbage(dryRun)
      .pipe(finalize(() => { this.isRunning = false; }))
      .subscribe({
        next: garbage => {
          this.garbage = garbage;
          if (dryRun) {
            this.snackbar.success(
              garbage.game_links.length + garbage.file_guids.length + garbage.stored_files.length > 0
                ? 'Проверка завершена, есть что удалить'
                : 'Мусора не найдено',
            );
          } else {
            this.snackbar.success('Мусор удалён');
          }
        },
        error: () => {
          this.snackbar.error('Не удалось выполнить сборку мусора');
        },
      });
  }
}
