/**
 * Input Panel Component - Text input for sending messages to Claude
 */

import {
  Component,
  input,
  output,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';

@Component({
  selector: 'app-input-panel',
  standalone: true,
  template: `
    <div class="input-panel">
      <!-- Pending files preview -->
      @if (pendingFiles() && pendingFiles()!.length > 0) {
        <div class="pending-files">
          @for (file of pendingFiles(); track file.name) {
            <div class="file-chip">
              <span class="file-icon">{{ getFileIcon(file) }}</span>
              <span class="file-name">{{ file.name }}</span>
              <button
                class="file-remove"
                (click)="removeFile.emit(file)"
                title="Remove file"
              >
                ×
              </button>
            </div>
          }
        </div>
      }

      <!-- Input area -->
      <div class="input-row">
        <textarea
          class="message-input"
          [placeholder]="placeholder()"
          [disabled]="disabled()"
          [value]="message()"
          (input)="onInput($event)"
          (keydown)="onKeyDown($event)"
          rows="1"
          #textareaRef
        ></textarea>

        <button
          class="btn-send"
          [disabled]="disabled() || !canSend()"
          (click)="onSend()"
          title="Send message (Enter)"
        >
          <span class="send-icon">↑</span>
        </button>
      </div>

      <div class="input-hints">
        <span class="hint">Press Enter to send, Shift+Enter for new line</span>
        <span class="hint">Drag files or paste images to attach</span>
      </div>
    </div>
  `,
  styles: [`
    .input-panel {
      background: var(--bg-secondary);
      border-radius: var(--radius-md);
      padding: var(--spacing-md);
    }

    .pending-files {
      display: flex;
      flex-wrap: wrap;
      gap: var(--spacing-sm);
      margin-bottom: var(--spacing-sm);
      padding-bottom: var(--spacing-sm);
      border-bottom: 1px solid var(--border-color);
    }

    .file-chip {
      display: flex;
      align-items: center;
      gap: var(--spacing-xs);
      padding: var(--spacing-xs) var(--spacing-sm);
      background: var(--bg-tertiary);
      border-radius: var(--radius-sm);
      font-size: 12px;
    }

    .file-icon {
      font-size: 14px;
    }

    .file-name {
      max-width: 150px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .file-remove {
      width: 18px;
      height: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      font-size: 14px;
      color: var(--text-muted);
      transition: all var(--transition-fast);

      &:hover {
        background: var(--error-bg);
        color: var(--error-color);
      }
    }

    .input-row {
      display: flex;
      gap: var(--spacing-sm);
      align-items: flex-end;
    }

    .message-input {
      flex: 1;
      min-height: 44px;
      max-height: 200px;
      padding: var(--spacing-sm) var(--spacing-md);
      resize: none;
      line-height: 1.5;
      font-size: 14px;

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }

    .btn-send {
      width: 44px;
      height: 44px;
      border-radius: var(--radius-md);
      background: var(--primary-color);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all var(--transition-fast);

      &:hover:not(:disabled) {
        background: var(--primary-hover);
      }

      &:disabled {
        opacity: 0.3;
        cursor: not-allowed;
      }
    }

    .send-icon {
      font-size: 20px;
      font-weight: bold;
    }

    .input-hints {
      display: flex;
      justify-content: space-between;
      margin-top: var(--spacing-xs);
      padding: 0 var(--spacing-xs);
    }

    .hint {
      font-size: 11px;
      color: var(--text-muted);
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InputPanelComponent {
  instanceId = input.required<string>();
  disabled = input<boolean>(false);
  placeholder = input<string>('Send a message...');
  pendingFiles = input<File[]>([]);

  sendMessage = output<string>();
  removeFile = output<File>();

  message = signal('');

  canSend(): boolean {
    return this.message().trim().length > 0 || (this.pendingFiles()?.length ?? 0) > 0;
  }

  onInput(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    this.message.set(textarea.value);

    // Auto-resize textarea
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.onSend();
    }
  }

  onSend(): void {
    if (!this.canSend() || this.disabled()) return;

    const text = this.message().trim();
    this.sendMessage.emit(text);
    this.message.set('');

    // Reset textarea height
    const textarea = document.querySelector('.message-input') as HTMLTextAreaElement;
    if (textarea) {
      textarea.style.height = 'auto';
    }
  }

  getFileIcon(file: File): string {
    if (file.type.startsWith('image/')) return '🖼️';
    if (file.type.includes('pdf')) return '📄';
    if (file.type.includes('text')) return '📝';
    if (file.type.includes('json') || file.type.includes('javascript')) return '📋';
    return '📎';
  }
}
