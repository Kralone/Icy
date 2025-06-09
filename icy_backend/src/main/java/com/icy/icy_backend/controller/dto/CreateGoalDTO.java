package com.icy.icy_backend.controller.dto;

import lombok.Getter;

@Getter
public class CreateGoalDTO {
    public String name;
    public String description;
    public int target;
    public Long parentId; // nullable
}
