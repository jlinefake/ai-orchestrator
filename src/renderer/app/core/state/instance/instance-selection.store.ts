/**
 * Instance Selection Store - Manages instance selection state
 */

import { Injectable, inject } from '@angular/core';
import { InstanceStateService } from './instance-state.service';

@Injectable({ providedIn: 'root' })
export class InstanceSelectionStore {
  private stateService = inject(InstanceStateService);

  /**
   * Set the selected instance
   */
  setSelectedInstance(id: string | null): void {
    this.stateService.setSelectedInstance(id);
  }

  /**
   * Select the next instance in the list
   */
  selectNextInstance(): void {
    const state = this.stateService.state();
    const instances = Array.from(state.instances.values());
    if (instances.length === 0) return;

    const currentIndex = instances.findIndex(
      (i) => i.id === state.selectedInstanceId
    );

    if (currentIndex === -1 || currentIndex === instances.length - 1) {
      // Select first if none selected or at end
      this.setSelectedInstance(instances[0].id);
    } else {
      this.setSelectedInstance(instances[currentIndex + 1].id);
    }
  }

  /**
   * Select the previous instance in the list
   */
  selectPreviousInstance(): void {
    const state = this.stateService.state();
    const instances = Array.from(state.instances.values());
    if (instances.length === 0) return;

    const currentIndex = instances.findIndex(
      (i) => i.id === state.selectedInstanceId
    );

    if (currentIndex === -1 || currentIndex === 0) {
      // Select last if none selected or at beginning
      this.setSelectedInstance(instances[instances.length - 1].id);
    } else {
      this.setSelectedInstance(instances[currentIndex - 1].id);
    }
  }

  /**
   * Clear the selection
   */
  clearSelection(): void {
    this.setSelectedInstance(null);
  }
}
