package com.icy.icy_backend.db.repository.catalog;

import com.icy.icy_backend.db.entity.catalog.CatalogSyncRun;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.Optional;

public interface CatalogSyncRunRepository extends JpaRepository<CatalogSyncRun, Long> {
    boolean existsByStatusIn(Collection<String> statuses);

    Optional<CatalogSyncRun> findFirstByOrderByCreatedAtDesc();
}
