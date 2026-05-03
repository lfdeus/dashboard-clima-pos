import { TestBed } from '@angular/core/testing';
import { ErrorMessageComponent } from './error-message.component';

describe('ErrorMessageComponent', () => {
  it('renders the message and emits retry on button click', async () => {
    await TestBed.configureTestingModule({ imports: [ErrorMessageComponent] }).compileComponents();
    const fixture = TestBed.createComponent(ErrorMessageComponent);
    fixture.componentRef.setInput('message', 'Cidade não encontrada.');
    fixture.detectChanges();

    let emitted = false;
    fixture.componentInstance.retry.subscribe(() => (emitted = true));

    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement | null;
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Cidade não encontrada.');
    expect(button).not.toBeNull();
    button!.click();
    expect(emitted).toBeTrue();
  });

  it('hides retry button when canRetry is false', async () => {
    await TestBed.configureTestingModule({ imports: [ErrorMessageComponent] }).compileComponents();
    const fixture = TestBed.createComponent(ErrorMessageComponent);
    fixture.componentRef.setInput('message', 'erro');
    fixture.componentRef.setInput('canRetry', false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
  });
});
