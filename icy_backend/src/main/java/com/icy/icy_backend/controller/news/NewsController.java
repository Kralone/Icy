package com.icy.icy_backend.controller.news;

import com.icy.icy_backend.controller.dto.news.NewsDTO;
import com.icy.icy_backend.controller.dto.news.NewsRequest;
import com.icy.icy_backend.db.entity.news.News;
import com.icy.icy_backend.db.entity.news.NewsType;
import com.icy.icy_backend.service.news.NewsService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.prepost.PreAuthorize;
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

    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    @PostMapping
    public News create(@RequestBody NewsRequest req) {
        News news = new News();
        news.setTitle(req.getTitle());
        news.setContent(req.getContent());
        return service.create(news, req.getTypeId());
    }

    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
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

    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        service.delete(id);
    }

    // === TYPES ===
    @GetMapping("/types")
    public List<NewsType> getTypes() {
        return service.getAllTypes();
    }

    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    @PostMapping("/types")
    public NewsType createType(@RequestBody NewsType type) {
        return service.createType(type);
    }

    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    @PutMapping("/types/{id}")
    public NewsType updateType(@PathVariable Long id, @RequestBody NewsType type) {
        return service.updateType(id, type);
    }

    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    @DeleteMapping("/types/{id}")
    public void deleteType(@PathVariable Long id) {
        service.deleteType(id);
    }
}






