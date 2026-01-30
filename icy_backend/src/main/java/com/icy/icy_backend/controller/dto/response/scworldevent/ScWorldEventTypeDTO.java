package com.icy.icy_backend.controller.dto.response.scworldevent;

import com.icy.icy_backend.db.entity.scworldevent.ScWorldEventType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ScWorldEventTypeDTO {
    private String name;
    private String textColor;
    private String imageUrl;
    private String scoreSchema;
    private Instant createdAt;

    public static ScWorldEventTypeDTO from(ScWorldEventType t) {
        return ScWorldEventTypeDTO.builder()
                .name(t.getName())
                .textColor(t.getTextColor())
                .imageUrl(t.getImageUrl())
                .scoreSchema(t.getScoreSchema())
                .createdAt(t.getCreatedAt())
                .build();
    }
}
