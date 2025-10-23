package com.icy.icy_backend.db.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "icelink_block")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class IceLinkBlock {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 100)
    private String name;

    @Column(nullable = false, length = 50)
    private String icon;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(length = 255)
    private String description;

    @Column(nullable = false)
    private String headline;
}
