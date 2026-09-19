import { Component, OnInit, ChangeDetectionStrategy, HostListener, ElementRef, Optional } from '@angular/core';
import { animate, style, transition, trigger, group, query, stagger } from '@angular/animations';
import { A11yModule } from '@angular/cdk/a11y';
import { AsyncStateComponent } from '../../../shared/async-state/async-state.component';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, firstValueFrom } from 'rxjs';
import { WikeloService } from '../../../core/services/wikelo/wikelo.service';
import { WikeloEquipment } from '../../../model/wikelo-equipment.model';
import { WikeloShip } from '../../../model/wikelo-ship.model';
import { UserService } from '../../../core/services/user/user.service';
import { ShipService } from '../../../core/services/ship/ship.service';
import { Ship } from '../../../model/ship.model';
import { GoalService } from '../../../core/services/goal/goal.service';
import { User } from '../../../model/user.model';
import { Goal } from '../../../model/goal.model';
import { AuthService } from '../../../core/services/auth/auth.service';
import { DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { utilityRouteFor } from '../utility-route-context';

type EquipmentView = 'weapons' | 'armor' | 'other';
type WikeloView = 'ships' | EquipmentView;
type EquipmentCharacteristic = { label: string; value: string; tone: 'general' | 'protection' | 'radiation' | 'temperature' | 'capacity' | 'weapon' };
type EquipmentPresentation = { characteristics: EquipmentCharacteristic[]; paragraphs: string[] };

@Component({
  standalone: true,
  selector: 'app-wikelo',
  imports: [FormsModule, RouterLink, A11yModule, AsyncStateComponent],
  templateUrl: './wikelo.component.html',
  styleUrl: './wikelo.component.css',
  changeDetection: ChangeDetectionStrategy.Eager,
  animations: [
    trigger('detailsExpand', [
      transition(':enter', [
        style({ height: '0px', opacity: 0 }),
        query(':scope > *', style({ opacity: 0, transform: 'translateY(14px)' }), { optional: true }),
        group([
          animate('420ms cubic-bezier(0.22, 1, 0.36, 1)', style({ height: '*', opacity: 1 })),
          query(':scope > *', stagger(45, animate('300ms 80ms cubic-bezier(0.22, 1, 0.36, 1)', style({ opacity: 1, transform: 'translateY(0)' }))), { optional: true })
        ])
      ]),
      transition(':leave', [
        style({ height: '*', opacity: 1, transform: 'translateY(0)' }),
        animate('220ms cubic-bezier(0.4, 0, 1, 1)', style({ height: '0px', opacity: 0, transform: 'translateY(-4px)' }))
      ])
    ])
  ]
})
export class WikeloComponent implements OnInit {
  private readonly roleLabels: Record<string, string> = {
      'MEDIUM FREIGHT': 'Transport de fret moyen', 'MEDIUM FREIGHTER': 'Transport de fret moyen',
      'MEDIUM HAULER': 'Transport de fret moyen', 'LIGHT FREIGHT': 'Transport de fret léger',
      'HEAVY FREIGHT': 'Transport de fret lourd', 'ARMORED FREIGHT': 'Transport de fret blindé',
      'FREIGHT': 'Transport de fret', 'CARGO': 'Transport de fret', 'CARGO LOADER': 'Chargement de fret',
      'LIGHT FIGHTER': 'Chasseur léger', 'MEDIUM FIGHTER': 'Chasseur moyen', 'HEAVY FIGHTER': 'Chasseur lourd',
      'STEALTH FIGHTER': 'Chasseur furtif', 'SNUB FIGHTER': 'Chasseur auxiliaire',
      'HEAVY BOMBER': 'Bombardier lourd', 'BOMBER': 'Bombardier', 'STEALTH BOMBER': 'Bombardier furtif',
      'GUN SHIP': 'Canonnière', 'GUNSHIP': 'Canonnière', 'GUNBOAT': 'Canonnière',
      'HEAVY GUN SHIP': 'Canonnière lourde', 'HEAVY GUNSHIP': 'Canonnière lourde',
      'MODULAR GUNSHIP': 'Canonnière modulaire', 'MINING': 'Minage', 'HEAVY MINING': 'Minage lourd',
      'PROSPECTING': 'Prospection', 'REFINING': 'Raffinage', 'REFINERY': 'Raffinerie',
      'SALVAGE': 'Récupération', 'LIGHT SALVAGE': 'Récupération légère',
      'MEDIUM SALVAGE': 'Récupération moyenne', 'HEAVY SALVAGE': 'Récupération lourde',
      'MEDICAL': 'Médical', 'AMBULANCE': 'Ambulance', 'PATROL': 'Patrouille',
      'EXPEDITION': 'Expédition', 'EXPLORATION': 'Exploration', 'RECON': 'Reconnaissance',
      'RECONNAISSANCE': 'Reconnaissance', 'INTELLIGENCE': 'Renseignement',
      'PATHFINDER': 'Éclaireur', 'STARTER': 'Débutant', 'RACING': 'Course', 'TOURING': 'Tourisme',
      'LUXURY': 'Luxe', 'LUXURY TOURING': 'Tourisme de luxe', 'LUXURY TRANSPORT': 'Transport de luxe',
      'EXPLORER': 'Exploration', 'PASSENGER': 'Transport de passagers', 'TRANSPORTER': 'Transport',
      'MILITARY TRANSPORT': 'Transport militaire', 'MILITARY': 'Militaire',
      'LIGHT REFUELER': 'Ravitaillement léger', 'HEAVY REFUELLING': 'Ravitaillement lourd',
      'MEDIUM REFUEL': 'Ravitaillement moyen', 'MEDIUM REPAIR': 'Réparation moyenne',
      'HEAVY REPAIR': 'Réparation lourde', 'LIGHT SCIENCE': 'Recherche scientifique légère',
      'HEAVY SCIENCE': 'Recherche scientifique lourde', 'MEDIUM DATA': 'Transport de données',
      'MEDIUM CARGO': 'Transport de fret moyen', 'HEAVY CONSTRUCTION': 'Construction lourde',
      'LIGHT CARRIER': 'Porte-vaisseaux léger', 'SNUB CARRIER': 'Porte-vaisseaux auxiliaires',
      'MULTI-ROLE': 'Polyvalent', 'GENERALIST': 'Polyvalent', 'MODULAR': 'Modulaire',
      'ASSAULT': 'Assaut', 'BOARDING': 'Abordage', 'DROPSHIP': 'Transport de troupes',
      'COMBAT SUPPORT': 'Soutien au combat', 'COMBINED ARMS PLATFORM': 'Plateforme interarmes',
      'ANTI-AIR': 'Défense antiaérienne', 'ANTI-AIRCRAFT': 'Défense antiaérienne',
      'INTERDICTOR': 'Interception', 'INTERDICTION': 'Interception', 'STEALTH': 'Furtivité',
      'MINELAYER': 'Mouilleur de mines', 'INDUSTRIAL': 'Industrie', 'RECOVERY': 'Récupération',
      'REPORTING': 'Reportage', 'FRIGATE': 'Frégate', 'DESTROYER': 'Destroyer'
    };

  ships: WikeloShip[] = [];
  equipment: WikeloEquipment[] = [];
  selectedView: WikeloView = 'ships';
  private readonly equipmentPresentations = new WeakMap<WikeloEquipment, {description: string | null; manufacturer: string | null; presentation: EquipmentPresentation}>();
  expandedEquipmentId: number | null = null;
  equipmentLoading = false;
  equipmentLoaded = false;
  equipmentError = '';
  failedImages = new Set<string>();
  catalogUnavailable = false;
  catalogShips: Ship[] = [];
  users: User[] = [];
  searchTerm = '';
  expandedShipName: string | null = null;
  selectedGoalShip: WikeloShip | null = null;
  isGoalModalOpen = false;
  goalAssignUserInput = '';
  goalAssignUserId: string | null = null;
  goalCreateStatus = '';
  isCreatingGoal = false;
  isLoading = true;
  errorMessage = '';
  canCreateGoals = false;

  constructor(
    private wikeloService: WikeloService,
    private userService: UserService,
    private shipService: ShipService,
    private goalService: GoalService,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private destroyRef: DestroyRef,
    @Optional() private elementRef: ElementRef<HTMLElement> | null = null
  ) {
    destroyRef.onDestroy(() => { if (this.scrollFrame !== null) cancelAnimationFrame(this.scrollFrame); });
  }

  private scrollFrame: number | null = null;
  get reducedMotion(): boolean {
    return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  }

  private revealExpandedCard(): void {
    if (!this.elementRef || typeof requestAnimationFrame === 'undefined') return;
    if (this.scrollFrame !== null) cancelAnimationFrame(this.scrollFrame);
    this.scrollFrame = requestAnimationFrame(() => {
      this.scrollFrame = null;
      this.elementRef?.nativeElement.querySelector<HTMLElement>('.offer-expanded')
        ?.scrollIntoView({ behavior: this.reducedMotion ? 'instant' : 'smooth', block: 'start' });
    });
  }

  ngOnInit(): void {
    this.resolvePermissions();
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      this.searchTerm = params.get('q') ?? '';
      this.selectedView = this.resolveView(params.get('view'));
      if (this.selectedView !== 'ships' && !this.equipmentLoaded && !this.equipmentLoading) this.loadEquipment();
    });
    this.loadCatalogShips();
    this.loadShips();
  }

  get backToMenuLink(): string {
    return utilityRouteFor(this.router.url);
  }

  setView(view: WikeloView | 'equipment'): void {
    this.selectedView = this.resolveView(view);
    this.expandedShipName = null;
    this.expandedEquipmentId = null;
    void this.router.navigate([], { relativeTo: this.route,
      queryParams: { view: this.selectedView === 'ships' ? null : this.selectedView }, queryParamsHandling: 'merge' });
    if (this.selectedView !== 'ships' && !this.equipmentLoaded && !this.equipmentLoading) this.loadEquipment();
  }

  loadEquipment(): void {
    this.equipmentError = '';
    this.equipmentLoading = true;
    this.wikeloService.getEquipment().pipe(finalize(() => this.equipmentLoading = false)).subscribe({
      next: response => { this.equipment = response.data ?? []; this.equipmentLoaded = true; },
      error: () => { this.equipmentError = 'Impossible de charger les équipements.'; }
    });
  }

  private resolveView(value: string | null): WikeloView {
    if (value === 'equipment' || value === 'weapons') return 'weapons';
    if (value === 'armor' || value === 'other') return value;
    return 'ships';
  }

  get equipmentCategoryLabel(): string {
    return this.selectedView === 'armor' ? 'Armures' : this.selectedView === 'other' ? 'Autres équipements' : 'Armes';
  }

  get hasOtherEquipment(): boolean { return this.equipment.some(item => item.family === 'ITEM'); }

  get categoryEquipment(): WikeloEquipment[] {
    const family = this.selectedView === 'armor' ? 'ARMOR' : this.selectedView === 'other' ? 'ITEM' : 'FPS_WEAPON';
    return this.equipment.filter(item => item.family === family);
  }

  get filteredEquipment(): WikeloEquipment[] {
    const search = this.normalizeName(this.searchTerm);
    return this.categoryEquipment.filter(item => !search || [item.name, item.manufacturer ?? '', item.description ?? '',
      ...(item.recipes ?? []).flatMap(recipe => [recipe.name, ...recipe.ingredients.map(ingredient => ingredient.name),
        ...recipe.rewards.map(reward => reward.name)])]
      .some(value => this.normalizeName(value).includes(search)))
      .sort((left, right) => {
        const availability = Number((right.recipes?.length ?? 0) > 0) - Number((left.recipes?.length ?? 0) > 0);
        return availability || left.name.localeCompare(right.name, 'fr', {sensitivity: 'base'});
      });
  }

  equipmentPresentation(item: WikeloEquipment): EquipmentPresentation {
    const cached = this.equipmentPresentations.get(item);
    if (cached?.description === item.description && cached.manufacturer === item.manufacturer) return cached.presentation;
    const fields: Record<string, {label: string; tone: EquipmentCharacteristic['tone']}> = {
      typedarticle: {label: 'Type', tone: 'general'}, typeditem: {label: 'Type', tone: 'general'}, typedobjet: {label: 'Type', tone: 'general'},
      typedarme: {label: 'Type', tone: 'general'}, type: {label: 'Type', tone: 'general'},
      fabricant: {label: 'Fabricant', tone: 'general'}, classe: {label: 'Classe', tone: 'general'},
      reductiondesdegats: {label: 'Réduction des dégâts', tone: 'protection'},
      temperaturedefonctionnement: {label: 'Température', tone: 'temperature'},
      indicethermique: {label: 'Température', tone: 'temperature'}, indicetemporaire: {label: 'Température', tone: 'temperature'},
      protectioncontrelesradiations: {label: 'Protection aux radiations', tone: 'radiation'},
      neutralisationdesradiations: {label: 'Neutralisation des radiations', tone: 'radiation'},
      capacitedecharge: {label: 'Capacité de charge', tone: 'capacity'}, capacitedetransport: {label: 'Capacité de transport', tone: 'capacity'},
      tauxdabsorptiondesradiations: {label: 'Absorption des radiations', tone: 'radiation'},
      tauxdedecontamination: {label: 'Décontamination', tone: 'radiation'},
      compatibilite: {label: 'Compatibilité', tone: 'capacity'},
      compatibilitedusacados: {label: 'Compatibilité du sac à dos', tone: 'capacity'},
      compatibleaveclessacsados: {label: 'Sac à dos compatible', tone: 'capacity'},
      compatibleaveclesacsados: {label: 'Sac à dos compatible', tone: 'capacity'},
      compatibleaveclesacados: {label: 'Sac à dos compatible', tone: 'capacity'},
      capaciteduchargeur: {label: 'Chargeur', tone: 'capacity'}, tailleduchargeur: {label: 'Chargeur', tone: 'capacity'},
      capacitedelabatterie: {label: 'Batterie', tone: 'capacity'},
      cadencedetir: {label: 'Cadence de tir', tone: 'weapon'}, porteeeffective: {label: 'Portée effective', tone: 'weapon'},
      degats: {label: 'Dégâts', tone: 'weapon'}, poids: {label: 'Poids', tone: 'general'}
    };
    const characteristics: EquipmentCharacteristic[] = [];
    const paragraphs: string[] = [];
    let paragraph: string[] = [];
    const flushParagraph = () => { if (paragraph.length) paragraphs.push(paragraph.join(' ')); paragraph = []; };
    for (const rawLine of (item.description ?? '').split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line) { flushParagraph(); continue; }
      const pair = line.match(/^([^:]{1,80})\s*:\s*(.+)$/);
      const key = pair ? this.normalizeName(pair[1]) : '';
      const field = fields[key];
      if (pair && field) {
        flushParagraph();
        // The manufacturer already appears beside the title when supplied separately.
        if (key !== 'fabricant' || !item.manufacturer) characteristics.push({...field, value: pair[2].trim()});
      } else paragraph.push(line);
    }
    flushParagraph();
    const presentation = {characteristics, paragraphs};
    this.equipmentPresentations.set(item, {description: item.description, manufacturer: item.manufacturer, presentation});
    return presentation;
  }

  equipmentReputation(value: string | null): string | null {
    if (!value?.trim()) return null;
    return value.trim().toLowerCase() === 'none' ? 'Aucune' : value.trim();
  }

  equipmentImage(item: WikeloEquipment): string | null {
    return item.imageUrl && !this.failedImages.has(item.imageUrl) ? item.imageUrl : null;
  }

  toggleEquipment(id: number): void {
    this.expandedEquipmentId = this.expandedEquipmentId === id ? null : id;
    if (this.expandedEquipmentId !== null) this.revealExpandedCard();
  }

  onEquipmentClick(event: MouseEvent, id: number): void {
    const target = event.target;
    if (target instanceof Element && target.closest('button, a, input, select, textarea, [role="button"]')) return;
    if (typeof window !== 'undefined' && window.getSelection()?.toString()) return;
    this.toggleEquipment(id);
  }

  get filteredShips(): WikeloShip[] {
    const normalizedSearch = this.normalizeName(this.searchTerm);
    if (!normalizedSearch) return this.ships;

    return this.ships.filter((ship) => {
      const name = this.normalizeName(ship.shipName);
      const components = this.normalizeName(ship.componentsText ?? '');
      const cost = this.normalizeName(ship.costText ?? '');
      return name.includes(normalizedSearch) || components.includes(normalizedSearch) || cost.includes(normalizedSearch);
    });
  }

  getShipImage(shipName: string): string | null {
    const image = this.getCatalogShip(shipName)?.imageUrl;
    return image && !image.includes('/catalog-fallback.svg') && !this.failedImages.has(image) ? image : null;
  }

  getCatalogShip(shipName: string): Ship | null {
    const target = this.normalizeName(shipName);
    const exact = this.catalogShips.find(ship => this.normalizeName(ship.name) === target);
    if (exact) return this.presentCatalogShip(exact);

    // Explicit short names observed in Wikelo versus canonical names in /api/ships.
    // Never discard variant suffixes such as CL/ES, Inferno/Ion or Wikelo Special.
    const aliases: Record<string, string> = {
      a2hercules: 'A2 Hercules Starlifter',
      aresinferno: 'Ares Star Fighter Inferno',
      aresion: 'Ares Star Fighter Ion',
      zeuscl: 'Zeus Mk II CL',
      zeuses: 'Zeus Mk II ES',
      f8clightningmilitary: 'F8C Lightning Wikelo War Special',
      f8clightningstealth: 'F8C Lightning Wikelo Sneak Special',
      l21wolfmilitarygear: 'L-21 Wolf Wikelo War Special',
      l21wolfstealth: 'L-21 Wolf Wikelo Sneak Special',
      miraiguardianmx: 'Guardian MX Wikelo War Special',
      rsimeteor: 'Meteor Wikelo Sneak Special',
      superhornetmkii: 'F7C-M Super Hornet Mk II'
    };
    const canonicalTarget = this.normalizeName(aliases[target] ?? shipName);
    const matches = this.catalogShips.filter(ship => {
      const canonicalName = this.normalizeName(ship.name);
      if (canonicalName === canonicalTarget) return true;
      const manufacturer = this.normalizeName(ship.brand?.name ?? '');
      return !!manufacturer && canonicalName.startsWith(manufacturer)
        && canonicalName.slice(manufacturer.length) === canonicalTarget;
    });
    return matches.length === 1 ? this.presentCatalogShip(matches[0]) : null;
  }

  private presentCatalogShip(ship: Ship): Ship {

    const sizes: Record<string, string> = {
      small: 'Petit', medium: 'Moyen', large: 'Grand', capital: 'Capital', snub: 'Auxiliaire', vehicle: 'Véhicule'
    };
    return {
      ...ship,
      focus: ship.focus?.split('/').map(role => this.roleLabels[role.trim().toUpperCase()] ?? role.trim()).join(' / '),
      size: ship.size ? sizes[ship.size.toLowerCase()] ?? ship.size : ship.size
    };
  }

  onCardClick(event: MouseEvent, shipName: string): void {
    const target = event.target;
    if (target instanceof Element && target.closest('button, a, input, select, textarea, [role="button"]')) return;
    if (typeof window !== 'undefined' && window.getSelection()?.toString()) return;
    this.toggleDetails(shipName);
  }

  @HostListener('document:click', ['$event'])
  closeOnOutsideClick(event: MouseEvent): void {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest('.offer, .goal-modal, button, a, input, select, textarea')) return;
    if (!this.isGoalModalOpen) { this.expandedShipName = null; this.expandedEquipmentId = null; }
  }

  @HostListener('document:keydown.escape')
  closeDetailsOnEscape(): void {
    if (!this.isGoalModalOpen) { this.expandedShipName = null; this.expandedEquipmentId = null; }
  }

  ingredientDetails(ship: WikeloShip): Array<{ name: string; quantity: string | null }> {
    return this.ingredients(ship).map(value => this.itemDetails(value));
  }

  equipmentDetails(ship: WikeloShip): Array<{ category: string; name: string; quantity: string | null; grade: string | null }> {
    const labels: Record<string, string> = {
      'power plant': 'Centrale énergétique', shield: 'Bouclier', 'quantum drive': 'Moteur quantique',
      cooler: 'Refroidisseur', weapon: 'Arme', weapons: 'Armes', missile: 'Missile', missiles: 'Missiles',
      'missile rack': 'Support de missiles', turret: 'Tourelle', 'mining laser': 'Laser de minage'
    };
    return this.toParts(ship.componentsText).map(value => {
      const separator = value.indexOf(':');
      const rawCategory = separator > 0 ? value.slice(0, separator).trim() : '';
      const item = this.itemDetails(separator > 0 ? value.slice(separator + 1).trim() : value);
      const grade = item.name.match(/\s*\(([^()]*)\)\s*$/);
      return { ...item, category: labels[rawCategory.toLowerCase()] ?? rawCategory,
        name: grade ? item.name.slice(0, grade.index).trim() : item.name,
        grade: grade ? grade[1].replace(/Military/gi, 'Militaire').replace(/Industrial/gi, 'Industriel').replace(/Civilian/gi, 'Civil') : null };
    });
  }

  missionName(ship: WikeloShip): string {
    return (ship.missionText ?? '').replace(/^Mission:\s*/i, '')
      .split(/\s*(?:-\s*)?(?:Cost|Reputation):/i)[0].trim() || 'Non renseignée';
  }

  private itemDetails(value: string): { name: string; quantity: string | null } {
    value = value.replace(/[⭐★☆🌟]\uFE0F?/gu, '').trim();
    const match = value.match(/^(\d[\d,.]*)\s*(?:[xX×]\s*|\s+(SCU)\s+)(.+)$/i);
    return match ? { name: match[3].trim(), quantity: match[1] + (match[2] ? ' SCU' : ' ×') }
      : { name: value, quantity: null };
  }

  toggleDetails(shipName: string): void {
    this.expandedShipName = this.expandedShipName === shipName ? null : shipName;
    if (this.expandedShipName !== null) this.revealExpandedCard();
  }

  isExpanded(shipName: string): boolean {
    return this.expandedShipName === shipName;
  }

  summarize(value: string | null | undefined, maxLength = 120): string {
    const text = (value ?? '').replace(/\s+/g, ' ').trim();
    if (!text) return '-';
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength).trim() + '...';
  }

  toParts(value: string | null | undefined): string[] {
    return (value ?? '')
      .split('|')
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
  }

  setSearchTerm(value: string): void {
    this.searchTerm = value;
    void this.router.navigate([], { relativeTo: this.route, queryParams: { q: value || null }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  clearSearch(): void {
    this.setSearchTerm('');
  }

  openGoalModal(ship: WikeloShip): void {
    if (!this.canCreateGoals) return;
    this.selectedGoalShip = ship;
    this.goalAssignUserInput = '';
    this.goalAssignUserId = null;
    this.goalCreateStatus = '';
    this.isGoalModalOpen = true;
  }

  closeGoalModal(): void {
    if (this.isCreatingGoal) return;
    this.isGoalModalOpen = false;
    this.selectedGoalShip = null;
    this.goalAssignUserInput = '';
    this.goalAssignUserId = null;
  }

  onGoalUserInputChange(): void {
    const value = this.goalAssignUserInput.trim().toLowerCase();
    if (!value) {
      this.goalAssignUserId = null;
      return;
    }
    const matchedUser = this.users.find((user) => (user.username ?? '').toLowerCase() === value);
    this.goalAssignUserId = matchedUser?.id ?? null;
  }

  getGoalPreviewIngredients(): Array<{ name: string; target: number }> {
    if (!this.selectedGoalShip) return [];
    return this.ingredients(this.selectedGoalShip).map((part) => this.parseIngredient(part));
  }

  async confirmCreateGoal(): Promise<void> {
    if (!this.selectedGoalShip || this.isCreatingGoal || !this.canCreateGoals) return;
    if (this.goalAssignUserInput.trim() && !this.goalAssignUserId) {
      this.goalCreateStatus = 'Choisissez un joueur de la liste ou laissez le champ vide.';
      return;
    }

    this.goalCreateStatus = '';
    this.isCreatingGoal = true;
    try {
      const ingredients = this.getGoalPreviewIngredients();
      const parentPayload = {
        name: `Wikelo - ${this.selectedGoalShip.shipName}`,
        description: `Objectif Wikelo pour ${this.selectedGoalShip.shipName}`,
        target: Math.max(ingredients.length, 1),
        current: 0,
        parentId: null,
        pinned: false,
        userId: this.goalAssignUserId
      };

      const parentGoal = await firstValueFrom(this.goalService.addGoal(parentPayload));
      const parentId = this.resolveGoalIdFromResponse(parentGoal)
        ?? await this.resolveCreatedParentId(parentPayload.name, this.goalAssignUserId);

      if (!parentId) {
        throw new Error('Creation du parent impossible (id manquant).');
      }

      for (const ingredient of ingredients) {
        const childPayload = {
          name: ingredient.name,
          description: `Ingredient Wikelo pour ${this.selectedGoalShip.shipName}`,
          target: ingredient.target,
          current: 0,
          parentId,
          pinned: false,
          userId: this.goalAssignUserId
        };
        await firstValueFrom(this.goalService.addGoal(childPayload));
      }

      this.goalCreateStatus = 'Objectif créé avec succès.';
      this.isCreatingGoal = false;
      this.closeGoalModal();
    } catch (error) {
      console.error(error);
      this.goalCreateStatus = 'La création de l’objectif a échoué. Vérifiez les objectifs existants avant de réessayer.';
    } finally {
      this.isCreatingGoal = false;
    }
  }

  loadShips(): void {
    this.errorMessage = '';
    this.isLoading = true;
    this.wikeloService.getShips()
      .pipe(finalize(() => this.isLoading = false))
      .subscribe({
        next: (response) => {
          this.ships = response.data ?? [];
          this.expandedShipName = null;
        },
        error: () => {
          this.errorMessage = 'Impossible de charger le catalogue Wikelo. Réessayez dans quelques instants.';
        }
      });
  }

  private resolvePermissions(): void {
    if (!this.authService.hasToken()) {
      this.canCreateGoals = false;
      return;
    }

    this.userService.getMyProfile().subscribe({
      next: (response) => {
        const roles = (response?.data?.roles ?? []).map((role) => (role ?? '').toUpperCase());
        this.canCreateGoals = roles.includes('ADMIN');
        if (this.canCreateGoals) {
          this.loadUsers();
        }
      },
      error: () => {
        this.canCreateGoals = false;
      }
    });
  }

  private loadCatalogShips(): void {
    this.shipService.getAllShips().subscribe({
      next: (response) => {
        this.catalogShips = response.data ?? [];
      },
      error: () => {
        this.catalogShips = [];
        this.catalogUnavailable = true;
      }
    });
  }

  private loadUsers(): void {
    this.userService.getAllUsers().subscribe({
      next: (response) => {
        this.users = response?.data ?? [];
      },
      error: () => {
        this.users = [];
      }
    });
  }

  imageFailed(url: string): void { this.failedImages.add(url); }

  ingredients(ship: WikeloShip): string[] {
    // Preserve the source text: commas can belong to quantities or ingredient names.
    return (ship.costText ?? '').split(/(?:[|\n]+|(?<!\d),(?=\s*\d[\d,]*\s*[xX×])|,(?=\s+\d[\d,]*\s*[xX×]))/).map(part => part.trim()).filter(Boolean);
  }

  private normalizeName(value: string): string {
    return (value ?? '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }

  private parseIngredient(rawValue: string): { name: string; target: number } {
    const cleaned = (rawValue ?? '').trim();
    const matched = cleaned.match(/^(\d{1,3}(?:,\d{3})+|\d+)\s*[xX×]\s*(.+)$/);
    if (matched) {
      return {
        target: Number.parseInt(matched[1].replace(/,/g, ''), 10),
        name: matched[2].trim()
      };
    }
    return { name: cleaned, target: 1 };
  }

  private resolveGoalIdFromResponse(response: any): number | null {
    const directId = Number(response?.id);
    if (Number.isFinite(directId) && directId > 0) return directId;

    const dataId = Number(response?.data?.id);
    if (Number.isFinite(dataId) && dataId > 0) return dataId;

    const nestedId = Number(response?.goal?.id);
    if (Number.isFinite(nestedId) && nestedId > 0) return nestedId;

    return null;
  }

  private async resolveCreatedParentId(name: string, userId: string | null): Promise<number | null> {
    const normalizedName = (name ?? '').trim();
    for (let attempt = 0; attempt < 3; attempt++) {
      const goals = await firstValueFrom(this.goalService.getAllGoals());
      const matches = (goals ?? [])
        .filter((goal: Goal) =>
          goal.parentId === null
          && (goal.name ?? '').trim() === normalizedName
          && (goal.userId ?? null) === (userId ?? null))
        .sort((left, right) => {
          const leftDate = new Date(left.createdAt ?? 0).getTime();
          const rightDate = new Date(right.createdAt ?? 0).getTime();
          if (rightDate !== leftDate) return rightDate - leftDate;
          return (right.id ?? 0) - (left.id ?? 0);
        });

      if (matches.length) return matches[0].id;
      await this.wait(120);
    }

    return null;
  }

  private wait(delayMs: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}
