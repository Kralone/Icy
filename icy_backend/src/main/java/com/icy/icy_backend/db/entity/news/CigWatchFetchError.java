package com.icy.icy_backend.db.entity.news;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;

@Entity
@Table(name = "cig_watch_fetch_errors", schema = "news")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CigWatchFetchError {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "source_id", nullable = false)
    private Long sourceId;

    @Column(name = "source_label", nullable = false, length = 150)
    private String sourceLabel;

    @Column(name = "source_url", nullable = false, columnDefinition = "TEXT")
    private String sourceUrl;

    @Column(nullable = false, length = 220)
    private String message;

    @Column(name = "fetched_at", nullable = false)
    private OffsetDateTime fetchedAt;
}
