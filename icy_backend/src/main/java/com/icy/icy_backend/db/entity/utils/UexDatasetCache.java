package com.icy.icy_backend.db.entity.utils;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;

@Entity
@Table(name = "uex_dataset_cache", schema = "utils")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class UexDatasetCache {
    @Id
    @Column(name = "dataset_key", nullable = false, length = 80)
    private String datasetKey;

    @Column(name = "source_url", nullable = false, columnDefinition = "TEXT")
    private String sourceUrl;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "payload", nullable = false, columnDefinition = "jsonb")
    private JsonNode payload;

    @Column(name = "item_count", nullable = false)
    private Integer itemCount;

    @Column(name = "fetched_at", nullable = false)
    private OffsetDateTime fetchedAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;
}
