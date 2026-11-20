package com.icy.icy_backend.controller.pole;

import com.icy.icy_backend.controller.dto.pole.PoleDtos;
import com.icy.icy_backend.service.pole.PoleService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Pôles de l'organisation (Logistique, Militaire, Industrie) et leurs référents, visibles par tous les membres. */
@RestController
@RequestMapping("/api/poles")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class PoleController {
    private final PoleService poles;

    @GetMapping
    public List<PoleDtos.Pole> poles() {
        return poles.poles();
    }
}
