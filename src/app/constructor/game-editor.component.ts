import {Component, OnDestroy, OnInit} from "@angular/core";
import {FormsModule} from "@angular/forms";
import {RouterLink} from "@angular/router";
import {ActivatedRoute, ParamMap} from "@angular/router";
import {Subscription} from "rxjs";
import {HttpErrorResponse} from "@angular/common/http";
import {ConstructorService} from "./constructor.service";
import {HintEditorComponent} from "./hint-editor.component";
import {FullGame, HintType, Level, ScenarioConditionType} from "../domain/game.models";
import {
  EffectsPayload,
  generateEffectId,
  HintPayload,
  isEditableStatus,
  parseKeys,
  SCENARIO_MODEL_VERSION,
  ScenarioPayload,
  STATUS_LABELS,
  UploadedFile,
  validateScenario,
} from "./constructor.models";
import {SnackbarService} from "../snackbar/snackbar.service";

interface EditorEffects {
  id: string;
  hints: HintPayload[];
  bonus_minutes: number;
  level_up: boolean;
  next_level: string | null;
}

interface EditorCondition {
  type: ScenarioConditionType;
  keysText: string;
  action_time: number | null;
  effects: EditorEffects;
}

interface EditorTimeHint {
  time: number;
  hint: HintPayload[];
}

interface EditorLevel {
  id: string;
  time_hints: EditorTimeHint[];
  conditions: EditorCondition[];
}

@Component({
  selector: "app-game-editor",
  standalone: true,
  imports: [FormsModule, RouterLink, HintEditorComponent],
  templateUrl: "./game-editor.component.html",
  styleUrl: "./game-editor.component.scss",
})
export class GameEditorComponent implements OnInit, OnDestroy {
  protected readonly ScenarioConditionType = ScenarioConditionType;
  protected readonly statusLabels = STATUS_LABELS;

  gameId!: number;
  game: FullGame | undefined;
  isLoading = false;
  isSaving = false;
  isUploading = false;

  name = "";
  levels: EditorLevel[] = [];
  files: UploadedFile[] = [];

  startAtLocal = "";
  validationErrors: string[] = [];

  private routeSubscription: Subscription | undefined;

  constructor(
    private constructorService: ConstructorService,
    private route: ActivatedRoute,
    private snackbar: SnackbarService,
  ) {
  }

