package com.icy.icy_backend.db.repository.moderation;

import com.icy.icy_backend.db.entity.moderation.MemberSanction;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MemberSanctionRepository extends JpaRepository<MemberSanction, Long> {
    List<MemberSanction> findByUserIdOrderByCreatedAtDescIdDesc(UUID userId);

    List<MemberSanction> findByUserIdIn(Collection<UUID> userIds);

    Optional<MemberSanction> findByDmDeliveryId(UUID deliveryId);

    /** Exclusions dont le ban Discord n'a pas encore été confirmé. */
    List<MemberSanction> findByDecisionAndDiscordBanDoneAtIsNullOrderByCreatedAtAsc(com.icy.icy_backend.db.entity.moderation.SanctionDecision decision);
}
