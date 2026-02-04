package com.icy.icy_backend.db.repository.image;

import com.icy.icy_backend.db.entity.image.ImageMetadata;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ImageMetadataRepository extends JpaRepository<ImageMetadata, Long> {
    Optional<ImageMetadata> findByName(String name);
    boolean existsByName(String name);
}




