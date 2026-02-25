package com.icy.icy_backend.controller.dto.response.front;

public class UexResourceSaleDTO {
    private String displayName;
    private String canonicalName;
    private String kind;
    private Integer baseSell;
    private Integer bestSell;
    private String bestSellTerminal;

    public UexResourceSaleDTO() {
    }

    public UexResourceSaleDTO(
            String displayName,
            String canonicalName,
            String kind,
            Integer baseSell,
            Integer bestSell,
            String bestSellTerminal
    ) {
        this.displayName = displayName;
        this.canonicalName = canonicalName;
        this.kind = kind;
        this.baseSell = baseSell;
        this.bestSell = bestSell;
        this.bestSellTerminal = bestSellTerminal;
    }

    public String getDisplayName() {
        return displayName;
    }

    public void setDisplayName(String displayName) {
        this.displayName = displayName;
    }

    public String getCanonicalName() {
        return canonicalName;
    }

    public void setCanonicalName(String canonicalName) {
        this.canonicalName = canonicalName;
    }

    public String getKind() {
        return kind;
    }

    public void setKind(String kind) {
        this.kind = kind;
    }

    public Integer getBaseSell() {
        return baseSell;
    }

    public void setBaseSell(Integer baseSell) {
        this.baseSell = baseSell;
    }

    public Integer getBestSell() {
        return bestSell;
    }

    public void setBestSell(Integer bestSell) {
        this.bestSell = bestSell;
    }

    public String getBestSellTerminal() {
        return bestSellTerminal;
    }

    public void setBestSellTerminal(String bestSellTerminal) {
        this.bestSellTerminal = bestSellTerminal;
    }
}
