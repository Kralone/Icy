package com.icy.icy_backend.service;

import com.icy.icy_backend.controller.dto.NewsDTO;
import com.icy.icy_backend.controller.dto.NewsTypeDTO;
import com.icy.icy_backend.db.entity.News;
import com.icy.icy_backend.db.entity.NewsType;
import com.icy.icy_backend.db.entity.User;
import com.icy.icy_backend.db.repository.NewsRepository;
import com.icy.icy_backend.db.repository.NewsTypeRepository;
import com.icy.icy_backend.exception.definition.ResourceAlreadyExistsException;
import com.icy.icy_backend.exception.definition.ResourceNotFoundException;
import com.icy.icy_backend.security.AuthUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class NewsService {

    private final NewsRepository newsRepository;
    private final NewsTypeRepository typeRepository;
    private final UserService userService;

    // === NEWS ===
    public Page<NewsDTO> getAll(Pageable pageable) {
        log.info("Fetching paginated news list");
        return newsRepository.findAll(pageable)
                .map(this::toDTO);
    }

    private NewsDTO toDTO(News news) {
        return NewsDTO.builder()
                .id(news.getId())
                .title(news.getTitle())
                .content(news.getContent())
                .createdAt(news.getCreatedAt())
                .author(news.getAuthor() != null ? news.getAuthor() : null)
                .type(news.getType() != null ?
                        new NewsTypeDTO(
                                news.getType().getId(),
                                news.getType().getName(),
                                news.getType().getColor(),
                                news.getType().getImageUrl()
                        ) : null
                )
                .build();
    }


    public News getObjectById(Long id) {
        return newsRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Actualité introuvable"));
    }

    public News create(News news, Long typeId) {
        log.info("Création d'une actualité : {}", news.getTitle());

        NewsType type = typeRepository.findById(typeId)
                .orElseThrow(() -> new ResourceNotFoundException("Type d’actualité non trouvé"));
        news.setType(type);

        news.setAuthor(userService.findUserById(AuthUtils.getCurrentUserId()).getUsername());

        return newsRepository.save(news);
    }


    public NewsDTO update(Long id, News updated) {
        News existing = getObjectById(id);
        existing.setTitle(updated.getTitle());
        existing.setContent(updated.getContent());
        existing.setType(getTypeById(updated.getType().getId()));
        log.info("Updating news id={}", id);
        News saved = newsRepository.save(existing);
        return toDTO(saved);
    }

    public void delete(Long id) {
        News existing = getObjectById(id);
        log.info("Deleting news id={}", id);
        newsRepository.delete(existing);
    }

    // === TYPES ===
    public List<NewsType> getAllTypes() {
        log.info("Fetching all news types");
        return typeRepository.findAll();
    }

    public NewsType getTypeById(Long id) {
        return typeRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Type de news introuvable"));
    }

    public NewsType createType(NewsType type) {
        typeRepository.findByNameIgnoreCase(type.getName()).ifPresent(existing -> {
            log.warn("Type {} already exists", existing.getName());
            throw new ResourceAlreadyExistsException("Ce type existe déjà");
        });
        log.info("Creating new NewsType: {}", type.getName());
        return typeRepository.save(type);
    }

    public NewsType updateType(Long id, NewsType updated) {
        NewsType existing = getTypeById(id);
        existing.setName(updated.getName());
        existing.setColor(updated.getColor());
        existing.setImageUrl(updated.getImageUrl());
        log.info("Updating NewsType id={}", id);
        return typeRepository.save(existing);
    }

    public void deleteType(Long id) {
        NewsType existing = getTypeById(id);
        log.info("Deleting NewsType id={}", id);
        typeRepository.delete(existing);
    }
}
