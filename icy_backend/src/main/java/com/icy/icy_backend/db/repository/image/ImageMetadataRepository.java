package com.icy.icy_backend.db.repository.image;

import com.icy.icy_backend.db.entity.image.ImageMetadata;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface ImageMetadataRepository extends JpaRepository<ImageMetadata, UUID> {
    Optional<ImageMetadata> findByName(String name);
    boolean existsByName(String name);

}




