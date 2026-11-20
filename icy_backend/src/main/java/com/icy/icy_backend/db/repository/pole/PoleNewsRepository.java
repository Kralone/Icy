package com.icy.icy_backend.db.repository.pole;

import com.icy.icy_backend.db.entity.pole.PoleNews;
import com.icy.icy_backend.db.entity.user.Specialty;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PoleNewsRepository extends JpaRepository<PoleNews, Long> {
    List<PoleNews> findTop10ByPoleOrderByCreatedAtDescIdDesc(Specialty pole);
}
