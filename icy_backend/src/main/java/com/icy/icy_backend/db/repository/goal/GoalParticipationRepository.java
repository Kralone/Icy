package com.icy.icy_backend.db.repository.goal;

import com.icy.icy_backend.db.entity.goal.GoalParticipation;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface GoalParticipationRepository extends JpaRepository<GoalParticipation, UUID> {
    Page<GoalParticipation> findByGoal_Id(Long goalId, Pageable pageable);
    Optional<GoalParticipation> findByGoal_IdAndUser_Id(Long goalId, UUID userId);
    List<GoalParticipation> findByGoal_IdIn(Collection<Long> goalIds);

    @Query("select count(distinct gp.goal.id) from GoalParticipation gp where gp.user.id = :userId")
    long countDistinctGoalsByUserId(@Param("userId") UUID userId);
}
