package com.icy.icy_backend.controller.admin;

import com.icy.icy_backend.controller.dto.request.admin.ItemCategoryCreateRequest;
import com.icy.icy_backend.controller.dto.request.admin.ItemUpsertRequest;
import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import com.icy.icy_backend.db.entity.item.Item;
import com.icy.icy_backend.db.entity.item.ItemCategory;
import com.icy.icy_backend.service.item.ItemCatalogService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/admin/items")
public class ItemAdminController {
    private final ItemCatalogService itemCatalogService;

    public ItemAdminController(ItemCatalogService itemCatalogService) {
        this.itemCatalogService = itemCatalogService;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    public ResponseEntity<MessageResponse<List<Item>>> listItems() {
        return itemCatalogService.listItems();
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    public ResponseEntity<MessageResponse<Item>> createItem(@RequestBody ItemUpsertRequest request) {
        return itemCatalogService.createItem(request);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    public ResponseEntity<MessageResponse<Item>> updateItem(
            @PathVariable Long id,
            @RequestBody ItemUpsertRequest request
    ) {
        return itemCatalogService.updateItem(id, request);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    public ResponseEntity<MessageResponse<String>> deleteItem(@PathVariable Long id) {
        return itemCatalogService.deleteItem(id);
    }

    @GetMapping("/categories")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    public ResponseEntity<MessageResponse<List<ItemCategory>>> listCategories() {
        return itemCatalogService.listCategories();
    }

    @PostMapping("/categories")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    public ResponseEntity<MessageResponse<ItemCategory>> createCategory(@RequestBody ItemCategoryCreateRequest request) {
        return itemCatalogService.createCategory(request);
    }
}
