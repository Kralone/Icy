package com.icy.icy_backend.db.repository.member;

import com.icy.icy_backend.db.entity.member.MemberActivitySettings;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MemberActivitySettingsRepository extends JpaRepository<MemberActivitySettings, Short> {
}
