package com.icy.icy_backend.db.repository.session;

import com.icy.icy_backend.db.entity.session.SessionExpense;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface SessionExpenseRepository extends JpaRepository<SessionExpense, UUID> {
    List<SessionExpense> findBySheetIdOrderByCreatedAtAsc(UUID sheetId);
}
