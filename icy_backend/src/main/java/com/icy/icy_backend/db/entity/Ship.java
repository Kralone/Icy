package com.icy.icy_backend.db.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "ships")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Ship {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String name;

    @ManyToOne
    @JoinColumn(name = "brand_id", nullable = false)
    private Brand brand;

    @Column
    private String focus;

    @Column
    private Integer scu;

    @Column
    private String size;

    @Column
    private String crew;

    @Column(nullable = false)
    private Boolean flightReady = false;

    @Column(nullable = false)
    private String imageUrl;
}
