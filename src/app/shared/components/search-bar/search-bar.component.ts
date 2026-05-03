import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  output
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, filter, map } from 'rxjs';

@Component({
  selector: 'app-search-bar',
  standalone: true,
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form
      class="flex w-full flex-col gap-2 sm:flex-row sm:items-center"
      [formGroup]="form"
      (ngSubmit)="onSubmit()"
      role="search"
    >
      <label for="city-input" class="sr-only">Buscar cidade</label>
      <div class="relative flex-1">
        <span
          class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400"
          aria-hidden="true"
        >
          <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path
              fill-rule="evenodd"
              d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
              clip-rule="evenodd"
            />
          </svg>
        </span>
        <input
          id="city-input"
          type="search"
          class="input pl-10"
          formControlName="city"
          [placeholder]="placeholder()"
          autocomplete="off"
          aria-label="Nome da cidade"
        />
      </div>
      <button
        type="submit"
        class="btn-primary"
        [disabled]="form.invalid || disabled()"
        aria-label="Buscar"
      >
        Buscar
      </button>
    </form>
  `
})
export class SearchBarComponent {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly placeholder = input<string>('Digite o nome de uma cidade…');
  readonly disabled = input<boolean>(false);
  readonly debounceMs = input<number>(400);

  readonly searchSubmitted = output<string>();
  readonly searchTyped = output<string>();

  protected readonly form = this.fb.nonNullable.group({
    city: ['']
  });

  constructor() {
    this.form.controls.city.valueChanges
      .pipe(
        map((v) => v.trim()),
        filter((v) => v.length >= 2),
        debounceTime(this.debounceMs()),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((value) => this.searchTyped.emit(value));
  }

  onSubmit(): void {
    const value = this.form.controls.city.value.trim();
    if (value.length >= 2) {
      this.searchSubmitted.emit(value);
    }
  }

  setValue(value: string): void {
    this.form.controls.city.setValue(value, { emitEvent: false });
  }
}
