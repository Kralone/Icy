package com.icy.icy_backend.db.entity.user.id;

import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class UserShipIdTest {

    @Test
    void equalityUsesBothCompositeKeyParts() {
        UUID userId = UUID.randomUUID();

        assertThat(new UserShipId(userId, 42L))
                .isEqualTo(new UserShipId(userId, 42L))
                .hasSameHashCodeAs(new UserShipId(userId, 42L))
                .isNotEqualTo(new UserShipId(userId, 43L))
                .isNotEqualTo(new UserShipId(UUID.randomUUID(), 42L));
    }
}
