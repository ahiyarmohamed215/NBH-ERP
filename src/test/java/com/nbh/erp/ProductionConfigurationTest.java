package com.nbh.erp;

import com.zaxxer.hikari.HikariConfig;
import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.boot.flyway.autoconfigure.FlywayProperties;
import org.springframework.core.io.ClassPathResource;
import org.springframework.mock.env.MockEnvironment;

import java.io.IOException;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/** Configuration binding only: never starts Spring, a pool, Flyway, or a database. */
class ProductionConfigurationTest {
    private MockEnvironment environment(boolean production) throws IOException {
        var env = new MockEnvironment();
        Map.ofEntries(
                Map.entry("RDS_HOST", "database.invalid"),
                Map.entry("DB_NAME", "test_schema"),
                Map.entry("DB_USERNAME", "runtime_test_user"),
                Map.entry("DB_PASSWORD", "synthetic-runtime-value"),
                Map.entry("FLYWAY_USERNAME", "migration_test_user"),
                Map.entry("FLYWAY_PASSWORD", "synthetic-migration-value"),
                Map.entry("DB_SSL_TRUSTSTORE_URL", "file:/test/rds-ca.p12"),
                Map.entry("DB_SSL_TRUSTSTORE_PASSWORD", "synthetic-truststore-value"),
                Map.entry("JWT_SECRET", "synthetic-unit-test-value"),
                Map.entry("CORS_ALLOWED_ORIGINS", "https://erp.invalid")
        ).forEach(env::setProperty);
        var loader = new YamlPropertySourceLoader();
        if (production) {
            for (var source : loader.load("prod", new ClassPathResource("application-prod.yml")))
                env.getPropertySources().addLast(source);
        }
        for (var source : loader.load("base", new ClassPathResource("application.yml")))
            env.getPropertySources().addLast(source);
        return env;
    }

    @Test
    void bindsSeparateUsersAndIdenticalVerifiedTlsWithoutOpeningConnections() throws IOException {
        var env = environment(true);
        var flyway = Binder.get(env).bind("spring.flyway", FlywayProperties.class).get();
        var pool = Binder.get(env).bind("spring.datasource.hikari", HikariConfig.class).get();

        assertEquals("runtime_test_user", env.getProperty("spring.datasource.username"));
        assertEquals("migration_test_user", flyway.getUser());
        assertNotEquals(env.getProperty("spring.datasource.password"), flyway.getPassword());
        assertEquals(env.getProperty("spring.datasource.url"), flyway.getUrl());
        assertTrue(flyway.getUrl().contains("sslMode=VERIFY_IDENTITY"));
        assertTrue(flyway.getUrl().contains("createDatabaseIfNotExist=false"));
        assertTrue(flyway.getUrl().contains("allowPublicKeyRetrieval=false"));
        for (String name : new String[]{"trustCertificateKeyStoreUrl", "trustCertificateKeyStoreType",
                "trustCertificateKeyStorePassword", "fallbackToSystemTrustStore"}) {
            assertEquals(pool.getDataSourceProperties().get(name).toString(), flyway.getJdbcProperties().get(name));
        }
        assertEquals("PKCS12", flyway.getJdbcProperties().get("trustCertificateKeyStoreType"));
        assertEquals("false", flyway.getJdbcProperties().get("fallbackToSystemTrustStore"));
        assertEquals(10, pool.getMaximumPoolSize());
        assertEquals(2, pool.getMinimumIdle());
        assertTrue(flyway.isEnabled());
        assertFalse(flyway.isBaselineOnMigrate());
        assertTrue(flyway.isCleanDisabled());
        assertTrue(flyway.isValidateOnMigrate());
        assertFalse(flyway.isOutOfOrder());
    }

    @Test
    void productionOverridesDevelopmentDefaultsAndRequiresSecrets() throws IOException {
        var env = environment(true);
        // Legacy development environment switches must not change prod YAML policy.
        env.setProperty("DB_DDL_AUTO", "update");
        env.setProperty("DB_BASELINE_ON_MIGRATE", "true");
        env.setProperty("COOKIE_SECURE", "false");
        assertEquals("validate", env.getProperty("spring.jpa.hibernate.ddl-auto"));
        assertEquals("false", env.getProperty("spring.flyway.baseline-on-migrate"));
        assertEquals("true", env.getProperty("app.security.cookie.secure"));
        assertEquals("Lax", env.getProperty("app.security.cookie.same-site"));
        assertEquals("127.0.0.1", env.getProperty("server.address"));
        assertEquals("8080", env.getProperty("server.port"));
        assertEquals("native", env.getProperty("server.forward-headers-strategy"));
        assertEquals("graceful", env.getProperty("server.shutdown"));
        assertEquals("30s", env.getProperty("spring.lifecycle.timeout-per-shutdown-phase"));
        assertEquals("900000", env.getProperty("app.jwt.access-token-expiration-ms"));
        assertEquals("1800000", env.getProperty("app.jwt.refresh-token-expiration-ms"));

        env.getPropertySources().remove("mockProperties");
        for (String property : new String[]{"spring.datasource.username", "spring.datasource.password",
                "spring.flyway.user", "spring.flyway.password", "app.jwt.secret",
                "app.cors.allowed-origins", "spring.datasource.hikari.data-source-properties.trustCertificateKeyStoreUrl"}) {
            assertThrows(IllegalArgumentException.class, () -> env.getProperty(property));
        }
    }

    @Test
    void baseConfigurationKeepsItsLocalDefaults() throws IOException {
        var env = environment(false);
        assertEquals("0.0.0.0", env.getProperty("server.address"));
        assertTrue(env.getProperty("spring.datasource.url").startsWith("jdbc:mysql://localhost:3306/"));
        assertEquals("false", env.getProperty("app.security.cookie.secure"));
        assertEquals("true", env.getProperty("spring.flyway.baseline-on-migrate"));
    }
}
