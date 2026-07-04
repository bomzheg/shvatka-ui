import {Component, OnDestroy, OnInit} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {ActivatedRoute, ParamMap, RouterLink} from '@angular/router';
import {HttpErrorResponse} from '@angular/common/http';
import {Subscription} from 'rxjs';
import {AdminService} from './admin.service';
import {AdminPlayerDetails} from './admin.models';
import {SnackbarService} from '../snackbar/snackbar.service';
import {PlayerTg} from '../team/team.models';

@Component({
  selector: 'app-admin-player-card',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './admin-player-card.component.html',
  styleUrl: './admin-player-card.component.scss',
})
export class AdminPlayerCardComponent implements OnInit, OnDestroy {
  player: AdminPlayerDetails | null = null;
  playerId = 0;
  isLoading = false;
  notFound = false;

  oneTimeLink = '';
  isLinkCreating = false;

  emailInput = '';
  emailVerified = false;
  isEmailSubmitting = false;

  tgId: number | null = null;
  tgUsername = '';
  tgFirstName = '';
  tgLastName = '';
  isTgSubmitting = false;

  private routeSub: Subscription | undefined;

  constructor(
    private route: ActivatedRoute,
    private adminService: AdminService,
    private snackbar: SnackbarService,
  ) {}

  ngOnInit(): void {
    this.routeSub = this.route.paramMap.subscribe((params: ParamMap) => {
      const playerId = Number(params.get('id'));
      if (Number.isNaN(playerId)) {
        this.notFound = true;
        return;
      }
      this.playerId = playerId;
      this.load();
    });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
  }

  get displayName(): string {
    return this.player?.username || this.player?.name_mention || `#${this.playerId}`;
  }

  tgLink(tg: PlayerTg): string | null {
    if (tg.username) return `https://t.me/${tg.username}`;
    if (tg.tg_id) return `tg://user?id=${tg.tg_id}`;
    return null;
  }

  tgFullName(tg: PlayerTg): string {
    return [tg.first_name, tg.last_name].filter(Boolean).join(' ');
  }

  createOneTimeLink(): void {
    this.isLinkCreating = true;
    this.adminService.createOneTimeLink(this.playerId).subscribe({
      next: (link) => {
        this.isLinkCreating = false;
        this.oneTimeLink = link.url;
        this.copyOneTimeLink();
      },
      error: () => {
        this.isLinkCreating = false;
        this.snackbar.error('Не удалось создать одноразовую ссылку');
      },
    });
  }

  copyOneTimeLink(): void {
    if (!this.oneTimeLink) return;
    navigator.clipboard?.writeText(this.oneTimeLink).then(
      () => this.snackbar.success('Ссылка скопирована в буфер обмена'),
      () => this.snackbar.info('Скопируйте ссылку вручную'),
    );
  }

  submitEmail(): void {
    const email = this.emailInput.trim();
    if (!email) {
      this.snackbar.error('Введите email');
      return;
    }

    this.isEmailSubmitting = true;
    this.adminService.setEmail(this.playerId, email, this.emailVerified).subscribe({
      next: (saved) => {
        this.isEmailSubmitting = false;
        if (this.player) {
          this.player.email = saved;
        }
        this.snackbar.success(saved.is_verified
          ? 'Email сохранён как подтверждённый'
          : 'Email сохранён, игрок должен подтвердить его сам');
      },
      error: (err) => {
        this.isEmailSubmitting = false;
        if (err instanceof HttpErrorResponse && err.status === 409) {
          this.snackbar.error('Этот email уже используется другим игроком');
          return;
        }
        if (err instanceof HttpErrorResponse && err.status === 422) {
          this.snackbar.error('Некорректный email');
          return;
        }
        this.snackbar.error('Не удалось сохранить email');
      },
    });
  }

  submitTg(): void {
    if (this.tgId === null || !Number.isInteger(this.tgId) || this.tgId <= 0) {
      this.snackbar.error('Введите корректный telegram id');
      return;
    }

    this.isTgSubmitting = true;
    this.adminService.relinkTg(this.playerId, {
      tg_id: this.tgId,
      username: this.tgUsername.trim() || null,
      first_name: this.tgFirstName.trim() || null,
      last_name: this.tgLastName.trim() || null,
    }).subscribe({
      next: (updated) => {
        this.isTgSubmitting = false;
        this.player = updated;
        this.fillFormsFromPlayer();
        this.snackbar.success('Telegram-аккаунт перепривязан');
      },
      error: (err) => {
        this.isTgSubmitting = false;
        if (err instanceof HttpErrorResponse && err.status === 409) {
          this.snackbar.error('Этот telegram-аккаунт уже привязан к другому игроку');
          return;
        }
        this.snackbar.error('Не удалось перепривязать telegram-аккаунт');
      },
    });
  }

  private load(): void {
    this.isLoading = true;
    this.notFound = false;
    this.player = null;
    this.oneTimeLink = '';

    this.adminService.getPlayer(this.playerId).subscribe({
      next: (player) => {
        this.isLoading = false;
        this.player = player;
        this.fillFormsFromPlayer();
      },
      error: (err) => {
        this.isLoading = false;
        if (err instanceof HttpErrorResponse && err.status === 404) {
          this.notFound = true;
          return;
        }
        this.snackbar.error('Не удалось загрузить игрока');
      },
    });
  }

  private fillFormsFromPlayer(): void {
    this.emailInput = this.player?.email?.email ?? '';
    this.emailVerified = this.player?.email?.is_verified ?? false;
    this.tgId = this.player?.tg?.tg_id ?? null;
    this.tgUsername = this.player?.tg?.username ?? '';
    this.tgFirstName = this.player?.tg?.first_name ?? '';
    this.tgLastName = this.player?.tg?.last_name ?? '';
  }
}
