export type ResourceLineId = 'planning' | 'refining' | 'locations' | 'fit';
export type FitTabId = 'ships' | 'modules' | 'tools';
export type ModuleFilterId = 'all' | 'mining_laser' | 'cargo_pod';

export interface ResourcesGuideLinkState {
  line?: ResourceLineId | null;
  fitTab?: FitTabId | null;
  fitFilter?: ModuleFilterId | null;
}

const RESOURCE_LINE_IDS: readonly ResourceLineId[] = ['planning', 'refining', 'locations', 'fit'];
const FIT_TAB_IDS: readonly FitTabId[] = ['ships', 'modules', 'tools'];
const MODULE_FILTER_IDS: readonly ModuleFilterId[] = ['all', 'mining_laser', 'cargo_pod'];

const RESOURCES_GUIDE_ROUTE = '/guides/minage/ressources';

export function normalizeResourceLineId(value: string | null | undefined): ResourceLineId | null {
  const normalized = sanitizeToken(value);
  if (!normalized) {
    return null;
  }
  return RESOURCE_LINE_IDS.includes(normalized as ResourceLineId) ? (normalized as ResourceLineId) : null;
}

export function normalizeFitTabId(value: string | null | undefined): FitTabId | null {
  const normalized = sanitizeToken(value);
  if (!normalized) {
    return null;
  }
  return FIT_TAB_IDS.includes(normalized as FitTabId) ? (normalized as FitTabId) : null;
}

export function normalizeModuleFilterId(value: string | null | undefined): ModuleFilterId | null {
  const normalized = sanitizeToken(value);
  if (!normalized) {
    return null;
  }
  return MODULE_FILTER_IDS.includes(normalized as ModuleFilterId) ? (normalized as ModuleFilterId) : null;
}

export function buildResourcesGuideLink(state?: ResourcesGuideLinkState): string {
  if (!state) {
    return RESOURCES_GUIDE_ROUTE;
  }

  const line = normalizeResourceLineId(state.line);
  const fitTab = normalizeFitTabId(state.fitTab);
  const fitFilter = normalizeModuleFilterId(state.fitFilter);
  const query = new URLSearchParams();

  if (line) {
    query.set('line', line);
  }
  if (fitTab) {
    query.set('fitTab', fitTab);
  }
  if (fitFilter) {
    query.set('fitFilter', fitFilter);
  }

  const serialized = query.toString();
  if (!serialized) {
    return RESOURCES_GUIDE_ROUTE;
  }
  return `${RESOURCES_GUIDE_ROUTE}?${serialized}`;
}

function sanitizeToken(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}
