import {Component, EventEmitter, Input, Output} from '@angular/core';
import {NgClass} from "@angular/common";
import {BonusEvent, BonusSource, GameStat, Keys, KeyTime, KeyType, Level, LevelTime} from "../domain/game.models";
import {MatIcon} from "@angular/material/icon";
import {RouterLink} from "@angular/router";
import {AppIcon} from "../ui/icons";
import {GameChartPartComponent} from "../game_chart.part/game_chart.part.component";

interface TeamPivotData {
  teamId: number;
  teamName: string;
  absoluteTimes: Map<number, string>;
  absoluteTimeMs: Map<number, number>;
  durations: Map<number, string>;
  durationMs: Map<number, number>;
  /** Бонус за уровень в мс: положительный снимает время, отрицательный добавляет. */
  bonusMs: Map<number, number>;
  bonusesByLevel: Map<number, BonusEvent[]>;
  /** Все бонусы команды, включая те, чей уровень не определён. */
  bonuses: BonusEvent[];
  totalBonusMs: number;
  /** Время последнего взятого уровня — по нему считается место команды. */
  finishMs: number | undefined;
  currentLevel: number;
}

/**
 * Как показывать время в таблицах:
 * raw — как есть, adjusted — с учётом бонусов, expression — с расчётом.
 */
export type TimeMode = 'raw' | 'adjusted' | 'expression';

const NO_VALUE = '—';

@Component({
  selector: 'app-game-log-part',
  standalone: true,
  imports: [MatIcon, NgClass, RouterLink, GameChartPartComponent],
  templateUrl: './game_log.part.component.html',
  styleUrl: './game_log.part.component.scss',
})
export class GameLogPartComponent {
  protected readonly AppIcon = AppIcon;
  private _keys: Keys | undefined;
  private _stat: GameStat | undefined;

  @Input()
  set keys(value: Keys | undefined) {
    this._keys = value;
    this.sortedTeamKeysEntries = this.buildSortedTeamKeysEntries(value);
    this.applyKeyFilters();
    if (value) {
      this.keysDetailsOpen = this.keysDetailsOpen || this.openKeys;
    }
  }

  get keys(): Keys | undefined {
    return this._keys;
  }

  @Input()
  set stat(value: GameStat | undefined) {
    this._stat = value;
    this.sortedStatEntries = this.buildSortedStatEntries(value);
    this.buildPivotData();
    if (value) {
      this.statDetailsOpen = this.statDetailsOpen || this.openStat;
      this.pivotDetailsOpen = this.pivotDetailsOpen || this.openStat;
    }
  }

  get stat(): GameStat | undefined {
    return this._stat;
  }

  @Input() levels: Level[] = [];
  @Input() gameStartAt: string | undefined;
  /** When set, the chart tab offers a link to its standalone full-page view. */
  @Input() gameId: number | undefined;
  @Input() openKeys = false;
  @Input() openStat = false;
  @Input() isCompleted = false;
  @Input() keysLoading = false;
  @Input() statLoading = false;
  /** Whether a results-workbook export is currently in flight. */
  @Input() exporting = false;
  /** Request to download the results workbook (.xlsx). */
  @Output() exportStat = new EventEmitter<void>();

  onExportClick(): void {
    if (!this.exporting) {
      this.exportStat.emit();
    }
  }

  /** The workbook export is offered on the table view only, not on the chart. */
  showExportButton(): boolean {
    return this.gameId !== undefined && !this.showCompletedChart();
  }

  sortedTeamKeysEntries: [string, KeyTime[]][] = [];
  displayedTeamKeysEntries: [string, KeyTime[]][] = [];
  sortedStatEntries: [string, LevelTime[]][] = [];
  pivotData: TeamPivotData[] = [];
  allLevelNumbers: number[] = [];
  minDurationPerLevel: Map<number, number> = new Map();
  minAbsoluteTimePerLevel: Map<number, number> = new Map();
  levelNameIds: Map<number, string> = new Map();

  filtersExpanded = false;
  showWrongKeys = true;
  showCorrectKeys = true;
  showEffectsKeys = true;
  showDuplicateKeys = true;

  keysDetailsOpen = false;
  statDetailsOpen = false;
  pivotDetailsOpen = false;
  statTab: 'results' | 'pivot' | 'bonuses' = 'results';
  completedTab: 'table' | 'chart' | 'bonuses' = 'table';
  timeMode: TimeMode = 'raw';
  private teamKeysOpenState: Record<string, boolean> = {};

