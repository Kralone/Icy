package com.icy.icy_backend.db.repository.bank;

import com.icy.icy_backend.db.entity.bank.BankEntry;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface BankEntryRepository extends JpaRepository<BankEntry, UUID> {
    List<BankEntry> findAllByOrderByOccurredOnDescRecordedAtDesc();
}
