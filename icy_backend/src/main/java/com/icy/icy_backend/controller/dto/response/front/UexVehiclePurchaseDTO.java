package com.icy.icy_backend.controller.dto.response.front;

public class UexVehiclePurchaseDTO {
    private String vehicleName;
    private String terminalName;
    private Integer buyPrice;

    public UexVehiclePurchaseDTO() {
    }

    public UexVehiclePurchaseDTO(String vehicleName, String terminalName, Integer buyPrice) {
        this.vehicleName = vehicleName;
        this.terminalName = terminalName;
        this.buyPrice = buyPrice;
    }

    public String getVehicleName() {
        return vehicleName;
    }

    public void setVehicleName(String vehicleName) {
        this.vehicleName = vehicleName;
    }

    public String getTerminalName() {
        return terminalName;
    }

    public void setTerminalName(String terminalName) {
        this.terminalName = terminalName;
    }

    public Integer getBuyPrice() {
        return buyPrice;
    }

    public void setBuyPrice(Integer buyPrice) {
        this.buyPrice = buyPrice;
    }
}
