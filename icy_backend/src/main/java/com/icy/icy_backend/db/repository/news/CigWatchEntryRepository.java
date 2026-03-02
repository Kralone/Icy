package com.icy.icy_backend.db.repository.news;

import com.icy.icy_backend.db.entity.news.CigWatchEntry;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Repository
public interface CigWatchEntryRepository extends JpaRepository<CigWatchEntry, Long> {

    Optional<CigWatchEntry> findBySourceIdAndLink(Long sourceId, String link);
    boolean existsBySourceIdAndLink(Long sourceId, String link);

    Optional<CigWatchEntry> findFirstByOrderByFetchedAtDesc();

    List<CigWatchEntry> findByOrderByFetchedAtDesc(Pageable pageable);

    @Modifying
    @Transactional
    @Query(
            value = """
                    INSERT INTO news.cig_watch_entries (
                        source_id,
                        source_label,
                        source_url,
                        external_id,
                        title,
                        title_fr,
                        link,
                        entry_type,
                        published_at,
                        rank_hint,
                        raw_excerpt,
                        raw_excerpt_fr,
                        raw_payload,
                        raw_payload_fr,
                        fetched_at,
                        created_at,
                        updated_at
                    ) VALUES (
                        :sourceId,
                        :sourceLabel,
                        :sourceUrl,
                        :externalId,
                        :title,
                        :titleFr,
                        :link,
                        :entryType,
                        :publishedAt,
                        :rankHint,
                        :rawExcerpt,
                        :rawExcerptFr,
                        :rawPayload,
                        :rawPayloadFr,
                        :fetchedAt,
                        :createdAt,
                        :updatedAt
                    )
                    ON CONFLICT (source_id, link) DO NOTHING
                    """,
            nativeQuery = true
    )
    void insertIfAbsent(
            @Param("sourceId") Long sourceId,
            @Param("sourceLabel") String sourceLabel,
            @Param("sourceUrl") String sourceUrl,
            @Param("externalId") String externalId,
            @Param("title") String title,
            @Param("titleFr") String titleFr,
            @Param("link") String link,
            @Param("entryType") String entryType,
            @Param("publishedAt") java.time.OffsetDateTime publishedAt,
            @Param("rankHint") Long rankHint,
            @Param("rawExcerpt") String rawExcerpt,
            @Param("rawExcerptFr") String rawExcerptFr,
            @Param("rawPayload") String rawPayload,
            @Param("rawPayloadFr") String rawPayloadFr,
            @Param("fetchedAt") java.time.OffsetDateTime fetchedAt,
            @Param("createdAt") java.time.OffsetDateTime createdAt,
            @Param("updatedAt") java.time.OffsetDateTime updatedAt
    );
}
