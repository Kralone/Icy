package com.icy.icy_backend.db.repository.session;

import com.icy.icy_backend.db.entity.session.SessionSettlement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SessionSettlementRepository extends JpaRepository<SessionSettlement, UUID> {
    /** Règlement en cours : au plus un, garanti par l'index unique partiel session_settlements_one_current. */
    @Query("select s from SessionSettlement s where s.sheetId = :sheetId and s.cancelledAt is null")
    Optional<SessionSettlement> findCurrent(@Param("sheetId") UUID sheetId);

    @Query("select s from SessionSettlement s where s.sheetId = :sheetId and s.cancelledAt is not null order by s.createdAt desc")
    List<SessionSettlement> findCancelled(@Param("sheetId") UUID sheetId);
}
