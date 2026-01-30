package com.icy.icy_backend.controller.dto.response.scworldevent;

import com.icy.icy_backend.db.entity.scworldevent.ScWorldEvent;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ScWorldEventDTO {
    private UUID id;
    private String title;
    private String description;
    private Instant startAt;
    private Instant endAt;

    private String typeName;
    private String typeTextColor;
    private String typeImageUrl;

    private String bannerImageUrl;
    private String gallery;

    /**
     * Le schéma renvoyé au frontend.
     * Il provient désormais toujours du Type parent.
     */
    private String scoreSchema;

    public static ScWorldEventDTO from(ScWorldEvent e) {
        if (e == null) return null;

        var t = e.getType();

        return ScWorldEventDTO.builder()
                .id(e.getId())
                .title(e.getTitle())
                .description(e.getDescription())
                .startAt(e.getStartAt())
                .endAt(e.getEndAt())

                // Infos du Type
                .typeName(t.getName())
                .typeTextColor(t.getTextColor())
                .typeImageUrl(t.getImageUrl())

                // Infos de l'Event
                .bannerImageUrl(e.getBannerImageUrl())
                .gallery(e.getGallery())

                // ✅ CHANGEMENT : On prend directement le schema du Type.
                // Plus de logique de fallback ou de snapshot.
                .scoreSchema(t.getScoreSchema())

                .build();
    }
}