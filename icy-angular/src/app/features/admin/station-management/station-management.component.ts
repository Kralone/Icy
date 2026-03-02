import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  OrbitalStation,
  OrbitalStationService,
  StationKind,
  StationOrbitKind,
  StationUpsertPayload
} from '../../../core/services/station/orbital-station.service';

@Component({
  selector: 'app-station-management',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './station-management.component.html',
  styleUrl: './station-management.component.css'
})
export class StationManagementComponent implements OnInit {
  stations: OrbitalStation[] = [];
  filteredStations: OrbitalStation[] = [];
  selectedSystem = 'ALL';
  currentPage = 1;
  readonly pageSize = 12;
  loading = false;
  isSubmitting = false;
  errorMessage = '';
  editingStation: OrbitalStation | null = null;

  readonly stationKindOptions: StationKind[] = ['ORBITAL', 'LAGRANGE', 'OUTLAW', 'GATEWAY', 'SERVICE'];

  newStation: StationUpsertPayload = this.defaultStation();

  constructor(private readonly orbitalStationService: OrbitalStationService) {}

  ngOnInit(): void {
    this.loadStations();
  }

  loadStations(): void {
    this.loading = true;
    this.errorMessage = '';
    this.orbitalStationService.listAdminStations().subscribe({
      next: (response) => {
        this.stations = [...(response?.data ?? [])];
        this.applyFilter();
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.errorMessage = 'Impossible de charger les stations.';
      }
    });
  }

  createOrUpdateStation(): void {
    if (this.isSubmitting) {
      return;
    }

    this.syncFormByStationKind();

    const payload: StationUpsertPayload = {
      name: this.newStation.name.trim(),
      systemName: this.newStation.systemName.trim(),
      stationKind: this.newStation.stationKind,
      orbitKind: this.newStation.orbitKind,
      orbitTarget: this.newStation.orbitTarget?.trim() || null,
      lagrangePoint: this.newStation.lagrangePoint?.trim() || null,
      operatorName: this.newStation.operatorName?.trim() || null,
      wikiUrl: this.newStation.wikiUrl.trim(),
      imageUrl: this.newStation.imageUrl.trim(),
      gameVersion: this.newStation.gameVersion.trim() || '4.6',
      notes: this.newStation.notes?.trim() || null,
      sortOrder: Number(this.newStation.sortOrder) || 0
    };

    if (!payload.name || !payload.systemName || !payload.wikiUrl || !payload.imageUrl) {
      this.errorMessage = 'Name, systemName, wikiUrl et imageUrl sont requis.';
      return;
    }

    this.isSubmitting = true;
    const request$ = this.editingStation
      ? this.orbitalStationService.updateStation(this.editingStation.id, payload)
      : this.orbitalStationService.createStation(payload);

    request$.subscribe({
      next: () => {
        this.isSubmitting = false;
        this.resetForm();
        this.loadStations();
      },
      error: () => {
        this.isSubmitting = false;
        this.errorMessage = 'Operation impossible sur la station.';
      }
    });
  }

  editStation(station: OrbitalStation): void {
    this.editingStation = station;
    this.errorMessage = '';
    this.newStation = {
      name: station.name,
      systemName: station.systemName,
      stationKind: station.stationKind,
      orbitKind: station.orbitKind,
      orbitTarget: station.orbitTarget,
      lagrangePoint: station.lagrangePoint,
      operatorName: station.operatorName,
      wikiUrl: station.wikiUrl,
      imageUrl: station.imageUrl,
      gameVersion: station.gameVersion,
      notes: station.notes,
      sortOrder: station.sortOrder
    };
    this.syncFormByStationKind();
  }

  deleteStation(station: OrbitalStation): void {
    if (!confirm(`Supprimer la station "${station.name}" ?`)) {
      return;
    }

    this.orbitalStationService.deleteStation(station.id).subscribe({
      next: () => {
        if (this.editingStation?.id === station.id) {
          this.resetForm();
        }
        this.loadStations();
      },
      error: () => {
        this.errorMessage = 'Suppression impossible.';
      }
    });
  }

  resetForm(): void {
    this.editingStation = null;
    this.newStation = this.defaultStation();
    this.syncFormByStationKind();
  }

  applyFilter(): void {
    const list = this.selectedSystem === 'ALL'
      ? [...this.stations]
      : this.stations.filter((station) => station.systemName === this.selectedSystem);

    this.filteredStations = list.sort((a, b) => {
      if (a.systemName !== b.systemName) {
        return a.systemName.localeCompare(b.systemName, undefined, { sensitivity: 'base' });
      }
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });
    this.currentPage = 1;
  }

  get systems(): string[] {
    const values = new Set<string>();
    for (const station of this.stations) {
      if (station.systemName?.trim()) {
        values.add(station.systemName.trim());
      }
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }

  get showOrbitKindSelect(): boolean {
    return this.newStation.stationKind !== 'LAGRANGE' && this.newStation.stationKind !== 'GATEWAY';
  }

  get showOrbitTargetField(): boolean {
    return this.newStation.orbitKind !== 'UNKNOWN' && this.newStation.stationKind !== 'GATEWAY';
  }

  get showLagrangeField(): boolean {
    return this.newStation.stationKind === 'LAGRANGE';
  }

  get filteredOrbitKindOptions(): StationOrbitKind[] {
    if (this.newStation.stationKind === 'OUTLAW') {
      return ['ASTEROID_BELT', 'MOON', 'PLANET', 'UNKNOWN'];
    }
    return ['PLANET', 'MOON', 'ASTEROID_BELT', 'UNKNOWN'];
  }

  onStationKindChange(): void {
    this.syncFormByStationKind();
  }

  get pagedStations(): OrbitalStation[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredStations.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredStations.length / this.pageSize));
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage -= 1;
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage += 1;
    }
  }

  private defaultStation(): StationUpsertPayload {
    return {
      name: '',
      systemName: 'Stanton',
      stationKind: 'ORBITAL',
      orbitKind: 'PLANET',
      orbitTarget: null,
      lagrangePoint: null,
      operatorName: null,
      wikiUrl: '',
      imageUrl: '',
      gameVersion: '4.6',
      notes: null,
      sortOrder: 0
    };
  }

  private syncFormByStationKind(): void {
    if (this.newStation.stationKind === 'LAGRANGE') {
      this.newStation.orbitKind = 'LAGRANGE_POINT';
      if (!this.newStation.lagrangePoint) {
        this.newStation.lagrangePoint = 'L1';
      }
      return;
    }

    if (this.newStation.stationKind === 'GATEWAY') {
      this.newStation.orbitKind = 'JUMP_POINT';
      this.newStation.lagrangePoint = null;
      return;
    }

    if (this.newStation.orbitKind === 'LAGRANGE_POINT' || this.newStation.orbitKind === 'JUMP_POINT') {
      this.newStation.orbitKind = this.newStation.stationKind === 'OUTLAW' ? 'ASTEROID_BELT' : 'PLANET';
    }
    this.newStation.lagrangePoint = null;
  }
}
