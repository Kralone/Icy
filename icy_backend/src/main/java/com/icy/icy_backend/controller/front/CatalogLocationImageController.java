package com.icy.icy_backend.controller.front;

import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import com.icy.icy_backend.service.common.MessageService;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.List;
import java.time.OffsetDateTime;

@RestController
public class CatalogLocationImageController {
    private final JdbcTemplate jdbc;
    private final MessageService messages;
    public CatalogLocationImageController(JdbcTemplate jdbc, MessageService messages) {
        this.jdbc = jdbc; this.messages = messages;
    }

    @GetMapping("/api/front/location-images")
    @Transactional(readOnly = true)
    public ResponseEntity<MessageResponse<List<LocationImage>>> images() {
        List<LocationImage> rows = jdbc.query("""
                SELECT id, name, family, image_url, source, source_url, source_version, source_updated_at,
                    regexp_replace(COALESCE(NULLIF(source_payload#>>'{star,name}', ''),
                        source_payload->>'system', ''), '\\s+[Ss]ystem$', '') AS system_name
                FROM catalog.entries
                WHERE active=TRUE AND dataset_key='locations' AND source='STAR_CITIZEN_WIKI'
                    AND image_is_fallback=FALSE AND image_url<>''
                ORDER BY name,id
                """, (row, index) -> new LocationImage(row.getString("name"), row.getString("system_name"),
                row.getString("family"), row.getString("image_url"), row.getLong("id"),
                row.getString("source"), row.getString("source_url"), row.getString("source_version"),
                row.getObject("source_updated_at", OffsetDateTime.class)));
        return messages.buildResponse("celestial.body.list", rows, rows.size());
    }
    public record LocationImage(String name, String systemName, String family, String imageUrl,
                                long id, String source, String sourceUrl, String sourceVersion,
                                OffsetDateTime sourceUpdatedAt) {}
}
