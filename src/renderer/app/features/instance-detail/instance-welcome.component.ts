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
        <div class="welcome-shell">
          <div class="welcome-copy">
            <p class="welcome-eyebrow">Operator Workspace</p>
            <h1 class="welcome-title">Start with a brief, not a control panel.</h1>
            <p class="welcome-hint">
              Launch a session, point it at the right folder, and let the rest of the orchestration stack stay in the background until you need it.
            </p>

            <div class="welcome-folder-wrapper">
              <span class="folder-label">Working directory</span>
              <app-recent-directories-dropdown
                [currentPath]="workingDirectory() || ''"
                placeholder="Select working folder..."
                (folderSelected)="selectFolder.emit($event)"
              />
            </div>
          </div>

          <div class="welcome-input-shell">
            <div class="welcome-input-header">
              <span class="welcome-composer-label">New session</span>
              <span class="welcome-composer-hint">Describe the outcome, constraints, and context.</span>
            </div>
            <div class="welcome-input">
              <app-input-panel
                instanceId="new"
                [disabled]="false"
                placeholder="Plan the work, review code, investigate a bug, or coordinate a multi-agent task..."
                [pendingFiles]="pendingFiles()"
                (sendMessage)="sendMessage.emit($event)"
                (removeFile)="removeFile.emit($event)"
                (addFiles)="addFiles.emit()"
              />
            </div>
          </div>
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
        align-items: center;
        justify-content: center;
        padding: 40px 32px;
        background:
          radial-gradient(circle at 18% 18%, rgba(var(--secondary-rgb), 0.12), transparent 26%),
          radial-gradient(circle at 82% 82%, rgba(var(--primary-rgb), 0.09), transparent 24%),
          linear-gradient(180deg, rgba(255, 255, 255, 0.02), transparent 22%),
          var(--bg-primary);
        position: relative;
        overflow: hidden;
      }

      .welcome-shell {
        width: min(980px, 100%);
        display: flex;
        flex-direction: column;
        gap: 26px;
        position: relative;
        z-index: 1;
      }

      .welcome-copy {
        display: flex;
        flex-direction: column;
        gap: 18px;
        animation: fadeInUp 0.6s ease-out;
        max-width: 720px;
      }

      .welcome-eyebrow {
        font-family: var(--font-mono);
        font-size: 11px;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: var(--text-muted);
      }

      .welcome-title {
        font-family: var(--font-display);
        font-size: clamp(34px, 5vw, 52px);
        font-weight: 600;
        letter-spacing: -0.03em;
        color: var(--text-primary);
        line-height: 0.94;
        max-width: 12ch;
      }

      .welcome-hint {
        max-width: 46ch;
        font-size: 17px;
        color: var(--text-secondary);
        margin: 0;
        line-height: 1.75;
      }

      .welcome-folder-wrapper {
        display: flex;
        flex-direction: column;
        gap: 8px;
        width: min(520px, 100%);
        padding: 18px 20px;
        border-radius: 22px;
        border: 1px solid rgba(255, 255, 255, 0.07);
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.025), rgba(255, 255, 255, 0)),
          rgba(255, 255, 255, 0.03);
        backdrop-filter: blur(18px);
        box-shadow: 0 24px 60px rgba(0, 0, 0, 0.18);
      }

      .folder-label {
        font-family: var(--font-mono);
        font-size: 10px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--text-muted);
      }

      .welcome-input-shell {
        display: flex;
        flex-direction: column;
        gap: 16px;
        min-width: 0;
        animation: fadeInUp 0.6s ease-out 0.15s both;
        width: 100%;
      }

      .welcome-input-header {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .welcome-composer-label {
        font-family: var(--font-mono);
        font-size: 10px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--text-muted);
      }

      .welcome-composer-hint {
        color: var(--text-secondary);
        font-size: 15px;
      }

      .welcome-input {
        width: 100%;
      }

      @media (max-width: 960px) {
        .welcome-copy {
          text-align: left;
        }

        .welcome-title {
          font-size: clamp(32px, 10vw, 46px);
        }
      }

      @media (max-width: 640px) {
        .welcome-view {
          padding: 20px;
        }

        .welcome-shell {
          gap: 20px;
        }
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
