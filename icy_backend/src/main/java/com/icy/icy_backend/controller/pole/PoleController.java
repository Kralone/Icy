package com.icy.icy_backend.controller.pole;

import com.icy.icy_backend.controller.dto.pole.PoleDtos;
import com.icy.icy_backend.service.pole.PoleHomeService;
import com.icy.icy_backend.service.pole.PoleService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Pôles de l'organisation (Logistique, Militaire, Industrie), visibles par tous les membres.
 * Le droit de gérer un pôle dépend du pôle : il est contrôlé dans PoleHomeService.
 */
@RestController
@RequestMapping("/api/poles")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class PoleController {
    private final PoleService poles;
    private final PoleHomeService home;

    @GetMapping
    public List<PoleDtos.Pole> poles() {
        return poles.poles();
    }

    @GetMapping("/{pole}")
    public PoleDtos.Home home(@PathVariable String pole) {
        return home.home(pole);
    }

    @PostMapping("/{pole}/news")
    @ResponseStatus(HttpStatus.CREATED)
    public PoleDtos.News publish(@PathVariable String pole, @RequestBody PoleDtos.NewsRequest request) {
        return home.publish(pole, request);
    }

    @PutMapping("/{pole}/news/{id}")
    public PoleDtos.News update(@PathVariable String pole, @PathVariable Long id, @RequestBody PoleDtos.NewsRequest request) {
        return home.update(pole, id, request);
    }

    @DeleteMapping("/{pole}/news/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String pole, @PathVariable Long id) {
        home.delete(pole, id);
    }
}
