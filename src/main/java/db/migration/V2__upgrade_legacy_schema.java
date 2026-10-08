package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;
import java.sql.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.regex.Pattern;

/** Additive upgrade for installations explicitly baselined at version 1. */
public class V2__upgrade_legacy_schema extends BaseJavaMigration {
    @Override public void migrate(Context context) throws Exception {
        Connection connection = context.getConnection();
        String schema;
        try (var resource = getClass().getResourceAsStream("/db/migration/V1__initial_schema.sql")) {
            if (resource == null) throw new IllegalStateException("Schema resource missing");
            schema = new String(resource.readAllBytes(), StandardCharsets.UTF_8);
        }
        var created = new HashSet<String>();
        var statements = schema.split(";");
        var tablePattern = Pattern.compile("create table ([a-z_]+) ", Pattern.CASE_INSENSITIVE);
        for (String sql : statements) {
            sql = sql.trim();
            var match = tablePattern.matcher(sql);
            if (!match.find()) continue;
            String table = match.group(1);
            if (!hasTable(connection, table)) {
                execute(connection, sql);
                created.add(table);
            } else if (sql.contains("record_version bigint") && !hasColumn(connection, table, "record_version")) {
                execute(connection, "alter table " + table + " add column record_version bigint not null default 0");
            }
        }
        add(connection, "users", "token_version", "bigint not null default 0");
        add(connection, "invoices", "returned_amount", "decimal(38,2) not null default 0");
        add(connection, "invoices", "payment_method", "varchar(30)");
        add(connection, "sales_returns", "refund_amount", "decimal(38,2) not null default 0");
        add(connection, "credit_notes", "applied_amount", "decimal(38,2) not null default 0");
        add(connection, "grns", "purchase_order_id", "bigint");
        add(connection, "prns", "source_grn_id", "bigint");
        // Preserve existing constraints. Install constraints/indexes only on newly created tables.
        var indexPattern = Pattern.compile("(?:alter table|on) ([a-z_]+) ", Pattern.CASE_INSENSITIVE);
        for (String sql : statements) {
            sql = sql.trim();
            if (!(sql.startsWith("alter table") || sql.startsWith("create index") || sql.startsWith("create unique index"))) continue;
            var match = indexPattern.matcher(sql);
            if (match.find() && created.contains(match.group(1))) execute(connection, sql);
        }
    }
    private void add(Connection c, String table, String column, String definition) throws SQLException {
        if (hasTable(c, table) && !hasColumn(c, table, column)) execute(c, "alter table " + table + " add column " + column + " " + definition);
    }
    private boolean hasTable(Connection c, String name) throws SQLException {
        try (var rows = c.getMetaData().getTables(c.getCatalog(), null, "%", new String[]{"TABLE"})) {
            while (rows.next()) if (name.equalsIgnoreCase(rows.getString("TABLE_NAME"))) return true;
            return false;
        }
    }
    private boolean hasColumn(Connection c, String table, String column) throws SQLException {
        try (var rows = c.getMetaData().getColumns(c.getCatalog(), null, "%", "%")) {
            while (rows.next()) if (table.equalsIgnoreCase(rows.getString("TABLE_NAME")) && column.equalsIgnoreCase(rows.getString("COLUMN_NAME"))) return true;
            return false;
        }
    }
    private void execute(Connection c, String sql) throws SQLException {
        try (var statement = c.createStatement()) { statement.execute(sql); }
    }
}
