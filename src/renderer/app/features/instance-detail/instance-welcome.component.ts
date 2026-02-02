/**
 * Instance Welcome Component - Welcome view for creating new conversations
 */

import {
  Component,
  input,
  output,
  ChangeDetectionStrategy
} from '@angular/core';
import { DropZoneComponent } from '../file-drop/drop-zone.component';
import { InputPanelComponent } from './input-panel.component';
import { RecentDirectoriesDropdownComponent } from '../../shared/components/recent-directories-dropdown/recent-directories-dropdown.component';

@Component({
  selector: 'app-instance-welcome',
  standalone: true,
  imports: [DropZoneComponent, InputPanelComponent, RecentDirectoriesDropdownComponent],
  template: `
    <app-drop-zone
      class="full-drop-zone"
      (filesDropped)="filesDropped.emit($event)"
      (imagesPasted)="imagesPasted.emit($event)"
    >
      <div class="welcome-view">
        <div class="welcome-content">
          <div class="welcome-icon">🤖</div>
          <h1 class="welcome-title">AI Orchestrator</h1>
          <p class="welcome-hint">
            Start a conversation to create a new instance
          </p>

          <!-- Folder selector -->
          <div class="welcome-folder-wrapper">
            <app-recent-directories-dropdown
              [currentPath]="workingDirectory() || ''"
              placeholder="Select working folder..."
              (folderSelected)="selectFolder.emit($event)"
            />
          </div>
        </div>
        <div class="welcome-input">
          <app-input-panel
            instanceId="new"
            [disabled]="false"
            placeholder="What would you like to work on?"
            [pendingFiles]="pendingFiles()"
            (sendMessage)="sendMessage.emit($event)"
            (removeFile)="removeFile.emit($event)"
            (addFiles)="addFiles.emit()"
          />
        </div>
      </div>
    </app-drop-zone>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex: 1;
        min-width: 0;
        min-height: 0;
      }

      .full-drop-zone {
        display: flex;
        flex: 1;
        min-width: 0;
        min-height: 0;
      }

      .welcome-view {
        display: flex;
        flex: 1;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: var(--spacing-xl);
        gap: var(--spacing-xl);
        background: var(--bg-primary);
        position: relative;
        overflow: hidden;
      }

      .welcome-view::before {
        content: '';
        position: absolute;
        inset: 0;
        background:
          radial-gradient(
            ellipse 80% 50% at 50% -10%,
            rgba(var(--primary-rgb), 0.12),
            transparent
          ),
          radial-gradient(
            circle at 80% 80%,
            rgba(var(--secondary-rgb), 0.08),
            transparent
          );
        pointer-events: none;
      }

      .welcome-content {
        text-align: center;
        max-width: 480px;
        position: relative;
        z-index: 2;
        animation: fadeInUp 0.6s ease-out;
      }

      @keyframes fadeInUp {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .welcome-icon {
        font-size: 72px;
        margin-bottom: var(--spacing-lg);
        filter: drop-shadow(0 8px 24px rgba(0, 0, 0, 0.3));
      }

      .welcome-title {
        font-family: var(--font-display);
        font-size: 32px;
        font-weight: 700;
        letter-spacing: -0.03em;
        color: var(--text-primary);
        margin: 0 0 var(--spacing-sm) 0;
        background: linear-gradient(
          135deg,
          var(--text-primary) 0%,
          var(--primary-color) 100%
        );
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }

      .welcome-hint {
        font-size: 15px;
        color: var(--text-muted);
        margin: 0;
        line-height: 1.5;
      }

      .welcome-input {
        width: 100%;
        max-width: 640px;
        position: relative;
        z-index: 1;
        animation: fadeInUp 0.6s ease-out 0.15s both;
      }

      .welcome-folder-wrapper {
        margin-top: var(--spacing-lg);
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InstanceWelcomeComponent {
  workingDirectory = input<string | null>(null);
  pendingFiles = input<File[]>([]);

  // Actions
  selectFolder = output<string>();
  sendMessage = output<string>();
  filesDropped = output<File[]>();
  imagesPasted = output<File[]>();
  removeFile = output<File>();
  addFiles = output<void>();
}