  setStatTab(tab: 'results' | 'pivot' | 'bonuses'): void {
    this.statTab = tab;
  }

  setCompletedTab(tab: 'table' | 'chart' | 'bonuses'): void {
    this.completedTab = tab;
  }

  setTimeMode(mode: TimeMode): void {
    this.timeMode = mode;
    this.refreshModeDerived();
  }

  /** Completed games offer a table / chart switch over the same results. */
  showCompletedTabs(): boolean {
    return this.isCompleted && this.pivotData.length > 0;
  }

  showCompletedChart(): boolean {
    return this.isCompleted && this.completedTab === 'chart' && this.pivotData.length > 0;
  }

  /** Both the standings and the per-level pivot are available, so tabs are shown. */
  showStatTabs(): boolean {
    return !this.isCompleted && this.pivotData.length > 0;
  }

  /** Current-level standings table (hidden once the game is completed). */
  showCurrentStandings(): boolean {
    return !this.isCompleted && (this.statTab === 'results' || this.pivotData.length === 0);
  }

  /** Per-level pivot table. The "Таблица" tab when completed. */
  showPivotTable(): boolean {
    if (this.pivotData.length === 0) {
      return false;
    }
    if (this.isCompleted) {
      return this.completedTab === 'table';
    }
    return this.statTab === 'pivot';
  }

  private buildSortedTeamKeysEntries(keys: Keys | undefined): [string, KeyTime[]][] {
    if (!keys) {
      return [];
    }

    const entries = Object.entries(keys as unknown as Record<string, KeyTime[]>);
    return entries
      .map(([teamId, teamKeys]) => [
        teamId,
        [...teamKeys].sort((a, b) => (this.parseDate(b.at) ?? 0) - (this.parseDate(a.at) ?? 0)),
      ]);
  }

  /**
   * A key must pass every category it belongs to. The duplicate flag is
   * independent of the key type, so a wrong duplicate is hidden when either
   * "неверные" or "дубли" is off, a correct duplicate when "верные" or "дубли"
   * is off, and so on.
   */
  private isKeyVisible(key: KeyTime): boolean {
    if (key.is_duplicate && !this.showDuplicateKeys) {
      return false;
    }
    switch (key.type_) {
      case KeyType.wrong:
        return this.showWrongKeys;
      case KeyType.effects:
        return this.showEffectsKeys;
      default:
        return this.showCorrectKeys;
    }
  }

  private applyKeyFilters(): void {
    this.displayedTeamKeysEntries = this.sortedTeamKeysEntries
      .map(([teamId, teamKeys]) => [teamId, teamKeys.filter(key => this.isKeyVisible(key))] as [string, KeyTime[]]);
  }

  toggleFilters(): void {
    this.filtersExpanded = !this.filtersExpanded;
  }

  onToggleShowWrongKeys(value: boolean): void {
    this.showWrongKeys = value;
    this.applyKeyFilters();
  }

  onToggleShowCorrectKeys(value: boolean): void {
    this.showCorrectKeys = value;
    this.applyKeyFilters();
  }

  onToggleShowEffectsKeys(value: boolean): void {
    this.showEffectsKeys = value;
    this.applyKeyFilters();
  }

  onToggleShowDuplicateKeys(value: boolean): void {
    this.showDuplicateKeys = value;
    this.applyKeyFilters();
  }

  private buildSortedStatEntries(stat: GameStat | undefined): [string, LevelTime[]][] {
    if (!stat?.level_times) {
      return [];
    }

    return Object.entries(stat.level_times as unknown as Record<string, LevelTime[]>)
      .map(([teamId, levelTimes]) => [teamId, [...levelTimes]] as [string, LevelTime[]])
      .sort((a, b) => {
        const aTimes = a[1];
        const bTimes = b[1];
        const levelDiff = this.getCurrentLevelNumber(bTimes) - this.getCurrentLevelNumber(aTimes);
        if (levelDiff !== 0) {
          return levelDiff;
        }

        const aStartedAt = this.parseDate(aTimes[aTimes.length - 1]?.start_at) ?? Number.MAX_SAFE_INTEGER;
        const bStartedAt = this.parseDate(bTimes[bTimes.length - 1]?.start_at) ?? Number.MAX_SAFE_INTEGER;
        return aStartedAt - bStartedAt;
      });
  }

