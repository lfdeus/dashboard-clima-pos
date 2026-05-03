import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-error-message',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      role="alert"
      class="card flex flex-col items-start gap-3 border border-red-200 bg-red-50 p-5 ring-red-200 dark:border-red-900/40 dark:bg-red-950/40 dark:ring-red-900/40"
    >
      <div class="flex items-center gap-2 text-red-700 dark:text-red-300">
        <svg
          class="h-5 w-5 flex-shrink-0"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fill-rule="evenodd"
            d="M18 10A8 8 0 11.999 10 8 8 0 0118 10zm-7-4a1 1 0 10-2 0v4a1 1 0 102 0V6zm-1 7a1.25 1.25 0 100 2.5 1.25 1.25 0 000-2.5z"
            clip-rule="evenodd"
          />
        </svg>
        <h2 class="text-base font-semibold">{{ title() }}</h2>
      </div>
      <p class="text-sm text-red-700/90 dark:text-red-200/90">{{ message() }}</p>
      @if (canRetry()) {
        <button
          type="button"
          class="btn-primary text-sm"
          (click)="retry.emit()"
          aria-label="Tentar novamente"
        >
          Tentar novamente
        </button>
      }
    </div>
  `
})
export class ErrorMessageComponent {
  readonly title = input<string>('Não foi possível carregar');
  readonly message = input.required<string>();
  readonly canRetry = input<boolean>(true);
  readonly retry = output<void>();
}
