package com.nbh.erp.realtime;

import org.junit.jupiter.api.*;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.transaction.support.*;
import java.util.Set;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;

class RealtimeChangesTest {
    RealtimeStreams streams;
    RealtimeChanges changes;
    @BeforeEach @SuppressWarnings("unchecked") void setup() {
        streams = mock(RealtimeStreams.class);
        ObjectProvider<RealtimeStreams> provider = mock(ObjectProvider.class);
        when(provider.getObject()).thenReturn(streams);
        changes = new RealtimeChanges(provider);
        TransactionSynchronizationManager.setActualTransactionActive(true);
        TransactionSynchronizationManager.initSynchronization();
    }
    @AfterEach void cleanup() {
        for (var sync : TransactionSynchronizationManager.getSynchronizations()) sync.afterCompletion(0);
        TransactionSynchronizationManager.clear();
        assertTrue(TransactionSynchronizationManager.getResourceMap().isEmpty());
    }
    @Test void commitCoalescesRepeatedOrderChangesAndDoesNotSendBeforeCommit() {
        changes.changed("orders", null); changes.changed("orders", null); changes.changed("inventory", null);
        verifyNoInteractions(streams);
        for (var sync : TransactionSynchronizationManager.getSynchronizations()) sync.afterCommit();
        verify(streams).enqueue(Set.of(new RealtimeChanges.Change("orders",null), new RealtimeChanges.Change("inventory",null)));
    }
    @Test void rollbackNeverPublishes() {
        changes.changed("orders",null);
        for (var sync : TransactionSynchronizationManager.getSynchronizations()) sync.afterCompletion(TransactionSynchronization.STATUS_ROLLED_BACK);
        verifyNoInteractions(streams);
    }
    @Test void notificationFailureCannotFailAnAlreadyCommittedMutation() {
        doThrow(new IllegalStateException("Transport unavailable")).when(streams).enqueue(anySet());
        changes.changed("orders",null);
        assertDoesNotThrow(() -> TransactionSynchronizationManager.getSynchronizations().forEach(TransactionSynchronization::afterCommit));
    }
    @Test void commitPublishesTargetedMetadataAndCoalescesIdenticalChanges() {
        changes.changed("inventory", null, "STOCK_UPDATED", 101L, 5L, null, null);
        changes.changed("inventory", null, "STOCK_UPDATED", 101L, 5L, null, null);
        changes.changed("sales", "cashier1", "INVOICE_UPDATED", null, 5L, 202L, null);
        verifyNoInteractions(streams);
        for (var sync : TransactionSynchronizationManager.getSynchronizations()) sync.afterCommit();
        verify(streams).enqueue(Set.of(
            new RealtimeChanges.Change("inventory", null, "STOCK_UPDATED", 101L, 5L, null, null),
            new RealtimeChanges.Change("sales", "cashier1", "INVOICE_UPDATED", null, 5L, 202L, null)
        ));
    }
}
