package com.icy.icy_backend.db.repository.moderation;

import com.icy.icy_backend.db.entity.moderation.MemberWarning;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MemberWarningRepository extends JpaRepository<MemberWarning, Long> {
    List<MemberWarning> findByUserIdOrderByCreatedAtDescIdDesc(UUID userId);

    long countByUserIdAndRevokedAtIsNull(UUID userId);

    /** Avertissements en cours de tous les membres, pour la liste. */
    List<MemberWarning> findByRevokedAtIsNull();

    Optional<MemberWarning> findByDmDeliveryId(UUID deliveryId);

    /** Verrouille le membre jusqu'à la fin de la transaction : deux avertissements simultanés reçoivent des rangs distincts. */
    @Query(value = "SELECT id FROM core.users WHERE id = :userId FOR UPDATE", nativeQuery = true)
    Optional<UUID> lockMember(@Param("userId") UUID userId);
}
