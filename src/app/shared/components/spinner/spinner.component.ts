import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-spinner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="flex items-center justify-center gap-2 text-slate-500 dark:text-slate-300"
      role="status"
      [attr.aria-label]="label()"
    >
      <span
        class="inline-block h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent"
      ></span>
      <span class="text-sm font-medium">{{ label() }}</span>
    </div>
  `
})
export class SpinnerComponent {
  readonly label = input<string>('Carregando…');
}
