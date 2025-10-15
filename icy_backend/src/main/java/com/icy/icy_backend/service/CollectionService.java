package com.icy.icy_backend.service;

import com.icy.icy_backend.controller.dto.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.icy.icy_backend.db.entity.CollectionTemplate;
import com.icy.icy_backend.db.entity.UserCollection;
import com.icy.icy_backend.db.repository.CollectionTemplateRepository;
import com.icy.icy_backend.db.repository.UserCollectionRepository;
import com.icy.icy_backend.exception.definition.BadRequestException;
import com.icy.icy_backend.exception.definition.InternalErrorException;
import com.icy.icy_backend.exception.definition.ResourceAlreadyExistsException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.Principal;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class CollectionService {

    private final CollectionTemplateRepository templateRepository;
    private final UserCollectionRepository userCollectionRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    // --- Templates ---
    @Transactional(readOnly = true)
    public List<TemplateListItemDTO> getTemplates(String archetype, String query) {
        if (query == null) query = ""; // évite l'erreur lower(bytea)
        return templateRepository.search(archetype, query).stream()
                .map(t -> new TemplateListItemDTO(t.getId(), t.getName(), t.getArchetype()))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public TemplateDetailDTO getTemplate(Long id) {
        CollectionTemplate t = templateRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Template not found"));

        // ✅ Utilise simplement le constructeur basé sur l’entité
        return new TemplateDetailDTO(t);
    }

    // --- User Collections ---
    @Transactional
    public UserCollectionDetailDTO importTemplate(String userId, Long templateId, String name) {
        CollectionTemplate t = templateRepository.findById(templateId)
                .orElseThrow(() -> new RuntimeException("Template not found"));

        ArrayNode emptyArray = objectMapper.createArrayNode();

        UserCollection uc = UserCollection.builder()
                .userId(userId)
                .template(t)
                .name(name)
                .checked(emptyArray) // ✅ vrai JSON vide
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();

        log.info("Type de checked avant save : {}", uc.getChecked().getClass().getName());
        userCollectionRepository.save(uc);
        return getUserCollection(userId, uc.getId());
    }

    @Transactional(readOnly = true)
    public List<UserCollectionListItemDTO> getUserCollections(String userId) {
        return userCollectionRepository.findByUserIdOrderByCreatedAtDesc(userId)
                .stream()
                .map(c -> new UserCollectionListItemDTO(c.getId(), c.getTemplate().getId(), c.getName()))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public UserCollectionDetailDTO getUserCollection(String userId, Long id) {
        UserCollection uc = userCollectionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Collection not found"));

        if (!uc.getUserId().equals(userId)) {
            throw new RuntimeException("Forbidden");
        }

        try {
            CollectionTemplate t = uc.getTemplate();
            return new UserCollectionDetailDTO(
                    uc.getId(),
                    t.getId(),
                    uc.getName(),
                    objectMapper.readTree(t.getAxisX()),
                    objectMapper.readTree(t.getAxisY()),
                    uc.getChecked() // ✅ plus besoin de parse
            );
        } catch (Exception e) {
            throw new RuntimeException("Error parsing collection JSON", e);
        }
    }

    @Transactional
    public List<String> patchCell(String userId, Long id, String x, String y, Boolean checked) {
        UserCollection uc = userCollectionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Collection not found"));

        if (!uc.getUserId().equals(userId)) {
            throw new RuntimeException("Forbidden");
        }

        String key = x + "|" + y;

        try {
            // ✅ récupère la liste actuelle depuis JsonNode
            List<String> list = objectMapper.convertValue(
                    uc.getChecked(),
                    objectMapper.getTypeFactory().constructCollectionType(List.class, String.class)
            );

            if (checked) {
                if (!list.contains(key)) list.add(key);
            } else {
                list.remove(key);
            }

            // ✅ reconvertit en JSON
            ArrayNode updated = objectMapper.valueToTree(list);
            uc.setChecked(updated);
            uc.setUpdatedAt(Instant.now());
            userCollectionRepository.save(uc);
            return list;
        } catch (Exception e) {
            throw new RuntimeException("Error updating cell state", e);
        }
    }

    @Transactional
    public void deleteUserCollection(String userId, Long id) {
        userCollectionRepository.deleteByIdAndUserId(id, userId);
    }

    @Transactional
    public TemplateDetailDTO createTemplate(TemplateCreateDTO dto) {
        log.debug("Création d’un template : {}", dto.getName());

        if (dto.getName() == null || dto.getName().isBlank()) {
            throw new BadRequestException("Le nom du template ne peut pas être vide.");
        }

        if (templateRepository.existsByName(dto.getName())) {
            throw new ResourceAlreadyExistsException("Un template portant ce nom existe déjà.");
        }

        try {
            CollectionTemplate template = new CollectionTemplate();
            template.setName(dto.getName());
            template.setArchetype(dto.getArchetype());

            // ✅ on sérialise directement le JSON reçu
            template.setAxisX(objectMapper.writeValueAsString(dto.getAxisX()));
            template.setAxisY(objectMapper.writeValueAsString(dto.getAxisY()));
            template.setCreatedAt(Instant.now());

            CollectionTemplate saved = templateRepository.save(template);
            log.info("Template '{}' créé avec succès (id={})", saved.getName(), saved.getId());

            return new TemplateDetailDTO(saved);

        } catch (Exception e) {
            log.error("Erreur interne lors de la création du template '{}'", dto.getName(), e);
            throw new InternalErrorException("Erreur interne lors de la création du template.");
        }
    }

}
