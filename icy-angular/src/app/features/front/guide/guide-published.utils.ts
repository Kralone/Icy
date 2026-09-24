import { Guide } from '../../../model/guide.model';
import { GuideDocument, GuideStatusBadge } from './guide-template/guide-template.types';

function statusBadge(status: string): GuideStatusBadge {
  const value = status.toUpperCase();
  if (value === 'LIVE' || value === 'PUBLISHED' || value === 'COMPLET') return { label: 'Disponible', tone: 'live' };
  if (value === 'SOON' || value === 'A_VENIR') return { label: 'Bientôt disponible', tone: 'soon' };
  return { label: 'En préparation', tone: 'writing' };
}

export function mergePublishedGuide(base: GuideDocument, remote: Guide): GuideDocument {
  try {
    const content = JSON.parse(remote.content) as Partial<GuideDocument>;
    if (!Array.isArray(content.sections)) return base;
    return {
      ...base, ...content,
      slug: base.slug,
      title: remote.title || base.title,
      subtitle: remote.summary || base.subtitle,
      updatedAt: remote.updatedAt ? new Date(remote.updatedAt).toLocaleDateString('fr-FR') : base.updatedAt,
      gameVersion: remote.gameVersion || base.gameVersion,
      status: statusBadge(remote.status),
      sections: content.sections
    };
  } catch { return base; }
}

export function hideUnpublishedGuide(base: GuideDocument, error: { status?: number }): GuideDocument {
  return error?.status === 404
    ? { ...base, status: { label: 'Non publié', tone: 'alert' }, sections: [] }
    : base;
}
