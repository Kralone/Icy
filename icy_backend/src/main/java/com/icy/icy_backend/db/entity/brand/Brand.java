package com.icy.icy_backend.db.entity.brand;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "brand", schema = "fleet")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Brand {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String name;

    @Column
    private String imageUrl;
}






