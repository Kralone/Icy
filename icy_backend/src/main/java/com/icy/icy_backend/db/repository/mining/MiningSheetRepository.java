package com.icy.icy_backend.db.repository.mining;

import com.icy.icy_backend.db.entity.mining.MiningSheet;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MiningSheetRepository extends JpaRepository<MiningSheet, UUID> {
    @EntityGraph(attributePaths = {
            "createdBy",
            "members",
            "members.user",
            "jobs",
            "jobs.ownerUser",
            "jobs.ores"
    })
    @Query("select distinct s from MiningSheet s order by s.operationDate desc, s.createdAt desc")
    List<MiningSheet> findAllWithDetails();

    @EntityGraph(attributePaths = {
            "createdBy",
            "members",
            "members.user",
            "jobs",
            "jobs.ownerUser",
            "jobs.ores"
    })
    @Query("select s from MiningSheet s where s.id = :id")
    Optional<MiningSheet> findByIdWithDetails(@Param("id") UUID id);
}
