package com.icy.icy_backend.db.entity.mining;

import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(name = "refinery_order_lines", schema = "mining")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class MiningRefineryOrderLine {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "order_id", nullable = false)
    private MiningRefineryOrder order;
    /** Minerai raffiné du jeu de données UEX ; le nom est gardé pour rester lisible si la source change. */
    @Column(name = "commodity_id", nullable = false) private int commodityId;
    @Column(name = "commodity_name", nullable = false, length = 80) private String commodityName;
    @Column(name = "quantity_cscu", nullable = false) private int quantityCscu;
    /** Qualité notée (0 à 1000) : n'entre dans aucun calcul, le prix réel est saisi à la vente. */
    @Column(nullable = false) private int quality;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 10) private Destination destination;
    @Column(nullable = false) private int position;

    /** KEEP : conservé, hors partage et hors stock à vendre. */
    public enum Destination { SELL, KEEP }
}
