import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy } from '@angular/core';
import { MiningSheet, MiningSheetShip, MiningSheetShipCargoGrid } from '../../../../core/services/mining/mining-sheet.service';
import { Ship } from '../../../../model/ship.model';
import { ShipSelectorComponent } from '../../../../shared/ship-selector/ship-selector.component';

interface CargoCubePlacement {
  id: string;
  x: number;
  y: number;
  z: number;
}

interface GridProjectionMetrics {
  sizeX: number;
  sizeY: number;
  sizeZ: number;
  cell: number;
  width: number;
  height: number;
  depth: number;
  cubeSize: number;
}

interface GridCameraState {
  rotateX: number;
  rotateY: number;
  zoom: number;
}

interface PreviewGrabState {
  key: string;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startRotateX: number;
  startRotateY: number;
}

interface CubeDragState {
  key: string;
  pointerId: number;
  cubeId: string | null;
}

@Component({
  selector: 'app-mining-sheets-logistics',
  standalone: true,
  imports: [CommonModule, ShipSelectorComponent],
  templateUrl: './mining-sheets-logistics.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './mining-sheets-logistics.component.css'
})
export class MiningSheetsLogisticsComponent {
  private static readonly MIN_CELL_PX = 2;
  private static readonly MAX_CELL_PX = 22;
  private static readonly MAX_PREVIEW_WIDTH_PX = 300;
  private static readonly MAX_PREVIEW_HEIGHT_PX = 220;
  private static readonly CUBE_SIZE = 2;
  private static readonly CUBE_SLOT_COUNT = 8;
  private static readonly DEFAULT_ROTATE_X = 52;
  private static readonly DEFAULT_ROTATE_Y = -38;
  private static readonly DEFAULT_ZOOM = 1;
  private static readonly MIN_ZOOM = 0.55;
  private static readonly MAX_ZOOM = 2.4;
  private static readonly PERSPECTIVE_PX = 1400;
  private static readonly WHEEL_ZOOM_SENSITIVITY = 0.0015;
  private static readonly BUTTON_ZOOM_STEP = 0.12;
  private static readonly DRAG_ROTATE_SENSITIVITY = 0.34;

  private readonly cubePlacementsByGrid = new Map<string, CargoCubePlacement[]>();
  private readonly plannerMessageByGrid = new Map<string, string>();
  private readonly cubeDragPreviewByGrid = new Map<string, CargoCubePlacement>();
  private readonly cameraByGrid = new Map<string, GridCameraState>();
  private previewGrabState: PreviewGrabState | null = null;
  private cubeDragState: CubeDragState | null = null;
  private cubeSequence = 0;

  @Input({ required: true }) sheet!: MiningSheet;
  @Input() saving = false;
  @Input() canEdit = false;

  @Output() addShip = new EventEmitter<number>();
  @Output() removeShip = new EventEmitter<string>();

  isShipSelectorOpen = false;

  openShipSelector(): void {
    if (!this.canEdit || this.saving) {
      return;
    }
    this.isShipSelectorOpen = true;
  }

  closeShipSelector(): void {
    this.isShipSelectorOpen = false;
  }

  onShipSelected(payload: { ship: Ship | null }): void {
    const shipId = payload?.ship?.id;
    if (!shipId) {
      return;
    }
    this.addShip.emit(shipId);
    this.isShipSelectorOpen = false;
  }

  removeSheetShip(sheetShipId: string): void {
    if (!sheetShipId || this.saving) {
      return;
    }
    this.removeShip.emit(sheetShipId);
  }

  trackSheetShip(_: number, sheetShip: MiningSheetShip): string {
    return sheetShip.id;
  }

  trackCargoGrid(index: number, cargoGrid: MiningSheetShipCargoGrid): string {
    return `${index}-${cargoGrid.sizeX}-${cargoGrid.sizeY}-${cargoGrid.sizeZ}`;
  }

  trackCubePlacement(_: number, cube: CargoCubePlacement): string {
    return cube.id;
  }

