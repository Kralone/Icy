package com.icy.icy_backend.db.repository.item;

import com.icy.icy_backend.db.entity.item.Item;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ItemRepository extends JpaRepository<Item, Long> {
    List<Item> findAllByOrderByNameAsc();
}
