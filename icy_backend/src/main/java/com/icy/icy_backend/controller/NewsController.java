package com.icy.icy_backend.controller;

import com.icy.icy_backend.controller.dto.NewsDTO;
import com.icy.icy_backend.controller.dto.NewsRequest;
import com.icy.icy_backend.db.entity.News;
import com.icy.icy_backend.db.entity.NewsType;
import com.icy.icy_backend.service.NewsService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/news")
@RequiredArgsConstructor
public class NewsController {

    private final NewsService service;

    // === NEWS ===
    @GetMapping
    public Page<NewsDTO> getAll(@RequestParam(defaultValue = "0") int page,
                                @RequestParam(defaultValue = "10") int size) {
        return service.getAll(PageRequest.of(page, size));
    }

    @PostMapping
    public News create(@RequestBody NewsRequest req) {
        News news = new News();
        news.setTitle(req.getTitle());
        news.setContent(req.getContent());
        return service.create(news, req.getTypeId());
    }

    @PutMapping("/{id}")
    public NewsDTO update(@PathVariable Long id, @RequestBody NewsRequest req) {
        News updated = new News();
        updated.setTitle(req.getTitle());
        updated.setContent(req.getContent());
        NewsType type = new NewsType();
        type.setId(req.getTypeId());
        updated.setType(type);
        return service.update(id, updated);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        service.delete(id);
    }

    // === TYPES ===
    @GetMapping("/types")
    public List<NewsType> getTypes() {
        return service.getAllTypes();
    }

    @PostMapping("/types")
    public NewsType createType(@RequestBody NewsType type) {
        return service.createType(type);
    }

    @PutMapping("/types/{id}")
    public NewsType updateType(@PathVariable Long id, @RequestBody NewsType type) {
        return service.updateType(id, type);
    }

    @DeleteMapping("/types/{id}")
    public void deleteType(@PathVariable Long id) {
        service.deleteType(id);
    }
}
