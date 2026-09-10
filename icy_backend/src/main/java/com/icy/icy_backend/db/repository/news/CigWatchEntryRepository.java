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

    @Modifying
    @Query("update CigWatchEntry e set e.deliveryStatus = 'DELIVERED', e.deliveryRetryAt = null, e.lastError = null where e.newsId = :newsId")
    void markDeliveredByNewsId(@Param("newsId") Long newsId);

    @Modifying
    @Transactional
    @Query(value = "INSERT INTO news.cig_watch_fetch_state(source_id, last_fetched_at) VALUES (:sourceId, :fetchedAt) ON CONFLICT (source_id) DO UPDATE SET last_fetched_at = EXCLUDED.last_fetched_at", nativeQuery = true)
    void recordFetch(@Param("sourceId") Long sourceId, @Param("fetchedAt") java.time.OffsetDateTime fetchedAt);

    @Query(value = "SELECT MAX(last_fetched_at) FROM news.cig_watch_fetch_state", nativeQuery = true)
    Optional<java.time.Instant> findLatestSourceFetchAt();

    @Query("select e from CigWatchEntry e where e.newsId in (select n.id from News n where n.imageUrl is null) order by e.id desc")
    List<CigWatchEntry> findImageCandidates(Pageable pageable);

    boolean existsBySourceId(Long sourceId);
    Optional<CigWatchEntry> findFirstBySourceIdOrderByRankHintDesc(Long sourceId);

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("select e from CigWatchEntry e where e.id = :id")
    Optional<CigWatchEntry> findForProcessing(@Param("id") Long id);

    @Query("select e.id from CigWatchEntry e where (e.translationStatus <> 'TRANSLATED' or (e.autoPublish = true and e.newsId is null)) and (e.nextRetryAt is null or e.nextRetryAt <= :now) order by e.autoPublish desc, e.fetchedAt desc, e.id desc")
    List<Long> findProcessingCandidates(@Param("now") java.time.OffsetDateTime now, Pageable pageable);

    @Query("select e.id from CigWatchEntry e where e.newsId is not null and e.deliveryStatus = 'PENDING' and (e.deliveryRetryAt is null or e.deliveryRetryAt <= :now) order by e.id asc")
    List<Long> findDeliveryCandidates(@Param("now") java.time.OffsetDateTime now, Pageable pageable);

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
                        updated_at,
                        auto_publish
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
                        :updatedAt,
                        :autoPublish
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
            @Param("updatedAt") java.time.OffsetDateTime updatedAt,
            @Param("autoPublish") boolean autoPublish
    );
}
