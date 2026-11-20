package com.icy.icy_backend.db.repository.goal;

import com.icy.icy_backend.db.entity.goal.Goal;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface GoalRepository extends JpaRepository<Goal, Long> {

    List<Goal> findByParentIsNullOrderByPinnedDescCreatedAtAsc();

    List<Goal> findByParent(Goal parent);

    /** Objectifs principaux d'un pôle : ceux en cours d'abord, les plus récents en tête. */
    List<Goal> findByPoleAndParentIsNullOrderByCompletedAscCreatedAtDesc(com.icy.icy_backend.db.entity.user.Specialty pole);

    Optional<Goal> findFirstByPinnedTrue();

    long countByUser_Id(UUID userId);
}






