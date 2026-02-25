package com.icy.icy_backend.controller.dto.response.front;

import com.fasterxml.jackson.databind.JsonNode;

import java.time.OffsetDateTime;

public class UexRefineryDatasetsDTO {
    private JsonNode methods;
    private JsonNode capacities;
    private JsonNode yields;
    private JsonNode audits;
    private OffsetDateTime methodsFetchedAt;
    private OffsetDateTime capacitiesFetchedAt;
    private OffsetDateTime yieldsFetchedAt;
    private OffsetDateTime auditsFetchedAt;

    public UexRefineryDatasetsDTO() {
    }

    public UexRefineryDatasetsDTO(
            JsonNode methods,
            JsonNode capacities,
            JsonNode yields,
            JsonNode audits,
            OffsetDateTime methodsFetchedAt,
            OffsetDateTime capacitiesFetchedAt,
            OffsetDateTime yieldsFetchedAt,
            OffsetDateTime auditsFetchedAt
    ) {
        this.methods = methods;
        this.capacities = capacities;
        this.yields = yields;
        this.audits = audits;
        this.methodsFetchedAt = methodsFetchedAt;
        this.capacitiesFetchedAt = capacitiesFetchedAt;
        this.yieldsFetchedAt = yieldsFetchedAt;
        this.auditsFetchedAt = auditsFetchedAt;
    }

    public JsonNode getMethods() {
        return methods;
    }

    public void setMethods(JsonNode methods) {
        this.methods = methods;
    }

    public JsonNode getCapacities() {
        return capacities;
    }

    public void setCapacities(JsonNode capacities) {
        this.capacities = capacities;
    }

    public JsonNode getYields() {
        return yields;
    }

    public void setYields(JsonNode yields) {
        this.yields = yields;
    }

    public JsonNode getAudits() {
        return audits;
    }

    public void setAudits(JsonNode audits) {
        this.audits = audits;
    }

    public OffsetDateTime getMethodsFetchedAt() {
        return methodsFetchedAt;
    }

    public void setMethodsFetchedAt(OffsetDateTime methodsFetchedAt) {
        this.methodsFetchedAt = methodsFetchedAt;
    }

    public OffsetDateTime getCapacitiesFetchedAt() {
        return capacitiesFetchedAt;
    }

    public void setCapacitiesFetchedAt(OffsetDateTime capacitiesFetchedAt) {
        this.capacitiesFetchedAt = capacitiesFetchedAt;
    }

    public OffsetDateTime getYieldsFetchedAt() {
        return yieldsFetchedAt;
    }

    public void setYieldsFetchedAt(OffsetDateTime yieldsFetchedAt) {
        this.yieldsFetchedAt = yieldsFetchedAt;
    }

    public OffsetDateTime getAuditsFetchedAt() {
        return auditsFetchedAt;
    }

    public void setAuditsFetchedAt(OffsetDateTime auditsFetchedAt) {
        this.auditsFetchedAt = auditsFetchedAt;
    }
}