  toDisplayDateTime(isoDateTime: string): string {
    if (!isoDateTime) {
      return '-';
    }
    const parsed = new Date(isoDateTime);
    if (Number.isNaN(parsed.getTime())) {
      return isoDateTime;
    }
    return parsed.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  cargoGridStyle(cargoGrid: MiningSheetShipCargoGrid): Record<string, string> {
    const projection = this.gridProjection(cargoGrid);
    return {
      '--grid-x': `${projection.sizeX}`,
      '--grid-y': `${projection.sizeY}`,
      '--grid-z': `${projection.sizeZ}`,
      '--cell': `${projection.cell.toFixed(2)}px`,
      '--world-w': `${projection.width.toFixed(2)}px`,
      '--world-h': `${projection.height.toFixed(2)}px`,
      '--world-d': `${projection.depth.toFixed(2)}px`,
    };
  }

  cargoOrbitStyle(
    sheetShipId: string,
    cargoGridIndex: number,
    cargoGrid: MiningSheetShipCargoGrid
  ): Record<string, string> {
    const key = this.gridPlannerKey(sheetShipId, cargoGridIndex, cargoGrid);
    const camera = this.getCameraForKey(key);
    return {
      '--orbit-x': `${camera.rotateX}deg`,
      '--orbit-y': `${camera.rotateY}deg`,
      '--orbit-z': `${this.zoomToOrbitZ(camera.zoom).toFixed(2)}px`,
    };
  }

  cargoVolumeStyle(cargoGrid: MiningSheetShipCargoGrid): Record<string, string> {
    const projection = this.gridProjection(cargoGrid);
    return {
      '--cuboid-w': `${projection.width.toFixed(2)}px`,
      '--cuboid-h': `${projection.height.toFixed(2)}px`,
      '--cuboid-d': `${projection.depth.toFixed(2)}px`,
      '--cuboid-cx': `${(projection.width / 2).toFixed(2)}px`,
      '--cuboid-cy': `${(projection.height / 2).toFixed(2)}px`,
      '--cuboid-cz': `${(-projection.depth / 2).toFixed(2)}px`,
    };
  }

  cubeStyle(cube: CargoCubePlacement, cargoGrid: MiningSheetShipCargoGrid): Record<string, string> {
    const projection = this.gridProjection(cargoGrid);
    const cubeSize = projection.cubeSize;
    const centerX = (cube.x + MiningSheetsLogisticsComponent.CUBE_SIZE / 2) * projection.cell;
    const centerY = projection.height - (cube.z + MiningSheetsLogisticsComponent.CUBE_SIZE / 2) * projection.cell;
    const centerZ = -(cube.y + MiningSheetsLogisticsComponent.CUBE_SIZE / 2) * projection.cell;
    return {
      '--cube-x': `${cube.x}`,
      '--cube-y': `${cube.y}`,
      '--cube-z': `${cube.z}`,
      '--cube-size': `${MiningSheetsLogisticsComponent.CUBE_SIZE}`,
      '--cuboid-w': `${cubeSize.toFixed(2)}px`,
      '--cuboid-h': `${cubeSize.toFixed(2)}px`,
      '--cuboid-d': `${cubeSize.toFixed(2)}px`,
      '--cuboid-cx': `${centerX.toFixed(2)}px`,
      '--cuboid-cy': `${centerY.toFixed(2)}px`,
      '--cuboid-cz': `${centerZ.toFixed(2)}px`,
      'z-index': `${cube.x + cube.y + cube.z + 1}`,
    };
  }

  previewCubeStyle(cube: CargoCubePlacement, cargoGrid: MiningSheetShipCargoGrid): Record<string, string> {
    const projection = this.gridProjection(cargoGrid);
    const baseStyle = this.cubeStyle(cube, cargoGrid);
    const baseDepth = Number.parseFloat(baseStyle['--cuboid-cz'] ?? '0');
    const lift = Math.max(4, projection.cell * 0.9);
    return {
      ...baseStyle,
      '--cuboid-cz': `${(baseDepth + lift).toFixed(2)}px`,
      'z-index': '9999',
    };
  }

  addCubeAt(
    sheetShipId: string,
    cargoGridIndex: number,
    cargoGrid: MiningSheetShipCargoGrid,
    rawX: unknown,
    rawY: unknown,
    rawZ: unknown
  ): void {
    const key = this.gridPlannerKey(sheetShipId, cargoGridIndex, cargoGrid);
    if (!this.canHostCubes(cargoGrid)) {
      this.setPlannerMessage(key, 'Cette grille est trop petite pour un cube 2x2x2.');
      return;
    }

    const x = this.parseCoordinate(rawX);
    const y = this.parseCoordinate(rawY);
    const z = this.parseCoordinate(rawZ);
    if (x === null || y === null || z === null) {
      this.setPlannerMessage(key, 'Coordonnees invalides. Utilise des entiers >= 0.');
      return;
    }

    const maxX = this.maxCubeOriginX(cargoGrid);
    const maxY = this.maxCubeOriginY(cargoGrid);
    const maxZ = this.maxCubeOriginZ(cargoGrid);
    if (x > maxX || y > maxY || z > maxZ) {
      this.setPlannerMessage(
        key,
        `Coordonnees hors limites. Max autorise: X ${maxX}, Y ${maxY}, Z ${maxZ}.`
      );
      return;
    }

    const placements = this.getPlacementsForKey(key);
    const candidate: CargoCubePlacement = {
      id: this.nextCubeId(),
      x,
      y,
      z,
    };
    if (this.overlapsAny(placements, candidate)) {
      this.setPlannerMessage(key, 'Espace deja occupe par un autre cube 2x2x2.');
      return;
    }

    placements.push(candidate);
    this.sortPlacements(placements);
    this.cubePlacementsByGrid.set(key, placements);
    this.setPlannerMessage(key, '');
  }

  autoPlaceCube(sheetShipId: string, cargoGridIndex: number, cargoGrid: MiningSheetShipCargoGrid): void {
    const key = this.gridPlannerKey(sheetShipId, cargoGridIndex, cargoGrid);
    if (!this.canHostCubes(cargoGrid)) {
      this.setPlannerMessage(key, 'Cette grille est trop petite pour un cube 2x2x2.');
      return;
    }

    const placements = this.getPlacementsForKey(key);
    const maxX = this.maxCubeOriginX(cargoGrid);
    const maxY = this.maxCubeOriginY(cargoGrid);
    const maxZ = this.maxCubeOriginZ(cargoGrid);

    for (let z = 0; z <= maxZ; z += 1) {
      for (let y = 0; y <= maxY; y += 1) {
        for (let x = 0; x <= maxX; x += 1) {
          const candidate: CargoCubePlacement = {
            id: '',
            x,
            y,
            z,
          };
          if (this.overlapsAny(placements, candidate)) {
            continue;
          }
          candidate.id = this.nextCubeId();
          placements.push(candidate);
          this.sortPlacements(placements);
          this.cubePlacementsByGrid.set(key, placements);
          this.setPlannerMessage(key, '');
          return;
        }
      }
    }

    this.setPlannerMessage(key, 'Plus aucune place disponible pour un cube 2x2x2.');
  }

  removeCube(
    sheetShipId: string,
    cargoGridIndex: number,
    cargoGrid: MiningSheetShipCargoGrid,
    cubeId: string
  ): void {
    const key = this.gridPlannerKey(sheetShipId, cargoGridIndex, cargoGrid);
    const placements = this.getPlacementsForKey(key).filter((cube) => cube.id !== cubeId);
    this.cubePlacementsByGrid.set(key, placements);
    this.setPlannerMessage(key, '');
  }

  clearCubes(sheetShipId: string, cargoGridIndex: number, cargoGrid: MiningSheetShipCargoGrid): void {
    const key = this.gridPlannerKey(sheetShipId, cargoGridIndex, cargoGrid);
    this.cubePlacementsByGrid.set(key, []);
    this.setPlannerMessage(key, '');
  }

  cubePlacements(
    sheetShipId: string,
    cargoGridIndex: number,
    cargoGrid: MiningSheetShipCargoGrid
  ): CargoCubePlacement[] {
    const key = this.gridPlannerKey(sheetShipId, cargoGridIndex, cargoGrid);
    return this.getPlacementsForKey(key);
  }

  plannerMessage(
    sheetShipId: string,
    cargoGridIndex: number,
    cargoGrid: MiningSheetShipCargoGrid
  ): string {
    const key = this.gridPlannerKey(sheetShipId, cargoGridIndex, cargoGrid);
    return this.plannerMessageByGrid.get(key) ?? '';
  }

  placedCubeCount(
    sheetShipId: string,
    cargoGridIndex: number,
    cargoGrid: MiningSheetShipCargoGrid
  ): number {
    return this.cubePlacements(sheetShipId, cargoGridIndex, cargoGrid).length;
  }

  usedSlots(
    sheetShipId: string,
    cargoGridIndex: number,
    cargoGrid: MiningSheetShipCargoGrid
  ): number {
    return this.placedCubeCount(sheetShipId, cargoGridIndex, cargoGrid) * MiningSheetsLogisticsComponent.CUBE_SLOT_COUNT;
  }

  fillPercent(
    sheetShipId: string,
    cargoGridIndex: number,
    cargoGrid: MiningSheetShipCargoGrid
  ): number {
    const slotCount = Math.max(1, Number(cargoGrid.slotCount) || 1);
    const used = this.usedSlots(sheetShipId, cargoGridIndex, cargoGrid);
    return Math.min(100, Math.round((used / slotCount) * 100));
  }

  maxCubeOriginX(cargoGrid: MiningSheetShipCargoGrid): number {
    return Math.max(0, this.normalizeDimension(cargoGrid.sizeX) - MiningSheetsLogisticsComponent.CUBE_SIZE);
  }

  maxCubeOriginY(cargoGrid: MiningSheetShipCargoGrid): number {
    return Math.max(0, this.normalizeDimension(cargoGrid.sizeY) - MiningSheetsLogisticsComponent.CUBE_SIZE);
  }

  maxCubeOriginZ(cargoGrid: MiningSheetShipCargoGrid): number {
    return Math.max(0, this.normalizeDimension(cargoGrid.sizeZ) - MiningSheetsLogisticsComponent.CUBE_SIZE);
  }

  canHostCubes(cargoGrid: MiningSheetShipCargoGrid): boolean {
    return this.normalizeDimension(cargoGrid.sizeX) >= MiningSheetsLogisticsComponent.CUBE_SIZE
      && this.normalizeDimension(cargoGrid.sizeY) >= MiningSheetsLogisticsComponent.CUBE_SIZE
      && this.normalizeDimension(cargoGrid.sizeZ) >= MiningSheetsLogisticsComponent.CUBE_SIZE;
  }

  cubeLabel(index: number): number {
    return index + 1;
  }

  previewZoomPercent(
    sheetShipId: string,
    cargoGridIndex: number,
    cargoGrid: MiningSheetShipCargoGrid
  ): number {
    const key = this.gridPlannerKey(sheetShipId, cargoGridIndex, cargoGrid);
    return Math.round(this.getCameraForKey(key).zoom * 100);
  }

  zoomPreview(
    event: WheelEvent,
    sheetShipId: string,
    cargoGridIndex: number,
    cargoGrid: MiningSheetShipCargoGrid
  ): void {
    const key = this.gridPlannerKey(sheetShipId, cargoGridIndex, cargoGrid);
    if (this.cubeDragState?.key === key) {
      event.preventDefault();
      return;
    }

    const delta = -event.deltaY * MiningSheetsLogisticsComponent.WHEEL_ZOOM_SENSITIVITY;
    this.adjustZoom(key, delta);
    event.preventDefault();
  }

  zoomInPreview(sheetShipId: string, cargoGridIndex: number, cargoGrid: MiningSheetShipCargoGrid): void {
    const key = this.gridPlannerKey(sheetShipId, cargoGridIndex, cargoGrid);
    this.adjustZoom(key, MiningSheetsLogisticsComponent.BUTTON_ZOOM_STEP);
  }

  zoomOutPreview(sheetShipId: string, cargoGridIndex: number, cargoGrid: MiningSheetShipCargoGrid): void {
    const key = this.gridPlannerKey(sheetShipId, cargoGridIndex, cargoGrid);
    this.adjustZoom(key, -MiningSheetsLogisticsComponent.BUTTON_ZOOM_STEP);
  }

  startPreviewGrab(
    event: PointerEvent,
    sheetShipId: string,
    cargoGridIndex: number,
    cargoGrid: MiningSheetShipCargoGrid,
    previewElement: HTMLElement
  ): void {
    if (event.defaultPrevented || this.cubeDragState) {
      return;
    }
    if (this.isCubePointerTarget(event.target)) {
      return;
    }
    if (this.isZoomControlPointerTarget(event.target)) {
      return;
    }
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }

    const key = this.gridPlannerKey(sheetShipId, cargoGridIndex, cargoGrid);
    const camera = this.getCameraForKey(key);
    this.previewGrabState = {
      key,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startRotateX: camera.rotateX,
      startRotateY: camera.rotateY,
    };

    previewElement.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  movePreviewGrab(
    event: PointerEvent,
    sheetShipId: string,
    cargoGridIndex: number,
    cargoGrid: MiningSheetShipCargoGrid
  ): void {
    const key = this.gridPlannerKey(sheetShipId, cargoGridIndex, cargoGrid);
    if (!this.previewGrabState || this.previewGrabState.key !== key || this.previewGrabState.pointerId !== event.pointerId) {
      return;
    }
    if (this.cubeDragState?.key === key) {
      return;
    }

    const deltaX = event.clientX - this.previewGrabState.startClientX;
    const deltaY = event.clientY - this.previewGrabState.startClientY;
    const nextRotateY = this.previewGrabState.startRotateY + deltaX * MiningSheetsLogisticsComponent.DRAG_ROTATE_SENSITIVITY;
    const nextRotateX = this.previewGrabState.startRotateX - deltaY * MiningSheetsLogisticsComponent.DRAG_ROTATE_SENSITIVITY;
    const camera = this.getCameraForKey(key);
    this.cameraByGrid.set(key, {
      rotateX: this.clamp(nextRotateX, -88, 88),
      rotateY: this.normalizeAngle(nextRotateY),
      zoom: camera.zoom,
    });
    event.preventDefault();
  }

  endPreviewGrab(
    event: PointerEvent,
    sheetShipId: string,
    cargoGridIndex: number,
    cargoGrid: MiningSheetShipCargoGrid,
    previewElement: HTMLElement
  ): void {
    const key = this.gridPlannerKey(sheetShipId, cargoGridIndex, cargoGrid);
    if (!this.previewGrabState || this.previewGrabState.key !== key || this.previewGrabState.pointerId !== event.pointerId) {
      return;
    }

    if (previewElement.hasPointerCapture(event.pointerId)) {
      previewElement.releasePointerCapture(event.pointerId);
    }
    this.previewGrabState = null;
  }

  isPreviewBeingGrabbed(sheetShipId: string, cargoGridIndex: number, cargoGrid: MiningSheetShipCargoGrid): boolean {
    const key = this.gridPlannerKey(sheetShipId, cargoGridIndex, cargoGrid);
    return this.previewGrabState?.key === key;
  }

  startCubeGrab(
    event: PointerEvent,
    sheetShipId: string,
    cargoGridIndex: number,
    cargoGrid: MiningSheetShipCargoGrid,
    cubeId: string,
    sceneElement: HTMLElement
  ): void {
    if (!this.canEdit || this.saving) {
      return;
    }

    const key = this.gridPlannerKey(sheetShipId, cargoGridIndex, cargoGrid);
    const placements = this.getPlacementsForKey(key);
    const draggedCube = placements.find((cube) => cube.id === cubeId);
    if (!draggedCube) {
      return;
    }

    this.cubeDragState = {
      key,
      pointerId: event.pointerId,
      cubeId,
    };
    this.previewGrabState = null;
    this.cubeDragPreviewByGrid.set(key, { ...draggedCube });
    (event.currentTarget as HTMLElement | null)?.setPointerCapture(event.pointerId);
    event.stopPropagation();
    event.preventDefault();

    this.updateCubeDragPreviewFromPointer(event, sceneElement, cargoGrid);
  }

  startCubeSpawnGrab(
    event: PointerEvent,
    sheetShipId: string,
    cargoGridIndex: number,
    cargoGrid: MiningSheetShipCargoGrid,
    sceneElement: HTMLElement
  ): void {
    if (!this.canEdit || this.saving) {
      return;
    }

    const key = this.gridPlannerKey(sheetShipId, cargoGridIndex, cargoGrid);
    if (!this.canHostCubes(cargoGrid)) {
      this.setPlannerMessage(key, 'Cette grille est trop petite pour un cube 2x2x2.');
      return;
    }

    const initial = this.findFirstAvailableCoordinate(cargoGrid, this.getPlacementsForKey(key));
    if (!initial) {
      this.setPlannerMessage(key, 'Plus aucune place disponible pour un cube 2x2x2.');
      return;
    }

    this.cubeDragState = {
      key,
      pointerId: event.pointerId,
      cubeId: null,
    };
    this.previewGrabState = null;
    this.cubeDragPreviewByGrid.set(key, {
      id: '__preview__',
      x: initial.x,
      y: initial.y,
      z: initial.z,
    });
    (event.currentTarget as HTMLElement | null)?.setPointerCapture(event.pointerId);
    event.preventDefault();
    event.stopPropagation();

    this.updateCubeDragPreviewFromPointer(event, sceneElement, cargoGrid);
  }

  moveCubeGrab(
    event: PointerEvent,
    sheetShipId: string,
    cargoGridIndex: number,
    cargoGrid: MiningSheetShipCargoGrid,
    sceneElement: HTMLElement
  ): void {
    const key = this.gridPlannerKey(sheetShipId, cargoGridIndex, cargoGrid);
    if (!this.cubeDragState || this.cubeDragState.key !== key || this.cubeDragState.pointerId !== event.pointerId) {
      return;
    }
    this.updateCubeDragPreviewFromPointer(event, sceneElement, cargoGrid);
    event.preventDefault();
    event.stopPropagation();
  }

  endCubeGrab(
    event: PointerEvent,
    sheetShipId: string,
    cargoGridIndex: number,
    cargoGrid: MiningSheetShipCargoGrid
  ): void {
    const key = this.gridPlannerKey(sheetShipId, cargoGridIndex, cargoGrid);
    if (!this.cubeDragState || this.cubeDragState.key !== key || this.cubeDragState.pointerId !== event.pointerId) {
      return;
    }

    const dragState = this.cubeDragState;
    const preview = this.cubeDragPreviewByGrid.get(key);
    if (preview) {
      if (dragState.cubeId === null) {
        this.commitSpawnedCube(key, cargoGrid, preview);
      } else {
        this.commitMovedCube(key, cargoGrid, dragState.cubeId, preview);
      }
    }

    this.releaseCurrentPointerCapture(event);
    this.clearCubeDragState(key);
    event.preventDefault();
    event.stopPropagation();
  }

  cancelCubeGrab(
    event: PointerEvent,
    sheetShipId: string,
    cargoGridIndex: number,
    cargoGrid: MiningSheetShipCargoGrid
  ): void {
    const key = this.gridPlannerKey(sheetShipId, cargoGridIndex, cargoGrid);
    if (!this.cubeDragState || this.cubeDragState.key !== key || this.cubeDragState.pointerId !== event.pointerId) {
      return;
    }

    this.releaseCurrentPointerCapture(event);
    this.clearCubeDragState(key);
    event.preventDefault();
    event.stopPropagation();
  }

  cubeDragPreview(
    sheetShipId: string,
    cargoGridIndex: number,
    cargoGrid: MiningSheetShipCargoGrid
  ): CargoCubePlacement | null {
    const key = this.gridPlannerKey(sheetShipId, cargoGridIndex, cargoGrid);
    return this.cubeDragPreviewByGrid.get(key) ?? null;
  }

  isCubeDragged(
    sheetShipId: string,
    cargoGridIndex: number,
    cargoGrid: MiningSheetShipCargoGrid,
    cubeId: string
  ): boolean {
    const key = this.gridPlannerKey(sheetShipId, cargoGridIndex, cargoGrid);
    return this.cubeDragState?.key === key && this.cubeDragState.cubeId === cubeId;
  }

  private gridProjection(cargoGrid: MiningSheetShipCargoGrid): GridProjectionMetrics {
    const sizeX = this.normalizeDimension(cargoGrid.sizeX);
    const sizeY = this.normalizeDimension(cargoGrid.sizeY);
    const sizeZ = this.normalizeDimension(cargoGrid.sizeZ);
    const cell = this.computeCellSize(sizeX, sizeY, sizeZ);
    const width = sizeX * cell;
    const height = sizeZ * cell;
    const depth = sizeY * cell;
    const cubeSize = MiningSheetsLogisticsComponent.CUBE_SIZE * cell;

    return {
      sizeX,
      sizeY,
      sizeZ,
      cell,
      width,
      height,
      depth,
      cubeSize,
    };
  }

  private updateCubeDragPreviewFromPointer(
    event: PointerEvent,
    sceneElement: HTMLElement,
    cargoGrid: MiningSheetShipCargoGrid
  ): void {
    if (!this.cubeDragState) {
      return;
    }

    const key = this.cubeDragState.key;
    const placements = this.getPlacementsForKey(key);
    const dragPreview = this.resolveNearestPlacementFromPointer(
      event,
      sceneElement,
      cargoGrid,
      placements,
      key,
      this.cubeDragState.cubeId
    );
    if (!dragPreview) {
      return;
    }

    this.cubeDragPreviewByGrid.set(key, {
      id: '__preview__',
      x: dragPreview.x,
      y: dragPreview.y,
      z: dragPreview.z,
    });
  }

  private resolveNearestPlacementFromPointer(
    event: PointerEvent,
    sceneElement: HTMLElement,
    cargoGrid: MiningSheetShipCargoGrid,
    placements: CargoCubePlacement[],
    key: string,
    draggedCubeId: string | null
  ): { x: number; y: number; z: number } | null {
    const pointer = this.pointerPositionInScene(event, sceneElement);
    if (!pointer) {
      return null;
    }

    const projection = this.gridProjection(cargoGrid);
    const camera = this.getCameraForKey(key);
    const blockedPlacements = draggedCubeId === null
      ? placements
      : placements.filter((cube) => cube.id !== draggedCubeId);

    let bestCandidate: { x: number; y: number; z: number } | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    const maxX = this.maxCubeOriginX(cargoGrid);
    const maxY = this.maxCubeOriginY(cargoGrid);
    const maxZ = this.maxCubeOriginZ(cargoGrid);
    for (let z = 0; z <= maxZ; z += 1) {
      for (let y = 0; y <= maxY; y += 1) {
        for (let x = 0; x <= maxX; x += 1) {
          const candidate: CargoCubePlacement = {
            id: '__candidate__',
            x,
            y,
            z,
          };
          if (this.overlapsAny(blockedPlacements, candidate)) {
            continue;
          }

          const center = this.projectedCubeCenter(candidate, projection, camera);
          const dx = pointer.x - center.x;
          const dy = pointer.y - center.y;
          const distance = dx * dx + dy * dy;
          if (distance < bestDistance) {
            bestDistance = distance;
            bestCandidate = { x, y, z };
          }
        }
      }
    }

    return bestCandidate;
  }

  private pointerPositionInScene(event: PointerEvent, sceneElement: HTMLElement): { x: number; y: number } | null {
    const bounds = sceneElement.getBoundingClientRect();
    if (
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom
    ) {
      return null;
    }

    return {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    };
  }

  private projectedCubeCenter(
    cube: CargoCubePlacement,
    projection: GridProjectionMetrics,
    camera: GridCameraState
  ): { x: number; y: number } {
    const point = {
      x: (cube.x + MiningSheetsLogisticsComponent.CUBE_SIZE / 2) * projection.cell,
      y: projection.height - (cube.z + MiningSheetsLogisticsComponent.CUBE_SIZE / 2) * projection.cell,
      z: -(cube.y + MiningSheetsLogisticsComponent.CUBE_SIZE / 2) * projection.cell,
    };
    return this.projectWorldPoint(point, projection, camera);
  }

  private projectWorldPoint(
    point: { x: number; y: number; z: number },
    projection: GridProjectionMetrics,
    camera: GridCameraState
  ): { x: number; y: number } {
    const centerX = projection.width / 2;
    const centerY = projection.height / 2;
    const centerZ = -projection.depth / 2;

    const localX = point.x - centerX;
    const localY = point.y - centerY;
    const localZ = point.z - centerZ;

    const rotateY = camera.rotateY * (Math.PI / 180);
    const rotateX = camera.rotateX * (Math.PI / 180);

    const cosY = Math.cos(rotateY);
    const sinY = Math.sin(rotateY);
    const cosX = Math.cos(rotateX);
    const sinX = Math.sin(rotateX);

    const xAfterY = localX * cosY + localZ * sinY;
    const zAfterY = -localX * sinY + localZ * cosY;
    const yAfterX = localY * cosX - zAfterY * sinX;
    const zAfterX = localY * sinX + zAfterY * cosX;

    const orbitZ = this.zoomToOrbitZ(camera.zoom);
    const zForPerspective = zAfterX - orbitZ;
    const perspectiveFactor = 1 / Math.max(0.2, 1 + zForPerspective / MiningSheetsLogisticsComponent.PERSPECTIVE_PX);
    const projectedX = centerX + xAfterY * perspectiveFactor;
    const projectedY = centerY + yAfterX * perspectiveFactor;
    return {
      x: projectedX,
      y: projectedY,
    };
  }

  private commitMovedCube(
    key: string,
    cargoGrid: MiningSheetShipCargoGrid,
    cubeId: string,
    preview: CargoCubePlacement
  ): void {
    const placements = [...this.getPlacementsForKey(key)];
    const index = placements.findIndex((cube) => cube.id === cubeId);
    if (index === -1) {
      return;
    }

    const next = {
      id: cubeId,
      x: preview.x,
      y: preview.y,
      z: preview.z,
    };
    if (!this.canFitPlacement(cargoGrid, next)) {
      this.setPlannerMessage(key, 'Position de depot invalide.');
      return;
    }

    const blocked = placements.filter((cube) => cube.id !== cubeId);
    if (this.overlapsAny(blocked, next)) {
      this.setPlannerMessage(key, 'Espace deja occupe pour ce depot.');
      return;
    }

    placements[index] = {
      ...placements[index],
      x: next.x,
      y: next.y,
      z: next.z,
    };
    this.sortPlacements(placements);
    this.cubePlacementsByGrid.set(key, placements);
    this.setPlannerMessage(key, '');
  }

  private commitSpawnedCube(key: string, cargoGrid: MiningSheetShipCargoGrid, preview: CargoCubePlacement): void {
    const placements = [...this.getPlacementsForKey(key)];
    const candidate: CargoCubePlacement = {
      id: this.nextCubeId(),
      x: preview.x,
      y: preview.y,
      z: preview.z,
    };

    if (!this.canFitPlacement(cargoGrid, candidate)) {
      this.setPlannerMessage(key, 'Position de depot invalide.');
      return;
    }

    if (this.overlapsAny(placements, candidate)) {
      this.setPlannerMessage(key, 'Espace deja occupe pour ce depot.');
      return;
    }

    placements.push(candidate);
    this.sortPlacements(placements);
    this.cubePlacementsByGrid.set(key, placements);
    this.setPlannerMessage(key, '');
  }

  private canFitPlacement(cargoGrid: MiningSheetShipCargoGrid, placement: CargoCubePlacement): boolean {
    return placement.x >= 0
      && placement.y >= 0
      && placement.z >= 0
      && placement.x <= this.maxCubeOriginX(cargoGrid)
      && placement.y <= this.maxCubeOriginY(cargoGrid)
      && placement.z <= this.maxCubeOriginZ(cargoGrid);
  }

  private findFirstAvailableCoordinate(
    cargoGrid: MiningSheetShipCargoGrid,
    placements: CargoCubePlacement[]
  ): { x: number; y: number; z: number } | null {
    const maxX = this.maxCubeOriginX(cargoGrid);
    const maxY = this.maxCubeOriginY(cargoGrid);
    const maxZ = this.maxCubeOriginZ(cargoGrid);
    for (let z = 0; z <= maxZ; z += 1) {
      for (let y = 0; y <= maxY; y += 1) {
        for (let x = 0; x <= maxX; x += 1) {
          const candidate: CargoCubePlacement = {
            id: '__candidate__',
            x,
            y,
            z,
          };
          if (this.overlapsAny(placements, candidate)) {
            continue;
          }
          return { x, y, z };
        }
      }
    }
    return null;
  }

  private releaseCurrentPointerCapture(event: PointerEvent): void {
    const currentTarget = event.currentTarget as HTMLElement | null;
    if (!currentTarget) {
      return;
    }
    if (currentTarget.hasPointerCapture(event.pointerId)) {
      currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  private clearCubeDragState(key: string): void {
    this.cubeDragState = null;
    this.cubeDragPreviewByGrid.delete(key);
  }

  private adjustZoom(key: string, delta: number): void {
    if (!Number.isFinite(delta) || delta === 0) {
      return;
    }

    const camera = this.getCameraForKey(key);
    const nextZoom = this.clamp(
      camera.zoom + delta,
      MiningSheetsLogisticsComponent.MIN_ZOOM,
      MiningSheetsLogisticsComponent.MAX_ZOOM
    );
    if (nextZoom === camera.zoom) {
      return;
    }

    this.cameraByGrid.set(key, {
      rotateX: camera.rotateX,
      rotateY: camera.rotateY,
      zoom: nextZoom,
    });
  }

  private zoomToOrbitZ(zoom: number): number {
    const safeZoom = this.clamp(
      zoom,
      MiningSheetsLogisticsComponent.MIN_ZOOM,
      MiningSheetsLogisticsComponent.MAX_ZOOM
    );
    return MiningSheetsLogisticsComponent.PERSPECTIVE_PX * (1 - 1 / safeZoom);
  }

  private getCameraForKey(key: string): GridCameraState {
    const existing = this.cameraByGrid.get(key);
    if (existing) {
      return existing;
    }

    const initial: GridCameraState = {
      rotateX: MiningSheetsLogisticsComponent.DEFAULT_ROTATE_X,
      rotateY: MiningSheetsLogisticsComponent.DEFAULT_ROTATE_Y,
      zoom: MiningSheetsLogisticsComponent.DEFAULT_ZOOM,
    };
    this.cameraByGrid.set(key, initial);
    return initial;
  }

  private normalizeAngle(value: number): number {
    let angle = value;
    while (angle > 180) {
      angle -= 360;
    }
    while (angle < -180) {
      angle += 360;
    }
    return angle;
  }

  private isCubePointerTarget(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) {
      return false;
    }
    return !!target.closest('.cube-block');
  }

  private isZoomControlPointerTarget(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) {
      return false;
    }
    return !!target.closest('.preview-zoom-controls');
  }

  private normalizeDimension(value: number): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 1;
    }
    return Math.round(parsed);
  }

  private computeCellSize(x: number, y: number, z: number): number {
    const visualWidthSlots = x + y * 0.75;
    const visualHeightSlots = z + y * 0.65;
    const maxCellByWidth = MiningSheetsLogisticsComponent.MAX_PREVIEW_WIDTH_PX / Math.max(1, visualWidthSlots);
    const maxCellByHeight = MiningSheetsLogisticsComponent.MAX_PREVIEW_HEIGHT_PX / Math.max(1, visualHeightSlots);
    return this.clamp(
      Math.min(maxCellByWidth, maxCellByHeight, MiningSheetsLogisticsComponent.MAX_CELL_PX),
      MiningSheetsLogisticsComponent.MIN_CELL_PX,
      MiningSheetsLogisticsComponent.MAX_CELL_PX
    );
  }

  private clamp(value: number, min: number, max: number): number {
    if (!Number.isFinite(value)) {
      return min;
    }
    if (value < min) {
      return min;
    }
    if (value > max) {
      return max;
    }
    return value;
  }

  private gridPlannerKey(sheetShipId: string, cargoGridIndex: number, cargoGrid: MiningSheetShipCargoGrid): string {
    return `${sheetShipId}:${cargoGridIndex}:${this.normalizeDimension(cargoGrid.sizeX)}x${this.normalizeDimension(cargoGrid.sizeY)}x${this.normalizeDimension(cargoGrid.sizeZ)}`;
  }

  private parseCoordinate(rawValue: unknown): number | null {
    const value = Number(rawValue);
    if (!Number.isInteger(value) || value < 0) {
      return null;
    }
    return value;
  }

  private getPlacementsForKey(key: string): CargoCubePlacement[] {
    return this.cubePlacementsByGrid.get(key) ?? [];
  }

  private overlapsAny(placements: CargoCubePlacement[], candidate: CargoCubePlacement): boolean {
    return placements.some((existing) => this.cubesOverlap(existing, candidate));
  }

  private cubesOverlap(left: CargoCubePlacement, right: CargoCubePlacement): boolean {
    const size = MiningSheetsLogisticsComponent.CUBE_SIZE;
    const overlapX = left.x < right.x + size && right.x < left.x + size;
    const overlapY = left.y < right.y + size && right.y < left.y + size;
    const overlapZ = left.z < right.z + size && right.z < left.z + size;
    return overlapX && overlapY && overlapZ;
  }

  private sortPlacements(placements: CargoCubePlacement[]): void {
    placements.sort((left, right) => {
      const depthLeft = left.x + left.y + left.z;
      const depthRight = right.x + right.y + right.z;
      if (depthLeft !== depthRight) {
        return depthLeft - depthRight;
      }
      if (left.z !== right.z) {
        return left.z - right.z;
      }
      if (left.y !== right.y) {
        return left.y - right.y;
      }
      return left.x - right.x;
    });
  }

  private setPlannerMessage(key: string, message: string): void {
    if (!message) {
      this.plannerMessageByGrid.delete(key);
      return;
    }
    this.plannerMessageByGrid.set(key, message);
  }

  private nextCubeId(): string {
    this.cubeSequence += 1;
    return `cube-${this.cubeSequence}`;
  }
}
