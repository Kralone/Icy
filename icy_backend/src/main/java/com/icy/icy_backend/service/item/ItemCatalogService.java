package com.icy.icy_backend.service.item;

import com.icy.icy_backend.controller.dto.request.admin.ItemCategoryCreateRequest;
import com.icy.icy_backend.controller.dto.request.admin.ItemUpsertRequest;
import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import com.icy.icy_backend.db.entity.item.Item;
import com.icy.icy_backend.db.entity.item.ItemCategory;
import com.icy.icy_backend.db.repository.item.ItemCategoryRepository;
import com.icy.icy_backend.db.repository.item.ItemRepository;
import com.icy.icy_backend.exception.definition.BadRequestException;
import com.icy.icy_backend.exception.definition.ResourceNotFoundException;
import com.icy.icy_backend.service.common.MessageService;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class ItemCatalogService {
    private final ItemRepository itemRepository;
    private final ItemCategoryRepository itemCategoryRepository;
    private final MessageService messageService;

    public ItemCatalogService(
            ItemRepository itemRepository,
            ItemCategoryRepository itemCategoryRepository,
            MessageService messageService
    ) {
        this.itemRepository = itemRepository;
        this.itemCategoryRepository = itemCategoryRepository;
        this.messageService = messageService;
    }

    @Transactional(readOnly = true)
    public ResponseEntity<MessageResponse<List<Item>>> listItems() {
        List<Item> rows = itemRepository.findAllByOrderByNameAsc();
        return messageService.buildResponse("item.list", rows, rows.size());
    }

    @Transactional(readOnly = true)
    public ResponseEntity<MessageResponse<List<ItemCategory>>> listCategories() {
        List<ItemCategory> rows = itemCategoryRepository.findAllByOrderByNameAsc();
        return messageService.buildResponse("item.category.list", rows, rows.size());
    }

    @Transactional
    public ResponseEntity<MessageResponse<ItemCategory>> createCategory(ItemCategoryCreateRequest request) {
        if (request == null) {
            throw new BadRequestException("Payload categorie manquant.");
        }
        String name = trimToNull(request.name());
        if (name == null) {
            throw new BadRequestException("Le nom de categorie est requis.");
        }

        ItemCategory existing = itemCategoryRepository.findByNameIgnoreCase(name).orElse(null);
        if (existing != null) {
            return messageService.buildResponse("item.category.created", existing, existing.getName());
        }

        ItemCategory category = new ItemCategory();
        category.setName(name);
        ItemCategory saved = itemCategoryRepository.save(category);
        return messageService.buildResponse("item.category.created", saved, saved.getName());
    }

    @Transactional
    public ResponseEntity<MessageResponse<Item>> createItem(ItemUpsertRequest request) {
        ItemPayload payload = sanitize(request);
        Item item = new Item();
        applyPayload(item, payload);
        Item saved = itemRepository.save(item);
        return messageService.buildResponse("item.created", saved, saved.getName());
    }

    @Transactional
    public ResponseEntity<MessageResponse<Item>> updateItem(Long id, ItemUpsertRequest request) {
        Item existing = itemRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Item introuvable avec l'id " + id));
        ItemPayload payload = sanitize(request);
        applyPayload(existing, payload);
        Item saved = itemRepository.save(existing);
        return messageService.buildResponse("item.updated", saved, saved.getName());
    }

    @Transactional
    public ResponseEntity<MessageResponse<String>> deleteItem(Long id) {
        Item existing = itemRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Item introuvable avec l'id " + id));
        String name = existing.getName();
        itemRepository.delete(existing);
        return messageService.buildResponse("item.deleted", name, name);
    }

    private ItemPayload sanitize(ItemUpsertRequest request) {
        if (request == null) {
            throw new BadRequestException("Payload item manquant.");
        }
        String name = trimToNull(request.name());
        if (name == null) {
            throw new BadRequestException("Le nom de l'item est requis.");
        }

        String manufacturer = trimToNull(request.manufacturer());
        String imageUrl = trimToNull(request.imageUrl());
        String description = trimToNull(request.description());
        String stats = trimToNull(request.stats());
        ItemCategory category = null;
        if (request.categoryId() != null) {
            category = itemCategoryRepository.findById(request.categoryId())
                    .orElseThrow(() -> new ResourceNotFoundException("Categorie introuvable avec l'id " + request.categoryId()));
        }

        return new ItemPayload(name, manufacturer, imageUrl, description, stats, category);
    }

    private void applyPayload(Item item, ItemPayload payload) {
        item.setName(payload.name());
        item.setManufacturer(payload.manufacturer());
        item.setImageUrl(payload.imageUrl());
        item.setDescription(payload.description());
        item.setStats(payload.stats());
        item.setCategory(payload.category());
    }

    private String trimToNull(String raw) {
        if (raw == null) {
            return null;
        }
        String trimmed = raw.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private record ItemPayload(
            String name,
            String manufacturer,
            String imageUrl,
            String description,
            String stats,
            ItemCategory category
    ) {
    }
}
