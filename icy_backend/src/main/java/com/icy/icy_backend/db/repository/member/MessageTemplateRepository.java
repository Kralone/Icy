package com.icy.icy_backend.db.repository.member;

import com.icy.icy_backend.db.entity.member.MessageTemplate;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MessageTemplateRepository extends JpaRepository<MessageTemplate, String> {
    List<MessageTemplate> findAllByOrderBySortOrderAscLabelAsc();
}
