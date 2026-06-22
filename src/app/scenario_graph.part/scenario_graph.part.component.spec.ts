import {ComponentFixture, TestBed} from '@angular/core/testing';

import {ScenarioGraphPartComponent} from './scenario_graph.part.component';
import {GraphLevel, routingGraphFromGame} from './scenario_graph.model';
import {
  Effect,
  FullGame,
  Level,
  Player,
  Scenario,
  ScenarioCondition,
  ScenarioConditionType,
} from "../domain/game.models";

function level(numberInGame: number, conditions: ScenarioCondition[] = []): Level {
  const author = new Player('author', 1, true);
  return new Level(numberInGame + 1, `lvl-${numberInGame}`, author, new Scenario(`s-${numberInGame}`, [], conditions), 1, numberInGame);
}

function game(levels: Level[]): FullGame {
  return new FullGame(1, new Player('author', 1, true), 'Game', 'complete', undefined, levels);
}

function gl(name: string, number: number, routes: GraphLevel['routes'] = []): GraphLevel {
  return {id: name, name, number, routes};
}

describe('routingGraphFromGame', () => {
  it('produces a routing level per game level with sequential progression only', () => {
    const levels = routingGraphFromGame(game([level(0), level(1), level(2)]));
    expect(levels.length).toBe(3);
    expect(levels.every(l => l.routes.length === 0)).toBeTrue();
    expect(levels[0]).toEqual(jasmine.objectContaining({id: 'lvl-0', name: 'lvl-0', number: 1}));
  });

  it('resolves a numeric next_level jump to a node position', () => {
    const jumpCondition = new ScenarioCondition(
      ScenarioConditionType.effectsKey,
      ['SKIP'],
      [new Effect('e1', [], 0, true, 2)],
    );
    const levels = routingGraphFromGame(game([level(0, [jumpCondition]), level(1), level(2)]));

    expect(levels[0].routes.length).toBe(1);
    expect(levels[0].routes[0]).toEqual(jasmine.objectContaining({target: 2, kind: 'key'}));
    expect(levels[0].routes[0].label).toContain('SKIP');
  });

  it('labels timer routes by minutes', () => {
    const timerCondition = new ScenarioCondition(
      ScenarioConditionType.effectsTimer,
      undefined,
      [new Effect('e1', [], 0, true, 0)],
      15,
    );
    const levels = routingGraphFromGame(game([level(0), level(1, [timerCondition]), level(2)]));

    expect(levels[1].routes[0]).toEqual(jasmine.objectContaining({target: 0, kind: 'timer', label: '15 мин'}));
  });
});

describe('ScenarioGraphPartComponent', () => {
  let component: ScenarioGraphPartComponent;
  let fixture: ComponentFixture<ScenarioGraphPartComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ScenarioGraphPartComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(ScenarioGraphPartComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    component.levels = [gl('A', 1), gl('B', 2)];
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('builds a node per level plus a finish node and a connecting spine', () => {
    component.levels = [gl('A', 1), gl('B', 2), gl('C', 3)];
    const model = component.model;

    expect(model.nodes.length).toBe(4);
    expect(model.nodes[model.nodes.length - 1].isFinish).toBeTrue();
    // 3 levels -> 3 sequential transitions (incl. last level -> finish).
    expect(model.spine.length).toBe(3);
    expect(component.hasRoutes()).toBeFalse();
    // level boxes carry a nav id for the editor link; finish does not.
    expect(model.nodes[0].navId).toBe('A');
    expect(model.nodes[3].navId).toBeNull();
  });

  it('renders a skip-ahead jump as an outgoing stub on the source and an incoming stub on the target', () => {
    component.levels = [
      gl('A', 1, [{target: 2, kind: 'key', label: 'SKIP'}]),
      gl('B', 2),
      gl('C', 3),
    ];
    const model = component.model;

    expect(model.rightStubs.length).toBe(1);
    expect(model.leftStubs.length).toBe(1);
    // outgoing stub on A names its target C (nodePos 2), incoming stub on C names source A (nodePos 0)
    expect(model.rightStubs[0]).toEqual(jasmine.objectContaining({name: 'C', nodePos: 2, kind: 'key'}));
    expect(model.rightStubs[0].trigger).toContain('SKIP');
    expect(model.leftStubs[0]).toEqual(jasmine.objectContaining({name: 'A', nodePos: 0}));
  });

  it('also draws routes to the next sequential level and timer routes', () => {
    component.levels = [
      gl('A', 1, [{target: 1, kind: 'key', label: 'NEXT'}, {target: 2, kind: 'timer', label: '15 мин'}]),
      gl('B', 2),
    ];
    const model = component.model;

    expect(component.hasRoutes()).toBeTrue();
    expect(model.rightStubs.length).toBe(2);
    expect(model.rightStubs.some(s => s.kind === 'timer' && s.trigger.includes('мин'))).toBeTrue();
  });

  it('does not de-duplicate routes that share a source and target', () => {
    component.levels = [
      gl('A', 1, [
        {target: 0, kind: 'key', label: 'K1'},
        {target: 0, kind: 'key', label: 'K2'},
      ]),
      gl('B', 2),
    ];

    // both self-routes are kept as separate arrows
    expect(component.model.rightStubs.length).toBe(2);
    expect(component.model.rightStubs.map(s => s.trigger)).toEqual(['K1', 'K2']);
  });

  it('emits the level id when a box title is activated', () => {
    const emitted: string[] = [];
    component.levelSelected.subscribe(id => emitted.push(id));

    component.onTitleClick('B');
    component.onTitleClick(null);

    expect(emitted).toEqual(['B']);
  });

  it('marks a box as highlighted when a stub name is clicked', () => {
    component.levels = [gl('A', 1), gl('B', 2)];
    component.highlightNode(1);
    expect(component.highlightedPos).toBe(1);
  });

  it('reports no levels gracefully', () => {
    component.levels = [];
    expect(component.hasLevels()).toBeFalse();
    expect(component.model.nodes.length).toBe(0);
  });
});
