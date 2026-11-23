package com.icy.icy_backend.db.repository.member;

import com.icy.icy_backend.db.entity.member.MemberFollowUp;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public interface MemberFollowUpRepository extends JpaRepository<MemberFollowUp, UUID> {

    /** Début de la dernière opération ou du dernier événement confirmé par chaque membre, déjà commencé. */
    @Query(value = """
            SELECT p.user_id AS userId, MAX(e.start_date_time) AS lastAt
            FROM events.event_participation p
            JOIN events.events e ON e.id = p.event_id
            WHERE p.status = 1 AND e.start_date_time <= :now
            GROUP BY p.user_id
            """, nativeQuery = true)
    List<LastParticipation> findLastConfirmedParticipations(@Param("now") LocalDateTime now);

    interface LastParticipation {
        UUID getUserId();

        LocalDateTime getLastAt();
    }
}
