package com.icy.icy_backend.controller.availability;

import com.icy.icy_backend.controller.dto.availability.AvailabilityDtos;
import com.icy.icy_backend.security.AuthUtils;
import com.icy.icy_backend.service.availability.AvailabilityService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Disponibilités habituelles. Chacun gère les siennes ; la grille de tous les membres sert aux admins et officiers qui planifient. */
@RestController
@RequestMapping("/api/availability")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class AvailabilityController {
    private final AvailabilityService availability;

    @GetMapping("/me")
    public AvailabilityDtos.Mine mine() {
        return availability.mine(AuthUtils.getCurrentUserId());
    }

    @PutMapping("/me")
    public AvailabilityDtos.Mine replace(@RequestBody AvailabilityDtos.UpdateRequest request) {
        return availability.replace(AuthUtils.getCurrentUserId(), request);
    }

    @GetMapping("/members")
    @PreAuthorize("hasAnyRole('ADMIN', 'OFFICIER')")
    public List<AvailabilityDtos.Member> members() {
        return availability.members();
    }
}
