package com.icy.icy_backend.db.entity.session;

import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(name = "settlement_shares", schema = "session")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class SessionSettlementShare {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "settlement_id", nullable = false)
    private SessionSettlement settlement;
    @Column(name = "user_id", nullable = false) private UUID userId;
    @Column(name = "shares_centi", nullable = false) private int sharesCenti;
    @Column(nullable = false) private long share;
    @Column(nullable = false) private long advanced;
    @Column(nullable = false) private long cashed;
    @Column(nullable = false) private long balance;
    @Column(nullable = false) private int position;
}
