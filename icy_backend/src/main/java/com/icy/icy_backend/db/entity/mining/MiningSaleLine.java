package com.icy.icy_backend.db.entity.mining;

import com.icy.icy_backend.db.entity.session.SessionSale;
import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(name = "sale_lines", schema = "mining")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class MiningSaleLine {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "sale_id", nullable = false)
    private SessionSale sale;
    @Column(name = "commodity_id", nullable = false) private int commodityId;
    @Column(name = "commodity_name", nullable = false, length = 80) private String commodityName;
    @Column(name = "quantity_cscu", nullable = false) private int quantityCscu;
    @Column(nullable = false) private int position;
}
