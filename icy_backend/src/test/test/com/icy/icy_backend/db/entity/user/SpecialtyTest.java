package com.icy.icy_backend.db.entity.user;

import com.icy.icy_backend.exception.definition.BadRequestException;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SpecialtyTest {
    @Test
    void anActivityMayHaveNoPole() {
        assertThat(Specialty.optional(null)).isNull();
        assertThat(Specialty.optional("  ")).isNull();
    }

    @Test
    void anActivityPoleIsReadWhateverItsCase() {
        assertThat(Specialty.optional(" industrie ")).isEqualTo(Specialty.INDUSTRIE);
    }

    @Test
    void anUnknownActivityPoleIsRefused() {
        assertThatThrownBy(() -> Specialty.optional("FINANCE")).isInstanceOf(BadRequestException.class);
    }
}
