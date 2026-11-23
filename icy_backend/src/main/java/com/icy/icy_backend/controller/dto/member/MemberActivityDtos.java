package com.icy.icy_backend.controller.dto.member;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Suivi de l'activité des membres, rappels aux inactifs et messages privés du bot (/api/member-activity…). */
public final class MemberActivityDtos {
    private MemberActivityDtos() {
    }

    /** ACTIF, A_SURVEILLER, INACTIF (calculés) ; EN_PAUSE (seulement noté à la main ou par une réponse à un rappel). */
    public enum State { ACTIF, A_SURVEILLER, INACTIF, EN_PAUSE }

    public record Settings(int watchDays, int inactiveDays) {
    }

    public record Manual(String state, LocalDate until, String note, LocalDateTime updatedAt, String updatedBy) {
    }

    /** Dernière fiche de rappel du membre. deliveryStatus : PENDING, SENT, FAILED, ou null pour un rappel envoyé à la main. */
    public record ReminderSummary(Long id, Long campaignId, String campaignTitle, LocalDateTime contactedAt, LocalDateTime answeredAt,
                                  String decision, LocalDate pauseUntil, String deliveryStatus, String deliveryReason) {
    }

    /**
     * Un membre actif et son activité. lastActivityAt est la plus récente de lastSeenAt (site) et lastOperationAt
     * (dernière opération ou événement confirmé) ; daysInactive se compte depuis elle, ou depuis la création du compte.
     */
    public record Member(UUID userId, String username, String avatarUrl, String discordId, List<String> roles, String specialty,
                         LocalDateTime createdAt, LocalDateTime lastSeenAt, LocalDateTime lastOperationAt, LocalDateTime lastActivityAt,
                         int daysInactive, State computedState, State state, Manual manual, ReminderSummary reminder) {
    }

    public record Overview(Settings settings, List<Member> members) {
    }

    /** state : ACTIF, EN_PAUSE ou null pour revenir au calcul. until : dernier jour, facultatif. */
    public record FollowUpRequest(String state, LocalDate until, String note) {
    }

    public record Template(String code, String category, String label, String body, String mediaFile, String mediaUrl,
                           LocalDateTime updatedAt, String updatedBy) {
    }

    public record TemplateUpdate(String body, String mediaFile) {
    }

    public record DirectMessage(UUID id, String origin, String reference, String label, String status, String reason,
                                LocalDateTime requestedAt, LocalDateTime completedAt, String requestedBy) {
    }

    public record History(UUID userId, String username, List<Reminder> reminders, List<DirectMessage> messages) {
    }

    /** Fiche de rappel complète. message : le texte personnalisé, prêt à copier pour un envoi à la main. */
    public record Reminder(Long id, Long campaignId, String campaignTitle, String delivery, UUID userId, String username, String avatarUrl,
                           String discordId, Integer daysInactive, LocalDateTime contactedAt, LocalDateTime answeredAt, String decision,
                           LocalDate pauseUntil, String note, String deliveryStatus, String deliveryReason, String message,
                           LocalDateTime updatedAt, String updatedBy) {
    }

    /**
     * contacted, answered : cocher ou décocher (null : inchangé). decision : REVIENT, PAUSE, QUITTE, SANS_REPONSE,
     * "" pour l'effacer, null inchangé. pauseUntil obligatoire pour PAUSE.
     */
    public record ReminderUpdate(Boolean contacted, Boolean answered, String decision, LocalDate pauseUntil, String note) {
    }

    /** Compteurs d'une campagne, pour la liste. decisions : nombre de fiches par décision. */
    public record CampaignCounts(int members, int contacted, int pending, int failed, int answered, Map<String, Integer> decisions) {
    }

    public record Campaign(Long id, String title, String body, String mediaFile, String mediaUrl, String delivery, String status,
                           LocalDateTime scheduledAt, LocalDateTime sentAt, String createdBy, LocalDateTime createdAt,
                           CampaignCounts counts, List<Reminder> reminders) {
    }

    /**
     * Nouvelle campagne. delivery : BOT ou MANUEL. Avec BOT : sendNow envoie tout de suite, scheduledAt programme l'envoi,
     * sinon la campagne reste en brouillon.
     */
    public record CampaignCreate(String title, String body, String mediaFile, String delivery, List<UUID> userIds,
                                 LocalDateTime scheduledAt, Boolean sendNow) {
    }

    /** Modifie une campagne pas encore envoyée. scheduledAt null : la repasse en brouillon. */
    public record CampaignUpdate(String title, String body, String mediaFile, LocalDateTime scheduledAt) {
    }

    public record SendResult(int queued, List<String> skipped) {
    }

    public record AnnounceRequest(String templateCode) {
    }
}
