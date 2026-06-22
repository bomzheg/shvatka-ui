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

  it('builds a node per level plus a finish node, with a vertical per gap', () => {
    component.levels = [gl('A', 1), gl('B', 2), gl('C', 3)];
    const model = component.model;

    expect(model.nodes.length).toBe(4);
    expect(model.nodes[model.nodes.length - 1].isFinish).toBeTrue();
    // 3 gaps (incl. last level -> finish), one default win vertical each.
    expect(model.verticals.length).toBe(3);
    expect(model.verticals.every(v => v.kind === 'win')).toBeTrue();
    expect(component.hasRoutes()).toBeFalse();
    // level boxes carry a nav id for the editor link; finish does not.
    expect(model.nodes[0].navId).toBe('A');
    expect(model.nodes[3].navId).toBeNull();
  });

  it('labels the default vertical with the win keys', () => {
    component.levels = [{...gl('A', 1), winLabel: 'WINKEY'}, gl('B', 2)];
    const model = component.model;

    // one vertical per gap: A -> B and B -> finish
    expect(model.verticals.length).toBe(2);
    expect(model.verticals[0]).toEqual(jasmine.objectContaining({kind: 'win', label: 'WINKEY'}));
    expect(component.hasRoutes()).toBeFalse();
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
    expect(model.rightStubs[0]).toEqual(jasmine.objectContaining({name: 'C', nodePos: 2, kind: 'key'}));
    expect(model.rightStubs[0].trigger).toContain('SKIP');
    expect(model.leftStubs[0]).toEqual(jasmine.objectContaining({name: 'A', nodePos: 0}));
  });

  it('draws a forward route to the next level as an extra vertical, including timers', () => {
    component.levels = [
      gl('A', 1, [{target: 1, kind: 'key', label: 'NEXT'}, {target: 1, kind: 'timer', label: '15 мин'}]),
      gl('B', 2),
    ];
    const model = component.model;

    // gap A->B has win + the two forward routes; gap B->finish has the win default
    expect(model.verticals.length).toBe(4);
    expect(model.verticals.some(v => v.kind === 'timer' && v.label.includes('мин'))).toBeTrue();
    expect(model.rightStubs.length).toBe(0);
    expect(component.hasRoutes()).toBeTrue();
  });

  it('draws a backward route to the previous level as an upward vertical', () => {
    component.levels = [
      gl('A', 1),
      gl('B', 2, [{target: 0, kind: 'key', label: 'BACK'}]),
      gl('C', 3),
    ];
    const model = component.model;

    // an adjacent back-step is a vertical, not a side stub
    expect(model.leftStubs.length).toBe(0);
    expect(model.rightStubs.length).toBe(0);
    const back = model.verticals.find(v => v.label === 'BACK');
    expect(back).toBeTruthy();
    // up arrow ends higher than it starts (arrowhead into the upper box)
    const [, y1, , y2] = back!.d.match(/[\d.]+/g)!.map(Number);
    expect(y2).toBeLessThan(y1);
  });

  it('draws a route back to the same level as a self-arc', () => {
    component.levels = [
      gl('A', 1, [
        {target: 0, kind: 'key', label: 'K1'},
        {target: 0, kind: 'key', label: 'K2'},
      ]),
      gl('B', 2),
    ];

    // both self-routes kept (no de-dup), drawn as arcs not stubs
    expect(component.model.selfArcs.length).toBe(2);
    expect(component.model.selfArcs.map(a => a.label)).toEqual(['K1', 'K2']);
    expect(component.model.rightStubs.length).toBe(0);
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
