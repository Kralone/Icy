package com.icy.icy_backend.db.repository.user;

import com.icy.icy_backend.db.entity.user.Role;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface RoleRepository extends JpaRepository<Role, UUID> {
    Optional<Role> findByName(String name);
}






