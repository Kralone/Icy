package com.icy.icy_backend.utils;

//package com.icy.icy_backend.utils;
//
//import com.icy.icy_backend.db.entity.ship.Ship;
//import com.icy.icy_backend.db.repository.ship.ShipRepository;
//import org.springframework.beans.factory.annotation.Autowired;
//import org.springframework.boot.context.event.ApplicationReadyEvent;
//import org.springframework.context.event.EventListener;
//import org.springframework.core.io.ClassPathResource;
//import org.springframework.stereotype.Service;
//
//import java.io.BufferedReader;
//import java.io.InputStreamReader;
//import java.nio.charset.StandardCharsets;
//import java.util.ArrayList;
//import java.util.List;
//import java.util.UUID;
//import java.util.stream.Collectors;
//
//@Service
//public class ShipCsvLoader {
//
//    private final ShipRepository shipRepository;
//
//    @Autowired
//    public ShipCsvLoader(ShipRepository shipRepository) {
//        this.shipRepository = shipRepository;
//    }
//
//    @EventListener(ApplicationReadyEvent.class)
//    public void loadShipsIfEmpty() {
//        if (shipRepository.count() == 0) {
//            loadShipsFromCsv();
//        }
//    }
//
//    private void loadShipsFromCsv() {
//        try (BufferedReader reader = new BufferedReader(new InputStreamReader(
//                new ClassPathResource("starcitizen_vehicles.csv").getInputStream(), StandardCharsets.UTF_8))) {
//
//            List<Ship> ships = new ArrayList<>();
//            long lineNumber = 1;
//            String line;
//            while ((line = reader.readLine()) != null) {
//                if (lineNumber == 1) { // Ignore l'en-tête
//                    lineNumber++;
//                    continue;
//                }
//                ships.add(mapToShip(line, lineNumber));
//                lineNumber++;
//            }
//
//            shipRepository.saveAll(ships);
//            System.out.println("🚀 Données des vaisseaux chargées depuis le CSV !");
//        } catch (Exception e) {
//            System.err.println("❌ Erreur lors du chargement du fichier CSV : " + e.getMessage());
//        }
//    }
//
//    private Ship mapToShip(String line, long lineNumber) {
//        String[] fields = line.split(",");
//        return new Ship(
//                lineNumber,  // ID auto-incrémenté basé sur la ligne
//                fields[0],  // Nom
//                fields[1],  // Fabricant (brand)
//                fields[4],  // Rôle (focus)
//                Integer.parseInt(fields[7]),  // Cargo (SCU), converti en Int
//                extractSize(fields[5]),  // Taille
//                extractCrew(fields[6]),  // Équipage
//                fields[2].equalsIgnoreCase("Flight ready"),  // Flight ready (TRUE/FALSE)
//                fields[3]   // Image URL
//        );
//    }
//
//    private String extractSize(String rawSize) {
//        return rawSize.replaceAll("\\s*\\(.*\\)", "").trim();
//    }
//
//    private String extractCrew(String rawCrew) {
//        return rawCrew.trim();
//    }
//}





