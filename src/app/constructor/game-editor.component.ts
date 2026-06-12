import {Component, OnDestroy, OnInit} from "@angular/core";
import {FormsModule} from "@angular/forms";
import {ActivatedRoute, ParamMap, RouterLink} from "@angular/router";
import {Subscription} from "rxjs";
import {ConstructorService} from "./constructor.service";
import {HintEditorComponent} from "./hint-editor.component";
import {HintTypePickerComponent} from "./hint-type-picker.component";
import {EffectsEditorComponent} from "./effects-editor.component";
import {FullGame, HintType, Level, ScenarioConditionType} from "../domain/game.models";
import {
  CONTENT_TYPE_LABELS,
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
import {HttpAdapter} from "../http/http.adapter";
import {AppEmoji, CONTENT_TYPE_EMOJI} from "../ui/emoji";

interface EditorCondition {
  keysText: string;            // EFFECTS_KEY
  action_time: number | null;  // EFFECTS_TIMER
  effects: EffectsPayload;
}

interface EditorTimeHint {
  time: number;
  hint: HintPayload[];
}

interface EditorLevel {
  id: string;
  /** Keys of the single WIN_KEY condition ("Ключ уровня"). */
  winKeysText: string;
  /** action_time of the winning timer ("Время автозавершения уровня"). */
  autoFinishTime: number | null;
  /** Preserved effects payload of the winning timer (round-trip safety). */
  autoFinishEffects: EffectsPayload;
  /** EFFECTS_KEY conditions. */
  keyConditions: EditorCondition[];
  /** Non-winning EFFECTS_TIMER conditions. */
  timerConditions: EditorCondition[];
  time_hints: EditorTimeHint[];
}

type FilePreviewKind = "image" | "video" | "audio" | "none";

@Component({
  selector: "app-game-editor",
  standalone: true,
  imports: [FormsModule, RouterLink, HintEditorComponent, HintTypePickerComponent, EffectsEditorComponent],
  templateUrl: "./game-editor.component.html",
  styleUrl: "./game-editor.component.scss",
})
export class GameEditorComponent implements OnInit, OnDestroy {
  protected readonly AppEmoji = AppEmoji;

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
    private http: HttpAdapter,
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
    const editor: EditorLevel = {
      id: scenario?.id ?? level.name_id,
      winKeysText: "",
      autoFinishTime: null,
      autoFinishEffects: this.newEffects(),
      keyConditions: [],
      timerConditions: [],
      time_hints: (scenario?.time_hints ?? []).map(th => ({
        time: th.time,
        hint: (th.hint ?? []) as HintPayload[],
      })),
    };

    for (const condition of (scenario?.conditions ?? []) as any[]) {
      const keys: string[] = Array.isArray(condition.keys) ? condition.keys : [];
      const effects = this.toEffects(condition.effects);
      const actionTime = typeof condition.action_time === "number" ? condition.action_time : null;

      switch (condition.type) {
        case ScenarioConditionType.winKey:
          editor.winKeysText = [editor.winKeysText, keys.join(" ")].filter(Boolean).join(" ");
          break;
        case ScenarioConditionType.effectsKey:
          editor.keyConditions.push({keysText: keys.join(" "), action_time: null, effects});
          break;
        case ScenarioConditionType.effectsTimer:
          if (effects.level_up && editor.autoFinishTime === null) {
            editor.autoFinishTime = actionTime;
            editor.autoFinishEffects = effects;
          } else {
            // Extra winning timers are invalid per the contract — demote them.
            editor.timerConditions.push({
              keysText: "",
              action_time: actionTime,
              effects: {...effects, level_up: false, next_level: null},
            });
          }
          break;
      }
    }

    return editor;
  }

  private toEffects(raw: any): EffectsPayload {
    const effects = Array.isArray(raw) ? raw[0] : raw;
    return {
      id: effects?.id ?? generateEffectId(),
      hints: (effects?.hints ?? effects?.hints_ ?? []) as HintPayload[],
      bonus_minutes: typeof effects?.bonus_minutes === "number" ? effects.bonus_minutes : 0,
      level_up: effects?.level_up === true,
      next_level: effects?.next_level ?? null,
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
    this.levels.push({
      id: this.uniqueLevelId(),
      winKeysText: "",
      autoFinishTime: null,
      autoFinishEffects: this.newEffects(),
      keyConditions: [],
      timerConditions: [],
      time_hints: [{time: 0, hint: []}],
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

  levelIdsExcept(level: EditorLevel): string[] {
    return this.levels.map(l => l.id).filter(id => id !== level.id);
  }

  conditionsCount(level: EditorLevel): number {
    return (parseKeys(level.winKeysText).length > 0 ? 1 : 0)
      + (level.autoFinishTime != null ? 1 : 0)
      + level.keyConditions.length
      + level.timerConditions.length;
  }

  hintsCount(level: EditorLevel): number {
    return level.time_hints.length;
  }

  // -------------------------------------------------------------------------
  // Time hints
  // -------------------------------------------------------------------------

  addTimeHint(level: EditorLevel) {
    const maxTime = level.time_hints.reduce((m, th) => Math.max(m, th.time), -1);
    level.time_hints.push({time: maxTime + 5, hint: []});
  }

  removeTimeHint(level: EditorLevel, index: number) {
    level.time_hints.splice(index, 1);
  }

  addHint(timeHint: EditorTimeHint, type: HintType) {
    timeHint.hint.push({type});
  }

  removeHint(timeHint: EditorTimeHint, index: number) {
    timeHint.hint.splice(index, 1);
  }

  // -------------------------------------------------------------------------
  // Conditions
  // -------------------------------------------------------------------------

  addKeyCondition(level: EditorLevel) {
    level.keyConditions.push({keysText: "", action_time: null, effects: this.newEffects()});
  }

  removeKeyCondition(level: EditorLevel, index: number) {
    level.keyConditions.splice(index, 1);
  }

  addTimerCondition(level: EditorLevel) {
    level.timerConditions.push({keysText: "", action_time: null, effects: this.newEffects()});
  }

  removeTimerCondition(level: EditorLevel, index: number) {
    level.timerConditions.splice(index, 1);
  }

  private newEffects(): EffectsPayload {
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
        this.addFile(uploaded);
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

  /** A file uploaded from inside a hint editor — register it in the list. */
  onHintFileUploaded(file: UploadedFile) {
    this.addFile(file);
  }

  private addFile(file: UploadedFile) {
    this.files = [...this.files.filter(f => f.guid !== file.guid), file];
  }

  fileLabel(file: UploadedFile): string {
    return `${file.original_filename}${file.extension || ""}`;
  }

  fileEmoji(file: UploadedFile): string {
    if (file.content_type && CONTENT_TYPE_EMOJI[file.content_type]) {
      return CONTENT_TYPE_EMOJI[file.content_type];
    }
    return AppEmoji.files;
  }

  fileContentTypeLabel(file: UploadedFile): string | undefined {
    if (!file.content_type) {
      return undefined;
    }
    return CONTENT_TYPE_LABELS[file.content_type] ?? file.content_type;
  }

  filePreviewKind(file: UploadedFile): FilePreviewKind {
    switch (file.content_type) {
      case "photo":
        return "image";
      case "video":
        return "video";
      case "audio":
        return "audio";
      default:
        return "none";
    }
  }

  fileUrl(file: UploadedFile): string {
    return this.http.getFileUrl(this.gameId, file.guid);
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
        conditions: this.buildConditions(level),
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

  private buildConditions(level: EditorLevel) {
    const conditions: any[] = [];

    const winKeys = parseKeys(level.winKeysText);
    if (winKeys.length > 0) {
      conditions.push({type: ScenarioConditionType.winKey, keys: winKeys});
    }

    if (level.autoFinishTime != null) {
      conditions.push({
        type: ScenarioConditionType.effectsTimer,
        action_time: Number(level.autoFinishTime),
        effects: {...this.buildEffects(level.autoFinishEffects), level_up: true},
      });
    }

    level.keyConditions.forEach(c => {
      conditions.push({
        type: ScenarioConditionType.effectsKey,
        keys: parseKeys(c.keysText),
        effects: this.buildEffects(c.effects),
      });
    });

    level.timerConditions.forEach(c => {
      conditions.push({
        type: ScenarioConditionType.effectsTimer,
        action_time: c.action_time != null ? Number(c.action_time) : undefined,
        effects: {...this.buildEffects(c.effects), level_up: false, next_level: null},
      });
    });

    return conditions;
  }

  private buildEffects(e: EffectsPayload): EffectsPayload {
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
    });
  }

  private toLocalInput(iso: string): string {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
}