  ngOnInit(): void {
    this.routeSubscription = this.route.paramMap.subscribe((params: ParamMap) => {
      const id = Number(params.get("id"));
      if (Number.isNaN(id)) {
        return;
      }
      this.gameId = id;
      this.load();
    });
  }

  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();
  }

  get status(): string | undefined {
    return this.game?.status;
  }

  statusLabel(status: string | undefined): string {
    if (!status) {
      return "";
    }
    return STATUS_LABELS[status] ?? status;
  }

  get isEditable(): boolean {
    return isEditableStatus(this.game?.status);
  }

  get canOpenWaivers(): boolean {
    return this.isEditable && this.game?.status !== "getting_waivers";
  }

  get canComplete(): boolean {
    return this.game?.status === "finished";
  }

  // -------------------------------------------------------------------------
  // Loading & state mapping
  // -------------------------------------------------------------------------

  load() {
    this.isLoading = true;
    this.constructorService.getGame(this.gameId).subscribe({
      next: game => {
        this.applyGame(game);
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }

  private applyGame(game: FullGame) {
    this.game = game;
    this.name = game.name;
    this.startAtLocal = game.start_at ? this.toLocalInput(game.start_at) : "";

    const rawLevels = [...(game.levels ?? [])].sort(
      (a, b) => (a.number_in_game ?? 0) - (b.number_in_game ?? 0),
    );
    this.levels = rawLevels.map(level => this.toEditorLevel(level));

    // Reconstruct the files list: prefer a server-provided files array if any,
    // otherwise rebuild best-effort entries from the guids referenced in hints.
    this.files = this.collectFiles(game);
  }

  private toEditorLevel(level: Level): EditorLevel {
    const scenario = level.scenario;
    return {
      id: scenario?.id ?? level.name_id,
      time_hints: (scenario?.time_hints ?? []).map(th => ({
        time: th.time,
        hint: (th.hint ?? []) as HintPayload[],
      })),
      conditions: (scenario?.conditions ?? []).map(c => this.toEditorCondition(c)),
    };
  }

  private toEditorCondition(condition: any): EditorCondition {
    const rawEffects = Array.isArray(condition.effects) ? condition.effects[0] : condition.effects;
    return {
      type: condition.type,
      keysText: Array.isArray(condition.keys) ? condition.keys.join(" ") : "",
      action_time: typeof condition.action_time === "number" ? condition.action_time : null,
      effects: {
        id: rawEffects?.id ?? generateEffectId(),
        hints: (rawEffects?.hints ?? rawEffects?.hints_ ?? []) as HintPayload[],
        bonus_minutes: typeof rawEffects?.bonus_minutes === "number" ? rawEffects.bonus_minutes : 0,
        level_up: rawEffects?.level_up === true,
        next_level: rawEffects?.next_level ?? null,
      },
    };
  }

  private collectFiles(game: FullGame): UploadedFile[] {
    const provided = (game as any).files;
    if (Array.isArray(provided) && provided.length > 0) {
      return provided as UploadedFile[];
    }

    const guids = new Set<string>();
    (game.levels ?? []).forEach(level => {
      (level.scenario?.time_hints ?? []).forEach(th => {
        (th.hint ?? []).forEach(h => {
          if (h.file_guid) guids.add(h.file_guid);
          if (h.thumb_guid) guids.add(h.thumb_guid);
        });
      });
      (level.scenario?.conditions ?? []).forEach((c: any) => {
        const eff = Array.isArray(c.effects) ? c.effects[0] : c.effects;
        const hints = eff?.hints ?? eff?.hints_ ?? [];
        hints.forEach((h: HintPayload) => {
          if (h.file_guid) guids.add(h.file_guid);
          if (h.thumb_guid) guids.add(h.thumb_guid);
        });
      });
    });

    return Array.from(guids).map(guid => ({
      guid,
      original_filename: guid,
      extension: "",
    }));
  }

  // -------------------------------------------------------------------------
  // Level operations
  // -------------------------------------------------------------------------

  addLevel() {
    const id = this.uniqueLevelId();
    this.levels.push({
      id,
      time_hints: [{time: 0, hint: [this.newHint()]}],
      conditions: [{
        type: ScenarioConditionType.winKey,
        keysText: "",
        action_time: null,
        effects: this.newEffects(),
      }],
    });
  }

  removeLevel(index: number) {
    this.levels.splice(index, 1);
  }

  moveLevel(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= this.levels.length) {
      return;
    }
    const [item] = this.levels.splice(index, 1);
    this.levels.splice(target, 0, item);
  }

  private uniqueLevelId(): string {
    const existing = new Set(this.levels.map(l => l.id));
    let n = this.levels.length + 1;
    let id = `lvl_${this.gameId}_${n}`;
    while (existing.has(id)) {
      n += 1;
      id = `lvl_${this.gameId}_${n}`;
    }
    return id;
  }

  // -------------------------------------------------------------------------
  // Time hints
  // -------------------------------------------------------------------------

  addTimeHint(level: EditorLevel) {
    const maxTime = level.time_hints.reduce((m, th) => Math.max(m, th.time), -1);
    level.time_hints.push({time: maxTime + 5, hint: [this.newHint()]});
  }

  removeTimeHint(level: EditorLevel, index: number) {
    level.time_hints.splice(index, 1);
  }

  addHint(timeHint: EditorTimeHint) {
    timeHint.hint.push(this.newHint());
  }

  removeHint(timeHint: EditorTimeHint, index: number) {
    timeHint.hint.splice(index, 1);
  }

  // -------------------------------------------------------------------------
  // Conditions
  // -------------------------------------------------------------------------

  addCondition(level: EditorLevel) {
    level.conditions.push({
      type: ScenarioConditionType.effectsKey,
      keysText: "",
      action_time: null,
      effects: this.newEffects(),
    });
  }

  removeCondition(level: EditorLevel, index: number) {
    level.conditions.splice(index, 1);
  }

  onConditionTypeChange(condition: EditorCondition) {
    if (!condition.effects?.id) {
      condition.effects = this.newEffects();
    }
  }

  isKeyCondition(condition: EditorCondition): boolean {
    return condition.type === ScenarioConditionType.winKey
      || condition.type === ScenarioConditionType.effectsKey;
  }

  hasEffects(condition: EditorCondition): boolean {
    return condition.type === ScenarioConditionType.effectsKey
      || condition.type === ScenarioConditionType.effectsTimer;
  }

  isTimer(condition: EditorCondition): boolean {
    return condition.type === ScenarioConditionType.effectsTimer;
  }

  addEffectHint(condition: EditorCondition) {
    condition.effects.hints.push(this.newHint());
  }

  removeEffectHint(condition: EditorCondition, index: number) {
    condition.effects.hints.splice(index, 1);
  }

  private newHint(): HintPayload {
    return {type: HintType.text, text: ""};
  }

  private newEffects(): EditorEffects {
    return {
      id: generateEffectId(),
      hints: [],
      bonus_minutes: 0,
      level_up: false,
      next_level: null,
    };
  }

  // -------------------------------------------------------------------------
  // Files
  // -------------------------------------------------------------------------

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    this.isUploading = true;
    this.constructorService.uploadFile(this.gameId, file).subscribe({
      next: uploaded => {
        this.files = [...this.files.filter(f => f.guid !== uploaded.guid), uploaded];
        this.isUploading = false;
        this.snackbar.success(`Файл загружен: ${uploaded.original_filename}${uploaded.extension}`);
        input.value = "";
      },
      error: () => {
        this.isUploading = false;
        input.value = "";
      },
    });
  }

  fileLabel(file: UploadedFile): string {
    return `${file.original_filename}${file.extension || ""}`;
  }

  // -------------------------------------------------------------------------
  // Saving scenario
  // -------------------------------------------------------------------------

  private buildScenario(): ScenarioPayload {
    return {
      name: this.name.trim(),
      __model_version__: SCENARIO_MODEL_VERSION,
      levels: this.levels.map(level => ({
        id: level.id.trim(),
        __model_version__: SCENARIO_MODEL_VERSION,
        time_hints: level.time_hints.map(th => ({
          time: Number(th.time),
          hint: th.hint.map(h => this.cleanHint(h)),
        })),
        conditions: level.conditions.map(c => this.buildCondition(c)),
      })),
      files: this.files.map(f => ({
        guid: f.guid,
        original_filename: f.original_filename,
        extension: f.extension,
        content_type: f.content_type,
        mime_type: f.mime_type,
        sha256: f.sha256,
      })),
    };
  }

  private buildCondition(c: EditorCondition) {
    if (c.type === ScenarioConditionType.winKey) {
      return {type: c.type, keys: parseKeys(c.keysText)};
    }
    if (c.type === ScenarioConditionType.effectsKey) {
      return {type: c.type, keys: parseKeys(c.keysText), effects: this.buildEffects(c.effects)};
    }
    // effects timer
    return {
      type: c.type,
      action_time: c.action_time != null ? Number(c.action_time) : undefined,
      effects: this.buildEffects(c.effects),
    };
  }

  private buildEffects(e: EditorEffects): EffectsPayload {
    return {
      id: e.id,
      hints: e.hints.map(h => this.cleanHint(h)),
      bonus_minutes: Number(e.bonus_minutes) || 0,
      level_up: e.level_up === true,
      next_level: e.next_level && e.next_level.length > 0 ? e.next_level : null,
    };
  }

  /** Drop empty/undefined fields and coerce numbers so the payload is clean. */
  private cleanHint(hint: HintPayload): HintPayload {
    const out: HintPayload = {type: hint.type};
    const copyIf = (key: keyof HintPayload) => {
      const v = hint[key];
      if (v !== undefined && v !== null && v !== "") {
        (out as any)[key] = v;
      }
    };
    copyIf("text");
    copyIf("title");
    copyIf("address");
    copyIf("foursquare_id");
    copyIf("foursquare_type");
    copyIf("caption");
    copyIf("file_guid");
    copyIf("thumb_guid");
    copyIf("phone_number");
    copyIf("first_name");
    copyIf("last_name");
    copyIf("vcard");
    if (typeof hint.latitude === "number") out.latitude = Number(hint.latitude);
    if (typeof hint.longitude === "number") out.longitude = Number(hint.longitude);
    if (hint.show_caption_above_media === true) out.show_caption_above_media = true;
    if (hint.link_preview) out.link_preview = hint.link_preview;
    return out;
  }

  save() {
    const scenario = this.buildScenario();
    this.validationErrors = validateScenario(scenario);
    if (this.validationErrors.length > 0) {
      this.snackbar.error("Исправьте ошибки перед сохранением");
      return;
    }

    this.isSaving = true;
    this.constructorService.saveScenario(this.gameId, scenario).subscribe({
      next: game => {
        this.applyGame(game);
        this.isSaving = false;
        this.snackbar.success("Сценарий сохранён");
      },
      error: () => {
        this.isSaving = false;
      },
    });
  }

  // -------------------------------------------------------------------------
  // Start time & status
  // -------------------------------------------------------------------------

  saveStartAt() {
    if (!this.startAtLocal) {
      this.snackbar.error("Выберите дату и время старта");
      return;
    }
    const iso = new Date(this.startAtLocal).toISOString();
    this.constructorService.setStartAt(this.gameId, iso).subscribe({
      next: () => {
        this.snackbar.success("Время старта сохранено");
        this.load();
      },
    });
  }

  clearStartAt() {
    this.constructorService.setStartAt(this.gameId, null).subscribe({
      next: () => {
        this.startAtLocal = "";
        this.snackbar.success("Планируемый старт отменён");
        this.load();
      },
    });
  }

  changeStatus(status: string) {
    this.constructorService.setStatus(this.gameId, status).subscribe({
      next: () => {
        this.snackbar.success("Статус изменён");
        this.load();
      },
      error: err => {
        if (err instanceof HttpErrorResponse) {
          // handled by global error handler
        }
      },
    });
  }

  private toLocalInput(iso: string): string {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
}
