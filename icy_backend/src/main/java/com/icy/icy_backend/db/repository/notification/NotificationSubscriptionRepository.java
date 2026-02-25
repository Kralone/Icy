package com.icy.icy_backend.db.repository.notification;

import com.icy.icy_backend.db.entity.notification.NotificationSubscription;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface NotificationSubscriptionRepository extends JpaRepository<NotificationSubscription, UUID> {
    Optional<NotificationSubscription> findByEndpoint(String endpoint);
    List<NotificationSubscription> findByUserId(UUID userId);
    List<NotificationSubscription> findByUserIdIn(List<UUID> userIds);
    void deleteByEndpoint(String endpoint);
}
