package com.icy.icy_backend.db.repository.member;

import com.icy.icy_backend.db.entity.member.DirectMessage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public interface DirectMessageRepository extends JpaRepository<DirectMessage, UUID> {
    List<DirectMessage> findByStatusAndRequestedAtBefore(DirectMessage.Status status, LocalDateTime before);

    List<DirectMessage> findTop20ByUserIdOrderByRequestedAtDesc(UUID userId);

    List<DirectMessage> findByIdIn(java.util.Collection<UUID> ids);
}
