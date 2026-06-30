import {Component, OnDestroy, OnInit} from "@angular/core";
import {FormsModule} from "@angular/forms";
import {ActivatedRoute, ParamMap, RouterLink} from "@angular/router";
import {Subscription} from "rxjs";
import {CdkDragDrop, DragDropModule, moveItemInArray} from "@angular/cdk/drag-drop";
import {ConstructorService} from "./constructor.service";
import {HintEditorComponent} from "./hint-editor.component";
import {HintTypePickerComponent} from "./hint-type-picker.component";
import {EffectsEditorComponent} from "./effects-editor.component";
import {OrganizersEditorComponent} from "./organizers-editor.component";
import {ImageLightboxComponent} from "../ui/image-lightbox.component";
import {ScenarioGraphPartComponent} from "../scenario_graph.part/scenario_graph.part.component";
import {GraphLevel, GraphRoute, keyRouteLabel, timerRouteLabel} from "../scenario_graph.part/scenario_graph.model";
import {scrollToLevel} from "../scenario_graph.part/scenario_graph.nav";
import {FullGame, HintType, Level, ScenarioConditionType} from "../domain/game.models";
import {
  CONTENT_TYPE_LABELS,
  describeError,
  EffectsPayload,
  generateEffectId,
  HintPayload,
  isEditableStatus,
  isValidKey,
  isValidLevelId,
  parseKeys,
  SCENARIO_MODEL_VERSION,
  ScenarioPayload,
  STATUS_LABELS,
  UploadedFile,
  validateScenario,
} from "./constructor.models";
import {SnackbarService} from "../snackbar/snackbar.service";
import {HttpAdapter} from "../http/http.adapter";
import {MatIcon} from "@angular/material/icon";
import {AppIcon, CONTENT_TYPE_ICON} from "../ui/icons";

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
  expanded: boolean;
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

type FilePreviewKind = "image" | "video" | "video_note" | "audio" | "none";

@Component({
  selector: "app-game-editor",
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    DragDropModule,
    HintEditorComponent,
    HintTypePickerComponent,
    EffectsEditorComponent,
    OrganizersEditorComponent,
    ImageLightboxComponent,
    ScenarioGraphPartComponent,
    MatIcon,
  ],
  templateUrl: "./game-editor.component.html",
  styleUrl: "./game-editor.component.scss",
})
export class GameEditorComponent implements OnInit, OnDestroy {
  protected readonly AppIcon = AppIcon;

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

  /** guid -> local blob URL, for instant previews right after upload
   *  (the CDN copy may not be readable for a moment). Shared with child
   *  hint editors so their previews resolve to the local copy too. */
  objectUrls = new Map<string, string>();

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
    this.objectUrls.forEach(url => URL.revokeObjectURL(url));
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
    this.startAtLocal = game.start_at ? this.toLocalInput(game.start_at) : this.defaultStartAtLocal();

    const rawLevels = [...(game.levels ?? [])].sort(
      (a, b) => (a.number_in_game ?? 0) - (b.number_in_game ?? 0),
    );
    this.levels = rawLevels.map(level => this.toEditorLevel(level));

