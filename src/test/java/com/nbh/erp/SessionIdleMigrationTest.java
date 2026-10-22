package com.nbh.erp;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import java.sql.DriverManager;
import static org.junit.jupiter.api.Assertions.*;

class SessionIdleMigrationTest {
    @Test void existingSessionsReceiveAnActivityDeadlineWithoutLosingTheirTokens() throws Exception {
        String url = "jdbc:h2:mem:idle-migration;MODE=MySQL;DB_CLOSE_DELAY=-1";
        try (var connection = DriverManager.getConnection(url, "sa", ""); var statement = connection.createStatement()) {
            statement.execute("create table refresh_session(id varchar(255) primary key, token_id varchar(255))");
            statement.execute("insert into refresh_session values('existing-session','existing-token')");
        }
        var flyway = Flyway.configure().dataSource(url, "sa", "").baselineOnMigrate(true)
            .baselineVersion("38").target("39").load();
        assertEquals(1, flyway.migrate().migrationsExecuted);
        assertEquals(0, flyway.migrate().migrationsExecuted);
        try (var connection = DriverManager.getConnection(url, "sa", ""); var statement = connection.createStatement();
             var rows = statement.executeQuery("select token_id,last_activity_at from refresh_session where id='existing-session'")) {
            assertTrue(rows.next());
            assertEquals("existing-token", rows.getString(1));
            assertNotNull(rows.getTimestamp(2));
        }
    }
}
