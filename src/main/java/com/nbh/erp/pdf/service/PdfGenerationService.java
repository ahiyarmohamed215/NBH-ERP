package com.nbh.erp.pdf.service;

import com.lowagie.text.*;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import com.nbh.erp.common.exception.ResourceNotFoundException;
import com.nbh.erp.common.util.DateUtils;
import com.nbh.erp.common.util.NumberUtils;
import com.nbh.erp.grn.entity.Grn;
import com.nbh.erp.grn.entity.GrnItem;
import com.nbh.erp.grn.repository.GrnRepository;
import com.nbh.erp.gtn.entity.Gtn;
import com.nbh.erp.gtn.entity.GtnItem;
import com.nbh.erp.gtn.repository.GtnRepository;
import com.nbh.erp.sales.entity.Invoice;
import com.nbh.erp.sales.entity.InvoiceItem;
import com.nbh.erp.sales.repository.InvoiceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.awt.Color;
import java.io.ByteArrayOutputStream;

@Slf4j
@Service
@RequiredArgsConstructor
public class PdfGenerationService {

    private final InvoiceRepository invoiceRepository;
    private final GrnRepository grnRepository;
    private final GtnRepository gtnRepository;
    private final com.nbh.erp.customer.repository.CustomerRepository customerRepository;
    private final com.nbh.erp.customergroup.repository.CustomerGroupRepository customerGroupRepository;
    private final com.nbh.erp.user.repository.UserRepository userRepository;

    @Value("${app.company.name:NBH Warehouse & Distribution}")
    private String companyName;

    @Value("${app.company.address:123 Commercial Avenue, Colombo, Sri Lanka}")
    private String companyAddress;

    @Value("${app.company.phone:+94 11 234 5678}")
    private String companyPhone;

    @Value("${app.company.currency-symbol:Rs.}")
    private String currencySymbol;

