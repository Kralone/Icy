package com.icy.icy_backend.db.repository.item;

import com.icy.icy_backend.db.entity.item.ItemCategory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ItemCategoryRepository extends JpaRepository<ItemCategory, Long> {
    Optional<ItemCategory> findByNameIgnoreCase(String name);
    List<ItemCategory> findAllByOrderByNameAsc();
}
