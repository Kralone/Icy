package com.icy.icy_backend.db.repository.recruitment;


import com.icy.icy_backend.db.entity.recruitment.Recruitment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface RecruitmentRepository extends JpaRepository<Recruitment, Long> {
}






