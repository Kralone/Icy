package com.icy.icy_backend.db.repository.user;

import com.icy.icy_backend.db.entity.user.UserParam;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface UserParamRepository extends JpaRepository<UserParam, UUID> {
}
