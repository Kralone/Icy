import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  CelestialBody,
  CelestialBodyService,
  PlanetUpsertPayload
} from '../../../core/services/celestial/celestial-body.service';

@Component({
  selector: 'app-planet-management',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './planet-management.component.html',
  styleUrl: './planet-management.component.css'
})
export class PlanetManagementComponent implements OnInit {
  bodies: CelestialBody[] = [];
  paginatedBodies: CelestialBody[] = [];
  selectedSystem = 'ALL';

  newPlanet: PlanetUpsertPayload = {
    name: '',
    systemName: 'Stanton',
    parentPlanet: null,
    imageUrl: '',
    wikiUrl: '',
    gameVersion: '4.6',
    sortOrder: 0
  };

  editingPlanet: CelestialBody | null = null;
  isSubmitting = false;
  loading = false;
  errorMessage = '';

  currentPage = 1;
  planetsPerPage = 10;
  readonly sortOrderPresets: Array<{ label: string; value: number }> = [
    { label: 'Tres haute', value: -100 },
    { label: 'Haute', value: -10 },
    { label: 'Normale', value: 0 },
    { label: 'Basse', value: 10 },
    { label: 'Tres basse', value: 100 }
  ];

  constructor(private readonly celestialBodyService: CelestialBodyService) {}

  ngOnInit(): void {
    this.loadPlanets();
  }

  loadPlanets(): void {
    this.loading = true;
    this.errorMessage = '';
    this.celestialBodyService.listPlanetsAdmin().subscribe({
      next: (response) => {
        this.bodies = [...(response?.data ?? [])];
        this.currentPage = 1;
        this.updatePagination();
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.errorMessage = 'Impossible de charger les planetes et lunes.';
      }
    });
  }

  createOrUpdatePlanet(): void {
    if (this.isSubmitting) {
      return;
    }

    const payload: PlanetUpsertPayload = {
      name: this.newPlanet.name.trim(),
      systemName: this.newPlanet.systemName.trim(),
      parentPlanet: this.newPlanet.parentPlanet?.trim() || null,
      imageUrl: this.newPlanet.imageUrl.trim(),
      wikiUrl: this.newPlanet.wikiUrl.trim(),
      gameVersion: this.newPlanet.gameVersion.trim() || '4.6',
      sortOrder: Number(this.newPlanet.sortOrder) || 0
    };

    if (!payload.name || !payload.systemName || !payload.imageUrl || !payload.wikiUrl) {
      this.errorMessage = 'Name, systemName, imageUrl et wikiUrl sont requis.';
      return;
    }
    this.isSubmitting = true;
    const request$ = this.editingPlanet
      ? this.celestialBodyService.updatePlanet(this.editingPlanet.id, payload)
      : this.celestialBodyService.createPlanet(payload);

    request$.subscribe({
      next: () => {
        this.isSubmitting = false;
        this.resetForm();
        this.loadPlanets();
      },
      error: () => {
        this.isSubmitting = false;
        this.errorMessage = 'Operation impossible. Verifie les champs et reessaie.';
      }
    });
  }

  editPlanet(planet: CelestialBody): void {
    this.editingPlanet = planet;
    this.errorMessage = '';
    this.newPlanet = {
      name: planet.name ?? '',
      systemName: planet.systemName ?? '',
      parentPlanet: planet.parentPlanet ?? null,
      imageUrl: planet.imageUrl ?? '',
      wikiUrl: planet.wikiUrl ?? '',
      gameVersion: planet.gameVersion ?? '4.6',
      sortOrder: planet.sortOrder ?? 0
    };
  }

  deletePlanet(planet: CelestialBody): void {
    if (!confirm(`Supprimer ${planet.bodyType === 'PLANET' ? 'la planete' : 'la lune'} "${planet.name}" ?`)) {
      return;
    }

    this.errorMessage = '';
    this.celestialBodyService.deletePlanet(planet.id).subscribe({
      next: () => {
        if (this.editingPlanet?.id === planet.id) {
          this.resetForm();
        }
        this.loadPlanets();
      },
      error: () => {
        this.errorMessage = 'Suppression impossible.';
      }
    });
  }

  resetForm(): void {
    this.editingPlanet = null;
    this.newPlanet = {
      name: '',
      systemName: 'Stanton',
      parentPlanet: null,
      imageUrl: '',
      wikiUrl: '',
      gameVersion: '4.6',
      sortOrder: 0
    };
  }

