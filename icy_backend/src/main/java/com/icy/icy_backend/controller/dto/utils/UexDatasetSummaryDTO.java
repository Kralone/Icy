package com.icy.icy_backend.controller.dto.utils;

import com.icy.icy_backend.db.entity.utils.UexDatasetCache;

import java.time.OffsetDateTime;

public class UexDatasetSummaryDTO {
    private String datasetKey;
    private String sourceUrl;
    private Integer itemCount;
    private OffsetDateTime fetchedAt;
    private OffsetDateTime updatedAt;

    public UexDatasetSummaryDTO() {
    }

    public UexDatasetSummaryDTO(UexDatasetCache cache) {
        this.datasetKey = cache.getDatasetKey();
        this.sourceUrl = cache.getSourceUrl();
        this.itemCount = cache.getItemCount();
        this.fetchedAt = cache.getFetchedAt();
        this.updatedAt = cache.getUpdatedAt();
    }

    public UexDatasetSummaryDTO(String datasetKey, String sourceUrl, Integer itemCount, OffsetDateTime fetchedAt, OffsetDateTime updatedAt) {
        this.datasetKey = datasetKey;
        this.sourceUrl = sourceUrl;
        this.itemCount = itemCount;
        this.fetchedAt = fetchedAt;
        this.updatedAt = updatedAt;
    }

    public String getDatasetKey() {
        return datasetKey;
    }

    public void setDatasetKey(String datasetKey) {
        this.datasetKey = datasetKey;
    }

    public String getSourceUrl() {
        return sourceUrl;
    }

    public void setSourceUrl(String sourceUrl) {
        this.sourceUrl = sourceUrl;
    }

    public Integer getItemCount() {
        return itemCount;
    }

    public void setItemCount(Integer itemCount) {
        this.itemCount = itemCount;
    }

    public OffsetDateTime getFetchedAt() {
        return fetchedAt;
    }

    public void setFetchedAt(OffsetDateTime fetchedAt) {
        this.fetchedAt = fetchedAt;
    }

    public OffsetDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(OffsetDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
