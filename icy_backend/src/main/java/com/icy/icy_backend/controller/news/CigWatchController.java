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

    public CigWatchController(CigWatchService cigWatchService) {
        this.cigWatchService = cigWatchService;
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
