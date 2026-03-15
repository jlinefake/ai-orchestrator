import {
  Component,
  input,
  output,
  ChangeDetectionStrategy,
  HostListener,
  ElementRef,
  inject,
} from '@angular/core';

export interface ContextMenuItem {
  label: string;
  icon?: string;
  action: () => void;
  disabled?: boolean;
  divider?: boolean;
}

@Component({
  selector: 'app-context-menu',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <div class="context-menu" [style.left.px]="x()" [style.top.px]="y()">
        @for (item of items(); track item.label) {
          @if (item.divider) {
            <div class="context-menu-divider"></div>
          }
          <button
            class="context-menu-item"
            [class.disabled]="item.disabled"
            [disabled]="item.disabled"
            (click)="onItemClick(item)"
          >
            {{ item.label }}
          </button>
        }
      </div>
    }
  `,
  styles: [`
    :host {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 10000;
      pointer-events: none;
    }

    .context-menu {
      position: fixed;
      min-width: 160px;
      background: var(--bg-secondary, #1e1e2e);
      border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
      border-radius: 8px;
      padding: 4px 0;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
      pointer-events: all;
      z-index: 10001;
    }

    .context-menu-item {
      display: block;
      width: 100%;
      padding: 8px 16px;
      border: none;
      background: none;
      color: var(--text-primary, #cdd6f4);
      font-size: 13px;
      text-align: left;
      cursor: pointer;
      transition: background 0.1s;
    }

    .context-menu-item:hover:not(.disabled) {
      background: var(--bg-hover, rgba(255, 255, 255, 0.08));
    }

    .context-menu-item.disabled {
      opacity: 0.4;
      cursor: default;
    }

    .context-menu-divider {
      height: 1px;
      background: var(--border-color, rgba(255, 255, 255, 0.1));
      margin: 4px 0;
    }
  `],
})
export class ContextMenuComponent {
  private el = inject(ElementRef);

  items = input.required<ContextMenuItem[]>();
  x = input.required<number>();
  y = input.required<number>();
  visible = input.required<boolean>();
  closed = output<void>();

  onItemClick(item: ContextMenuItem): void {
    if (!item.disabled) {
      item.action();
      this.closed.emit();
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.visible()) {
      const menuEl = this.el.nativeElement.querySelector('.context-menu');
      if (menuEl && !menuEl.contains(event.target as Node)) {
        this.closed.emit();
      }
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.visible()) {
      this.closed.emit();
    }
  }
}
