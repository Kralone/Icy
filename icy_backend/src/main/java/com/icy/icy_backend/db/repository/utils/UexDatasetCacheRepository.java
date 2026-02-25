package com.icy.icy_backend.db.repository.utils;

import com.icy.icy_backend.db.entity.utils.UexDatasetCache;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface UexDatasetCacheRepository extends JpaRepository<UexDatasetCache, String> {
    List<UexDatasetCache> findAllByOrderByDatasetKeyAsc();
}
