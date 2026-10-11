package com.icy.icy_backend.db.entity.event;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
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

    @Column(name = "meeting_point", length = 255)
    private String meetingPoint;

    @Enumerated(EnumType.STRING)
    @Column(name = "publication_status", nullable = false, length = 20)
    @Builder.Default
    private PublicationStatus publicationStatus = PublicationStatus.DRAFT;

    @Column(name = "updated_at", nullable = false)
    @Builder.Default
    private LocalDateTime updatedAt = LocalDateTime.now();

    public enum PublicationStatus { DRAFT, PUBLISHED }
}
