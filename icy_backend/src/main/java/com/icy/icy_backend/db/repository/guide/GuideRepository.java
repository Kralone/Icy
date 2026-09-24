package com.icy.icy_backend.db.repository.guide;

import com.icy.icy_backend.db.entity.guide.Guide;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface GuideRepository extends JpaRepository<Guide, Long> {
    List<Guide> findAllByOrderByUpdatedAtDesc();
    List<Guide> findAllByPublishedTrueOrderByUpdatedAtDesc();
    Optional<Guide> findBySlugAndPublishedTrue(String slug);
}
