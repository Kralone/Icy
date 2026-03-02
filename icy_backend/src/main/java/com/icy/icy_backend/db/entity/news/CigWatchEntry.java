package com.icy.icy_backend.db.entity.news;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;

@Entity
@Table(
        name = "cig_watch_entries",
        schema = "news",
        uniqueConstraints = {
                @UniqueConstraint(name = "uq_cig_watch_entries_source_link", columnNames = {"source_id", "link"})
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CigWatchEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "source_id", nullable = false)
    private Long sourceId;

    @Column(name = "source_label", nullable = false, length = 150)
    private String sourceLabel;

    @Column(name = "source_url", nullable = false, columnDefinition = "TEXT")
    private String sourceUrl;

    @Column(name = "external_id", length = 255)
    private String externalId;

    @Column(nullable = false, length = 300)
    private String title;

    @Column(name = "title_fr", length = 300)
    private String titleFr;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String link;

    @Column(name = "entry_type", nullable = false, length = 120)
    private String entryType;

    @Column(name = "published_at")
    private OffsetDateTime publishedAt;

    @Column(name = "rank_hint")
    private Long rankHint;

    @Column(name = "raw_excerpt", columnDefinition = "TEXT")
    private String rawExcerpt;

    @Column(name = "raw_excerpt_fr", columnDefinition = "TEXT")
    private String rawExcerptFr;

    @Column(name = "raw_payload", columnDefinition = "TEXT")
    private String rawPayload;

    @Column(name = "raw_payload_fr", columnDefinition = "TEXT")
    private String rawPayloadFr;

    @Column(name = "fetched_at", nullable = false)
    private OffsetDateTime fetchedAt;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;
}
