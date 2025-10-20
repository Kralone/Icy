package com.icy.icy_backend.db.repository;

import com.icy.icy_backend.db.entity.NewsType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface NewsTypeRepository extends JpaRepository<NewsType, Long> {
    Optional<NewsType> findByNameIgnoreCase(String name);
}
