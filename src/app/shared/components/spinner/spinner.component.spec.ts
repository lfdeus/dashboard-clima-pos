import { TestBed } from '@angular/core/testing';
import { SpinnerComponent } from './spinner.component';

describe('SpinnerComponent', () => {
  it('renders the default label and role=status', async () => {
    await TestBed.configureTestingModule({ imports: [SpinnerComponent] }).compileComponents();
    const fixture = TestBed.createComponent(SpinnerComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[role="status"]')).not.toBeNull();
    expect(el.textContent).toContain('Carregando');
  });

  it('respects custom label input', async () => {
    await TestBed.configureTestingModule({ imports: [SpinnerComponent] }).compileComponents();
    const fixture = TestBed.createComponent(SpinnerComponent);
    fixture.componentRef.setInput('label', 'Buscando…');
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Buscando');
  });
});
