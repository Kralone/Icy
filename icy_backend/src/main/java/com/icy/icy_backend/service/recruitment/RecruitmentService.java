package com.icy.icy_backend.service.recruitment;

import com.icy.icy_backend.controller.dto.recruitment.RecruitmentDTO;
import com.icy.icy_backend.db.entity.recruitment.Recruitment;
import com.icy.icy_backend.db.repository.recruitment.RecruitmentRepository;
import com.icy.icy_backend.exception.definition.ResourceNotFoundException;
import jakarta.transaction.Transactional;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.List;

@Slf4j
@Service
public class RecruitmentService {

    private final RecruitmentRepository recruitmentRepository;
    private static final Logger logger = LoggerFactory.getLogger(RecruitmentService.class);

    public RecruitmentService(RecruitmentRepository recruitmentRepository) {
        this.recruitmentRepository = recruitmentRepository;
    }

    public RecruitmentDTO create(RecruitmentDTO dto) {
        logger.info("Creating recruitment for {}", dto.getUsername());
        Recruitment recruitment = new Recruitment(dto);
        return new RecruitmentDTO(recruitmentRepository.save(recruitment));
    }

    public List<RecruitmentDTO> getAll() {
        return recruitmentRepository.findAll().stream()
                .map(RecruitmentDTO::new)
                .toList();
    }

    public RecruitmentDTO getById(Long id) {
        Recruitment recruitment = recruitmentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Recruitment not found for id: " + id));
        return new RecruitmentDTO(recruitment);
    }

    public RecruitmentDTO update(Long id, RecruitmentDTO dto) {
        Recruitment existing = recruitmentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Recruitment not found for id: " + id));
        existing.updateFromDto(dto);
        logger.info("Updating recruitment {}", id);
        return new RecruitmentDTO(recruitmentRepository.save(existing));
    }

    public void delete(Long id) {
        Recruitment existing = recruitmentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Recruitment not found for id: " + id));
        recruitmentRepository.delete(existing);
        logger.warn("Deleted recruitment {}", id);
    }

    @Transactional
    public void updateStatus(Long id, String status) {
        Recruitment recruitment = recruitmentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Recruitment not found"));

        recruitment.setStatus(status);
        recruitmentRepository.save(recruitment);
        log.info("Recruitment {} marked as {}", id, status);
    }

}






