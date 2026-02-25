package com.icy.icy_backend.controller.dto.ship;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;

@Getter
public class AddShipDTO {
    private long shipId;
    @JsonProperty("inGamePurchase")
    private boolean isInGame;
    @JsonProperty("rewardInGame")
    private boolean isRewardInGame;
    @JsonProperty("loaner")
    private boolean isLoaner;

}



