package com.icy.icy_backend.db.repository.image;

import com.icy.icy_backend.db.entity.image.ImageCategory;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ImageCategoryRepository extends JpaRepository<ImageCategory, String> {
}
