package com.icy.icy_backend.service.catalog;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class CatalogCanonicalizerTest {
    @Test
    void groupsEditionsWithTheirBaseModel() {
        assertThat(CatalogCanonicalizer.canonicalVehicleName("Carrack Expedition")).isEqualTo("carrack");
        assertThat(CatalogCanonicalizer.canonicalVehicleName("600i 2951 BIS")).isEqualTo("600i");
        assertThat(CatalogCanonicalizer.canonicalVehicleName("F8C Lightning Executive Edition"))
                .isEqualTo("f8c lightning");
        assertThat(CatalogCanonicalizer.canonicalVehicleName("Mustang CitizenCon 2948 Edition"))
                .isEqualTo("mustang alpha");
        assertThat(CatalogCanonicalizer.canonicalVehicleName("F7C-M Hornet Heartseeker Mk II"))
                .isEqualTo("f7c-m super hornet mk ii");
        assertThat(CatalogCanonicalizer.canonicalVehicleName("Hornet F7A Mk II PYAM Exec"))
                .isEqualTo("f7a hornet mk ii");
        assertThat(CatalogCanonicalizer.canonicalVehicleName("F7 Hornet Mk Wikelo"))
                .isEqualTo("f7c hornet mk ii");
    }

    @Test
    void keepsFunctionalVariantsSeparate() {
        assertThat(CatalogCanonicalizer.canonicalVehicleName("Cutlass Black")).isEqualTo("cutlass black");
        assertThat(CatalogCanonicalizer.canonicalVehicleName("Cutlass Red")).isEqualTo("cutlass red");
        assertThat(CatalogCanonicalizer.canonicalVehicleName("600i Touring")).isEqualTo("600i touring");
        assertThat(CatalogCanonicalizer.canonicalVehicleName("C8R Pisces Rescue")).isEqualTo("c8r pisces rescue");
    }

    @Test
    void separatesSpecialCollectionsFromStandardShipsAndDeduplicatesExactNames() {
        String standard = CatalogCanonicalizer.vehicleKey("SHIP", "Anvil", "F8C Lightning");
        String pyam = CatalogCanonicalizer.vehicleKey("SHIP", "Anvil", "F8C Lightning PYAM Exec");
        String wikelo = CatalogCanonicalizer.vehicleKey("SHIP", "Anvil", "F8C Lightning Wikelo War Special");
        String battaglia = CatalogCanonicalizer.vehicleKey("SHIP", "MISC", "MISC Prospector Alliance");

        assertThat(pyam).isNotEqualTo(standard);
        assertThat(wikelo).isNotEqualTo(standard);
        assertThat(battaglia).isNotEqualTo(CatalogCanonicalizer.vehicleKey("SHIP", "MISC", "MISC Prospector"));
        assertThat(pyam).isEqualTo(CatalogCanonicalizer.vehicleKey("SHIP", "Anvil", "F8C Lightning PYAM Exec"));
        assertThat(CatalogCanonicalizer.catalogGroup("F7 Hornet Mk Wikelo")).isEqualTo("WIKELO");
        assertThat(CatalogCanonicalizer.catalogGroup("Corsair PYAM Exec")).isEqualTo("PYAM_EXEC");
        assertThat(CatalogCanonicalizer.catalogGroup("MOLE Alliance")).isEqualTo("BATTAGLIA");
        assertThat(CatalogCanonicalizer.catalogGroup("ARMOR", "Alliance Heavy Armor")).isEqualTo("STANDARD");
    }
}
