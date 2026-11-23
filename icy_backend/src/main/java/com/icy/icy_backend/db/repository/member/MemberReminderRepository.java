package com.icy.icy_backend.db.repository.member;

import com.icy.icy_backend.db.entity.member.MemberReminder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MemberReminderRepository extends JpaRepository<MemberReminder, Long> {
    List<MemberReminder> findByCampaignIdOrderByIdAsc(Long campaignId);

    List<MemberReminder> findByCampaignIdIn(Collection<Long> campaignIds);

    List<MemberReminder> findByUserIdOrderByIdDesc(UUID userId);

    Optional<MemberReminder> findByDeliveryId(UUID deliveryId);

    /** Dernière fiche de chaque membre, celle que montre la liste. */
    @Query(value = """
            SELECT DISTINCT ON (r.user_id) r.* FROM core.member_reminders r
            JOIN core.reminder_campaigns c ON c.id = r.campaign_id
            WHERE c.status <> 'ANNULEE'
            ORDER BY r.user_id, r.id DESC
            """, nativeQuery = true)
    List<MemberReminder> findLatestPerMember();
}
