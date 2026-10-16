package com.icy.icy_backend.db.repository.session;

import com.icy.icy_backend.db.entity.mining.MiningRefineryOrder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface MiningRefineryOrderRepository extends JpaRepository<MiningRefineryOrder, UUID> {
    @Query("select distinct o from MiningRefineryOrder o left join fetch o.lines where o.sheetId = :sheetId order by o.createdAt asc")
    List<MiningRefineryOrder> findBySheetWithLines(@Param("sheetId") UUID sheetId);

    @Query("select o from MiningRefineryOrder o where o.sheetId in :sheetIds")
    List<MiningRefineryOrder> findBySheetIds(@Param("sheetIds") Collection<UUID> sheetIds);

    /** Ordres devenus prêts et pas encore annoncés, sur une fiche encore en cours. */
    @Query("""
            select o from MiningRefineryOrder o
            where o.readyNotifiedAt is null and o.finishesAt <= :now
              and exists (select s.id from SessionSheet s where s.id = o.sheetId
                          and s.status = com.icy.icy_backend.db.entity.session.SessionSheet.Status.ACTIVE)
            order by o.finishesAt asc""")
    List<MiningRefineryOrder> findReadyToAnnounce(@Param("now") LocalDateTime now);
}