  private buildPivotData(): void {
    if (!this.sortedStatEntries.length) {
      this.pivotData = [];
      this.allLevelNumbers = [];
      this.minDurationPerLevel = new Map();
      this.minAbsoluteTimePerLevel = new Map();
      this.levelNameIds = new Map();
      return;
    }

    const allLevels = new Set<number>();
    const levelNameIds = new Map<number, string>();
    const pivotRows: TeamPivotData[] = [];

    for (const [teamId, teamLevelTimes] of this.sortedStatEntries) {
      if (teamLevelTimes.length === 0) continue;

      const sorted = [...teamLevelTimes].sort((a, b) => a.level_number - b.level_number);
      const absoluteTimes = new Map<number, string>();
      const absoluteTimeMs = new Map<number, number>();
      const durations = new Map<number, string>();
      const durationMs = new Map<number, number>();
      const bonuses = this.bonusesOf(teamId);
      const bonusesByLevel = this.groupBonusesByLevel(bonuses);
      const bonusMs = new Map<number, number>();
      for (const [lvl, events] of bonusesByLevel) {
        bonusMs.set(lvl, this.sumBonusMs(events));
      }

      for (let i = 0; i < sorted.length; i++) {
        const lt = sorted[i];
        allLevels.add(lt.level_number);
        if (lt.name_id) {
          levelNameIds.set(lt.level_number, lt.name_id);
        }

        const ms = this.parseDate(lt.start_at);

        if (i < sorted.length - 1) {
          const nextMs = this.parseDate(sorted[i + 1].start_at);
          if (nextMs !== undefined) {
            absoluteTimes.set(lt.level_number, this.toLocalHms(String(sorted[i + 1].start_at)));
            absoluteTimeMs.set(lt.level_number, nextMs);
          }
          if (ms !== undefined && nextMs !== undefined) {
            const diffMs = nextMs - ms;
            durationMs.set(lt.level_number, diffMs);
            durations.set(lt.level_number, this.formatDuration(diffMs));
          }
        }
      }

      pivotRows.push({
        teamId: sorted[0].team.id,
        teamName: sorted[0].team.name,
        absoluteTimes,
        absoluteTimeMs,
        durations,
        durationMs,
        bonusMs,
        bonusesByLevel,
        bonuses,
        totalBonusMs: this.sumBonusMs(bonuses),
        finishMs: this.parseDate(teamLevelTimes[teamLevelTimes.length - 1]?.start_at),
        currentLevel: this.getCurrentLevelNumber(teamLevelTimes),
      });
    }

    const sortedLevels = [...allLevels].sort((a, b) => a - b);
    const hasData = (lvl: number) => pivotRows.some(
      row => row.absoluteTimes.has(lvl) || row.durations.has(lvl)
    );
    this.allLevelNumbers = sortedLevels.filter(hasData);
    this.pivotData = pivotRows;
    this.levelNameIds = levelNameIds;

    this.refreshModeDerived();
  }

  /** Пересчитать всё, что зависит от режима отображения: подсветку лучшего и порядок. */
  private refreshModeDerived(): void {
    const minDurations = new Map<number, number>();
    const minAbsTimes = new Map<number, number>();
    for (const lvl of this.allLevelNumbers) {
      let minDur = Number.MAX_SAFE_INTEGER;
      let minAbs = Number.MAX_SAFE_INTEGER;
      for (const row of this.pivotData) {
        const d = this.comparableDurationMs(row, lvl);
        if (d !== undefined && d < minDur) {
          minDur = d;
        }
        const a = this.comparableAbsoluteMs(row, lvl);
        if (a !== undefined && a < minAbs) {
          minAbs = a;
        }
      }
      if (minDur < Number.MAX_SAFE_INTEGER) {
        minDurations.set(lvl, minDur);
      }
      if (minAbs < Number.MAX_SAFE_INTEGER) {
        minAbsTimes.set(lvl, minAbs);
      }
    }
    this.minDurationPerLevel = minDurations;
    this.minAbsoluteTimePerLevel = minAbsTimes;
    this.sortPivotData();
  }

  /** Время на уровне, по которому команды сравниваются в текущем режиме. */
  comparableDurationMs(row: TeamPivotData, levelNumber: number): number | undefined {
    const raw = row.durationMs.get(levelNumber);
    if (raw === undefined || this.timeMode === 'raw') {
      return raw;
    }
    return raw - (row.bonusMs.get(levelNumber) ?? 0);
  }

