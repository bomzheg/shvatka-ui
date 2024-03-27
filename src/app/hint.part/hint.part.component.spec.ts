import {ComponentFixture, TestBed} from '@angular/core/testing';

import {HintPartComponent} from './hint.part.component';

describe('HintPartComponent', () => {
  let component: HintPartComponent;
  let fixture: ComponentFixture<HintPartComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HintPartComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HintPartComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
