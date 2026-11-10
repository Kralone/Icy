package com.icy.icy_backend.service.bank;

import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.Map;

/**
 * Signale que la banque a changé, après validation en base.
 * Le message ne porte que l'heure : chaque page ouverte relit ce que son lecteur a le droit de voir.
 */
@Component
@RequiredArgsConstructor
public class BankEvents {
    static final String TOPIC = "/topic/bank";

    private final SimpMessagingTemplate messagingTemplate;

    public void changed() {
        Runnable send = () -> messagingTemplate.convertAndSend(TOPIC, (Object) Map.of("timestamp", System.currentTimeMillis()));
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            send.run();
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                send.run();
            }
        });
    }
}
