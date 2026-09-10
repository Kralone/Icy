package com.icy.icy_backend.controller.news;

import com.icy.icy_backend.controller.dto.news.CigFeedResponseDTO;
import com.icy.icy_backend.controller.dto.news.CigWatchSourceDTO;
import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import com.icy.icy_backend.service.news.CigWatchService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/news/cig")
@PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
public class CigWatchController {

    private final CigWatchService cigWatchService;
    private final com.icy.icy_backend.service.news.CigWatchPublicationService publication;

    public CigWatchController(CigWatchService cigWatchService, com.icy.icy_backend.service.news.CigWatchPublicationService publication) {
        this.publication = publication;
        this.cigWatchService = cigWatchService;
    }

    public record TranslationCorrection(String titleFr, String excerptFr) {}

    @org.springframework.web.bind.annotation.PutMapping("/entries/{id}/translation")
    public ResponseEntity<MessageResponse<CigFeedResponseDTO>> correctTranslation(
            @org.springframework.web.bind.annotation.PathVariable Long id,
            @org.springframework.web.bind.annotation.RequestBody TranslationCorrection correction) {
        publication.correctTranslation(id, correction.titleFr(), correction.excerptFr());
        return cigWatchService.loadLatestFeed(40);
    }

    @PostMapping("/entries/{id}/retry")
    public ResponseEntity<MessageResponse<CigFeedResponseDTO>> retry(@org.springframework.web.bind.annotation.PathVariable Long id) {
        publication.requestAction(id, false);
        return cigWatchService.loadLatestFeed(40);
    }

    @PostMapping("/entries/{id}/publish")
    public ResponseEntity<MessageResponse<CigFeedResponseDTO>> publish(@org.springframework.web.bind.annotation.PathVariable Long id) {
        publication.requestAction(id, true);
        return cigWatchService.loadLatestFeed(40);
    }

    @org.springframework.web.bind.annotation.ExceptionHandler(org.springframework.web.server.ResponseStatusException.class)
    public ResponseEntity<java.util.Map<String, String>> rejectedAction(org.springframework.web.server.ResponseStatusException exception) {
        return ResponseEntity.status(exception.getStatusCode()).body(java.util.Map.of(
                "message", exception.getReason() == null ? "Action impossible" : exception.getReason()));
    }

    @GetMapping("/sources")
    public ResponseEntity<MessageResponse<List<CigWatchSourceDTO>>> listSources() {
        return cigWatchService.listSources();
    }

    @GetMapping("/feed")
    public ResponseEntity<MessageResponse<CigFeedResponseDTO>> getFeed(
            @RequestParam(defaultValue = "40") Integer limit
    ) {
        return cigWatchService.loadLatestFeed(limit);
    }

    @PostMapping("/feed/refresh")
    public ResponseEntity<MessageResponse<CigFeedResponseDTO>> forceRefreshFeed(
            @RequestParam(defaultValue = "40") Integer limit
    ) {
        return cigWatchService.forceRefreshAndLoadFeed(limit);
    }
}
