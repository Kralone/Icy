package com.icy.icy_backend.db.repository.session;

import com.icy.icy_backend.db.entity.session.SessionParticipant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface SessionParticipantRepository extends JpaRepository<SessionParticipant, UUID> {
    /** Ordre d'arrivée, puis identifiant : c'est l'ordre de départage des arrondis. */
    @Query("select p from SessionParticipant p where p.sheetId = :sheetId order by p.joinedAt asc, p.userId asc")
    List<SessionParticipant> findBySheetOrdered(@Param("sheetId") UUID sheetId);

    @Query("select p from SessionParticipant p where p.sheetId in :sheetIds")
    List<SessionParticipant> findBySheetIds(@Param("sheetIds") Collection<UUID> sheetIds);
}
