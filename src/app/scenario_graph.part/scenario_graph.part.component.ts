import {Component, Input} from '@angular/core';
import {Effects, FullGame, Level, ScenarioConditionType} from "../domain/game.models";
import {MatIcon} from "@angular/material/icon";
import {AppIcon} from "../ui/icons";

/** A level (or the terminal "finish") box laid out on the routing graph. */
interface GraphNode {
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
  title: string;
  fullTitle: string;
  isFinish: boolean;
}

/** The default, sequential "complete the level" transition between two nodes. */
interface SpineEdge {
  d: string;
}

/** A non-sequential jump produced by a `next_level` routing effect. */
interface JumpEdge {
  d: string;
  label: string;
  labelX: number;
  labelY: number;
  kind: 'key' | 'timer';
  back: boolean;
}

interface GraphModel {
  nodes: GraphNode[];
  spine: SpineEdge[];
  jumps: JumpEdge[];
  width: number;
  height: number;
}

const NODE_W = 240;
const NODE_H = 44;
const ROW_H = 88;
const TOP = 24;
const NODE_X = 16;
const TITLE_MAX = 28;
const KEY_MAX = 16;

/**
 * Renders the level-to-level routing of a scenario as a directed graph.
 *
 * Nodes are the levels (ordered by {@link Level.number_in_game}) plus a terminal
 * "Финиш" node. The vertical spine is the default progression — completing a
 * level on its win key moves to the next one. `next_level` routing effects that
 * point somewhere other than the next level are drawn as labelled arcs, so a
 * scenario that branches or loops back becomes visible at a glance.
 */
@Component({
  selector: 'app-scenario-graph-part',
  standalone: true,
  imports: [
    MatIcon,
  ],
  templateUrl: './scenario_graph.part.component.html',
  styleUrl: './scenario_graph.part.component.scss'
})
export class ScenarioGraphPartComponent {
  protected readonly AppIcon = AppIcon;

  @Input({required: true}) game!: FullGame;

  private cachedFor: FullGame | undefined;
  private cachedModel: GraphModel | undefined;

  get model(): GraphModel {
    if (this.cachedFor !== this.game || this.cachedModel === undefined) {
      this.cachedFor = this.game;
      this.cachedModel = this.build(this.game);
    }
    return this.cachedModel;
  }

  hasJumps(): boolean {
    return this.model.jumps.length > 0;
  }

  hasLevels(): boolean {
    return (this.game?.levels?.length ?? 0) > 0;
  }

  private build(game: FullGame): GraphModel {
    const ordered = (game.levels ?? [])
      .map((level, position) => ({
        level,
        index: typeof level.number_in_game === 'number' ? level.number_in_game : position,
      }))
      .sort((a, b) => a.index - b.index);

    const indexToPos = new Map<number, number>();
    ordered.forEach((entry, pos) => indexToPos.set(entry.index, pos));
    const maxIndex = ordered.length > 0 ? ordered[ordered.length - 1].index : -1;
    const finishPos = ordered.length;

    const nodes: GraphNode[] = ordered.map((entry, pos) =>
      this.makeNode(pos, `№${entry.index + 1} (${entry.level.name_id})`, false));
    if (ordered.length > 0) {
      nodes.push(this.makeNode(finishPos, 'Финиш', true));
    }

    const spine: SpineEdge[] = [];
    for (let pos = 0; pos < finishPos; pos++) {
      const a = nodes[pos];
      const b = nodes[pos + 1];
      spine.push({d: `M ${a.cx} ${a.y + a.h} L ${b.cx} ${b.y}`});
    }

    const jumpByKey = new Map<string, JumpEdge>();
    let maxBulge = 0;

    ordered.forEach((entry, pos) => {
      for (const condition of (entry.level.scenario?.conditions ?? [])) {
        const isTimer = condition.type === ScenarioConditionType.effectsTimer;
        for (const effect of Effects.normalize(condition.effects)) {
          if (effect.level_up !== true) {
            continue;
          }

          let targetIndex: number;
          if (typeof effect.next_level === 'number') {
            targetIndex = effect.next_level;
          } else if (effect.next_level === undefined || effect.next_level === null) {
            targetIndex = entry.index + 1;
          } else {
            // A non-numeric target (e.g. a name id) can't be resolved against the
            // played game's numeric level indices — skip rather than guess.
            continue;
          }

          let targetPos: number;
          if (indexToPos.has(targetIndex)) {
            targetPos = indexToPos.get(targetIndex)!;
          } else if (targetIndex > maxIndex) {
            targetPos = finishPos;
          } else {
            continue;
          }

          // The straight-down spine already shows the default next-level step.
          if (targetPos === pos + 1 || targetPos === pos) {
            continue;
          }

          const label = isTimer ? this.timerLabel(condition.action_time) : this.keyLabel(condition.keys);
          const kind: JumpEdge['kind'] = isTimer ? 'timer' : 'key';
          const dedupeKey = `${pos}->${targetPos}:${kind}`;

          const existing = jumpByKey.get(dedupeKey);
          if (existing) {
            if (label && !existing.label.includes(label)) {
              existing.label = `${existing.label}, ${label}`;
            }
            continue;
          }

          const src = nodes[pos];
          const dst = nodes[targetPos];
          const sx = src.x + src.w;
          const sy = src.cy;
          const ex = dst.x + dst.w;
          const ey = dst.cy;
          const span = Math.abs(targetPos - pos);
          const bulge = 30 + 18 * Math.min(span, 6);
          maxBulge = Math.max(maxBulge, bulge);

          jumpByKey.set(dedupeKey, {
            d: `M ${sx} ${sy} C ${sx + bulge} ${sy}, ${ex + bulge} ${ey}, ${ex} ${ey}`,
            label,
            labelX: Math.max(sx, ex) + bulge * 0.6 + 8,
            labelY: (sy + ey) / 2,
            kind,
            back: targetPos < pos,
          });
        }
      }
    });

    const jumps = [...jumpByKey.values()];
    const width = NODE_X + NODE_W + maxBulge + 150;
    const height = nodes.length > 0
      ? TOP + (nodes.length - 1) * ROW_H + NODE_H + 24
      : 0;

    return {nodes, spine, jumps, width, height};
  }

  private makeNode(pos: number, title: string, isFinish: boolean): GraphNode {
    const y = TOP + pos * ROW_H;
    return {
      x: NODE_X,
      y,
      w: NODE_W,
      h: NODE_H,
      cx: NODE_X + NODE_W / 2,
      cy: y + NODE_H / 2,
      title: this.truncate(title, TITLE_MAX),
      fullTitle: title,
      isFinish,
    };
  }

  private timerLabel(actionTime: number | undefined): string {
    return typeof actionTime === 'number' ? `${actionTime} мин` : 'таймер';
  }

  private keyLabel(keys: string[] | undefined): string {
    const list = Array.isArray(keys) ? keys : [];
    if (list.length === 0) {
      return 'ключ';
    }
    const head = this.truncate(list[0], KEY_MAX);
    return list.length > 1 ? `${head} +${list.length - 1}` : head;
  }

  private truncate(value: string, max: number): string {
    return value.length > max ? `${value.slice(0, max - 1)}…` : value;
  }
}
