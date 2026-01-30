import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScWorldEventService, ScWorldEventType } from '../../../core/services/scworldevent/sc-world-event.service';
import { ScweEventsAdminComponent } from './components/scwe-events-admin/scwe-events-admin.component';
import { ScweTypesAdminComponent } from './components/scwe-types-admin/scwe-types-admin.component';

type Tab = 'events' | 'types';

@Component({
  selector: 'app-sc-world-event-management',
  standalone: true,
  imports: [CommonModule, ScweEventsAdminComponent, ScweTypesAdminComponent],
  templateUrl: './sc-world-event-management.component.html',
})
export class ScWorldEventManagementComponent implements OnInit {
  tab: Tab = 'events';

  loadingTypes = false;
  types: ScWorldEventType[] = [];

  error: string | null = null;
  success: string | null = null;

  constructor(private api: ScWorldEventService) {}

  ngOnInit(): void {
    this.reloadTypes();
  }

  switchTab(tab: Tab) {
    this.tab = tab;
    this.clearMessages();
  }

  reloadTypes() {
    this.loadingTypes = true;
    this.api.getTypes().subscribe({
      next: (t) => {
        this.types = (t ?? []).slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        this.loadingTypes = false;
      },
      error: () => {
        this.loadingTypes = false;
        this.error = 'Impossible de charger les types.';
      }
    });
  }

  setMessage(payload: { type: 'success' | 'error', text: string } | null) {
    this.clearMessages();
    if (!payload) return;
    if (payload.type === 'success') this.success = payload.text;
    if (payload.type === 'error') this.error = payload.text;
  }

  clearMessages() {
    this.error = null;
    this.success = null;
  }
}
