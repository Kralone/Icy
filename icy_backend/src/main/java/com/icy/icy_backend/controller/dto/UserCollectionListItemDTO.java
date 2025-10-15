package com.icy.icy_backend.controller.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class UserCollectionListItemDTO {
    private Long id;
    private Long templateId;
    private String name;
}