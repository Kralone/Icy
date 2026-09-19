package com.icy.icy_backend.controller.dto.response.front;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

public class UexRefineryDatasetsDTO {
    private List<Map<String, Object>> methods;
    private List<Map<String, Object>> capacities;
    private List<Map<String, Object>> yields;
    private List<Map<String, Object>> audits;
    private OffsetDateTime methodsFetchedAt;
    private OffsetDateTime capacitiesFetchedAt;
    private OffsetDateTime yieldsFetchedAt;
    private OffsetDateTime auditsFetchedAt;
    private String methodsGameVersion;
    private String capacitiesGameVersion;
    private String yieldsGameVersion;
    private String auditsGameVersion;

    public UexRefineryDatasetsDTO() {
    }

    public UexRefineryDatasetsDTO(
            List<Map<String, Object>> methods,
            List<Map<String, Object>> capacities,
            List<Map<String, Object>> yields,
            List<Map<String, Object>> audits,
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

    public List<Map<String, Object>> getMethods() {
        return methods;
    }

    public void setMethods(List<Map<String, Object>> methods) {
        this.methods = methods;
    }

    public List<Map<String, Object>> getCapacities() {
        return capacities;
    }

    public void setCapacities(List<Map<String, Object>> capacities) {
        this.capacities = capacities;
    }

    public List<Map<String, Object>> getYields() {
        return yields;
    }

    public void setYields(List<Map<String, Object>> yields) {
        this.yields = yields;
    }

    public List<Map<String, Object>> getAudits() {
        return audits;
    }

    public void setAudits(List<Map<String, Object>> audits) {
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

    public String getMethodsGameVersion() { return methodsGameVersion; }
    public void setMethodsGameVersion(String value) { this.methodsGameVersion = value; }
    public String getCapacitiesGameVersion() { return capacitiesGameVersion; }
    public void setCapacitiesGameVersion(String value) { this.capacitiesGameVersion = value; }
    public String getYieldsGameVersion() { return yieldsGameVersion; }
    public void setYieldsGameVersion(String value) { this.yieldsGameVersion = value; }
    public String getAuditsGameVersion() { return auditsGameVersion; }
    public void setAuditsGameVersion(String value) { this.auditsGameVersion = value; }
}
