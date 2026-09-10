package com.icy.icy_backend.controller.dto.response.front;

public class UexVehicleRentalDTO {
    private String terminalId;
    private String planetName;
    private String locationName;
    private String systemName;

    public String getTerminalId() { return terminalId; }
    public void setTerminalId(String value) { terminalId = value; }
    public String getPlanetName() { return planetName; }
    public void setPlanetName(String value) { planetName = value; }
    public String getLocationName() { return locationName; }
    public void setLocationName(String value) { locationName = value; }
    public String getSystemName() { return systemName; }
    public void setSystemName(String value) { systemName = value; }
    private String vehicleName;
    private String terminalName;
    private Integer rentPrice;

    public UexVehicleRentalDTO() {
    }

    public UexVehicleRentalDTO(String vehicleName, String terminalName, Integer rentPrice) {
        this.vehicleName = vehicleName;
        this.terminalName = terminalName;
        this.rentPrice = rentPrice;
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

    public Integer getRentPrice() {
        return rentPrice;
    }

    public void setRentPrice(Integer rentPrice) {
        this.rentPrice = rentPrice;
    }
}
