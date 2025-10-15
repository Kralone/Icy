package com.icy.icy_backend.controller.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class UserCollectionDetailDTO {
    private Long id;
    private Long templateId;
    private String name;
    private Object axisX;
    private Object axisY;
    private Object checked;
}