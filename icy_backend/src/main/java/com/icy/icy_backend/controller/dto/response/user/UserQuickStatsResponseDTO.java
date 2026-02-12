package com.icy.icy_backend.controller.dto.response.user;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class UserQuickStatsResponseDTO {
    private long missions;
    private long events;
    private long ships;
    private long collections;
}
