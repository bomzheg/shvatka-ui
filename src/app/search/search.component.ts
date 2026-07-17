import {Component, OnDestroy, OnInit} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {ActivatedRoute, ParamMap, Router, RouterLink} from '@angular/router';
import {finalize, Subscription} from 'rxjs';
import {SearchService} from './search.service';
import {
  DEFAULT_SEARCH_SCOPE,
  GameSearchResult,
  LevelSearchResult,
  PlayerSearchResult,
  SearchScope,
  TeamSearchResult,
} from './search.models';

/**
 * Global search results page (`/search`). The whole search state — the query
 * and the four "search in" filters — lives in the URL query params, so a
 * results page can be shared as a link and reproduces the same results.
 */
@Component({
  selector: 'app-search',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './search.component.html',
  styleUrl: './search.component.scss',
})
export class SearchComponent implements OnInit, OnDestroy {
  query = '';
  scope: SearchScope = {...DEFAULT_SEARCH_SCOPE};

  gameResults: GameSearchResult[] = [];
  levelResults: LevelSearchResult[] = [];
  teamResults: TeamSearchResult[] = [];
  playerResults: PlayerSearchResult[] = [];

  isLoading = false;
  loadFailed = false;

  private queryParamsSubscription: Subscription | undefined;
  private searchSubscription: Subscription | undefined;
  private debounceTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private searchService: SearchService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.queryParamsSubscription = this.route.queryParamMap.subscribe(params => {
      this.applyParams(params);
      this.load();
    });
  }

  ngOnDestroy(): void {
    this.queryParamsSubscription?.unsubscribe();
    this.searchSubscription?.unsubscribe();
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
  }

  onQueryChange(value: string): void {
    this.query = value;
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    // Typing rewrites the current history entry instead of stacking one per keystroke.
    this.debounceTimer = setTimeout(() => this.syncUrl(true), 350);
  }

  onSubmit(event: Event): void {
    event.preventDefault();
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = undefined;
    }
    this.syncUrl(false);
  }

  onScopeChange(): void {
    this.syncUrl(false);
  }

  hasQuery(): boolean {
    return this.query.trim().length > 0;
  }

  totalCount(): number {
    return this.gameResults.length
      + this.levelResults.length
      + this.teamResults.length
      + this.playerResults.length;
  }

  gameTitle(result: GameSearchResult): string {
    return result.game_number !== null
      ? `Игра №${result.game_number} «${result.game_name}»`
      : `Игра «${result.game_name}»`;
  }

  levelGameLabel(result: LevelSearchResult): string {
    return result.game_number !== null
      ? `игра №${result.game_number} «${result.game_name}»`
      : `игра «${result.game_name}»`;
  }

  levelDetail(result: LevelSearchResult): string {
    switch (result.found_in) {
      case 'name_id':
        return 'совпадение в названии уровня';
      case 'key':
        return `ключ ${result.key ?? ''}`.trim();
      case 'hint':
        if (result.hint_number !== null) {
          const time = result.hint_time !== null ? ` (${result.hint_time} мин)` : '';
          return `подсказка №${result.hint_number + 1}${time}`;
        }
        if (result.condition_key.length > 0) {
          return `бонусная подсказка за ключ ${result.condition_key.join(', ')}`;
        }
        if (result.condition_timer !== null) {
          return `бонусная подсказка на ${result.condition_timer} мин`;
        }
        return 'бонусная подсказка';
    }
  }

  playerFoundInLabel(result: PlayerSearchResult): string {
    switch (result.found_in) {
      case 'username':
        return 'имя пользователя';
      case 'tg_username':
        return 'юзернейм в Telegram';
      case 'tg_name':
        return 'имя в Telegram';
      case 'forum_name':
        return 'имя на форуме';
    }
  }

  /** The snippet line is noise when it just repeats the row's own name. */
  showSnippet(snippet: string, name: string): boolean {
    return snippet.trim() !== name.trim();
  }

  private applyParams(params: ParamMap): void {
    this.query = params.get('query') ?? '';
    this.scope = {
      games: params.get('games') !== 'false',
      levels: params.get('levels') !== 'false',
      teams: params.get('teams') !== 'false',
      players: params.get('players') !== 'false',
    };
  }

  private syncUrl(replaceUrl: boolean): void {
    const queryParams: Record<string, string> = {};
    const trimmed = this.query.trim();
    if (trimmed) {
      queryParams['query'] = trimmed;
    }
    // Filters default to true — a shared URL only needs the disabled ones.
    (['games', 'levels', 'teams', 'players'] as const)
      .filter(key => !this.scope[key])
      .forEach(key => queryParams[key] = 'false');

    this.router.navigate([], {relativeTo: this.route, queryParams, replaceUrl});
  }

  private load(): void {
    this.searchSubscription?.unsubscribe();
    this.loadFailed = false;

    if (!this.hasQuery()) {
      this.clearResults();
      this.isLoading = false;
      return;
    }

    this.isLoading = true;
    this.searchSubscription = this.searchService.search(this.query, this.scope)
      .pipe(finalize(() => { this.isLoading = false; }))
      .subscribe({
        next: results => {
          this.gameResults = results.filter((r): r is GameSearchResult => r.type === 'game');
          this.levelResults = results.filter((r): r is LevelSearchResult => r.type === 'level');
          this.teamResults = results.filter((r): r is TeamSearchResult => r.type === 'team');
          this.playerResults = results.filter((r): r is PlayerSearchResult => r.type === 'player');
        },
        error: () => {
          this.clearResults();
          this.loadFailed = true;
        },
      });
  }

  private clearResults(): void {
    this.gameResults = [];
    this.levelResults = [];
    this.teamResults = [];
    this.playerResults = [];
  }
}
