package com.icy.icy_backend.service.guide;

import com.icy.icy_backend.controller.dto.guide.GuideRequest;
import com.icy.icy_backend.db.entity.guide.Guide;
import com.icy.icy_backend.db.repository.guide.GuideRepository;
import com.icy.icy_backend.exception.definition.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.util.List;

@Service @RequiredArgsConstructor
public class GuideService {
    private final GuideRepository repository;

    public List<Guide> listAdmin() { return repository.findAllByOrderByUpdatedAtDesc(); }
    public List<Guide> listPublished() { return repository.findAllByPublishedTrueOrderByUpdatedAtDesc(); }
    public Guide getPublished(String slug) { return repository.findBySlugAndPublishedTrue(slug).orElseThrow(() -> new ResourceNotFoundException("Guide introuvable")); }

    @Transactional
    public Guide save(Long id, GuideRequest request) {
        Guide guide = id == null ? new Guide() : repository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Guide introuvable"));
        guide.setSlug(required(request.getSlug(), "Le slug est obligatoire").trim().toLowerCase());
        guide.setTitle(required(request.getTitle(), "Le titre est obligatoire").trim());
        guide.setSummary(request.getSummary());
        guide.setContent(required(request.getContent(), "Le contenu est obligatoire"));
        guide.setStatus(request.getStatus() == null || request.getStatus().isBlank() ? "DRAFT" : request.getStatus().trim().toUpperCase());
        guide.setPublished(request.isPublished());
        guide.setGameVersion(request.getGameVersion());
        guide.setUpdatedAt(LocalDateTime.now());
        return repository.save(guide);
    }

    public void delete(Long id) { repository.deleteById(id); }
    private String required(String value, String message) { if (value == null || value.isBlank()) throw new IllegalArgumentException(message); return value; }
}
