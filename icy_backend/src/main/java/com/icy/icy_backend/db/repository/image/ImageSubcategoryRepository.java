package com.icy.icy_backend.db.repository.image;

import com.icy.icy_backend.db.entity.image.ImageSubcategory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ImageSubcategoryRepository extends JpaRepository<ImageSubcategory, UUID> {
    List<ImageSubcategory> findByCategoryNameOrderByNameAsc(String categoryName);
    boolean existsByCategoryNameAndName(String categoryName, String name);
}
