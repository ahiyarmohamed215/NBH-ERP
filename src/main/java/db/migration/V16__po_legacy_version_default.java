package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

/** Older installations retained an unmapped, mandatory PO version column. */
public class V16__po_legacy_version_default extends BaseJavaMigration {
    @Override
    public void migrate(Context context) throws Exception {
        var connection = context.getConnection();
        var metadata = connection.getMetaData();
        String tablePattern = metadata.storesUpperCaseIdentifiers() ? "PURCHASE_ORDERS" : "purchase_orders";
        String table = null;
        String column = null;
        try (var columns = metadata.getColumns(connection.getCatalog(), connection.getSchema(), tablePattern, null)) {
            while (columns.next()) {
                if ("version".equalsIgnoreCase(columns.getString("COLUMN_NAME"))
                        && "NO".equalsIgnoreCase(columns.getString("IS_NULLABLE"))
                        && columns.getString("COLUMN_DEF") == null) {
                    table = columns.getString("TABLE_NAME");
                    column = columns.getString("COLUMN_NAME");
                    break;
                }
            }
        }
        if (table == null) return; // Fresh schemas use record_version only.
        String quote = metadata.getIdentifierQuoteString().trim();
        try (var statement = connection.createStatement()) {
            statement.execute("ALTER TABLE " + quote + table + quote + " ALTER COLUMN " + quote + column + quote + " SET DEFAULT 0");
        }
    }
}
