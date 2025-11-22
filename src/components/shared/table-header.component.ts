import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'th[app-table-header]',
  imports: [],
  template: `
    <div class="flex items-center justify-center gap-2">
      <ng-content></ng-content>
      @if (sortKey()) {
        <span class="text-gray-400">
          @if (activeSortKey() === sortKey()) {
            @if (sortDirection() === 'asc') {
              <span>▲</span>
            } @else {
              <span>▼</span>
            }
          } @else {
            <span class="opacity-50">▲▼</span>
          }
        </span>
      }
    </div>
  `,
  host: {
    '[class.cursor-pointer]': 'sortKey()',
    '[class.hover:bg-blue-700]': 'sortKey()',
    '(click)': 'onSort()'
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TableHeaderComponent {
  sortKey = input<string>();
  activeSortKey = input.required<string>();
  sortDirection = input.required<'asc' | 'desc'>();
  sort = output<string>();

  onSort() {
    if (this.sortKey()) {
      this.sort.emit(this.sortKey());
    }
  }
}