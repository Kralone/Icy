package com.icy.icy_backend.db.entity.image;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "image_tag", schema = "media")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ImageTag {

    @Id
    @Column(nullable = false, length = 255)
    private String name;

    @Column(nullable = false, length = 32)
    private String color;
}
