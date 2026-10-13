package com.icy.icy_backend.controller.dto.operation;

import lombok.Data;

/** Poste d'un équipage ou d'un preset : libellé libre, icône et capacité facultatives. */
@Data
public class OperationPositionRequest {
    private String label;
    private String icon;
    private Integer capacity;
    private int sortOrder;
}
