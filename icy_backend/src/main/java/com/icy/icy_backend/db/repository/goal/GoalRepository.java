package com.icy.icy_backend.db.repository.goal;

import com.icy.icy_backend.db.entity.goal.Goal;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface GoalRepository extends JpaRepository<Goal, Long> {

    List<Goal> findByParentIsNullOrderByPinnedDescCreatedAtAsc();

    List<Goal> findByParent(Goal parent);

    Optional<Goal> findFirstByPinnedTrue();
}