  /** Время закрытия уровня, по которому команды сравниваются в текущем режиме. */
  comparableAbsoluteMs(row: TeamPivotData, levelNumber: number): number | undefined {
    const raw = row.absoluteTimeMs.get(levelNumber);
    if (raw === undefined || this.timeMode === 'raw') {
      return raw;
    }
    return raw - this.cumulativeBonusMs(row, levelNumber);
  }

  private bonusesOf(teamId: string): BonusEvent[] {
    const all = this._stat?.bonuses as unknown as Record<string, BonusEvent[]> | undefined;
    return all?.[teamId] ?? [];
  }

  private groupBonusesByLevel(bonuses: BonusEvent[]): Map<number, BonusEvent[]> {
    const grouped = new Map<number, BonusEvent[]>();
    for (const bonus of bonuses) {
      if (bonus.level_number === null || bonus.level_number === undefined) {
        continue;
      }
      const existing = grouped.get(bonus.level_number);
      if (existing) {
        existing.push(bonus);
      } else {
        grouped.set(bonus.level_number, [bonus]);
      }
    }
    return grouped;
  }

  private sumBonusMs(bonuses: BonusEvent[]): number {
    return bonuses.reduce((acc, bonus) => acc + bonus.minutes * 60_000, 0);
  }

  /** Бонус на 3-м уровне не должен двигать время закрытия 1-го, поэтому суммируем нарастающе. */
  private cumulativeBonusMs(row: TeamPivotData, levelNumber: number): number {
    let total = 0;
    for (const [lvl, ms] of row.bonusMs) {
      if (lvl <= levelNumber) {
        total += ms;
      }
    }
    return total;
  }

  /** Бонусы всех уровней до этого включительно — слагаемые для режима с расчётом. */
  private cumulativeBonuses(row: TeamPivotData, levelNumber: number): BonusEvent[] {
    return [...row.bonusesByLevel.entries()]
      .filter(([lvl]) => lvl <= levelNumber)
      .sort((a, b) => a[0] - b[0])
      .flatMap(([, events]) => events);
  }

  /**
   * Место команды: кто дальше — выше, при равенстве — кто раньше закрыл
   * последний уровень. В режиме с бонусами сравнивается уже их время
   * с бонусами, так что победитель может поменяться.
   */
  private sortPivotData(): void {
    const finishOf = (row: TeamPivotData): number => {
      if (row.finishMs === undefined) {
        return Number.MAX_SAFE_INTEGER;
      }
      return this.timeMode === 'raw' ? row.finishMs : row.finishMs - row.totalBonusMs;
    };
    this.pivotData = [...this.pivotData].sort((a, b) => {
      const levelDiff = b.currentLevel - a.currentLevel;
      return levelDiff !== 0 ? levelDiff : finishOf(a) - finishOf(b);
    });
  }

  shouldOpenTeamKeys(teamKeysCount: number): boolean {
    return teamKeysCount <= 10;
  }

  toLocal(dt: string): string {
    return new Date(Date.parse(dt)).toLocaleTimeString();
  }

  toLocalHm(dt: string): string {
    return new Date(Date.parse(dt)).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
  }

  toLocalHms(dt: string): string {
    return this.msToLocalHms(Date.parse(dt));
  }

  msToLocalHms(ms: number): string {
    return new Date(ms).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', second: '2-digit'});
  }

