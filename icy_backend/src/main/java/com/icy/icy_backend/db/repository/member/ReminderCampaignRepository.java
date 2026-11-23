package com.icy.icy_backend.db.repository.member;

import com.icy.icy_backend.db.entity.member.ReminderCampaign;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface ReminderCampaignRepository extends JpaRepository<ReminderCampaign, Long> {
    List<ReminderCampaign> findAllByOrderByCreatedAtDesc();

    List<ReminderCampaign> findByStatusAndScheduledAtLessThanEqual(ReminderCampaign.Status status, LocalDateTime now);
}
