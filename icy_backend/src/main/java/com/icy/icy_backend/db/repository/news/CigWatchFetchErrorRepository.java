package com.icy.icy_backend.db.repository.news;

import com.icy.icy_backend.db.entity.news.CigWatchFetchError;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CigWatchFetchErrorRepository extends JpaRepository<CigWatchFetchError, Long> {

    List<CigWatchFetchError> findAllByOrderBySourceLabelAsc();

    Optional<CigWatchFetchError> findFirstByOrderByFetchedAtDesc();
}
