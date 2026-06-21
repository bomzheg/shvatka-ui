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

describe('routingGraphFromGame', () => {
  it('produces a routing level per game level with sequential progression only', () => {
    const levels = routingGraphFromGame(game([level(0), level(1), level(2)]));
    expect(levels.length).toBe(3);
    expect(levels.every(l => l.routes.length === 0)).toBeTrue();
    expect(levels[0].title).toContain('№1');
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

  function levels(spec: GraphLevel[]): GraphLevel[] {
    return spec;
  }

  it('should create', () => {
    component.levels = levels([{title: 'A', routes: []}, {title: 'B', routes: []}]);
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('builds a node per level plus a finish node and a connecting spine', () => {
    component.levels = levels([
      {title: 'A', routes: []},
      {title: 'B', routes: []},
      {title: 'C', routes: []},
    ]);
    const model = component.model;

    expect(model.nodes.length).toBe(4);
    expect(model.nodes[model.nodes.length - 1].isFinish).toBeTrue();
    // 3 levels -> 3 sequential transitions (incl. last level -> finish).
    expect(model.spine.length).toBe(3);
    expect(component.hasJumps()).toBeFalse();
  });

  it('draws an arc for a route that skips ahead', () => {
    component.levels = levels([
      {title: 'A', routes: [{target: 2, kind: 'key', label: 'SKIP'}]},
      {title: 'B', routes: []},
      {title: 'C', routes: []},
    ]);

    const jumps = component.model.jumps;
    expect(jumps.length).toBe(1);
    expect(jumps[0].kind).toBe('key');
    expect(jumps[0].label).toBe('SKIP');
    expect(jumps[0].back).toBeFalse();
  });

  it('does not draw an arc when a route points to the next sequential level', () => {
    component.levels = levels([
      {title: 'A', routes: [{target: 1, kind: 'key', label: 'NEXT'}]},
      {title: 'B', routes: []},
    ]);

    expect(component.hasJumps()).toBeFalse();
  });

  it('marks a backward jump', () => {
    component.levels = levels([
      {title: 'A', routes: []},
      {title: 'B', routes: [{target: 0, kind: 'timer', label: '15 мин'}]},
      {title: 'C', routes: []},
    ]);

    const jumps = component.model.jumps;
    expect(jumps.length).toBe(1);
    expect(jumps[0].back).toBeTrue();
  });

  it('reports no levels gracefully', () => {
    component.levels = [];
    expect(component.hasLevels()).toBeFalse();
    expect(component.model.nodes.length).toBe(0);
  });
});
