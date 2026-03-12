package com.icy.icy_backend.controller.dto.response.front;

import java.util.List;

public class UexResourceSaleDTO {
    private String displayName;
    private String canonicalName;
    private String kind;
    private Integer baseSell;
    private Integer bestSell;
    private String bestSellTerminal;
    private List<SalePointDTO> salePoints;

    public UexResourceSaleDTO() {
    }

    public UexResourceSaleDTO(
            String displayName,
            String canonicalName,
            String kind,
            Integer baseSell,
            Integer bestSell,
            String bestSellTerminal,
            List<SalePointDTO> salePoints
    ) {
        this.displayName = displayName;
        this.canonicalName = canonicalName;
        this.kind = kind;
        this.baseSell = baseSell;
        this.bestSell = bestSell;
        this.bestSellTerminal = bestSellTerminal;
        this.salePoints = salePoints;
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

    public List<SalePointDTO> getSalePoints() {
        return salePoints;
    }

    public void setSalePoints(List<SalePointDTO> salePoints) {
        this.salePoints = salePoints;
    }

    public static class SalePointDTO {
        private String terminalName;
        private Integer sellPrice;

        public SalePointDTO() {
        }

        public SalePointDTO(String terminalName, Integer sellPrice) {
            this.terminalName = terminalName;
            this.sellPrice = sellPrice;
        }

        public String getTerminalName() {
            return terminalName;
        }

        public void setTerminalName(String terminalName) {
            this.terminalName = terminalName;
        }

        public Integer getSellPrice() {
            return sellPrice;
        }

        public void setSellPrice(Integer sellPrice) {
            this.sellPrice = sellPrice;
        }
    }
}
