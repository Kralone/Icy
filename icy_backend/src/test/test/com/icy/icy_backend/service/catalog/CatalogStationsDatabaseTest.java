package com.icy.icy_backend.service.catalog;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import java.sql.*;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Runs the station queries on the explicitly supplied migrated validation database. Every change is rolled back. */
@EnabledIfEnvironmentVariable(named="CATALOG_TEST_JDBC_URL", matches=".+")
class CatalogStationsDatabaseTest {
 Connection connection; JdbcTemplate jdbc; NamedParameterJdbcTemplate named; long run;
 ObjectMapper json=new ObjectMapper();
 @BeforeEach void setup() throws Exception {
  connection=DriverManager.getConnection(System.getenv("CATALOG_TEST_JDBC_URL"),System.getenv("CATALOG_TEST_DB_USER"),System.getenv("CATALOG_TEST_DB_PASSWORD"));
  connection.setAutoCommit(false);
  var ds=new SingleConnectionDataSource(connection,true); jdbc=new JdbcTemplate(ds); named=new NamedParameterJdbcTemplate(ds);
  run=jdbc.queryForObject("INSERT INTO catalog.sync_runs(operation,status) VALUES('SCRAPE_AND_MAP','SUCCEEDED') RETURNING id",Long.class);
  cache("terminals","""
    [{"id":990001,"star_system_name":"Stanton","planet_name":"Crusader","moon_name":"Daymar","outpost_name":"Station Test Outpost","id_poi":0},
     {"id":990002,"star_system_name":"Stanton","planet_name":"Hurston","moon_name":"Aberdeen","id_poi":990100},
     {"id":990003,"star_system_name":"Stanton","planet_name":"","space_station_name":"Station Test Lagrange"}]""");
  cache("poi","[{\"id\":990100,\"name\":\"Station Test POI\"}]");
  cache("space_stations","[{\"name\":\"Station Test Alpha\"},{\"name\":\"Station Test Twin\"}]");
  cache("cities","[{\"name\":\"Station Test City\"},{\"name\":\"Station Test Twin\"}]");
  cache("outposts","[]");
 }
 @AfterEach void cleanup() throws Exception { if(connection!=null){connection.rollback();connection.close();} }
 void cache(String key,String payload) {
  jdbc.update("INSERT INTO utils.uex_dataset_cache(dataset_key,source_url,payload,item_count,fetched_at) VALUES(?,'test',CAST(? AS jsonb),0,NOW()) ON CONFLICT (dataset_key) DO UPDATE SET payload=EXCLUDED.payload",key,payload);
 }
 long ship() {
  return jdbc.queryForObject("INSERT INTO catalog.entries(source,dataset_key,external_id,family,name,manufacturer,image_url,source_image_url,source_image_is_fallback,source_payload,last_seen_run_id) VALUES('STAR_CITIZEN_WIKI','vehicles','station-test-ship','SHIP','Station Test Ship','Test','/images/source.webp','/images/source.webp',FALSE,'{}',?) RETURNING id",Long.class,run);
 }
 void offer(long entry,String type,int terminal,int price) {
  jdbc.update("INSERT INTO catalog.offers(source,external_id,entry_id,entity_name,offer_type,location_name,price,source_payload,last_seen_run_id) VALUES('UEX',?,?,'Station Test Ship',?,?,?,CAST(? AS jsonb),?)",
    "station-test:"+terminal+":"+type,entry,type,"Terminal "+terminal,price,"{\"id_terminal\":"+terminal+"}",run);
 }
 @Test void catalogOffersNamePlanetMoonPoiAndStation() {
  long ship=ship(); offer(ship,"BUY",990001,100); offer(ship,"BUY",990002,200); offer(ship,"BUY",990003,300); offer(ship,"BUY",990999,400);
  var rows=named.queryForList(CatalogBrowseService.OFFERS_SQL,new MapSqlParameterSource("entryIds",List.of(ship)));
  assertThat(rows).extracting(r->r.get("location_name"),r->r.get("planet_name"),r->r.get("moon_name"),r->r.get("place_name")).containsExactly(
    tuple("Terminal 990001","Crusader","Daymar","Station Test Outpost"),
    tuple("Terminal 990002","Hurston","Aberdeen","Station Test POI"),
    tuple("Terminal 990003",null,null,"Station Test Lagrange"),
    tuple("Terminal 990999",null,null,null));
 }
 @Test void vehicleMarketUsesThePoiNameInsteadOfTheMoon() {
  long ship=ship(); offer(ship,"RENT",990002,50);
  var rows=named.queryForList(CatalogVehicleMarketService.VEHICLE_OFFERS_SQL,new MapSqlParameterSource("offerType","RENT"))
    .stream().filter(r->"Station Test Ship".equals(r.get("vehicle_name"))).toList();
  assertThat(rows).extracting(r->r.get("planet_name"),r->r.get("moon_name"),r->r.get("location_name"))
    .containsExactly(tuple("Hurston","Aberdeen","Station Test POI"));
 }
 @Test void wikiLocationsWithoutMarkerTakeTheirFamilyFromExactUexNames() throws Exception {
  CatalogRawStore raw=mock(CatalogRawStore.class);
  when(raw.loadActive("STAR_CITIZEN_WIKI","locations")).thenReturn(List.of(
    json.readTree("{\"uuid\":\"station-test-1\",\"name\":\"Station Test Alpha\",\"type\":{\"name\":\"Manmade\",\"classification\":\"Manmade\"}}"),
    json.readTree("{\"uuid\":\"station-test-2\",\"name\":\"station  test city\",\"type\":{\"name\":\"Manmade\"}}"),
    json.readTree("{\"uuid\":\"station-test-3\",\"name\":\"Station Test Twin\",\"type\":{\"name\":\"Manmade\"}}"),
    json.readTree("{\"uuid\":\"station-test-4\",\"name\":\"Station Test Alpha Hangar\",\"type\":{\"name\":\"Manmade\"}}"),
    json.readTree("{\"uuid\":\"station-test-5\",\"name\":\"Station Test City\",\"type\":{\"name\":\"JumpPoint\"}}")));
  new CatalogMapper(named,raw,json,mock(CatalogConflictService.class)).mapWikiDataset("locations",run);
  var families=new HashMap<String,String>();
  jdbc.query("SELECT external_id,family FROM catalog.entries WHERE external_id LIKE 'station-test-%'",(ResultSet r)->{families.put(r.getString(1),r.getString(2));});
  assertThat(families).containsExactlyInAnyOrderEntriesOf(Map.of(
    "station-test-1","STATION","station-test-2","CITY","station-test-3","LOCATION","station-test-4","LOCATION","station-test-5","JUMP_POINT"));
 }
}