  formatDuration(ms: number): string {
    const totalSeconds = Math.max(Math.floor(ms / 1000), 0);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  /**
   * Длительность со знаком. Бонус может оказаться больше времени на уровне —
   * такое время не обрезаем в ноль, а показываем минусом, чтобы сумма по
   * уровням совпадала с итогом и была видна ошибка в сценарии.
   */
  formatSignedDuration(ms: number): string {
    const sign = ms < 0 ? '-' : '';
    return sign + this.formatDuration(Math.abs(ms));
  }

  /** Время на уровне в выбранном режиме. */
  durationCell(row: TeamPivotData, levelNumber: number): string {
    const raw = row.durationMs.get(levelNumber);
    if (raw === undefined) {
      return NO_VALUE;
    }
    const bonus = row.bonusMs.get(levelNumber) ?? 0;
    if (this.timeMode === 'raw' || bonus === 0) {
      return this.formatDuration(raw);
    }
    if (this.timeMode === 'adjusted') {
      return this.formatSignedDuration(raw - bonus);
    }
    return this.formatDuration(raw) + this.bonusTerms(row.bonusesByLevel.get(levelNumber) ?? []);
  }

  /** Время закрытия уровня в выбранном режиме. */
  absoluteCell(row: TeamPivotData, levelNumber: number): string {
    const raw = row.absoluteTimeMs.get(levelNumber);
    if (raw === undefined) {
      return NO_VALUE;
    }
    const bonus = this.cumulativeBonusMs(row, levelNumber);
    if (this.timeMode === 'raw' || bonus === 0) {
      return row.absoluteTimes.get(levelNumber) ?? NO_VALUE;
    }
    if (this.timeMode === 'adjusted') {
      return this.msToLocalHms(raw - bonus);
    }
    return (row.absoluteTimes.get(levelNumber) ?? NO_VALUE)
      + this.bonusTerms(this.cumulativeBonuses(row, levelNumber));
  }

  /** Итоговое время команды с учётом всех бонусов — то самое «место». */
  totalCell(row: TeamPivotData): string {
    const total = this.totalRawMs(row);
    if (total === undefined) {
      return NO_VALUE;
    }
    if (this.timeMode === 'expression') {
      return this.formatDuration(total) + this.bonusTerms(row.bonuses);
    }
    return this.formatSignedDuration(total - row.totalBonusMs);
  }

  /** Полная расшифровка для подсказки — доступна в любом режиме. */
  cellTitle(bonuses: BonusEvent[]): string {
    if (bonuses.length === 0) {
      return '';
    }
    return bonuses
      .map(bonus => {
        const what = bonus.minutes > 0 ? 'бонус' : 'штраф';
        const where = bonus.key ? `ключ ${bonus.key}` : this.bonusSourceLabel(bonus.source);
        return `${this.toLocalHms(bonus.at)} ${what} ${Math.abs(bonus.minutes)} мин. (${where})`;
      })
      .join('\n');
  }

  levelCellTitle(row: TeamPivotData, levelNumber: number): string {
    return this.cellTitle(row.bonusesByLevel.get(levelNumber) ?? []);
  }

  cumulativeCellTitle(row: TeamPivotData, levelNumber: number): string {
    return this.cellTitle(this.cumulativeBonuses(row, levelNumber));
  }

  /** Слагаемые вида `-00:05:00+00:03:00`: бонус вычитается, штраф прибавляется. */
  private bonusTerms(bonuses: BonusEvent[]): string {
    return bonuses
      .map(bonus => {
        const ms = bonus.minutes * 60_000;
        return (ms > 0 ? '-' : '+') + this.formatDuration(Math.abs(ms));
      })
      .join('');
  }

  private totalRawMs(row: TeamPivotData): number | undefined {
    const startMs = this.parseDate(this.gameStartAt);
    if (startMs === undefined || row.finishMs === undefined) {
      return undefined;
    }
    return row.finishMs - startMs;
  }

  bonusSourceLabel(source: BonusSource): string {
    switch (source) {
      case BonusSource.key:
        return 'ключ';
      case BonusSource.timer:
        return 'таймер';
      default:
        return 'неизвестно';
    }
  }

  bonusSourceIcon(source: BonusSource): AppIcon {
    return source === BonusSource.timer ? AppIcon.effects : AppIcon.bonus;
  }

  /** Класс ячейки по знаку бонуса: положительный — бонус, отрицательный — штраф. */
  bonusClass(bonus: number | undefined): string {
    if (!bonus) {
      return '';
    }
    return bonus > 0 ? 'has-bonus' : 'has-penalty';
  }

  showTotalColumn(): boolean {
    return this.timeMode !== 'raw' && this.gameStartAt !== undefined;
  }

  hasAnyBonus(): boolean {
    return this.pivotData.some(row => row.bonuses.length > 0);
  }

  /** Вкладка «Бонусы» имеет смысл только когда бонусы вообще были. */
  showBonusesTab(): boolean {
    if (!this.hasAnyBonus()) {
      return false;
    }
    return this.isCompleted ? this.completedTab === 'bonuses' : this.statTab === 'bonuses';
  }

  bonusRows(): TeamPivotData[] {
    return this.pivotData.filter(row => row.bonuses.length > 0);
  }

  levelLabelOf(bonus: BonusEvent): string {
    if (bonus.level_number === null || bonus.level_number === undefined) {
      return NO_VALUE;
    }
    const nameId = this.getLevelNameId(bonus.level_number);
    return nameId ? `${bonus.level_number + 1} (${nameId})` : `${bonus.level_number + 1}`;
  }

  isMinDuration(levelNumber: number, durationMs: number | undefined): boolean {
    if (durationMs === undefined) return false;
    return this.minDurationPerLevel.get(levelNumber) === durationMs;
  }

  isMinAbsoluteTime(levelNumber: number, timeMs: number | undefined): boolean {
    if (timeMs === undefined) return false;
    return this.minAbsoluteTimePerLevel.get(levelNumber) === timeMs;
  }

  keyTypeIcon(key: KeyTime): AppIcon {
    if (key.is_duplicate) {
      return AppIcon.duplicate;
    }

    switch (key.type_) {
      case KeyType.simple:
        return AppIcon.levelUp;
      case KeyType.wrong:
        return AppIcon.cancel;
      case KeyType.bonus:
        return AppIcon.bonus;
      case KeyType.effects:
        return AppIcon.effects;
      default:
        return AppIcon.unknown;
    }
  }

  /** Color class for a key in the log: correct / wrong / duplicate. */
  keyTypeClass(key: KeyTime): string {
    if (key.is_duplicate) {
      return "key-type-duplicate";
    }
    switch (key.type_) {
      case KeyType.wrong:
        return "key-type-wrong";
      case KeyType.simple:
      case KeyType.bonus:
      case KeyType.effects:
        return "key-type-correct";
      default:
        return "";
    }
  }

  isLevelChanged(keys: KeyTime[], index: number): boolean {
    if (index >= keys.length - 1) {
      return false;
    }

    return keys[index].level_number !== keys[index + 1].level_number;
  }

  getCurrentLevelNumber(teamLevelTimes: LevelTime[]): number {
    const currentLevel = teamLevelTimes[teamLevelTimes.length - 1];
    return (currentLevel?.level_number ?? 0) + 1;
  }

  getCurrentLevelNameId(teamLevelTimes: LevelTime[]): string | null {
    const currentLevel = teamLevelTimes[teamLevelTimes.length - 1];
    return currentLevel?.name_id ?? null;
  }

  getCurrentLevelLabel(teamLevelTimes: LevelTime[]): string {
    const number = this.getCurrentLevelNumber(teamLevelTimes);
    const nameId = this.getCurrentLevelNameId(teamLevelTimes);
    return nameId ? `${number} (${nameId})` : `${number}`;
  }

  getLevelNameId(levelNumber: number): string | null {
    return this.levelNameIds.get(levelNumber) ?? null;
  }

  getCurrentLevelDuration(teamLevelTimes: LevelTime[]): string {
    const currentLevel = teamLevelTimes[teamLevelTimes.length - 1];
    const startedAtMs = this.parseDate(currentLevel?.start_at);
    if (startedAtMs === undefined) {
      return "—";
    }

    const totalSeconds = Math.max(Math.floor((Date.now() - startedAtMs) / 1000), 0);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}ч ${minutes}м ${seconds}с`;
    }

    return `${minutes}м ${seconds}с`;
  }

  getLevelStartedAtTitle(teamLevelTimes: LevelTime[]): string {
    const currentLevel = teamLevelTimes[teamLevelTimes.length - 1];
    const startedAtMs = this.parseDate(currentLevel?.start_at);
    if (startedAtMs === undefined) {
      return "";
    }

    return `Уровень начался: ${new Date(startedAtMs).toLocaleTimeString()}`;
  }

  private parseDate(value: string | Date | undefined): number | undefined {
    if (!value) {
      return undefined;
    }

    const parsed = Date.parse(String(value));
    return Number.isNaN(parsed) ? undefined : parsed;
  }

  onKeysDetailsToggle(isOpen: boolean) {
    this.keysDetailsOpen = isOpen;
  }

  onStatDetailsToggle(isOpen: boolean) {
    this.statDetailsOpen = isOpen;
  }

  onPivotDetailsToggle(isOpen: boolean) {
    this.pivotDetailsOpen = isOpen;
  }

  onTeamKeysToggle(teamId: string, isOpen: boolean) {
    this.teamKeysOpenState[teamId] = isOpen;
  }

  isTeamKeysOpen(teamId: string, teamKeysCount: number): boolean {
    if (this.teamKeysOpenState[teamId] !== undefined) {
      return this.teamKeysOpenState[teamId];
    }

    const shouldOpen = this.shouldOpenTeamKeys(teamKeysCount);
    this.teamKeysOpenState[teamId] = shouldOpen;
    return shouldOpen;
  }

  protected readonly KeyType = KeyType;
  protected readonly Object = Object;
}