  updatePagination(): void {
    const start = (this.currentPage - 1) * this.planetsPerPage;
    const end = start + this.planetsPerPage;
    this.paginatedBodies = this.filteredAndSortedBodies.slice(start, end);
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updatePagination();
    }
  }

  prevPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePagination();
    }
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredAndSortedBodies.length / this.planetsPerPage));
  }

  onSystemChange(): void {
    this.currentPage = 1;
    this.updatePagination();
  }

  get systems(): string[] {
    const values = new Set<string>();
    for (const body of this.bodies) {
      if (body.systemName?.trim()) {
        values.add(body.systemName.trim());
      }
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }

  isPlanet(body: CelestialBody): boolean {
    return body.bodyType === 'PLANET';
  }

  onFormSystemChange(): void {
    this.newPlanet.parentPlanet = null;
  }

  get formSystemOptions(): string[] {
    const existing = this.systems;
    if (!existing.length) {
      return ['Stanton', 'Pyro'];
    }
    return existing;
  }

  get parentPlanetOptions(): string[] {
    return this.bodies
      .filter((body) => body.bodyType === 'PLANET' && body.systemName === this.newPlanet.systemName)
      .map((body) => body.name)
      .sort((a, b) => this.compareBodyNames(a, b));
  }

  get sortOrderOptions(): Array<{ label: string; value: number }> {
    const current = Number(this.newPlanet.sortOrder ?? 0);
    const hasCurrent = this.sortOrderPresets.some((preset) => preset.value === current);
    if (hasCurrent) {
      return this.sortOrderPresets;
    }
    return [...this.sortOrderPresets, { label: `Personnalise (${current})`, value: current }];
  }

  private get filteredAndSortedBodies(): CelestialBody[] {
    const filtered = this.selectedSystem === 'ALL'
      ? [...this.bodies]
      : this.bodies.filter((body) => body.systemName === this.selectedSystem);

    const bySystem = new Map<string, CelestialBody[]>();
    for (const body of filtered) {
      const key = body.systemName ?? '';
      if (!bySystem.has(key)) {
        bySystem.set(key, []);
      }
      bySystem.get(key)?.push(body);
    }

    const systems = Array.from(bySystem.keys()).sort((a, b) => a.localeCompare(b));
    const ordered: CelestialBody[] = [];

    for (const system of systems) {
      const bodiesInSystem = bySystem.get(system) ?? [];
      const planets = bodiesInSystem
        .filter((body) => body.bodyType === 'PLANET')
        .sort((a, b) => this.compareByOrderThenName(a, b));
      const moons = bodiesInSystem.filter((body) => body.bodyType === 'MOON');

      for (const planet of planets) {
        ordered.push(planet);
        const childMoons = moons
          .filter((moon) => (moon.parentPlanet ?? '').toLowerCase() === planet.name.toLowerCase())
          .sort((a, b) => this.compareByOrderThenName(a, b));
        ordered.push(...childMoons);
      }

      const orphanMoons = moons
        .filter((moon) =>
          !planetHasName(planets, moon.parentPlanet)
        )
        .sort((a, b) => this.compareByOrderThenName(a, b));
      ordered.push(...orphanMoons);
    }

    return ordered;

    function planetHasName(planetsList: CelestialBody[], planetName: string | null): boolean {
      if (!planetName) {
        return false;
      }
      return planetsList.some((planet) => planet.name.toLowerCase() === planetName.toLowerCase());
    }
  }

  private compareBodyNames(leftName: string, rightName: string): number {
    const left = this.extractNameSortParts(leftName);
    const right = this.extractNameSortParts(rightName);

    const base = left.base.localeCompare(right.base);
    if (base !== 0) {
      return base;
    }
    if (left.order !== right.order) {
      return left.order - right.order;
    }
    return left.full.localeCompare(right.full);
  }

  private compareByOrderThenName(left: CelestialBody, right: CelestialBody): number {
    const leftOrder = Number(left.sortOrder ?? 0);
    const rightOrder = Number(right.sortOrder ?? 0);
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }
    return this.compareBodyNames(left.name, right.name);
  }

  private extractNameSortParts(name: string): { base: string; order: number; full: string } {
    const safeName = (name ?? '').trim();
    const numericMatch = safeName.match(/^(.*?)[\s-]+(\d+)$/);
    if (numericMatch) {
      return {
        base: numericMatch[1].trim().toLowerCase(),
        order: Number.parseInt(numericMatch[2], 10),
        full: safeName.toLowerCase()
      };
    }

    const romanMatch = safeName.match(/^(.*?)[\s-]+([ivxlcdm]+)$/i);
    if (romanMatch) {
      return {
        base: romanMatch[1].trim().toLowerCase(),
        order: this.romanToInt(romanMatch[2]),
        full: safeName.toLowerCase()
      };
    }

    return {
      base: safeName.toLowerCase(),
      order: 0,
      full: safeName.toLowerCase()
    };
  }

  private romanToInt(raw: string): number {
    const roman = (raw ?? '').toUpperCase();
    const values: Record<string, number> = {
      I: 1,
      V: 5,
      X: 10,
      L: 50,
      C: 100,
      D: 500,
      M: 1000
    };
    let total = 0;
    let previous = 0;

    for (let i = roman.length - 1; i >= 0; i--) {
      const current = values[roman[i]] ?? 0;
      if (current < previous) {
        total -= current;
      } else {
        total += current;
      }
      previous = current;
    }
    return total > 0 ? total : 0;
  }
}
