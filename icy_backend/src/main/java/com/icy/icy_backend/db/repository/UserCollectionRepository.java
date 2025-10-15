package com.icy.icy_backend.db.repository;

import com.icy.icy_backend.db.entity.UserCollection;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface UserCollectionRepository extends JpaRepository<UserCollection, Long> {
    List<UserCollection> findByUserIdOrderByCreatedAtDesc(String userId);

    void deleteByIdAndUserId(Long id, String userId);
}
