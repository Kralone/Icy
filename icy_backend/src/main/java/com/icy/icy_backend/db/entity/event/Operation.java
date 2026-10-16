package com.icy.icy_backend.db.entity.event;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "operations", schema = "events")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Operation {
    @Id
    @Column(name = "event_id")
    private UUID eventId;

    @OneToOne
    @JoinColumn(name = "event_id", insertable = false, updatable = false)
    private Event event;

    @Column(columnDefinition = "TEXT")
    private String briefing;

    @Column(columnDefinition = "TEXT")
    private String objectives;

    @Column(name = "meeting_point", length = 255)
    private String meetingPoint;

    @Column(name = "image_url", columnDefinition = "TEXT")
    private String imageUrl;

    @Enumerated(EnumType.STRING)
    @Column(name = "publication_status", nullable = false, length = 20)
    @Builder.Default
    private PublicationStatus publicationStatus = PublicationStatus.DRAFT;

    @Column(name = "allow_ship_proposals", nullable = false)
    @Builder.Default
    private boolean allowShipProposals = false;

    /** Session de minage : une fiche de minage liée est créée à la publication (ou dès que l'option est cochée après). */
    @Column(name = "mining_session", nullable = false)
    @Builder.Default
    private boolean miningSession = false;

    @Column(name = "updated_at", nullable = false)
    @Builder.Default
    private LocalDateTime updatedAt = LocalDateTime.now();

    /** Mode d'affectation des groupes qui n'en fixent pas un eux-mêmes (ni leur parent). */
    @Enumerated(EnumType.STRING)
    @Column(name = "default_assignment_mode", nullable = false, length = 20)
    @Builder.Default
    private OperationGroup.AssignmentMode defaultAssignmentMode = OperationGroup.AssignmentMode.FREE;

    /** Verrou optimiste : une écriture fondée sur une révision périmée est refusée au lieu d'écraser une version plus récente. */
    @Version
    @Column(nullable = false)
    @Builder.Default
    private long revision = 0;

    public enum PublicationStatus { DRAFT, PUBLISHED }
}
