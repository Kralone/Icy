package com.icy.icy_backend.db.repository;

import com.icy.icy_backend.db.entity.CollectionTemplate;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface CollectionTemplateRepository extends JpaRepository<CollectionTemplate, Long> {
    @Query("""
    SELECT t FROM CollectionTemplate t
    WHERE (:archetype IS NULL OR t.archetype = :archetype)
    AND (:search = '' OR LOWER(t.name) LIKE LOWER(CONCAT('%', :search, '%')))
    """)
    List<CollectionTemplate> search(@Param("archetype") String archetype,
                          @Param("search") String search);

    boolean existsByName(String name);
}
