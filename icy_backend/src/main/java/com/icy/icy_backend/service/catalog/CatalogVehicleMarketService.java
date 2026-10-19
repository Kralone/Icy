package com.icy.icy_backend.service.catalog;

import com.icy.icy_backend.controller.dto.response.common.MessageResponse;
import com.icy.icy_backend.controller.dto.response.front.UexVehiclePurchaseDTO;
import com.icy.icy_backend.controller.dto.response.front.UexVehicleRentalDTO;
import com.icy.icy_backend.service.common.MessageService;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class CatalogVehicleMarketService {
    static final String VEHICLE_OFFERS_SQL = """
            WITH terminals AS MATERIALIZED (
                SELECT terminal
                FROM utils.uex_dataset_cache cache,
                     LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(cache.payload) = 'array'
                         THEN cache.payload ELSE '[]'::jsonb END) terminal
                WHERE cache.dataset_key = 'terminals'
            )
            SELECT e.name AS vehicle_name,
                   o.location_name AS terminal_name,
                   o.source_payload->>'id_terminal' AS terminal_id,
                   NULLIF(BTRIM(t.terminal->>'planet_name'), '') AS planet_name,
                   COALESCE(NULLIF(BTRIM(t.terminal->>'space_station_name'), ''),
                            NULLIF(BTRIM(t.terminal->>'city_name'), ''),
                            NULLIF(BTRIM(t.terminal->>'outpost_name'), ''),
                            NULLIF(BTRIM(t.terminal->>'poi_name'), ''),
                            NULLIF(BTRIM(t.terminal->>'moon_name'), ''),
                            NULLIF(BTRIM(t.terminal->>'displayname'), '')) AS location_name,
                   NULLIF(BTRIM(t.terminal->>'moon_name'), '') AS moon_name,
                   NULLIF(BTRIM(t.terminal->>'star_system_name'), '') AS system_name,
                   o.price::integer AS price
            FROM catalog.offers o
            JOIN catalog.entries e ON e.id = o.entry_id
            LEFT JOIN terminals t ON t.terminal->>'id' = o.source_payload->>'id_terminal'
            WHERE o.source = 'UEX'
              AND o.active = TRUE
              AND e.active = TRUE
              AND e.family IN ('SHIP', 'GROUND_VEHICLE')
              AND o.offer_type = :offerType
              AND o.price > 0
              AND BTRIM(o.location_name) <> ''
            ORDER BY LOWER(e.name), o.price, LOWER(o.location_name), o.id
            """;

    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final MessageService messageService;

    public CatalogVehicleMarketService(
            NamedParameterJdbcTemplate jdbcTemplate,
            MessageService messageService
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.messageService = messageService;
    }

    @Transactional(readOnly = true)
    public ResponseEntity<MessageResponse<List<UexVehiclePurchaseDTO>>> listPurchases() {
        List<UexVehiclePurchaseDTO> rows = jdbcTemplate.query(
                VEHICLE_OFFERS_SQL,
                new MapSqlParameterSource("offerType", "BUY"),
                (resultSet, rowNumber) -> {
                    var offer = new UexVehiclePurchaseDTO(
                        resultSet.getString("vehicle_name"),
                        resultSet.getString("terminal_name"),
                        resultSet.getInt("price")
                    );
                    offer.setTerminalId(resultSet.getString("terminal_id"));
                    offer.setPlanetName(resultSet.getString("planet_name"));
                    offer.setLocationName(resultSet.getString("location_name"));
                    offer.setSystemName(resultSet.getString("system_name"));
                    offer.setMoonName(resultSet.getString("moon_name"));
                    return offer;
                }
        );
        return messageService.buildResponse("uex.vehicles.purchases.list", rows, rows.size());
    }

    @Transactional(readOnly = true)
    public ResponseEntity<MessageResponse<List<UexVehicleRentalDTO>>> listRentals() {
        List<UexVehicleRentalDTO> rows = jdbcTemplate.query(
                VEHICLE_OFFERS_SQL,
                new MapSqlParameterSource("offerType", "RENT"),
                (resultSet, rowNumber) -> {
                    var offer = new UexVehicleRentalDTO(
                        resultSet.getString("vehicle_name"),
                        resultSet.getString("terminal_name"),
                        resultSet.getInt("price")
                    );
                    offer.setTerminalId(resultSet.getString("terminal_id"));
                    offer.setPlanetName(resultSet.getString("planet_name"));
                    offer.setLocationName(resultSet.getString("location_name"));
                    offer.setSystemName(resultSet.getString("system_name"));
                    offer.setMoonName(resultSet.getString("moon_name"));
                    return offer;
                }
        );
        return messageService.buildResponse("uex.vehicles.rentals.list", rows, rows.size());
    }
}
