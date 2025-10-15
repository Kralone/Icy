package com.icy.icy_backend.controller.dto;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.icy.icy_backend.db.entity.CollectionTemplate;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TemplateDetailDTO {

    private Long id;
    private String name;
    private String archetype;
    private JsonNode axisX;
    private JsonNode axisY;
    private Instant createdAt;

    public TemplateDetailDTO(CollectionTemplate entity) {
        ObjectMapper mapper = new ObjectMapper();

        this.id = entity.getId();
        this.name = entity.getName();
        this.archetype = entity.getArchetype();
        this.createdAt = entity.getCreatedAt();

        try {
            // ✅ On parse les String JSON en JsonNode pour le frontend
            this.axisX = mapper.readTree(entity.getAxisX());
            this.axisY = mapper.readTree(entity.getAxisY());
        } catch (Exception e) {
            this.axisX = null;
            this.axisY = null;
        }
    }
}
