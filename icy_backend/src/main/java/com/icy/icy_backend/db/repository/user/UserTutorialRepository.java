package com.icy.icy_backend.db.repository.user;

import com.icy.icy_backend.db.entity.user.UserTutorial;
import com.icy.icy_backend.db.entity.user.id.UserTutorialId;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface UserTutorialRepository extends JpaRepository<UserTutorial, UserTutorialId> {
    List<UserTutorial> findByUserIdOrderByTutorialIdAsc(UUID userId);
}
