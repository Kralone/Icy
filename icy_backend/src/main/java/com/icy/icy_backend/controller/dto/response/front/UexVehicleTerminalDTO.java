package com.icy.icy_backend.controller.dto.response.front;

public class UexVehicleTerminalDTO {
    private String name;
    private String nickname;
    private String displayName;
    private String code;
    private String planetName;
    private String cityName;
    private String spaceStationName;
    private String screenshot;

    public UexVehicleTerminalDTO() {
    }

    public UexVehicleTerminalDTO(
            String name,
            String nickname,
            String displayName,
            String code,
            String planetName,
            String cityName,
            String spaceStationName,
            String screenshot
    ) {
        this.name = name;
        this.nickname = nickname;
        this.displayName = displayName;
        this.code = code;
        this.planetName = planetName;
        this.cityName = cityName;
        this.spaceStationName = spaceStationName;
        this.screenshot = screenshot;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getNickname() {
        return nickname;
    }

    public void setNickname(String nickname) {
        this.nickname = nickname;
    }

    public String getDisplayName() {
        return displayName;
    }

    public void setDisplayName(String displayName) {
        this.displayName = displayName;
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public String getPlanetName() {
        return planetName;
    }

    public void setPlanetName(String planetName) {
        this.planetName = planetName;
    }

    public String getCityName() {
        return cityName;
    }

    public void setCityName(String cityName) {
        this.cityName = cityName;
    }

    public String getSpaceStationName() {
        return spaceStationName;
    }

    public void setSpaceStationName(String spaceStationName) {
        this.spaceStationName = spaceStationName;
    }

    public String getScreenshot() {
        return screenshot;
    }

    public void setScreenshot(String screenshot) {
        this.screenshot = screenshot;
    }
}
