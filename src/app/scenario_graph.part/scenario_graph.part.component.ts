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

/** The default sequential transition between two boxes. */
interface SpineEdge {
  d: string;
}

/**
 * A labelled stub for one route, shown beside its node. Incoming routes sit on
 * the left (arrow pointing into the box, naming the source); outgoing routes sit
 * on the right (arrow pointing out, naming the target). The same route appears
 * as an outgoing stub on its source and an incoming stub on its target. Every
 * route is drawn — duplicates, self-loops and next-level hops included.
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
  spine: SpineEdge[];
  leftStubs: Stub[];
  rightStubs: Stub[];
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
const BAND_GAP = 22;
const TOP = 12;

const NAME_MAX = 12;
const TRIGGER_MAX = 12;
const TITLE_MAX = 22;

/**
 * Renders the level-to-level routing of a scenario.
 *
 * Levels form a vertical spine of boxes (default progression, top to bottom,
 * ending in "Финиш"). Every routing effect is drawn as a short labelled stub
 * beside its box — incoming on the left (naming the source), outgoing on the
 * right (naming the target) — so the picture stays readable however dense the
 * routing gets. Clicking a name on a stub highlights the matching box in the
 * graph; clicking the name inside a box emits {@link levelSelected} so the host
 * can jump to that level's editor / scenario card.
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
    return this.model.rightStubs.length > 0;
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
      return {nodes: [], spine: [], leftStubs: [], rightStubs: [], width: 0, height: 0};
    }

    const finishPos = levels.length;
    const nodeCount = finishPos + 1;

    const nodeName: string[] = levels.map(l => l.name);
    nodeName.push('Финиш');
    const nodeNavId: (string | null)[] = levels.map(l => l.id);
    nodeNavId.push(null);

    // Every route is kept as-is: no de-duplication, and self-loops / next-level
    // hops are drawn too, so nothing the author wrote silently disappears.
    type Route = {src: number; tgt: number; kind: 'key' | 'timer'; label: string};
    const incoming: Route[][] = Array.from({length: nodeCount}, () => []);
    const outgoing: Route[][] = Array.from({length: nodeCount}, () => []);
    levels.forEach((level, pos) => {
      for (const route of level.routes) {
        const tgt = route.target;
        if (tgt < 0 || tgt > finishPos) {
          continue;
        }
        const entry: Route = {src: pos, tgt, kind: route.kind, label: route.label};
        outgoing[pos].push(entry);
        incoming[tgt].push(entry);
      }
    });

    const nodes: NodeBox[] = [];
    const leftStubs: Stub[] = [];
    const rightStubs: Stub[] = [];
    const spine: SpineEdge[] = [];

    let y = TOP;
    for (let pos = 0; pos < nodeCount; pos++) {
      const ins = incoming[pos];
      const outs = outgoing[pos];
      const rows = Math.max(ins.length, outs.length, 1);
      const bandH = Math.max(BOX_H + 2 * BAND_PAD, rows * STUB_ROW + 2 * BAND_PAD);
      const bandTop = y;
      const isFinish = pos === finishPos;
      // The box fills the band (minus padding) so every stub arrow enters its
      // body rather than touching the top/bottom edge.
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

      outs.forEach((route, j) => {
        const sy = bandTop + bandH * (j + 0.5) / outs.length;
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

      y = bandTop + bandH + BAND_GAP;
    }

    for (let pos = 0; pos < nodeCount - 1; pos++) {
      const a = nodes[pos];
      const b = nodes[pos + 1];
      spine.push({d: `M ${a.cx} ${a.y + a.h} L ${b.cx} ${b.y}`});
    }

    return {nodes, spine, leftStubs, rightStubs, width: WIDTH, height: y - BAND_GAP + TOP};
  }

  private signature(levels: GraphLevel[] | undefined): string {
    return (levels ?? [])
      .map(l => `${l.id}|${l.name}|${l.number}|${l.routes.map(r => `${r.target}:${r.kind}:${r.label}`).join(',')}`)
      .join(';');
  }

  private truncate(value: string, max: number): string {
    return value.length > max ? `${value.slice(0, max - 1)}…` : value;
  }
}
