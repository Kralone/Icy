package com.icy.icy_backend.db.repository.user;

import com.icy.icy_backend.db.entity.user.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.time.LocalDateTime;

public interface UserRepository extends JpaRepository<User, UUID> {
    Optional<User> findByDiscordId(String discordId);
    Optional<User> findByUsername(String username);
    @Query("SELECT DISTINCT u FROM User u " +
            "JOIN u.roles ur " +
            "JOIN ur.role r " +
            "WHERE r.name = :roleName")
    List<User> findAllByRoleName(@Param("roleName") String roleName);
    @Query("SELECT u FROM User u " +
            "LEFT JOIN FETCH u.roles ur " +
            "LEFT JOIN FETCH ur.role " +
            "WHERE u.username = :username")
    Optional<User> findByUsernameWithRoles(@Param("username") String username);

    List<User> findByCreatedAtAfterOrderByCreatedAtDesc(LocalDateTime since);


}






