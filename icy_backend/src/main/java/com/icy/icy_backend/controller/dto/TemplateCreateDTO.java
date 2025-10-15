package com.icy.icy_backend.controller.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO pour la création d’un template.
 * Accepte des tableaux simples ou des objets complets pour axisX/axisY.
 *
 * Exemple JSON valide :
 * {
 *   "name": "Test",
 *   "archetype": "TEST",
 *   "axisX": ["Test"],
 *   "axisY": ["Test"]
 * }
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class TemplateCreateDTO {

    private String name;
    private String archetype;

    // ✅ Jackson acceptera soit un tableau, soit un objet
    private JsonNode axisX;
    private JsonNode axisY;
}
