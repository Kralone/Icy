package com.icy.icy_backend.service.collection;

import com.icy.icy_backend.controller.dto.collection.TemplateCreateDTO;
import com.icy.icy_backend.controller.dto.collection.TemplateDetailDTO;
import com.icy.icy_backend.controller.dto.collection.TemplateListItemDTO;
import com.icy.icy_backend.controller.dto.collection.UserCollectionDetailDTO;
import com.icy.icy_backend.controller.dto.collection.UserCollectionListItemDTO;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.icy.icy_backend.db.entity.collection.CollectionTemplate;
import com.icy.icy_backend.db.entity.collection.UserCollection;
import com.icy.icy_backend.db.repository.collection.CollectionTemplateRepository;
import com.icy.icy_backend.db.repository.collection.UserCollectionRepository;
import com.icy.icy_backend.exception.definition.BadRequestException;
import com.icy.icy_backend.exception.definition.InternalErrorException;
import com.icy.icy_backend.exception.definition.ResourceAlreadyExistsException;
import com.icy.icy_backend.service.notification.NotificationPushService;
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
    private final NotificationPushService notificationPushService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    // --- Templates ---
    @Transactional(readOnly = true)
    public List<TemplateListItemDTO> getTemplates(String archetype, String query) {
        final String searchQuery = (query == null) ? "" : query.toLowerCase();

        List<CollectionTemplate> templates;
        if (archetype != null && !archetype.isBlank()) {
            templates = templateRepository.findAllByArchetypeOrderByCreatedAtDesc(archetype);
        } else {
            templates = templateRepository.findAllByOrderByCreatedAtDesc();
        }

        return templates.stream()
                .filter(t -> t.getName().toLowerCase().contains(searchQuery))
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
            notificationPushService.sendBroadcast(
                    "Collection : nouveau template",
                    "Le template \"" + saved.getName() + "\" est disponible.",
                    "/icy/collection",
                    1
            );

            return new TemplateDetailDTO(saved);

        } catch (Exception e) {
            log.error("Erreur interne lors de la création du template '{}'", dto.getName(), e);
            throw new InternalErrorException("Erreur interne lors de la création du template.");
        }
    }

    @Transactional
    public TemplateDetailDTO updateTemplateByName(String name, TemplateCreateDTO dto) {
        CollectionTemplate existing = templateRepository.findByName(name)
                .orElseThrow(() -> new BadRequestException("Template introuvable : " + name));

        if (dto.getName() == null || dto.getName().isBlank()) {
            throw new BadRequestException("Le nom du template ne peut pas être vide.");
        }

        try {
            existing.setName(dto.getName());
            existing.setArchetype(dto.getArchetype());
            existing.setAxisX(objectMapper.writeValueAsString(dto.getAxisX()));
            existing.setAxisY(objectMapper.writeValueAsString(dto.getAxisY()));
            CollectionTemplate saved = templateRepository.save(existing);
            return new TemplateDetailDTO(saved);
        } catch (Exception e) {
            log.error("Erreur lors de la mise à jour du template '{}'", name, e);
            throw new InternalErrorException("Erreur interne lors de la mise à jour du template.");
        }
    }

}






