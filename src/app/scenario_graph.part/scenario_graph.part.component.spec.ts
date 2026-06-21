import {ComponentFixture, TestBed} from '@angular/core/testing';

import {ScenarioGraphPartComponent} from './scenario_graph.part.component';
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
    component.game = game([level(0), level(1)]);
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('builds a node per level plus a finish node and a connecting spine', () => {
    component.game = game([level(0), level(1), level(2)]);
    const model = component.model;

    expect(model.nodes.length).toBe(4);
    expect(model.nodes[model.nodes.length - 1].isFinish).toBeTrue();
    // 3 levels -> 3 sequential transitions (incl. last level -> finish).
    expect(model.spine.length).toBe(3);
    expect(component.hasJumps()).toBeFalse();
  });

  it('draws a jump arc for a next_level routing effect that skips ahead', () => {
    const jumpCondition = new ScenarioCondition(
      ScenarioConditionType.effectsKey,
      ['SKIP'],
      [new Effect('e1', [], 0, true, 2)],
    );
    component.game = game([level(0, [jumpCondition]), level(1), level(2)]);

    const jumps = component.model.jumps;
    expect(jumps.length).toBe(1);
    expect(jumps[0].kind).toBe('key');
    expect(jumps[0].label).toContain('SKIP');
  });

  it('does not draw an arc when the effect routes to the next sequential level', () => {
    const seqCondition = new ScenarioCondition(
      ScenarioConditionType.effectsKey,
      ['NEXT'],
      [new Effect('e1', [], 0, true, 1)],
    );
    component.game = game([level(0, [seqCondition]), level(1)]);

    expect(component.hasJumps()).toBeFalse();
  });

  it('marks a backward jump and labels timer routes by minutes', () => {
    const timerCondition = new ScenarioCondition(
      ScenarioConditionType.effectsTimer,
      undefined,
      [new Effect('e1', [], 0, true, 0)],
      15,
    );
    component.game = game([level(0), level(1, [timerCondition]), level(2)]);

    const jumps = component.model.jumps;
    expect(jumps.length).toBe(1);
    expect(jumps[0].kind).toBe('timer');
    expect(jumps[0].back).toBeTrue();
    expect(jumps[0].label).toBe('15 мин');
  });

  it('reports no levels gracefully', () => {
    component.game = game([]);
    expect(component.hasLevels()).toBeFalse();
    expect(component.model.nodes.length).toBe(0);
  });
});
