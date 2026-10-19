package com.nbh.erp.realtime;

import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.beans.factory.ObjectProvider;
import java.util.LinkedHashSet;
import java.util.Set;

/** Coalesces invalidations within the actual database transaction. Never publishes on rollback. */
@Component
public class RealtimeChanges {
    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(RealtimeChanges.class);
    public record Change(
            String topic,
            String owner,
            String type,
            Long productId,
            Long warehouseId,
            Long invoiceId,
            Long grnId
    ) {
        public Change(String topic, String owner) {
            this(topic, owner, null, null, null, null, null);
        }
    }
    private final Object resourceKey = new Object();
    private final ObjectProvider<RealtimeStreams> streams;
    public RealtimeChanges(ObjectProvider<RealtimeStreams> streams) { this.streams = streams; }

    public void changed(String topic, String owner) {
        changed(topic, owner, null, null, null, null, null);
    }

    @SuppressWarnings("unchecked")
    public void changed(String topic, String owner, String type, Long productId, Long warehouseId, Long invoiceId, Long grnId) {
        if (!TransactionSynchronizationManager.isActualTransactionActive()
                || !TransactionSynchronizationManager.isSynchronizationActive()) return;
        Set<Change> pending = (Set<Change>) TransactionSynchronizationManager.getResource(resourceKey);
        if (pending == null) {
            pending = new LinkedHashSet<>();
            TransactionSynchronizationManager.bindResource(resourceKey, pending);
            Set<Change> changes = pending;
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override public void suspend() { TransactionSynchronizationManager.unbindResource(resourceKey); }
                @Override public void resume() { TransactionSynchronizationManager.bindResource(resourceKey, changes); }
                @Override public void afterCommit() {
                    try { streams.getObject().enqueue(Set.copyOf(changes)); }
                    catch (RuntimeException error) {
                        // A notification outage must never turn a committed mutation into an API failure.
                        log.warn("Realtime invalidation unavailable; clients will reconcile", error);
                    }
                }
                @Override public void afterCompletion(int status) {
                    TransactionSynchronizationManager.unbindResourceIfPossible(resourceKey);
                }
            });
        }
        pending.add(new Change(topic, owner, type, productId, warehouseId, invoiceId, grnId));
    }
}
