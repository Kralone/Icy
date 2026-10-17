package com.icy.icy_backend.db.repository.session;

import com.icy.icy_backend.db.entity.session.SessionHistory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface SessionHistoryRepository extends JpaRepository<SessionHistory, UUID> {
    List<SessionHistory> findBySheetIdOrderByAtDesc(UUID sheetId);
}
