package com.icy.icy_backend.db.repository.news;

import com.icy.icy_backend.db.entity.news.NewsType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface NewsTypeRepository extends JpaRepository<NewsType, Long> {
    Optional<NewsType> findByNameIgnoreCase(String name);
    List<NewsType> findAllByOrderByNameAsc();

    Optional<NewsType> findByName(String type);
}






