export interface RecruitmentAdmin {
  id: number;
  username: string;          // ✅ Nom du joueur
  discordTag: string;        // ✅ Tag Discord
  motivation: string;        // ✅ Motivation du joueur
  referral?: string;         // (optionnel)
  experience?: string;       // (optionnel)
  preferredGameplay?: string;// (optionnel)
  accept: boolean;           // ✅ Accepte ou non
  status: 'PENDING' | 'ACCEPTED' | 'REFUSED'; // ✅ Statut du recrutement
  comment?: string;          // (optionnel)
  createdAt: string;         // ✅ Date d’envoi
}
