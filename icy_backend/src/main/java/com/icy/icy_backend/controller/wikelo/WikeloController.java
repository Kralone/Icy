package com.icy.icy_backend.controller.wikelo;

import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import com.icy.icy_backend.db.entity.utils.WikeloShip;
import com.icy.icy_backend.service.wikelo.WikeloService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/wikelo")
public class WikeloController {
    private final WikeloService wikeloService;

    public WikeloController(WikeloService wikeloService) {
        this.wikeloService = wikeloService;
    }

    @GetMapping("/ships")
    public ResponseEntity<MessageResponse<List<WikeloShip>>> getShips() {
        return wikeloService.getShips();
    }

    @PostMapping("/ships/rescrape")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    public ResponseEntity<MessageResponse<List<WikeloShip>>> rescrapeShips() {
        return wikeloService.rescrapeShips();
    }
}
