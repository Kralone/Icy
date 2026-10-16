package com.icy.icy_backend.db.repository.session;

import com.icy.icy_backend.db.entity.session.SessionSale;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface SessionSaleRepository extends JpaRepository<SessionSale, UUID> {
    @Query("select distinct s from SessionSale s left join fetch s.lines where s.sheetId = :sheetId order by s.soldAt asc")
    List<SessionSale> findBySheetWithLines(@Param("sheetId") UUID sheetId);

    @Query("select s from SessionSale s where s.sheetId in :sheetIds")
    List<SessionSale> findBySheetIds(@Param("sheetIds") Collection<UUID> sheetIds);
}
