package com.icy.icy_backend.db.repository.goal;

import com.icy.icy_backend.db.entity.goal.GoalTemplate;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface GoalTemplateRepository extends JpaRepository<GoalTemplate, Long> {
    List<GoalTemplate> findByParentIsNullOrderByCreatedAtAsc();
    List<GoalTemplate> findByParent(GoalTemplate parent);
}
