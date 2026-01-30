package com.icy.icy_backend.db.repository.scworldevent;

import com.icy.icy_backend.db.entity.scworldevent.ScWorldEvent;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface ScWorldEventRepository extends JpaRepository<ScWorldEvent, UUID> {

    Page<ScWorldEvent> findByStartAtGreaterThanEqual(Instant from, Pageable pageable);

    @Query("""
        select e
        from ScWorldEvent e
        where e.startAt <= :now
          and (e.endAt is null or e.endAt >= :now)
        order by e.startAt desc
    """)
    Optional<ScWorldEvent> findCurrent(@Param("now") Instant now);

    @Query("""
        select (count(e) > 0)
        from ScWorldEvent e
        where e.startAt <= :now
          and (e.endAt is null or e.endAt >= :now)
    """)
    boolean existsCurrent(@Param("now") Instant now);

    @Query("SELECT e FROM ScWorldEvent e WHERE e.endAt IS NULL OR e.endAt > :now")
    Page<ScWorldEvent> findActiveOrFuture(@Param("now") Instant now, Pageable pageable);

    @Query("SELECT e FROM ScWorldEvent e WHERE e.endAt IS NOT NULL AND e.endAt < :now")
    Page<ScWorldEvent> findPast(@Param("now") Instant now, Pageable pageable);
}
