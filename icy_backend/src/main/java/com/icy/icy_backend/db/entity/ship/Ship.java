package com.icy.icy_backend.db.entity.ship;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.icy.icy_backend.db.entity.brand.Brand;
import jakarta.persistence.*;
import lombok.*;

@Entity
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
@Table(name = "ships", schema = "fleet")
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






