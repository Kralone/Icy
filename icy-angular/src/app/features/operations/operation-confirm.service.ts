import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';

export interface ConfirmRequest {
  title: string;
  /** Conséquence de l'action, en une ou deux phrases. */
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Action destructrice : bouton de confirmation en rouge. */
  danger?: boolean;
  /** Case à cocher qui doit l'être pour pouvoir confirmer : l'utilisateur reconnaît ce qui sera perdu. */
  acknowledge?: string;
}

const STYLE_ID = 'operation-confirm-style';
const STYLE = `
.operation-confirm { position: fixed; inset: 0; margin: auto; width: min(30rem, calc(100vw - 2rem)); height: fit-content; padding: 0; border: 1px solid rgba(103,232,249,.35); border-top: 3px solid #67e8f9; border-radius: .9rem; color: #e2e8f0; background: #0f172a; box-shadow: 0 24px 60px rgba(2,8,23,.6); }
.operation-confirm[data-danger] { border-color: #774457; border-top-color: #fda4af; }
.operation-confirm::backdrop { background: rgba(2,8,23,.72); }
.operation-confirm__body { display: grid; gap: .6rem; padding: 1.4rem 1.5rem .4rem; }
.operation-confirm h2 { margin: 0; color: #f8fafc; font-size: 1.15rem; font-weight: 700; overflow-wrap: anywhere; }
.operation-confirm p { margin: 0; color: #cbd5e1; line-height: 1.5; overflow-wrap: anywhere; }
.operation-confirm__actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: .6rem; padding: 1rem 1.5rem 1.4rem; }
.operation-confirm button { min-height: 2.6rem; padding: .5rem 1.1rem; border: 1px solid #36546a; border-radius: .45rem; color: #bae6fd; background: #122235; font-size: .95rem; cursor: pointer; }
.operation-confirm button:hover { border-color: #67e8f9; }
.operation-confirm button[data-confirm] { border-color: #67e8f9; color: #082f49; background: #67e8f9; font-weight: 700; }
.operation-confirm[data-danger] button[data-confirm] { border-color: #fda4af; color: #351f2a; background: #fda4af; }
.operation-confirm button:focus-visible { outline: 2px solid #72ddf7; outline-offset: 3px; }
.operation-confirm button:disabled { opacity: .45; cursor: not-allowed; }
.operation-confirm__ack { display: flex; align-items: flex-start; gap: .55rem; margin-top: .3rem; color: #f8fafc; font-size: .92rem; line-height: 1.45; cursor: pointer; }
.operation-confirm__ack input { width: 1.1rem; height: 1.1rem; margin-top: .15rem; flex: none; accent-color: #fda4af; }
@media (max-width: 480px) { .operation-confirm__actions button { flex: 1 1 100%; } }
`;

/** Demande de confirmation dans une fenêtre modale de l'application, à la place de celle du navigateur. */
@Injectable({ providedIn: 'root' })
export class OperationConfirmService {
  private readonly document = inject(DOCUMENT);

  /** Résout à true si l'action est confirmée ; Échap, « Annuler » ou un clic hors de la fenêtre résolvent à false. */
  ask(request: ConfirmRequest): Promise<boolean> {
    const document = this.document;
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = STYLE;
      document.head.appendChild(style);
    }
    const dialog = document.createElement('dialog');
    dialog.className = 'operation-confirm';
    if (request.danger) dialog.setAttribute('data-danger', '');
    const body = document.createElement('div');
    body.className = 'operation-confirm__body';
    const title = document.createElement('h2');
    title.id = `operation-confirm-title-${Date.now()}`;
    title.textContent = request.title;
    body.appendChild(title);
    dialog.setAttribute('aria-labelledby', title.id);
    if (request.message) {
      const message = document.createElement('p');
      message.textContent = request.message;
      body.appendChild(message);
    }
    let acknowledge: HTMLInputElement | null = null;
    if (request.acknowledge) {
      const label = document.createElement('label');
      label.className = 'operation-confirm__ack';
      acknowledge = document.createElement('input');
      acknowledge.type = 'checkbox';
      label.append(acknowledge, document.createTextNode(request.acknowledge));
      body.appendChild(label);
    }
    const actions = document.createElement('div');
    actions.className = 'operation-confirm__actions';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = request.cancelLabel ?? 'Annuler';
    const confirm = document.createElement('button');
    confirm.type = 'button';
    confirm.setAttribute('data-confirm', '');
    confirm.textContent = request.confirmLabel;
    // Avec une case à cocher, la confirmation reste impossible tant qu'elle n'est pas cochée.
    if (acknowledge) {
      const box = acknowledge;
      confirm.disabled = true;
      box.addEventListener('change', () => { confirm.disabled = !box.checked; });
    }
    actions.append(cancel, confirm);
    dialog.append(body, actions);
    document.body.appendChild(dialog);

    return new Promise<boolean>(resolve => {
      const previousFocus = document.activeElement as HTMLElement | null;
      let answered = false;
      const answer = (value: boolean) => {
        if (answered) return;
        answered = true;
        dialog.remove();
        previousFocus?.focus?.();
        resolve(value);
      };
      cancel.addEventListener('click', () => answer(false));
      confirm.addEventListener('click', () => { if (!confirm.disabled) answer(true); });
      dialog.addEventListener('cancel', event => { event.preventDefault(); answer(false); });
      // Un clic sur le fond (hors du contenu) vaut annulation.
      dialog.addEventListener('click', event => { if (event.target === dialog) answer(false); });
      if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
      // Le focus part sur « Annuler » : Entrée ne confirme jamais par accident.
      cancel.focus();
    });
  }
}
