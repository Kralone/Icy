package com.icy.icy_backend.controller.guide;

import com.icy.icy_backend.controller.dto.guide.GuideRequest;
import com.icy.icy_backend.db.entity.guide.Guide;
import com.icy.icy_backend.service.guide.GuideService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController @RequiredArgsConstructor
public class GuideController {
    private final GuideService service;

    @GetMapping("/api/guides")
    public List<Guide> published() { return service.listPublished(); }

    @GetMapping("/api/guides/{slug}")
    public Guide published(@PathVariable String slug) { return service.getPublished(slug); }

    @GetMapping("/api/admin/guides")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    public List<Guide> adminList() { return service.listAdmin(); }

    @PostMapping("/api/admin/guides")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    public Guide create(@RequestBody GuideRequest request) { return service.save(null, request); }

    @PutMapping("/api/admin/guides/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    public Guide update(@PathVariable Long id, @RequestBody GuideRequest request) { return service.save(id, request); }

    @DeleteMapping("/api/admin/guides/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    public void delete(@PathVariable Long id) { service.delete(id); }
}
