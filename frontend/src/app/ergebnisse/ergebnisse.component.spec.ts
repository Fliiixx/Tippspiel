import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ErgebnisseComponent } from './ergebnisse.component';

describe('Ergebnisse', () => {
  let component: ErgebnisseComponent;
  let fixture: ComponentFixture<ErgebnisseComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ErgebnisseComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ErgebnisseComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
