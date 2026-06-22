import {Component, ElementRef, EventEmitter, Input, Output, QueryList, ViewChildren} from '@angular/core';
import {MatIcon} from "@angular/material/icon";
import {AppIcon} from "../ui/icons";
import {GraphLevel} from "./scenario_graph.model";

/** A level box (or the terminal "finish") on the spine. */
interface NodeBox {
  pos: number;
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
  title: string;
  fullTitle: string;
  isFinish: boolean;
  /** Editor/scenario nav id, or null for the terminal finish. */
  navId: string | null;
}

/** A vertical arrow in the gap between two consecutive boxes (forward routes). */
interface VerticalArrow {
  d: string;
  label: string;
  labelX: number;
  labelY: number;
  kind: 'win' | 'key' | 'timer';
}

/** A self-loop drawn as a small arc off the right side of a box. */
interface SelfArc {
  d: string;
  label: string;
  labelX: number;
  labelY: number;
}

/**
 * A labelled stub for a non-adjacent jump, shown beside its node. Incoming jumps
 * sit on the left (arrow into the box, naming the source); outgoing jumps sit on
 * the right (arrow out, naming the target).
 */
interface Stub {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  trigger: string;
  triggerX: number;
  triggerY: number;
  name: string;
  fullName: string;
  nameX: number;
  nameY: number;
  nameAnchor: 'start' | 'end';
  /** Position of the node this stub names — clicking it highlights that box. */
  nodePos: number;
  kind: 'key' | 'timer';
}

interface GraphModel {
  nodes: NodeBox[];
  verticals: VerticalArrow[];
  selfArcs: SelfArc[];
  leftStubs: Stub[];
  rightStubs: Stub[];
  hasRoutes: boolean;
  width: number;
  height: number;
}

const NAME_X = 10;
const NAME_COL_W = 86;
const LEFT_ARROW_X1 = NAME_X + NAME_COL_W;      // 96
const BOX_X = LEFT_ARROW_X1 + 96;               // 192
const BOX_W = 200;
const BOX_H = 44;
const BOX_RIGHT = BOX_X + BOX_W;                // 392
const RIGHT_ARROW_X2 = BOX_RIGHT + 96;          // 488
const RIGHT_NAME_X = RIGHT_ARROW_X2 + 8;        // 496
const WIDTH = RIGHT_NAME_X + NAME_COL_W + 8;    // 590
const SPINE_X = BOX_X + BOX_W / 2;              // 292

const STUB_ROW = 30;
const BAND_PAD = 14;
const VGAP = 54;
const TOP = 12;

const VERT_DX = 64;
const VERT_SPAN = 168;   // max horizontal room for stacked verticals inside a box
const ARC_BULGE = 36;
const ARC_HALF = 9;

const NAME_MAX = 12;
const TRIGGER_MAX = 12;
const TITLE_MAX = 22;
const VLABEL_MAX = 10;

