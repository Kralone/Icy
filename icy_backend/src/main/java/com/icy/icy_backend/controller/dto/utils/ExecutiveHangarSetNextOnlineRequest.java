package com.icy.icy_backend.controller.dto.utils;

import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;

@Getter
@Setter
public class ExecutiveHangarSetNextOnlineRequest {
    private OffsetDateTime nextOnlineAt;
}
