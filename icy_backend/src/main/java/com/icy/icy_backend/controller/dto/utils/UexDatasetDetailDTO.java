package com.icy.icy_backend.controller.dto.utils;

import com.fasterxml.jackson.databind.JsonNode;

import java.time.OffsetDateTime;

public class UexDatasetDetailDTO {
    private String datasetKey;
    private String sourceUrl;
    private Integer itemCount;
    private OffsetDateTime fetchedAt;
    private OffsetDateTime updatedAt;
    private JsonNode previewPayload;
    private Integer previewItemCount;
    private boolean truncated;

    public UexDatasetDetailDTO() {
    }

    public UexDatasetDetailDTO(
            String datasetKey,
            String sourceUrl,
            Integer itemCount,
            OffsetDateTime fetchedAt,
            OffsetDateTime updatedAt,
            JsonNode previewPayload,
            Integer previewItemCount,
            boolean truncated
    ) {
        this.datasetKey = datasetKey;
        this.sourceUrl = sourceUrl;
        this.itemCount = itemCount;
        this.fetchedAt = fetchedAt;
        this.updatedAt = updatedAt;
        this.previewPayload = previewPayload;
        this.previewItemCount = previewItemCount;
        this.truncated = truncated;
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

    public JsonNode getPreviewPayload() {
        return previewPayload;
    }

    public void setPreviewPayload(JsonNode previewPayload) {
        this.previewPayload = previewPayload;
    }

    public Integer getPreviewItemCount() {
        return previewItemCount;
    }

    public void setPreviewItemCount(Integer previewItemCount) {
        this.previewItemCount = previewItemCount;
    }

    public boolean isTruncated() {
        return truncated;
    }

    public void setTruncated(boolean truncated) {
        this.truncated = truncated;
    }
}
