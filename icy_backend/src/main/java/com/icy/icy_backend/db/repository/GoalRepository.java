package com.icy.icy_backend.db.repository;

import com.icy.icy_backend.db.entity.Goal;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface GoalRepository extends JpaRepository<Goal, Long> {
    List<Goal> findByParentIsNull();
}
