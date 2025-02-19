package com.icy.icy_backend.db.repository;

import com.icy.icy_backend.db.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<User, UUID> {
    Optional<User> findByDiscordId(Long discordId);
    Optional<User> findByUsername(String username);
}