/**
 * Renders the level-to-level routing of a scenario.
 *
 * Levels form a vertical spine of boxes (top to bottom, ending in "Финиш").
 * Forward routes to the next level — including the default WIN_KEY progression —
 * are drawn as parallel vertical arrows in the gap between the two boxes. A route
 * back to the same level is drawn as a small self-loop on the box's right side.
 * Every other (non-adjacent) jump becomes a short labelled stub: incoming on the
 * left (naming the source), outgoing on the right (naming the target).
 *
 * Clicking a name on a stub highlights the matching box in the graph; clicking
 * the name inside a box emits {@link levelSelected} so the host can jump to that
 * level's editor / scenario card.
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
  @Output() levelSelected = new EventEmitter<string>();

  @ViewChildren('nodeGroup') private nodeGroups?: QueryList<ElementRef<SVGGElement>>;

  /** Box currently pulsed after a stub name was clicked. */
  highlightedPos: number | null = null;
  private highlightTimer: number | undefined;

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

  hasLevels(): boolean {
    return (this.levels?.length ?? 0) > 0;
  }

  hasRoutes(): boolean {
    return this.model.hasRoutes;
  }

  /** Pulse — and, for long scenarios, scroll to — the named box in the graph. */
  highlightNode(pos: number): void {
    this.highlightedPos = pos;
    this.nodeGroups?.get(pos)?.nativeElement?.scrollIntoView({behavior: 'smooth', block: 'center'});
    window.clearTimeout(this.highlightTimer);
    this.highlightTimer = window.setTimeout(() => (this.highlightedPos = null), 2500);
  }

  /** Open the level's editor / scenario card. */
  onTitleClick(navId: string | null): void {
    if (navId) {
      this.levelSelected.emit(navId);
    }
  }

  private build(levels: GraphLevel[]): GraphModel {
    if (levels.length === 0) {
      return {nodes: [], verticals: [], selfArcs: [], leftStubs: [], rightStubs: [], hasRoutes: false, width: 0, height: 0};
    }

    const finishPos = levels.length;
    const nodeCount = finishPos + 1;

    const nodeName: string[] = levels.map(l => l.name);
    nodeName.push('Финиш');
    const nodeNavId: (string | null)[] = levels.map(l => l.id);
    nodeNavId.push(null);

    type Route = {src: number; tgt: number; kind: 'key' | 'timer'; label: string};
    // Forward routes (to the next level) become verticals; self-routes become
    // arcs; everything else is a left/right jump stub. No de-duplication.
    const nextOut: Route[][] = Array.from({length: nodeCount}, () => []);
    const selfLoops: Route[][] = Array.from({length: nodeCount}, () => []);
    const jumpsIn: Route[][] = Array.from({length: nodeCount}, () => []);
    const jumpsOut: Route[][] = Array.from({length: nodeCount}, () => []);
    levels.forEach((level, pos) => {
      for (const route of level.routes) {
        const tgt = route.target;
        if (tgt < 0 || tgt > finishPos) {
          continue;
        }
        const entry: Route = {src: pos, tgt, kind: route.kind, label: route.label};
        if (tgt === pos + 1) {
          nextOut[pos].push(entry);
        } else if (tgt === pos) {
          selfLoops[pos].push(entry);
        } else {
          jumpsOut[pos].push(entry);
          jumpsIn[tgt].push(entry);
        }
      }
    });

    const nodes: NodeBox[] = [];
    const leftStubs: Stub[] = [];
    const rightStubs: Stub[] = [];
    const selfArcs: SelfArc[] = [];
    let hasRoutes = false;

    let y = TOP;
    for (let pos = 0; pos < nodeCount; pos++) {
      const ins = jumpsIn[pos];
      const outs = jumpsOut[pos];
      const loops = selfLoops[pos];
      const rightCount = outs.length + loops.length;
      const rows = Math.max(ins.length, rightCount, 1);
      const bandH = Math.max(BOX_H + 2 * BAND_PAD, rows * STUB_ROW + 2 * BAND_PAD);
      const bandTop = y;
      const isFinish = pos === finishPos;
      const boxH = bandH - 2 * BAND_PAD;

      nodes.push({
        pos,
        x: BOX_X,
        y: bandTop + BAND_PAD,
        w: BOX_W,
        h: boxH,
        cx: SPINE_X,
        cy: bandTop + bandH / 2,
        title: this.truncate(isFinish ? 'Финиш' : `№${levels[pos].number} (${levels[pos].name})`, TITLE_MAX),
        fullTitle: isFinish ? 'Финиш' : `№${levels[pos].number} (${levels[pos].name})`,
        isFinish,
        navId: nodeNavId[pos],
      });

      ins.forEach((route, i) => {
        const sy = bandTop + bandH * (i + 0.5) / ins.length;
        leftStubs.push({
          x1: LEFT_ARROW_X1, y1: sy, x2: BOX_X, y2: sy,
          trigger: this.truncate(route.label, TRIGGER_MAX),
          triggerX: (LEFT_ARROW_X1 + BOX_X) / 2, triggerY: sy - 7,
          name: this.truncate(nodeName[route.src], NAME_MAX),
          fullName: nodeName[route.src],
          nameX: NAME_X, nameY: sy, nameAnchor: 'start',
          nodePos: route.src,
          kind: route.kind,
        });
      });

      let ri = 0;
      const rowY = (index: number) => bandTop + bandH * (index + 0.5) / rightCount;
      outs.forEach((route) => {
        const sy = rowY(ri++);
        rightStubs.push({
          x1: BOX_RIGHT, y1: sy, x2: RIGHT_ARROW_X2, y2: sy,
          trigger: this.truncate(route.label, TRIGGER_MAX),
          triggerX: (BOX_RIGHT + RIGHT_ARROW_X2) / 2, triggerY: sy - 7,
          name: this.truncate(nodeName[route.tgt], NAME_MAX),
          fullName: nodeName[route.tgt],
          nameX: RIGHT_NAME_X, nameY: sy, nameAnchor: 'start',
          nodePos: route.tgt,
          kind: route.kind,
        });
      });
      loops.forEach((route) => {
        const sy = rowY(ri++);
        const yt = sy - ARC_HALF;
        const yb = sy + ARC_HALF;
        selfArcs.push({
          d: `M ${BOX_RIGHT} ${yt} C ${BOX_RIGHT + ARC_BULGE} ${yt}, ${BOX_RIGHT + ARC_BULGE} ${yb}, ${BOX_RIGHT} ${yb}`,
          label: this.truncate(route.label, TRIGGER_MAX),
          labelX: BOX_RIGHT + ARC_BULGE + 6, labelY: sy,
        });
      });

      if (ins.length || rightCount) {
        hasRoutes = true;
      }
      y = bandTop + bandH + VGAP;
    }

    // Forward (to-next) verticals, one per gap, fanned out across the box width.
    const verticals: VerticalArrow[] = [];
    for (let g = 0; g < nodeCount - 1; g++) {
      const forward: {kind: 'win' | 'key' | 'timer'; label: string}[] = [
        {kind: 'win', label: levels[g].winLabel ?? ''},
        ...nextOut[g].map(r => ({kind: r.kind, label: r.label})),
      ];
      if (forward.length > 1) {
        hasRoutes = true;
      }

      const count = forward.length;
      const dx = count > 1 ? Math.min(VERT_DX, VERT_SPAN / (count - 1)) : 0;
      const startX = SPINE_X - (count - 1) * dx / 2;
      const boxBottom = nodes[g].y + nodes[g].h;
      const nextTop = nodes[g + 1].y;
      const midY = (boxBottom + nextTop) / 2;

      forward.forEach((v, k) => {
        const x = startX + k * dx;
        verticals.push({
          d: `M ${x} ${boxBottom} L ${x} ${nextTop}`,
          label: this.truncate(v.label, VLABEL_MAX),
          labelX: x + 5,
          labelY: midY,
          kind: v.kind,
        });
      });
    }

    return {
      nodes, verticals, selfArcs, leftStubs, rightStubs, hasRoutes,
      width: WIDTH, height: y - VGAP + TOP,
    };
  }

  private signature(levels: GraphLevel[] | undefined): string {
    return (levels ?? [])
      .map(l => `${l.id}|${l.name}|${l.number}|${l.winLabel ?? ''}|${l.routes.map(r => `${r.target}:${r.kind}:${r.label}`).join(',')}`)
      .join(';');
  }

  private truncate(value: string, max: number): string {
    return value.length > max ? `${value.slice(0, max - 1)}…` : value;
  }
}
