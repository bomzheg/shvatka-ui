import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideHttpClient} from '@angular/common/http';
import {provideHttpClientTesting} from '@angular/common/http/testing';

import {GamePlayComponent} from './game_play.component';
import {PassedLevel} from './game_play.service';

describe('GamePlayComponent', () => {
  let component: GamePlayComponent;
  let fixture: ComponentFixture<GamePlayComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GamePlayComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    })
    .compileComponents();

    fixture = TestBed.createComponent(GamePlayComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows how long the team stayed on a passed level', () => {
    const level = new PassedLevel(
      0,
      11,
      "2024-05-05T10:00:00+00:00",
      "2024-05-05T10:07:30+00:00",
      [],
    );

    expect(component.getPassedLevelDuration(level)).toBe("7м 30с");
  });

  it('reads no duration out of a broken timestamp', () => {
    const level = new PassedLevel(0, 11, "not a date", "2024-05-05T10:07:30+00:00", []);

    expect(component.getPassedLevelDuration(level)).toBe("—");
  });
});
