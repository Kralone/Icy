/** Ce qu'il faut dire quand une opération n'a pas pu être lue : la cause, et si réessayer a un sens. */
export interface OperationLoadFailure {
  title: string;
  detail: string;
  retry: boolean;
}

export function operationLoadFailure(error: any, editor = false): OperationLoadFailure {
  const status = typeof error?.status === 'number' ? error.status : null;
  if (status === 403) {
    return { title: 'Accès refusé', detail: editor ? 'L’éditeur est réservé aux organisateurs.' : 'Votre compte n’a pas accès à cette opération.', retry: false };
  }
  if (status === 404) {
    return { title: 'Opération introuvable', detail: editor ? 'Elle n’existe pas ou a été supprimée.' : 'Elle n’existe pas, a été supprimée ou n’est pas encore publiée.', retry: false };
  }
  if (status === 0 || status === null) {
    return { title: 'Serveur injoignable', detail: 'Vérifiez votre connexion puis réessayez.', retry: true };
  }
  return { title: 'Opération indisponible', detail: `Le serveur a répondu par une erreur (${status}).`, retry: true };
}
