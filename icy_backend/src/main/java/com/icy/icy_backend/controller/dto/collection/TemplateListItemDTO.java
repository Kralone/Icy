package com.icy.icy_backend.controller.dto.collection;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class TemplateListItemDTO {
    private Long id;
    private String name;
    private String archetype;
}


