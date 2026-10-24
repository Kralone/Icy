package com.icy.icy_backend.controller.dto.user;

import lombok.Data;

@Data
public class UpdateUserTutorialRequest {
    private Integer version;
    private String status;
}
