package com.icy.icy_backend.db.repository.goal;

import com.icy.icy_backend.db.entity.goal.GoalMember;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface GoalMemberRepository extends JpaRepository<GoalMember, UUID> {
    List<GoalMember> findByGoal_IdInOrderByJoinedAtAsc(Collection<Long> goalIds);
    Optional<GoalMember> findByGoal_IdAndUser_Id(Long goalId, UUID userId);
}
