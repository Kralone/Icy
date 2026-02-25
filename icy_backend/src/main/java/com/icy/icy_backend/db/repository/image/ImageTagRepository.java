package com.icy.icy_backend.db.repository.image;

import com.icy.icy_backend.db.entity.image.ImageTag;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ImageTagRepository extends JpaRepository<ImageTag, String> {
}
