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

    const jumpByKey = new Map<string, JumpEdge>();
    let maxBulge = 0;

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
          if (route.label && !existing.label.includes(route.label)) {
            existing.label = `${existing.label}, ${route.label}`;
          }
          continue;
        }

        const src = nodes[pos];
        const dst = nodes[target];
        const sx = src.x + src.w;
        const sy = src.cy;
        const ex = dst.x + dst.w;
        const ey = dst.cy;
        const span = Math.abs(target - pos);
        const bulge = 30 + 18 * Math.min(span, 6);
        maxBulge = Math.max(maxBulge, bulge);

        jumpByKey.set(dedupeKey, {
          d: `M ${sx} ${sy} C ${sx + bulge} ${sy}, ${ex + bulge} ${ey}, ${ex} ${ey}`,
          label: route.label,
          labelX: Math.max(sx, ex) + bulge * 0.6 + 8,
          labelY: (sy + ey) / 2,
          kind: route.kind,
          back: target < pos,
        });
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

  private signature(levels: GraphLevel[] | undefined): string {
    return (levels ?? [])
      .map(level => `${level.title}|${level.routes.map(r => `${r.target}:${r.kind}:${r.label}`).join(',')}`)
      .join(';');
  }

  private truncate(value: string, max: number): string {
    return value.length > max ? `${value.slice(0, max - 1)}…` : value;
  }
}
