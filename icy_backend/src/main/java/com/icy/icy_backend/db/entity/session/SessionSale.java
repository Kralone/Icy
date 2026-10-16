package com.icy.icy_backend.db.entity.session;

import com.icy.icy_backend.db.entity.mining.MiningSaleLine;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/** Vente : le montant est celui réellement reçu en jeu, saisi par le vendeur. */
@Entity
@Table(name = "sales", schema = "session")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class SessionSale {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @Column(name = "sheet_id", nullable = false) private UUID sheetId;
    @Column(name = "seller_user_id", nullable = false) private UUID sellerUserId;
    @Column(name = "terminal_id") private Integer terminalId;
    @Column(name = "terminal_label", nullable = false, length = 200) private String terminalLabel;
    @Column(nullable = false) private long amount;
    @Column(name = "sold_at", nullable = false) private LocalDateTime soldAt;
    @OneToMany(mappedBy = "sale", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("position ASC")
    @Builder.Default private List<MiningSaleLine> lines = new ArrayList<>();
}
