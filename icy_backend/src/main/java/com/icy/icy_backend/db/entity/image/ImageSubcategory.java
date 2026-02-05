package com.icy.icy_backend.db.entity.image;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.UUID;

@Entity
@Table(name = "image_subcategory", schema = "media")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ImageSubcategory {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "UUID DEFAULT gen_random_uuid()")
    private UUID id;

    @Column(name = "category_name", nullable = false, length = 255)
    private String categoryName;

    @Column(nullable = false, length = 255)
    private String name;
}
