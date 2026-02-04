package com.icy.icy_backend.db.repository.user;

import com.icy.icy_backend.db.entity.user.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<User, UUID> {
    Optional<User> findByDiscordId(String discordId);
    Optional<User> findByUsername(String username);
    @Query("SELECT u FROM User u " +
            "LEFT JOIN FETCH u.roles ur " +
            "LEFT JOIN FETCH ur.role " +
            "WHERE u.username = :username")
    Optional<User> findByUsernameWithRoles(@Param("username") String username);


}






