import {Component, OnInit} from '@angular/core';
import {RouterLink} from '@angular/router';
import {catchError, forkJoin, of} from 'rxjs';
import {UserService} from '../auth/user.service';
import {AuthService} from '../auth/auth.service';
import {TeamService} from '../team/team.service';
import {PlayerProfile, PlayerStat} from '../team/team.models';
import {AvatarComponent} from '../ui/avatar.component';
import {ProfileAccountComponent} from './profile-account.component';
import {ProfileIdentitiesComponent} from './profile-identities.component';
import {ProfileNotificationsComponent} from './profile-notifications.component';

/** Which group of settings the page is showing. */
export type ProfileTab = 'account' | 'identities' | 'notifications';

interface TabDescriptor {
  id: ProfileTab;
  label: string;
  /** Section heading, spelled out where the short tab label cannot be. */
  title: string;
}

const TABS: TabDescriptor[] = [
  {id: 'account', label: 'Аккаунт', title: 'Имя и пароль'},
  {id: 'identities', label: 'Вход', title: 'Способы входа'},
  {id: 'notifications', label: 'Уведомления', title: 'Уведомления и напоминания'},
];

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    RouterLink,
    AvatarComponent,
    ProfileAccountComponent,
    ProfileIdentitiesComponent,
    ProfileNotificationsComponent,
  ],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent implements OnInit {
  readonly tabs = TABS;
  activeTab: ProfileTab = 'account';

  /** Public-facing figures, the same ones the player's card shows. */
  profile: PlayerProfile | null = null;
  stat: PlayerStat | null = null;
  isStatLoading = false;

  constructor(
    private userService: UserService,
    private authService: AuthService,
    private teamService: TeamService,
  ) {
  }

  async ngOnInit() {
    if (!this.userService.isUserLoaded()) {
      await this.userService.loadMe();
    }
    this.loadStat();
  }

  get isAuthenticated(): boolean {
    return this.userService.isUserLoaded();
  }

  get playerId(): number | undefined {
    return this.userService.getMe()?.id;
  }

  get displayName(): string {
    const me = this.userService.getMe();
    return me?.name_mention || me?.username || 'Игрок';
  }

  get username(): string | null {
    return this.userService.getMe()?.username ?? null;
  }

  get isAuthor(): boolean {
    return this.userService.getMe()?.can_be_author === true;
  }

  get isAdmin(): boolean {
    return this.userService.isAdmin();
  }

  /**
   * The address the avatar is looked up by: only a confirmed one, since an
   * address still waiting for its code is not yet known to be this player's.
   */
  get gravatarEmail(): string | null {
    const email = this.userService.getMe()?.email;
    return email?.is_verified ? email.email ?? null : null;
  }

  /** The letter drawn in the avatar circle. */
  get initial(): string {
    const source = this.displayName.replace(/^@/, '');
    return source.charAt(0).toUpperCase() || '?';
  }

  get currentTeamName(): string | null {
    return this.profile?.player_in_team?.team?.name ?? null;
  }

  get playedGamesCount(): number | null {
    return this.stat?.played_games.length ?? null;
  }

  get typedKeysCount(): number | null {
    return this.stat?.typed_keys_count ?? null;
  }

  get correctKeysPercent(): number | null {
    const total = this.stat?.typed_keys_count ?? 0;
    if (total === 0) {
      return null;
    }
    return Math.round(((this.stat?.typed_correct_keys_count ?? 0) / total) * 100);
  }

  activeTabTitle(): string {
    return this.tabs.find(tab => tab.id === this.activeTab)?.title ?? '';
  }

  selectTab(tab: ProfileTab): void {
    this.activeTab = tab;
  }

  openLoginForm(): void {
    this.authService.showLoginForm();
  }

  /**
   * Stats are decoration: a failure here leaves the tiles empty rather than
   * taking the settings down with it.
   */
  private loadStat(): void {
    const id = this.playerId;
    if (id === undefined) {
      return;
    }

    this.isStatLoading = true;
    forkJoin({
      profile: this.teamService.getPlayer(id).pipe(catchError(() => of(null))),
      stat: this.teamService.getPlayerStat(id).pipe(catchError(() => of(null))),
    }).subscribe(({profile, stat}) => {
      this.profile = profile;
      this.stat = stat;
      this.isStatLoading = false;
    });
  }
}
