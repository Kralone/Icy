package com.icy.icy_backend.db.entity.ship;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.icy.icy_backend.db.entity.brand.Brand;
import jakarta.persistence.*;
import lombok.*;

import java.util.ArrayList;
import java.util.List;

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

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(nullable = false)
    private Boolean flightReady = false;

    @Column(nullable = false)
    private String imageUrl;

    @OneToMany(mappedBy = "ship", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @OrderBy("id ASC")
    private List<ShipSalePoint> salePoints = new ArrayList<>();

    public void setSalePoints(List<ShipSalePoint> salePoints) {
        List<ShipSalePoint> nextSalePoints = salePoints == null ? List.of() : new ArrayList<>(salePoints);
        this.salePoints.clear();
        for (ShipSalePoint salePoint : nextSalePoints) {
            if (salePoint == null) {
                continue;
            }
            salePoint.setShip(this);
            this.salePoints.add(salePoint);
        }
    }
}