    // Reconstruct the files list: prefer a server-provided files array if any,
    // otherwise rebuild best-effort entries from the guids referenced in hints.
    // Keep files already uploaded this session (they may not yet be referenced
    // by any hint, so they wouldn't be re-derived from the scenario).
    this.files = this.mergeFiles(this.files, this.collectFiles(game));
  }

  /** Merge two file lists by guid; entries in `existing` win (richer metadata). */
  private mergeFiles(existing: UploadedFile[], incoming: UploadedFile[]): UploadedFile[] {
    const map = new Map<string, UploadedFile>();
    for (const f of incoming) {
      map.set(f.guid, f);
    }
    for (const f of existing) {
      map.set(f.guid, f);
    }
    return Array.from(map.values());
  }

  private toEditorLevel(level: Level): EditorLevel {
    const scenario = level.scenario;
    const editor: EditorLevel = {
      expanded: false,
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

    // The server doesn't return file metadata here, so derive at least the
    // content type from the hint types referencing each guid (for previews).
    const kinds = new Map<string, string | undefined>();
    const note = (h: HintPayload) => {
      if (h.file_guid && !kinds.has(h.file_guid)) {
        kinds.set(h.file_guid, this.contentTypeForHintType(h.type));
      }
      if (h.thumb_guid && !kinds.has(h.thumb_guid)) {
        kinds.set(h.thumb_guid, "photo");
      }
    };

    (game.levels ?? []).forEach(level => {
      (level.scenario?.time_hints ?? []).forEach(th => {
        (th.hint ?? []).forEach(note);
      });
      (level.scenario?.conditions ?? []).forEach((c: any) => {
        const eff = Array.isArray(c.effects) ? c.effects[0] : c.effects;
        const hints = eff?.hints ?? eff?.hints_ ?? [];
        hints.forEach((h: HintPayload) => note(h));
      });
    });

    return Array.from(kinds.entries()).map(([guid, contentType]) => ({
      guid,
      original_filename: guid,
      extension: "",
      content_type: contentType,
    }));
  }

  private contentTypeForHintType(type: HintType): string | undefined {
    switch (type) {
      case HintType.photo:
      case HintType.sticker:
        return "photo";
      case HintType.video:
      case HintType.animation:
      case HintType.video_note:
        return "video";
      case HintType.audio:
      case HintType.voice:
        return "audio";
      case HintType.document:
        return "document";
      default:
        return undefined;
    }
  }

  // -------------------------------------------------------------------------
  // Level operations
  // -------------------------------------------------------------------------

  addLevel() {
    this.levels.push({
      expanded: true,
      id: this.uniqueLevelId(),
      winKeysText: "",
      autoFinishTime: null,
      autoFinishEffects: this.newEffects(),
      keyConditions: [],
      timerConditions: [],
      time_hints: [{time: 0, hint: []}],
    });
  }

  onLevelToggle(level: EditorLevel, event: Event) {
    level.expanded = (event.target as HTMLDetailsElement).open;
  }

  anyLevelExpanded(): boolean {
    return this.levels.some(l => l.expanded);
  }

  removeLevel(index: number) {
    this.levels.splice(index, 1);
  }

  moveLevel(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= this.levels.length) {
      return;
    }
    moveItemInArray(this.levels, index, target);
  }

  onLevelDrop(event: CdkDragDrop<EditorLevel[]>) {
    moveItemInArray(this.levels, event.previousIndex, event.currentIndex);
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

  allLevelIds(): string[] {
    return this.levels.map(l => l.id);
  }

  /**
   * Live routing graph of the levels being edited. Recomputed on each change
   * detection from the current editor state so the graph tracks edits; the
   * graph component memoizes the layout by content so this stays cheap.
   *
   * The default win (win key) is the sequential spine the graph already draws,
   * so only the explicit `next_level` jumps are emitted here: the winning timer
   * ("автозавершение") and any EFFECTS_KEY condition whose effect advances the
   * level. Non-winning timers never advance, so they contribute no routes.
   */
  getGraphLevels(): GraphLevel[] {
    const idToPos = new Map<string, number>();
    this.levels.forEach((level, pos) => {
      if (!idToPos.has(level.id)) {
        idToPos.set(level.id, pos);
      }
    });

    const resolveTarget = (nextLevel: string | null, pos: number): number | undefined => {
      if (nextLevel && nextLevel.length > 0) {
        return idToPos.get(nextLevel);
      }
      // No explicit target on a winning effect means "the next level".
      return pos + 1;
    };

    return this.levels.map((level, pos) => {
      const routes: GraphRoute[] = [];

      if (level.autoFinishTime != null) {
        const target = resolveTarget(level.autoFinishEffects.next_level, pos);
        if (target !== undefined) {
          routes.push({target, kind: 'timer', label: timerRouteLabel(Number(level.autoFinishTime))});
        }
      }

      for (const condition of level.keyConditions) {
        if (condition.effects.level_up !== true) {
          continue;
        }
        const target = resolveTarget(condition.effects.next_level, pos);
        if (target !== undefined) {
          routes.push({target, kind: 'key', label: keyRouteLabel(parseKeys(condition.keysText))});
        }
      }

      const winKeys = parseKeys(level.winKeysText);
      return {
        id: level.id,
        name: level.id,
        number: pos + 1,
        winLabel: winKeys.length > 0 ? keyRouteLabel(winKeys) : undefined,
        routes,
      };
    });
  }

  /** Scroll to the level card with the given id and briefly highlight it. */
  onGraphLevelSelected(id: string): void {
    const level = this.levels.find(l => l.id === id);
    if (level) {
      // Keep it open past the next change detection (the card binds [open]).
      level.expanded = true;
    }
    scrollToLevel(id);
  }

  // -------------------------------------------------------------------------
  // Live field validation
  // -------------------------------------------------------------------------

  /** Auto-capitalize keys as the user types. */
  upperKeys(value: string): string {
    return value.toUpperCase();
  }

  /** Empty is fine (no condition emitted); every entered key must match. */
  areKeysOk(text: string): boolean {
    return parseKeys(text).every(isValidKey);
  }

  isLevelIdOk(id: string): boolean {
    return isValidLevelId(id);
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
        if (uploaded?.guid) {
          this.objectUrls.set(uploaded.guid, URL.createObjectURL(file));
        }
        this.isUploading = false;
        this.snackbar.success(`Файл загружен: ${uploaded.original_filename}${uploaded.extension}`);
        input.value = "";
      },
      error: err => {
        this.isUploading = false;
        input.value = "";
        this.snackbar.error(`Не удалось загрузить файл: ${describeError(err)}`);
      },
    });
  }

  /** A file uploaded from inside a hint editor — register it in the list. */
  onHintFileUploaded(file: UploadedFile) {
    this.addFile(file);
  }

  private addFile(file: UploadedFile) {
    if (!file || !file.guid) {
      this.snackbar.error("Сервер вернул файл без идентификатора");
      return;
    }
    this.files = [...this.files.filter(f => f.guid !== file.guid), file];
  }

  fileLabel(file: UploadedFile): string {
    const hasName = file.original_filename && file.original_filename !== file.guid;
    if (!hasName) {
      return `файл ${file.guid.slice(0, 8)}…`;
    }
    return `${file.original_filename}${file.extension || ""}`;
  }

  fileIcon(file: UploadedFile): AppIcon {
    if (file.content_type && CONTENT_TYPE_ICON[file.content_type]) {
      return CONTENT_TYPE_ICON[file.content_type];
    }
    return AppIcon.files;
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
      case "sticker":
        return "image";
      case "video":
      case "animation":
        return "video";
      case "video_note":
        return "video_note";
      case "audio":
      case "voice":
        return "audio";
      default:
        return "none";
    }
  }

  fileUrl(file: UploadedFile): string {
    return this.objectUrls.get(file.guid) ?? this.http.getFileUrl(this.gameId, file.guid);
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
        this.startAtLocal = this.defaultStartAtLocal();
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

  /** Default value for the planned-start picker: today at 23:00. */
  private defaultStartAtLocal(): string {
    const d = new Date();
    d.setHours(23, 0, 0, 0);
    return this.toLocalInput(d.toISOString());
  }
}
