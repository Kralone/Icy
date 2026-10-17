package com.icy.icy_backend.service.session;

import com.icy.icy_backend.db.entity.session.SessionSheet;
import com.icy.icy_backend.db.repository.session.MiningRefineryOrderRepository;
import com.icy.icy_backend.db.repository.session.SessionExpenseRepository;
import com.icy.icy_backend.db.repository.session.SessionParticipantRepository;
import com.icy.icy_backend.db.repository.session.SessionSaleRepository;
import com.icy.icy_backend.db.repository.session.SessionSettlementRepository;
import com.icy.icy_backend.db.repository.session.SessionSheetRepository;
import com.icy.icy_backend.exception.definition.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Component
@RequiredArgsConstructor
public class SessionLoader {
    private final SessionSheetRepository sheets;
    private final SessionParticipantRepository participants;
    private final SessionExpenseRepository expenses;
    private final MiningRefineryOrderRepository orders;
    private final SessionSaleRepository sales;
    private final SessionSettlementRepository settlements;

    public SessionData read(UUID sheetId) {
        return load(sheets.findById(sheetId).orElseThrow(SessionLoader::notFound));
    }

    /** Lecture sous verrou d'écriture : à appeler dans la transaction qui modifie la fiche. */
    public SessionData lock(UUID sheetId) {
        return load(sheets.lockById(sheetId).orElseThrow(SessionLoader::notFound));
    }

    public SessionData load(SessionSheet sheet) {
        UUID id = sheet.getId();
        return new SessionData(sheet, participants.findBySheetOrdered(id), expenses.findBySheetIdOrderByCreatedAtAsc(id),
                orders.findBySheetWithLines(id), sales.findBySheetWithLines(id), settlements.findCurrent(id));
    }

    static ResourceNotFoundException notFound() {
        return new ResourceNotFoundException("Fiche de minage introuvable.");
    }
}
