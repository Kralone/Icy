package com.icy.icy_backend.db.repository.utils;

import com.icy.icy_backend.db.entity.utils.ExecutiveHangarPlayerStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ExecutiveHangarPlayerStatusRepository extends JpaRepository<ExecutiveHangarPlayerStatus, UUID> {
    List<ExecutiveHangarPlayerStatus> findAllByOrderByUserIdAsc();
}
