package com.icy.icy_backend.db.repository.bank;

import com.icy.icy_backend.db.entity.bank.BankProject;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface BankProjectRepository extends JpaRepository<BankProject, UUID> {
    List<BankProject> findAllByOrderByCreatedAtDesc();
}