    @Transactional(readOnly = true)
    public byte[] generateInvoicePdf(Long invoiceId) {
        Invoice invoice = invoiceRepository.findById(invoiceId)
                .orElseThrow(() -> new ResourceNotFoundException("Invoice", "id", invoiceId));

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        Document document = new Document(PageSize.A4, 36, 36, 36, 36);

        try {
            PdfWriter.getInstance(document, out);
            document.open();

            Font headerFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 18, new Color(30, 41, 59));
            Font subHeaderFont = FontFactory.getFont(FontFactory.HELVETICA, 10, new Color(100, 116, 139));
            Font titleFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 14, new Color(15, 23, 42));
            Font tableHeadFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10, Color.WHITE);
            Font bodyFont = FontFactory.getFont(FontFactory.HELVETICA, 10, new Color(51, 65, 85));
            Font boldBody = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10, new Color(15, 23, 42));

            // Header Section
            Paragraph title = new Paragraph(companyName, headerFont);
            Paragraph address = new Paragraph(companyAddress + " | Tel: " + companyPhone, subHeaderFont);
            address.setSpacingAfter(15);
            document.add(title);
            document.add(address);

            // Document Info Box
            PdfPTable metaTable = new PdfPTable(2);
            metaTable.setWidthPercentage(100);

            PdfPCell leftCell = new PdfPCell();
            leftCell.setBorder(Rectangle.NO_BORDER);
            leftCell.addElement(new Paragraph("INVOICE TO:", boldBody));
            leftCell.addElement(new Paragraph(invoice.getCustomer().getName(), bodyFont));
            leftCell.addElement(new Paragraph("Phone: " + (invoice.getCustomer().getPhone() != null ? invoice.getCustomer().getPhone() : "-"), bodyFont));
            leftCell.addElement(new Paragraph("Warehouse: " + invoice.getWarehouse().getName(), bodyFont));

            PdfPCell rightCell = new PdfPCell();
            rightCell.setBorder(Rectangle.NO_BORDER);
            rightCell.setHorizontalAlignment(Element.ALIGN_RIGHT);
            rightCell.addElement(new Paragraph("INVOICE: " + invoice.getInvoiceNumber(), titleFont));
            rightCell.addElement(new Paragraph("Date: " + DateUtils.formatDate(invoice.getInvoiceDate()), bodyFont));
            rightCell.addElement(new Paragraph("Payment: " + invoice.getPaymentType(), bodyFont));
            rightCell.addElement(new Paragraph("Status: " + invoice.getStatus(), boldBody));

            metaTable.addCell(leftCell);
            metaTable.addCell(rightCell);
            metaTable.setSpacingAfter(20);
            document.add(metaTable);

            // Line Items Table
            PdfPTable itemsTable = new PdfPTable(6);
            itemsTable.setWidthPercentage(100);
            itemsTable.setWidths(new float[]{1f, 3.5f, 1.2f, 1.5f, 1.2f, 1.6f});

            String[] headers = {"#", "Item Description", "Qty", "Price (" + currencySymbol + ")", "Disc", "Total (" + currencySymbol + ")"};
            for (String h : headers) {
                PdfPCell cell = new PdfPCell(new Phrase(h, tableHeadFont));
                cell.setBackgroundColor(new Color(37, 99, 235));
                cell.setPadding(6);
                cell.setHorizontalAlignment(Element.ALIGN_CENTER);
                itemsTable.addCell(cell);
            }

            int index = 1;
            for (InvoiceItem item : invoice.getItems()) {
                addTableCell(itemsTable, String.valueOf(index++), bodyFont, Element.ALIGN_CENTER);
                addTableCell(itemsTable, item.getProduct().getName() + " (" + item.getProduct().getSku() + ")", bodyFont, Element.ALIGN_LEFT);
                addTableCell(itemsTable, NumberUtils.formatQuantity(item.getQuantity()), bodyFont, Element.ALIGN_RIGHT);
                addTableCell(itemsTable, NumberUtils.formatCurrency(item.getUnitPrice()), bodyFont, Element.ALIGN_RIGHT);
                addTableCell(itemsTable, NumberUtils.formatCurrency(item.getDiscountAmount()), bodyFont, Element.ALIGN_RIGHT);
                addTableCell(itemsTable, NumberUtils.formatCurrency(item.getTotalPrice()), bodyFont, Element.ALIGN_RIGHT);
            }

            itemsTable.setSpacingAfter(15);
            document.add(itemsTable);

            // Summary Totals Table
            PdfPTable totalsTable = new PdfPTable(2);
            totalsTable.setWidthPercentage(40);
            totalsTable.setHorizontalAlignment(Element.ALIGN_RIGHT);

            addTotalRow(totalsTable, "Subtotal:", NumberUtils.formatCurrency(invoice.getSubtotal()) + " " + currencySymbol, bodyFont);
            if (invoice.getDiscountAmount().compareTo(java.math.BigDecimal.ZERO) > 0) {
                addTotalRow(totalsTable, "Discount:", "-" + NumberUtils.formatCurrency(invoice.getDiscountAmount()) + " " + currencySymbol, bodyFont);
            }
            if (invoice.getTaxAmount().compareTo(java.math.BigDecimal.ZERO) > 0) {
                addTotalRow(totalsTable, "Tax (" + invoice.getTaxRate() + "%):", NumberUtils.formatCurrency(invoice.getTaxAmount()) + " " + currencySymbol, bodyFont);
            }
            addTotalRow(totalsTable, "Net Total:", NumberUtils.formatCurrency(invoice.getNetTotal()) + " " + currencySymbol, boldBody);
            addTotalRow(totalsTable, "Amount Paid:", NumberUtils.formatCurrency(invoice.getPaidAmount()) + " " + currencySymbol, bodyFont);
            if (invoice.getBalanceAmount().compareTo(java.math.BigDecimal.ZERO) > 0) {
                addTotalRow(totalsTable, "Balance Due:", NumberUtils.formatCurrency(invoice.getBalanceAmount()) + " " + currencySymbol, boldBody);
            }

            document.add(totalsTable);

            // Footer Note
            Paragraph footer = new Paragraph("\n\nThank you for your business!\nGenerated by NBH ERP", subHeaderFont);
            footer.setAlignment(Element.ALIGN_CENTER);
            document.add(footer);

            document.close();
        } catch (Exception e) {
            log.error("Failed to generate PDF for invoice: " + invoiceId, e);
            throw new RuntimeException("Could not generate PDF", e);
        }

        return out.toByteArray();
    }

    @Transactional(readOnly = true)
    public byte[] generateGrnPdf(Long grnId) {
        Grn grn = grnRepository.findById(grnId)
                .orElseThrow(() -> new ResourceNotFoundException("GRN", "id", grnId));

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        Document document = new Document(PageSize.A4, 36, 36, 36, 36);

        try {
            PdfWriter.getInstance(document, out);
            document.open();

            Font headerFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 18, new Color(30, 41, 59));
            Font subHeaderFont = FontFactory.getFont(FontFactory.HELVETICA, 10, new Color(100, 116, 139));
            Font titleFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 14, new Color(15, 23, 42));
            Font tableHeadFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10, Color.WHITE);
            Font bodyFont = FontFactory.getFont(FontFactory.HELVETICA, 10, new Color(51, 65, 85));
            Font boldBody = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10, new Color(15, 23, 42));

            document.add(new Paragraph(companyName, headerFont));
            Paragraph addr = new Paragraph("GOODS RECEIVED NOTE (GRN)", titleFont);
            addr.setSpacingAfter(15);
            document.add(addr);

            PdfPTable meta = new PdfPTable(2);
            meta.setWidthPercentage(100);

            PdfPCell c1 = new PdfPCell();
            c1.setBorder(Rectangle.NO_BORDER);
            c1.addElement(new Paragraph("GRN #: " + grn.getGrnNumber(), boldBody));
            c1.addElement(new Paragraph("Supplier: " + grn.getSupplier().getName(), bodyFont));
            c1.addElement(new Paragraph("Supplier Inv: " + (grn.getSupplierInvoiceNumber() != null ? grn.getSupplierInvoiceNumber() : "-"), bodyFont));

            PdfPCell c2 = new PdfPCell();
            c2.setBorder(Rectangle.NO_BORDER);
            c2.addElement(new Paragraph("Warehouse: " + grn.getWarehouse().getName(), bodyFont));
            c2.addElement(new Paragraph("Received Date: " + DateUtils.formatDate(grn.getReceivedDate()), bodyFont));
            c2.addElement(new Paragraph("Status: " + grn.getStatus(), boldBody));

            meta.addCell(c1);
            meta.addCell(c2);
            meta.setSpacingAfter(15);
            document.add(meta);

            PdfPTable items = new PdfPTable(5);
            items.setWidthPercentage(100);
            items.setWidths(new float[]{1f, 4f, 1.5f, 1.5f, 2f});

            String[] heads = {"#", "Product", "Qty Received", "Unit Cost (" + currencySymbol + ")", "Total (" + currencySymbol + ")"};
            for (String h : heads) {
                PdfPCell c = new PdfPCell(new Phrase(h, tableHeadFont));
                c.setBackgroundColor(new Color(13, 148, 136)); // Teal
                c.setPadding(6);
                c.setHorizontalAlignment(Element.ALIGN_CENTER);
                items.addCell(c);
            }

            int idx = 1;
            for (GrnItem it : grn.getItems()) {
                addTableCell(items, String.valueOf(idx++), bodyFont, Element.ALIGN_CENTER);
                addTableCell(items, it.getProduct().getName() + " (" + it.getProduct().getSku() + ")", bodyFont, Element.ALIGN_LEFT);
                addTableCell(items, NumberUtils.formatQuantity(it.getQuantityReceived()), bodyFont, Element.ALIGN_RIGHT);
                addTableCell(items, NumberUtils.formatCurrency(it.getUnitCost()), bodyFont, Element.ALIGN_RIGHT);
                addTableCell(items, NumberUtils.formatCurrency(it.getTotalCost()), bodyFont, Element.ALIGN_RIGHT);
            }

            items.setSpacingAfter(15);
            document.add(items);

            Paragraph tot = new Paragraph("Grand Total: " + currencySymbol + " " + NumberUtils.formatCurrency(grn.getTotalAmount()), boldBody);
            tot.setAlignment(Element.ALIGN_RIGHT);
            document.add(tot);

            document.close();
        } catch (Exception e) {
            log.error("Failed to generate GRN PDF: " + grnId, e);
            throw new RuntimeException("Could not generate GRN PDF", e);
        }

        return out.toByteArray();
    }

    @Transactional(readOnly = true)
    public byte[] generateGtnPdf(Long gtnId) {
        Gtn gtn = gtnRepository.findById(gtnId)
                .orElseThrow(() -> new ResourceNotFoundException("GTN", "id", gtnId));

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        Document document = new Document(PageSize.A4, 36, 36, 36, 36);

        try {
            PdfWriter.getInstance(document, out);
            document.open();

            Font headerFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 18, new Color(30, 41, 59));
            Font titleFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 14, new Color(15, 23, 42));
            Font tableHeadFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10, Color.WHITE);
            Font bodyFont = FontFactory.getFont(FontFactory.HELVETICA, 10, new Color(51, 65, 85));
            Font boldBody = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10, new Color(15, 23, 42));

            document.add(new Paragraph(companyName, headerFont));
            Paragraph addr = new Paragraph("GOODS TRANSFER NOTE (GTN)", titleFont);
            addr.setSpacingAfter(15);
            document.add(addr);

            PdfPTable meta = new PdfPTable(2);
            meta.setWidthPercentage(100);

            PdfPCell c1 = new PdfPCell();
            c1.setBorder(Rectangle.NO_BORDER);
            c1.addElement(new Paragraph("GTN #: " + gtn.getGtnNumber(), boldBody));
            c1.addElement(new Paragraph("Source: " + gtn.getSourceWarehouse().getName(), bodyFont));
            c1.addElement(new Paragraph("Destination: " + gtn.getDestinationWarehouse().getName(), bodyFont));

            PdfPCell c2 = new PdfPCell();
            c2.setBorder(Rectangle.NO_BORDER);
            c2.addElement(new Paragraph("Status: " + gtn.getStatus(), boldBody));
            c2.addElement(new Paragraph("Dispatch Date: " + (gtn.getDispatchDate() != null ? DateUtils.formatDate(gtn.getDispatchDate()) : "-"), bodyFont));
            c2.addElement(new Paragraph("Notes: " + (gtn.getNotes() != null ? gtn.getNotes() : "-"), bodyFont));

            meta.addCell(c1);
            meta.addCell(c2);
            meta.setSpacingAfter(15);
            document.add(meta);

            PdfPTable items = new PdfPTable(4);
            items.setWidthPercentage(100);
            items.setWidths(new float[]{1f, 5f, 2f, 2f});

            String[] heads = {"#", "Product Description & SKU", "Qty Transferred", "Unit Cost (" + currencySymbol + ")"};
            for (String h : heads) {
                PdfPCell c = new PdfPCell(new Phrase(h, tableHeadFont));
                c.setBackgroundColor(new Color(37, 99, 235));
                c.setPadding(6);
                c.setHorizontalAlignment(Element.ALIGN_CENTER);
                items.addCell(c);
            }

            int idx = 1;
            java.math.BigDecimal totalUnits = java.math.BigDecimal.ZERO;
            for (GtnItem it : gtn.getItems()) {
                addTableCell(items, String.valueOf(idx++), bodyFont, Element.ALIGN_CENTER);
                addTableCell(items, it.getProduct().getName() + " (" + it.getProduct().getSku() + ")", bodyFont, Element.ALIGN_LEFT);
                addTableCell(items, NumberUtils.formatQuantity(it.getQuantityTransferred()), bodyFont, Element.ALIGN_RIGHT);
                addTableCell(items, NumberUtils.formatCurrency(it.getUnitCost()), bodyFont, Element.ALIGN_RIGHT);
                totalUnits = totalUnits.add(it.getQuantityTransferred() != null ? it.getQuantityTransferred() : java.math.BigDecimal.ZERO);
            }

            items.setSpacingAfter(15);
            document.add(items);

            Paragraph tot = new Paragraph("Total Transfer Units: " + NumberUtils.formatQuantity(totalUnits), boldBody);
            tot.setAlignment(Element.ALIGN_RIGHT);
            document.add(tot);

            document.close();
        } catch (Exception e) {
            log.error("Failed to generate GTN PDF: " + gtnId, e);
            throw new RuntimeException("Could not generate GTN PDF", e);
        }

        return out.toByteArray();
    }

    @Transactional(readOnly = true)
    public byte[] generateCustomerPdf(Long customerId) {
        var customer = customerRepository.findById(customerId)
                .orElseThrow(() -> new ResourceNotFoundException("Customer", "id", customerId));

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        Document document = new Document(PageSize.A4, 36, 36, 36, 36);

        try {
            PdfWriter.getInstance(document, out);
            document.open();

            Font headerFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 16, new Color(30, 41, 59));
            Font subHeaderFont = FontFactory.getFont(FontFactory.HELVETICA, 9, new Color(100, 116, 139));
            Font titleFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 13, new Color(15, 23, 42));
            Font tableHeadFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9, Color.WHITE);
            Font bodyFont = FontFactory.getFont(FontFactory.HELVETICA, 9, new Color(51, 65, 85));
            Font boldBody = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9, new Color(15, 23, 42));

            Paragraph title = new Paragraph(companyName, headerFont);
            Paragraph address = new Paragraph(companyAddress + " | Tel: " + companyPhone, subHeaderFont);
            address.setSpacingAfter(12);
            document.add(title);
            document.add(address);

            Paragraph docTitle = new Paragraph("CUSTOMER STATEMENT & PROFILE", titleFont);
            docTitle.setSpacingAfter(10);
            document.add(docTitle);

            PdfPTable infoTable = new PdfPTable(2);
            infoTable.setWidthPercentage(100);

            PdfPCell leftCell = new PdfPCell();
            leftCell.setBorder(Rectangle.NO_BORDER);
            leftCell.addElement(new Paragraph("CUSTOMER DETAILS", boldBody));
            leftCell.addElement(new Paragraph("Customer ID: #" + customer.getId(), bodyFont));
            leftCell.addElement(new Paragraph("Code: " + customer.getCustomerCode(), boldBody));
            leftCell.addElement(new Paragraph("Name: " + customer.getName(), bodyFont));
            leftCell.addElement(new Paragraph("Address: " + (customer.getAddress() != null && !customer.getAddress().isBlank() ? customer.getAddress() : "—"), bodyFont));
            leftCell.addElement(new Paragraph("Phone: " + (customer.getPhone() != null ? customer.getPhone() : "—"), bodyFont));
            leftCell.addElement(new Paragraph("Contact Person: " + (customer.getContactPerson() != null ? customer.getContactPerson() : "—"), bodyFont));

            PdfPCell rightCell = new PdfPCell();
            rightCell.setBorder(Rectangle.NO_BORDER);
            rightCell.setHorizontalAlignment(Element.ALIGN_RIGHT);
            rightCell.addElement(new Paragraph("ACCOUNT SUMMARY", boldBody));
            rightCell.addElement(new Paragraph("Status: " + (Boolean.TRUE.equals(customer.getIsActive()) ? "ACTIVE" : "INACTIVE"), boldBody));
            rightCell.addElement(new Paragraph("Credit Limit: " + currencySymbol + " " + NumberUtils.formatCurrency(customer.getCreditLimit()), bodyFont));
            rightCell.addElement(new Paragraph("Current Balance: " + currencySymbol + " " + NumberUtils.formatCurrency(customer.getCurrentBalance()), boldBody));
            rightCell.addElement(new Paragraph("Generated: " + DateUtils.formatDateTime(java.time.LocalDateTime.now()), bodyFont));

            infoTable.addCell(leftCell);
            infoTable.addCell(rightCell);
            infoTable.setSpacingAfter(15);
            document.add(infoTable);

            var invoices = invoiceRepository.findByCustomerId(customerId);
            Paragraph invTitle = new Paragraph("TRANSACTION HISTORY", titleFont);
            invTitle.setSpacingAfter(8);
            document.add(invTitle);

            PdfPTable itemsTable = new PdfPTable(6);
            itemsTable.setWidthPercentage(100);
            itemsTable.setWidths(new float[]{1.5f, 2.2f, 1.8f, 1.8f, 1.8f, 1.5f});

            String[] headers = {"Date", "Invoice No", "Net Total", "Paid", "Balance", "Status"};
            for (String h : headers) {
                PdfPCell cell = new PdfPCell(new Phrase(h, tableHeadFont));
                cell.setBackgroundColor(new Color(2, 132, 199));
                cell.setPadding(5);
                cell.setHorizontalAlignment(Element.ALIGN_CENTER);
                itemsTable.addCell(cell);
            }

            if (invoices.isEmpty()) {
                PdfPCell emptyCell = new PdfPCell(new Phrase("No transaction records found for this customer.", bodyFont));
                emptyCell.setColspan(6);
                emptyCell.setPadding(10);
                emptyCell.setHorizontalAlignment(Element.ALIGN_CENTER);
                itemsTable.addCell(emptyCell);
            } else {
                for (var inv : invoices) {
                    addTableCell(itemsTable, DateUtils.formatDate(inv.getInvoiceDate()), bodyFont, Element.ALIGN_CENTER);
                    addTableCell(itemsTable, inv.getInvoiceNumber(), bodyFont, Element.ALIGN_LEFT);
                    addTableCell(itemsTable, NumberUtils.formatCurrency(inv.getNetTotal()), bodyFont, Element.ALIGN_RIGHT);
                    addTableCell(itemsTable, NumberUtils.formatCurrency(inv.getPaidAmount()), bodyFont, Element.ALIGN_RIGHT);
                    addTableCell(itemsTable, NumberUtils.formatCurrency(inv.getBalanceAmount()), boldBody, Element.ALIGN_RIGHT);
                    addTableCell(itemsTable, inv.getStatus(), bodyFont, Element.ALIGN_CENTER);
                }
            }

            itemsTable.setSpacingAfter(15);
            document.add(itemsTable);

            document.close();
        } catch (Exception e) {
            log.error("Failed to generate Customer PDF: " + customerId, e);
            throw new RuntimeException("Could not generate Customer PDF", e);
        }

        return out.toByteArray();
    }

    @Transactional(readOnly = true)
    public byte[] generateCustomerListPdf() {
        var customers = customerRepository.findAll();

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        Document document = new Document(PageSize.A4.rotate(), 28, 28, 28, 28);

        try {
            PdfWriter.getInstance(document, out);
            document.open();

            Font headerFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 15, new Color(30, 41, 59));
            Font subHeaderFont = FontFactory.getFont(FontFactory.HELVETICA, 8, new Color(100, 116, 139));
            Font titleFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 12, new Color(15, 23, 42));
            Font tableHeadFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8, Color.WHITE);
            Font bodyFont = FontFactory.getFont(FontFactory.HELVETICA, 8, new Color(51, 65, 85));
            Font boldBody = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8, new Color(15, 23, 42));

            Paragraph title = new Paragraph(companyName, headerFont);
            Paragraph address = new Paragraph(companyAddress + " | Tel: " + companyPhone + " | Date: " + DateUtils.formatDateTime(java.time.LocalDateTime.now()), subHeaderFont);
            address.setSpacingAfter(8);
            document.add(title);
            document.add(address);

            Paragraph docTitle = new Paragraph("CUSTOMER DIRECTORY & MASTER LIST (A4)", titleFont);
            docTitle.setSpacingAfter(8);
            document.add(docTitle);

            PdfPTable itemsTable = new PdfPTable(8);
            itemsTable.setWidthPercentage(100);
            itemsTable.setWidths(new float[]{1.4f, 2.8f, 3.2f, 1.8f, 1.8f, 1.6f, 1.6f, 1.2f});

            String[] headers = {"Code", "Customer Name", "Address", "Contact Person", "Phone", "Credit Limit", "Balance", "Status"};
            for (String h : headers) {
                PdfPCell cell = new PdfPCell(new Phrase(h, tableHeadFont));
                cell.setBackgroundColor(new Color(2, 132, 199));
                cell.setPadding(4);
                cell.setHorizontalAlignment(Element.ALIGN_CENTER);
                itemsTable.addCell(cell);
            }

            java.math.BigDecimal totalCredit = java.math.BigDecimal.ZERO;
            java.math.BigDecimal totalBal = java.math.BigDecimal.ZERO;

            for (var c : customers) {
                addTableCell(itemsTable, c.getCustomerCode(), boldBody, Element.ALIGN_CENTER);
                addTableCell(itemsTable, c.getName(), bodyFont, Element.ALIGN_LEFT);
                addTableCell(itemsTable, c.getAddress() != null && !c.getAddress().isBlank() ? c.getAddress() : "—", bodyFont, Element.ALIGN_LEFT);
                addTableCell(itemsTable, c.getContactPerson() != null ? c.getContactPerson() : "—", bodyFont, Element.ALIGN_LEFT);
                addTableCell(itemsTable, c.getPhone() != null ? c.getPhone() : "—", bodyFont, Element.ALIGN_LEFT);
                addTableCell(itemsTable, NumberUtils.formatCurrency(c.getCreditLimit()), bodyFont, Element.ALIGN_RIGHT);
                addTableCell(itemsTable, NumberUtils.formatCurrency(c.getCurrentBalance()), boldBody, Element.ALIGN_RIGHT);
                addTableCell(itemsTable, Boolean.TRUE.equals(c.getIsActive()) ? "Active" : "Inactive", bodyFont, Element.ALIGN_CENTER);

                if (c.getCreditLimit() != null) totalCredit = totalCredit.add(c.getCreditLimit());
                if (c.getCurrentBalance() != null) totalBal = totalBal.add(c.getCurrentBalance());
            }

            itemsTable.setSpacingAfter(10);
            document.add(itemsTable);

            Paragraph summary = new Paragraph(String.format("Total Customers: %d | Total Credit Limit: %s %s | Total Outstanding: %s %s",
                    customers.size(), currencySymbol, NumberUtils.formatCurrency(totalCredit), currencySymbol, NumberUtils.formatCurrency(totalBal)), boldBody);
            summary.setAlignment(Element.ALIGN_RIGHT);
            document.add(summary);

            document.close();
        } catch (Exception e) {
            log.error("Failed to generate Customer Directory PDF", e);
            throw new RuntimeException("Could not generate Customer Directory PDF", e);
        }

        return out.toByteArray();
    }

    @Transactional(readOnly = true)
    public byte[] generateCustomerGroupPdf(Long groupId) {
        var group = customerGroupRepository.findById(groupId)
                .orElseThrow(() -> new ResourceNotFoundException("CustomerGroup", "id", groupId));

        var members = customerRepository.findByCustomerGroupId(groupId);

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        Document document = new Document(PageSize.A4, 36, 36, 36, 36);

        try {
            PdfWriter.getInstance(document, out);
            document.open();

            Font headerFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 16, new Color(30, 41, 59));
            Font subHeaderFont = FontFactory.getFont(FontFactory.HELVETICA, 9, new Color(100, 116, 139));
            Font titleFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 13, new Color(15, 23, 42));
            Font tableHeadFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9, Color.WHITE);
            Font bodyFont = FontFactory.getFont(FontFactory.HELVETICA, 9, new Color(51, 65, 85));
            Font boldBody = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9, new Color(15, 23, 42));

            Paragraph title = new Paragraph(companyName, headerFont);
            Paragraph address = new Paragraph(companyAddress + " | Tel: " + companyPhone, subHeaderFont);
            address.setSpacingAfter(10);
            document.add(title);
            document.add(address);

            Paragraph docTitle = new Paragraph("CUSTOMER GROUP ROSTER: " + group.getGroupName(), titleFont);
            document.add(docTitle);

            String rep = group.getAssignedStaff() != null ? group.getAssignedStaff().getFullName() : "Unassigned";
            Paragraph meta = new Paragraph(String.format("Group Code: %s | Assigned Staff: %s | Total Customers: %d",
                    group.getGroupCode(), rep, members.size()), subHeaderFont);
            meta.setSpacingAfter(12);
            document.add(meta);

            PdfPTable itemsTable = new PdfPTable(6);
            itemsTable.setWidthPercentage(100);
            itemsTable.setWidths(new float[]{1.4f, 2.6f, 3.0f, 1.8f, 1.8f, 1.2f});

            String[] headers = {"Code", "Customer Name", "Address", "Phone", "Balance", "Status"};
            for (String h : headers) {
                PdfPCell cell = new PdfPCell(new Phrase(h, tableHeadFont));
                cell.setBackgroundColor(new Color(2, 132, 199));
                cell.setPadding(5);
                cell.setHorizontalAlignment(Element.ALIGN_CENTER);
                itemsTable.addCell(cell);
            }

            java.math.BigDecimal totalBal = java.math.BigDecimal.ZERO;
            for (var c : members) {
                addTableCell(itemsTable, c.getCustomerCode(), boldBody, Element.ALIGN_CENTER);
                addTableCell(itemsTable, c.getName(), bodyFont, Element.ALIGN_LEFT);
                addTableCell(itemsTable, c.getAddress() != null && !c.getAddress().isBlank() ? c.getAddress() : "—", bodyFont, Element.ALIGN_LEFT);
                addTableCell(itemsTable, c.getPhone() != null ? c.getPhone() : "—", bodyFont, Element.ALIGN_LEFT);
                addTableCell(itemsTable, NumberUtils.formatCurrency(c.getCurrentBalance()), boldBody, Element.ALIGN_RIGHT);
                addTableCell(itemsTable, Boolean.TRUE.equals(c.getIsActive()) ? "Active" : "Inactive", bodyFont, Element.ALIGN_CENTER);
                if (c.getCurrentBalance() != null) totalBal = totalBal.add(c.getCurrentBalance());
            }

            itemsTable.setSpacingAfter(12);
            document.add(itemsTable);

            Paragraph summary = new Paragraph("Total Group Outstanding Balance: " + currencySymbol + " " + NumberUtils.formatCurrency(totalBal), boldBody);
            summary.setAlignment(Element.ALIGN_RIGHT);
            document.add(summary);

            document.close();
        } catch (Exception e) {
            log.error("Failed to generate Customer Group PDF: " + groupId, e);
            throw new RuntimeException("Could not generate Customer Group PDF", e);
        }

        return out.toByteArray();
    }

    @Transactional(readOnly = true)
    public byte[] generateCustomerHistoryPdf(Long customerId) {
        var customer = customerRepository.findById(customerId)
                .orElseThrow(() -> new ResourceNotFoundException("Customer", "id", customerId));

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        Document document = new Document(PageSize.A4, 36, 36, 36, 36);

        try {
            PdfWriter.getInstance(document, out);
            document.open();

            Font headerFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 16, new Color(30, 41, 59));
            Font subHeaderFont = FontFactory.getFont(FontFactory.HELVETICA, 9, new Color(100, 116, 139));
            Font titleFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 13, new Color(15, 23, 42));
            Font tableHeadFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9, Color.WHITE);
            Font bodyFont = FontFactory.getFont(FontFactory.HELVETICA, 9, new Color(51, 65, 85));
            Font boldBody = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9, new Color(15, 23, 42));

            Paragraph title = new Paragraph(companyName, headerFont);
            Paragraph address = new Paragraph(companyAddress + " | Tel: " + companyPhone, subHeaderFont);
            address.setSpacingAfter(10);
            document.add(title);
            document.add(address);

            Paragraph docTitle = new Paragraph("CUSTOMER STATEMENT & TRANSACTION LEDGER", titleFont);
            docTitle.setSpacingAfter(8);
            document.add(docTitle);

            // In customer history the customer details no need to show customer name show the id only and also add the address to that
            PdfPTable infoTable = new PdfPTable(2);
            infoTable.setWidthPercentage(100);

            PdfPCell leftCell = new PdfPCell();
            leftCell.setBorder(Rectangle.NO_BORDER);
            leftCell.addElement(new Paragraph("CUSTOMER ID: #" + customer.getId(), boldBody));
            leftCell.addElement(new Paragraph("Code: " + customer.getCustomerCode(), boldBody));
            leftCell.addElement(new Paragraph("Address: " + (customer.getAddress() != null && !customer.getAddress().isBlank() ? customer.getAddress() : "—"), bodyFont));
            leftCell.addElement(new Paragraph("Phone: " + (customer.getPhone() != null ? customer.getPhone() : "—"), bodyFont));

            PdfPCell rightCell = new PdfPCell();
            rightCell.setBorder(Rectangle.NO_BORDER);
            rightCell.setHorizontalAlignment(Element.ALIGN_RIGHT);
            rightCell.addElement(new Paragraph("Status: " + (Boolean.TRUE.equals(customer.getIsActive()) ? "ACTIVE" : "INACTIVE"), boldBody));
            rightCell.addElement(new Paragraph("Credit Limit: " + currencySymbol + " " + NumberUtils.formatCurrency(customer.getCreditLimit()), bodyFont));
            rightCell.addElement(new Paragraph("Current Balance: " + currencySymbol + " " + NumberUtils.formatCurrency(customer.getCurrentBalance()), boldBody));
            rightCell.addElement(new Paragraph("Report Date: " + DateUtils.formatDateTime(java.time.LocalDateTime.now()), bodyFont));

            infoTable.addCell(leftCell);
            infoTable.addCell(rightCell);
            infoTable.setSpacingAfter(14);
            document.add(infoTable);

            var invoices = invoiceRepository.findByCustomerId(customerId);
            PdfPTable itemsTable = new PdfPTable(6);
            itemsTable.setWidthPercentage(100);
            itemsTable.setWidths(new float[]{1.5f, 2.2f, 1.8f, 1.8f, 1.8f, 1.5f});

            String[] headers = {"Date", "Invoice No", "Net Total", "Paid", "Balance", "Status"};
            for (String h : headers) {
                PdfPCell cell = new PdfPCell(new Phrase(h, tableHeadFont));
                cell.setBackgroundColor(new Color(2, 132, 199));
                cell.setPadding(5);
                cell.setHorizontalAlignment(Element.ALIGN_CENTER);
                itemsTable.addCell(cell);
            }

            if (invoices.isEmpty()) {
                PdfPCell emptyCell = new PdfPCell(new Phrase("No invoices found for this customer.", bodyFont));
                emptyCell.setColspan(6);
                emptyCell.setPadding(10);
                emptyCell.setHorizontalAlignment(Element.ALIGN_CENTER);
                itemsTable.addCell(emptyCell);
            } else {
                for (var inv : invoices) {
                    addTableCell(itemsTable, DateUtils.formatDate(inv.getInvoiceDate()), bodyFont, Element.ALIGN_CENTER);
                    addTableCell(itemsTable, inv.getInvoiceNumber(), bodyFont, Element.ALIGN_LEFT);
                    addTableCell(itemsTable, NumberUtils.formatCurrency(inv.getNetTotal()), bodyFont, Element.ALIGN_RIGHT);
                    addTableCell(itemsTable, NumberUtils.formatCurrency(inv.getPaidAmount()), bodyFont, Element.ALIGN_RIGHT);
                    addTableCell(itemsTable, NumberUtils.formatCurrency(inv.getBalanceAmount()), boldBody, Element.ALIGN_RIGHT);
                    addTableCell(itemsTable, inv.getStatus(), bodyFont, Element.ALIGN_CENTER);
                }
            }

            itemsTable.setSpacingAfter(12);
            document.add(itemsTable);

            document.close();
        } catch (Exception e) {
            log.error("Failed to generate Customer History PDF: " + customerId, e);
            throw new RuntimeException("Could not generate Customer History PDF", e);
        }

        return out.toByteArray();
    }

    @Transactional(readOnly = true)
    public byte[] generateEmployeeListPdf() {
        var employees = userRepository.findAll();

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        Document document = new Document(PageSize.A4.rotate(), 28, 28, 28, 28);

        try {
            PdfWriter.getInstance(document, out);
            document.open();

            Font headerFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 15, new Color(30, 41, 59));
            Font subHeaderFont = FontFactory.getFont(FontFactory.HELVETICA, 8, new Color(100, 116, 139));
            Font titleFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 12, new Color(15, 23, 42));
            Font tableHeadFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8, Color.WHITE);
            Font bodyFont = FontFactory.getFont(FontFactory.HELVETICA, 8, new Color(51, 65, 85));
            Font boldBody = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8, new Color(15, 23, 42));

            Paragraph title = new Paragraph(companyName, headerFont);
            Paragraph address = new Paragraph(companyAddress + " | Tel: " + companyPhone + " | Date: " + DateUtils.formatDateTime(java.time.LocalDateTime.now()), subHeaderFont);
            address.setSpacingAfter(8);
            document.add(title);
            document.add(address);

            Paragraph docTitle = new Paragraph("EMPLOYEE DIRECTORY & STAFF ROSTER (A4)", titleFont);
            docTitle.setSpacingAfter(8);
            document.add(docTitle);

            PdfPTable itemsTable = new PdfPTable(7);
            itemsTable.setWidthPercentage(100);
            itemsTable.setWidths(new float[]{1.4f, 2.5f, 1.8f, 2.3f, 1.8f, 2.6f, 1.2f});

            String[] headers = {"Code", "Full Name", "Username", "Assigned Roles", "Phone", "Email", "Status"};
            for (String h : headers) {
                PdfPCell cell = new PdfPCell(new Phrase(h, tableHeadFont));
                cell.setBackgroundColor(new Color(2, 132, 199));
                cell.setPadding(4);
                cell.setHorizontalAlignment(Element.ALIGN_CENTER);
                itemsTable.addCell(cell);
            }

            int activeCount = 0;
            int inactiveCount = 0;

            for (var emp : employees) {
                String code = emp.getEmployeeCode() != null && !emp.getEmployeeCode().isBlank() ? emp.getEmployeeCode() : "EMP-" + emp.getId();
                String roleNames = emp.getRoles() != null && !emp.getRoles().isEmpty()
                        ? emp.getRoles().stream().map(r -> r.getName().replace("ROLE_", "")).collect(java.util.stream.Collectors.joining(", "))
                        : "Employee";
                boolean isActive = Boolean.TRUE.equals(emp.getIsActive());
                if (isActive) activeCount++; else inactiveCount++;

                addTableCell(itemsTable, code, boldBody, Element.ALIGN_CENTER);
                addTableCell(itemsTable, emp.getFullName() != null ? emp.getFullName() : emp.getUsername(), bodyFont, Element.ALIGN_LEFT);
                addTableCell(itemsTable, "@" + emp.getUsername(), bodyFont, Element.ALIGN_LEFT);
                addTableCell(itemsTable, roleNames, bodyFont, Element.ALIGN_LEFT);
                addTableCell(itemsTable, emp.getPhone() != null && !emp.getPhone().isBlank() ? emp.getPhone() : "—", bodyFont, Element.ALIGN_LEFT);
                addTableCell(itemsTable, emp.getEmail() != null && !emp.getEmail().isBlank() ? emp.getEmail() : "—", bodyFont, Element.ALIGN_LEFT);
                addTableCell(itemsTable, isActive ? "Active" : "Inactive", boldBody, Element.ALIGN_CENTER);
            }

            itemsTable.setSpacingAfter(10);
            document.add(itemsTable);

            Paragraph summary = new Paragraph(String.format("Total Employees: %d | Active: %d | Inactive: %d",
                    employees.size(), activeCount, inactiveCount), boldBody);
            summary.setAlignment(Element.ALIGN_RIGHT);
            document.add(summary);

            document.close();
        } catch (Exception e) {
            log.error("Failed to generate Employee Directory PDF", e);
            throw new RuntimeException("Could not generate Employee Directory PDF", e);
        }

        return out.toByteArray();
    }

    @Transactional(readOnly = true)
    public byte[] generateEmployeePdf(Long userId) {
        var emp = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", userId));

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        Document document = new Document(PageSize.A4, 36, 36, 36, 36);

        try {
            PdfWriter.getInstance(document, out);
            document.open();

            Font headerFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 16, new Color(30, 41, 59));
            Font subHeaderFont = FontFactory.getFont(FontFactory.HELVETICA, 9, new Color(100, 116, 139));
            Font titleFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 13, new Color(15, 23, 42));
            Font bodyFont = FontFactory.getFont(FontFactory.HELVETICA, 9, new Color(51, 65, 85));
            Font boldBody = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9, new Color(15, 23, 42));

            Paragraph title = new Paragraph(companyName, headerFont);
            Paragraph address = new Paragraph(companyAddress + " | Tel: " + companyPhone + " | Date: " + DateUtils.formatDateTime(java.time.LocalDateTime.now()), subHeaderFont);
            address.setSpacingAfter(12);
            document.add(title);
            document.add(address);

            Paragraph docTitle = new Paragraph("EMPLOYEE PERSONNEL RECORD & STATEMENT", titleFont);
            docTitle.setSpacingAfter(12);
            document.add(docTitle);

            // Information Table Box
            PdfPTable infoTable = new PdfPTable(2);
            infoTable.setWidthPercentage(100);
            infoTable.setWidths(new float[]{1.1f, 0.9f});

            PdfPCell leftCell = new PdfPCell();
            leftCell.setBorder(Rectangle.NO_BORDER);
            leftCell.addElement(new Paragraph("EMPLOYEE DETAILS", boldBody));
            leftCell.addElement(new Paragraph("System ID: #" + emp.getId(), bodyFont));
            leftCell.addElement(new Paragraph("Code: " + (emp.getEmployeeCode() != null ? emp.getEmployeeCode() : "EMP-" + emp.getId()), boldBody));
            leftCell.addElement(new Paragraph("Full Name: " + (emp.getFullName() != null ? emp.getFullName() : emp.getUsername()), boldBody));
            leftCell.addElement(new Paragraph("Username: @" + emp.getUsername(), bodyFont));
            leftCell.addElement(new Paragraph("Phone: " + (emp.getPhone() != null && !emp.getPhone().isBlank() ? emp.getPhone() : "—"), bodyFont));
            leftCell.addElement(new Paragraph("Email: " + (emp.getEmail() != null && !emp.getEmail().isBlank() ? emp.getEmail() : "—"), bodyFont));

            PdfPCell rightCell = new PdfPCell();
            rightCell.setBorder(Rectangle.NO_BORDER);
            rightCell.addElement(new Paragraph("EMPLOYMENT STATUS & ROLES", boldBody));
            rightCell.addElement(new Paragraph("Status: " + (Boolean.TRUE.equals(emp.getIsActive()) ? "ACTIVE (OPERATIONAL)" : "INACTIVE"), boldBody));
            rightCell.addElement(new Paragraph("Approval Status: " + (emp.getApprovalStatus() != null ? emp.getApprovalStatus() : "APPROVED"), bodyFont));

            String roleNames = emp.getRoles() != null && !emp.getRoles().isEmpty()
                    ? emp.getRoles().stream().map(r -> r.getName().replace("ROLE_", "")).collect(java.util.stream.Collectors.joining(", "))
                    : "Employee";
            rightCell.addElement(new Paragraph("Assigned Roles: " + roleNames, boldBody));
            if (emp.getCommissionRate() != null && emp.getCommissionRate().compareTo(java.math.BigDecimal.ZERO) > 0) {
                rightCell.addElement(new Paragraph("Commission Rate: " + emp.getCommissionRate().toPlainString() + "%", boldBody));
            }
            if (emp.getCreatedAt() != null) {
                rightCell.addElement(new Paragraph("Joined Date: " + DateUtils.formatDateTime(emp.getCreatedAt()), bodyFont));
            }

            infoTable.addCell(leftCell);
            infoTable.addCell(rightCell);
            infoTable.setSpacingAfter(18);
            document.add(infoTable);

            // Footer note
            Paragraph footer = new Paragraph("Confidential Internal Personnel Document • " + companyName + " • Generated on " + DateUtils.formatDateTime(java.time.LocalDateTime.now()), subHeaderFont);
            footer.setAlignment(Element.ALIGN_CENTER);
            document.add(footer);

            document.close();
        } catch (Exception e) {
            log.error("Failed to generate Employee PDF for ID: " + userId, e);
            throw new RuntimeException("Could not generate Employee PDF", e);
        }

        return out.toByteArray();
    }

    private void addTableCell(PdfPTable table, String text, Font font, int alignment) {
        PdfPCell cell = new PdfPCell(new Phrase(text, font));
        cell.setPadding(5);
        cell.setHorizontalAlignment(alignment);
        cell.setBorderColor(new Color(226, 232, 240));
        table.addCell(cell);
    }

    private void addTotalRow(PdfPTable table, String label, String value, Font font) {
        PdfPCell c1 = new PdfPCell(new Phrase(label, font));
        c1.setBorder(Rectangle.NO_BORDER);
        c1.setHorizontalAlignment(Element.ALIGN_RIGHT);
        c1.setPadding(3);

        PdfPCell c2 = new PdfPCell(new Phrase(value, font));
        c2.setBorder(Rectangle.NO_BORDER);
        c2.setHorizontalAlignment(Element.ALIGN_RIGHT);
        c2.setPadding(3);

        table.addCell(c1);
        table.addCell(c2);
    }
}
