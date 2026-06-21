import {Component, Input} from '@angular/core';
import {MatIcon} from "@angular/material/icon";
import {AppIcon} from "../ui/icons";
import {GraphLevel} from "./scenario_graph.model";

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
  /** Source marker — the node the jump departs from. */
  dotX: number;
  dotY: number;
  label: string;
  labelX: number;
  labelY: number;
  kind: 'key' | 'timer';
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
// Right-hand "bus" lanes for jump arrows: each jump gets its own vertical lane
// so arrows never overlap, with a source dot and an arrowhead making direction
// unambiguous.
const LANE_GAP = 22;
const LANE_STEP = 22;
const LABEL_CHAR_W = 7;

/**
 * Renders the level-to-level routing of a scenario as a directed graph.
 *
 * Input is a host-agnostic {@link GraphLevel} list (see `scenario_graph.model`),
 * so the same view serves the completed game, the running game and the editor.
 * Nodes are the levels in order plus a terminal "Финиш" node. The vertical spine
 * is the default progression — completing a level moves to the next one. Routes
 * that point somewhere other than the next level are drawn as labelled arcs, so
 * a scenario that branches or loops back becomes visible at a glance.
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

  @Input({required: true}) levels: GraphLevel[] = [];

  private cachedSignature: string | undefined;
  private cachedModel: GraphModel | undefined;

  get model(): GraphModel {
    const signature = this.signature(this.levels);
    if (signature !== this.cachedSignature || this.cachedModel === undefined) {
      this.cachedSignature = signature;
      this.cachedModel = this.build(this.levels ?? []);
    }
    return this.cachedModel;
  }

  hasJumps(): boolean {
    return this.model.jumps.length > 0;
  }

  hasLevels(): boolean {
    return (this.levels?.length ?? 0) > 0;
  }

  private build(levels: GraphLevel[]): GraphModel {
    const finishPos = levels.length;

    const nodes: GraphNode[] = levels.map((level, pos) => this.makeNode(pos, level.title, false));
    if (levels.length > 0) {
      nodes.push(this.makeNode(finishPos, 'Финиш', true));
    }

    const spine: SpineEdge[] = [];
    for (let pos = 0; pos < finishPos; pos++) {
      const a = nodes[pos];
      const b = nodes[pos + 1];
      spine.push({d: `M ${a.cx} ${a.y + a.h} L ${b.cx} ${b.y}`});
    }

    // Collect the jumps (merging duplicates that share source/target/kind, e.g.
    // several keys that all route to the same level) before laying them out.
    const jumpByKey = new Map<string, {pos: number; target: number; kind: 'key' | 'timer'; triggers: string[]}>();
    levels.forEach((level, pos) => {
      for (const route of level.routes) {
        const target = route.target;
        if (target < 0 || target > finishPos) {
          continue;
        }
        // The straight-down spine already shows the default next-level step.
        if (target === pos + 1 || target === pos) {
          continue;
        }

        const dedupeKey = `${pos}->${target}:${route.kind}`;
        const existing = jumpByKey.get(dedupeKey);
        if (existing) {
          if (route.label && !existing.triggers.includes(route.label)) {
            existing.triggers.push(route.label);
          }
          continue;
        }
        jumpByKey.set(dedupeKey, {pos, target, kind: route.kind, triggers: route.label ? [route.label] : []});
      }
    });

    const right = NODE_X + NODE_W;
    const rawJumps = [...jumpByKey.values()];
    // Labels share one column to the right of every lane, so no connector line
    // ever crosses label text; a label ties to its arc by colour and shared y.
    const labelX = right + LANE_GAP + Math.max(rawJumps.length - 1, 0) * LANE_STEP + 14;
    let maxRight = labelX;

    const jumps: JumpEdge[] = rawJumps.map((jump, lane) => {
      const laneX = right + LANE_GAP + lane * LANE_STEP;
      const src = nodes[jump.pos];
      const dst = nodes[jump.target];
      const sy = src.cy;
      const ty = dst.cy;
      const dest = dst.isFinish ? 'Финиш' : dst.title.split(' ')[0];
      const triggers = jump.triggers.join(', ');
      const label = triggers ? `${triggers} → ${dest}` : `→ ${dest}`;

      maxRight = Math.max(maxRight, labelX + label.length * LABEL_CHAR_W + 8);

      return {
        // Out from the source's right edge, down/up the lane, back into the target.
        d: `M ${right} ${sy} H ${laneX} V ${ty} H ${right}`,
        dotX: right,
        dotY: sy,
        label,
        labelX,
        labelY: (sy + ty) / 2,
        kind: jump.kind,
      };
    });

    const width = Math.max(maxRight, right + 60);
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

  private signature(levels: GraphLevel[] | undefined): string {
    return (levels ?? [])
      .map(level => `${level.title}|${level.routes.map(r => `${r.target}:${r.kind}:${r.label}`).join(',')}`)
      .join(';');
  }

  private truncate(value: string, max: number): string {
    return value.length > max ? `${value.slice(0, max - 1)}…` : value;
  }
}
