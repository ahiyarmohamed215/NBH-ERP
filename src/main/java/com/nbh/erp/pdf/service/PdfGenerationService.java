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
import java.math.BigDecimal;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
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

        com.nbh.erp.customer.repository.CustomerRepository.requireActive(invoice.getCustomer());
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        boolean isHeld = invoice.getInvoiceNumber() == null
                || "YET_TO_PRINT".equalsIgnoreCase(invoice.getStatus())
                || "HELD".equalsIgnoreCase(invoice.getStatus())
                || "SENT_TO_WAREHOUSE".equalsIgnoreCase(invoice.getStatus())
                || "STOCK_ADJUSTED".equalsIgnoreCase(invoice.getStatus())
                || "POS_ONHOLD".equalsIgnoreCase(invoice.getStatus());

        Document document = isHeld
                ? new Document(PageSize.A4, 28, 28, 22, 22)
                : new Document(PageSize.A4, 34, 34, 34, 34);

        try {
            PdfWriter writer = PdfWriter.getInstance(document, out);
            document.open();

            if (isHeld) {
                generateHeldBillPdf(writer, document, invoice);
            } else {
                generateCommercialInvoicePdf(document, invoice);
            }

            document.close();
        } catch (Exception e) {
            log.error("Failed to generate PDF for invoice: " + invoiceId, e);
            throw new RuntimeException("Could not generate PDF", e);
        }

        return out.toByteArray();
    }

    private void generateHeldBillPdf(PdfWriter writer, Document document, Invoice invoice) throws DocumentException {
        Font brandFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 18, new Color(15, 23, 42));
        Font subHeaderFont = FontFactory.getFont(FontFactory.HELVETICA, 10, new Color(100, 116, 139));
        Font titleFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 22, new Color(3, 105, 161));
        Font docNumFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 13.5f, new Color(15, 23, 42));
        Font tableHeadFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10.5f, Color.WHITE);
        Font bodyFont = FontFactory.getFont(FontFactory.HELVETICA, 10.5f, new Color(51, 65, 85));
        Font boldBody = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 11f, new Color(15, 23, 42));
        Font smallLabel = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9.5f, new Color(100, 116, 139));
        Font badgeFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9.5f, new Color(133, 77, 14));
        Font qtyFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 13f, new Color(15, 23, 42));

        String heldNumber = invoice.getDocumentNumber() != null ? invoice.getDocumentNumber() : ("HLD-" + invoice.getId());
        String displayStatus = "SENT TO WAREHOUSE";
        if ("STOCK_ADJUSTED".equalsIgnoreCase(invoice.getStatus())) {
            displayStatus = "WAREHOUSE REVIEWED";
        } else if ("CANCELLED".equalsIgnoreCase(invoice.getStatus()) || "VOIDED".equalsIgnoreCase(invoice.getStatus())) {
            displayStatus = "CANCELLED";
        }

        String printDateStr = DateTimeFormatter.ofPattern("dd MMM yyyy, hh:mm a", java.util.Locale.ENGLISH)
                .withZone(ZoneId.of("Asia/Colombo"))
                .format(Instant.now());

        final int pageSize = 18;
        java.util.List<InvoiceItem> allItems = invoice.getItems() != null ? invoice.getItems() : java.util.Collections.emptyList();
        int totalItems = allItems.size();
        int totalPages = Math.max(1, (totalItems + pageSize - 1) / pageSize);

        for (int pageIdx = 0; pageIdx < totalPages; pageIdx++) {
            if (pageIdx > 0) {
                document.newPage();
            }
            boolean isLastPage = (pageIdx == totalPages - 1);
            int pageNum = pageIdx + 1;
            int startIdx = pageIdx * pageSize;
            int endIdx = Math.min(startIdx + pageSize, totalItems);
            java.util.List<InvoiceItem> pageItems = allItems.subList(startIdx, endIdx);

            // Every collection sheet includes full bill and customer details.
            {
                PdfPTable headerTable = new PdfPTable(2);
                headerTable.setWidthPercentage(100);
                headerTable.setWidths(new float[]{3.2f, 2.0f});

                PdfPCell hLeft = new PdfPCell();
                hLeft.setBorder(Rectangle.NO_BORDER);
                Paragraph brandTitle = new Paragraph("NBH ENTERPRISE", brandFont);
                brandTitle.setLeading(20f);
                hLeft.addElement(brandTitle);
                Paragraph brandSub = new Paragraph("Warehouse & Distribution · Enterprise ERP", subHeaderFont);
                brandSub.setLeading(9f);
                brandSub.setSpacingBefore(3);
                hLeft.addElement(brandSub);

                String whName = invoice.getWarehouse() != null ? invoice.getWarehouse().getName().toUpperCase() : "WH01";
                PdfPTable whTable = new PdfPTable(1);
                whTable.setWidthPercentage(72);
                whTable.setHorizontalAlignment(Element.ALIGN_LEFT);
                whTable.setSpacingBefore(6);
                PdfPCell whCell = new PdfPCell();
                whCell.setBackgroundColor(new Color(254, 226, 226));
                whCell.setBorderColor(new Color(252, 165, 165));
                whCell.setBorderWidth(1f);
                whCell.setPadding(4);
                whCell.setPaddingLeft(6);
                whCell.setPaddingRight(6);
                Paragraph whPara = new Paragraph(whName, FontFactory.getFont(FontFactory.HELVETICA_BOLD, 11.5f, new Color(185, 28, 28)));
                whPara.setLeading(9f);
                whCell.addElement(whPara);
                whTable.addCell(whCell);
                hLeft.addElement(whTable);

                PdfPCell hRight = new PdfPCell();
                hRight.setBorder(Rectangle.NO_BORDER);
                hRight.setHorizontalAlignment(Element.ALIGN_RIGHT);
                Paragraph dt = new Paragraph("Onhold bill", titleFont);
                dt.setAlignment(Element.ALIGN_RIGHT);
                dt.setLeading(22f);
                hRight.addElement(dt);
                Paragraph dn = new Paragraph(heldNumber, docNumFont);
                dn.setAlignment(Element.ALIGN_RIGHT);
                dn.setLeading(12f);
                hRight.addElement(dn);
                Paragraph copySub = new Paragraph("Warehouse review copy", subHeaderFont);
                copySub.setAlignment(Element.ALIGN_RIGHT);
                copySub.setLeading(9f);
                hRight.addElement(copySub);

                // Status badge row
                Paragraph st = new Paragraph(displayStatus, badgeFont);
                st.setAlignment(Element.ALIGN_RIGHT);
                st.setSpacingBefore(4);
                st.setLeading(10f);
                hRight.addElement(st);

                headerTable.addCell(hLeft);
                headerTable.addCell(hRight);
                headerTable.setSpacingAfter(4);
                document.add(headerTable);

                // Blue divider line
                PdfPTable divider = new PdfPTable(1);
                divider.setWidthPercentage(100);
                PdfPCell dCell = new PdfPCell();
                dCell.setBackgroundColor(new Color(2, 132, 199));
                dCell.setFixedHeight(2f);
                dCell.setBorder(Rectangle.NO_BORDER);
                divider.addCell(dCell);
                divider.setSpacingAfter(4);
                document.add(divider);

                // Full-width customer details and remarks
                PdfPTable upperTable = new PdfPTable(2);
                // Packing labels use 36 pt; each entry box is exactly 72 pt (1 inch).
                float packingPanelWidth = 36f + 72f + 9f;
                upperTable.setWidths(new float[]{document.right() - document.left() - packingPanelWidth, packingPanelWidth});
                upperTable.setWidthPercentage(100);

                PdfPCell leftCell = new PdfPCell();
                leftCell.setBorder(Rectangle.NO_BORDER);
                leftCell.setPadding(0);
                leftCell.setPaddingRight(0);

                PdfPTable metaTable = new PdfPTable(2);
                metaTable.setWidthPercentage(100);
                metaTable.setWidths(new float[]{1.2f, 1f});

                PdfPCell custCell = new PdfPCell();
                custCell.setBackgroundColor(new Color(248, 250, 252));
                custCell.setBorderColor(new Color(226, 232, 240));
                custCell.setPadding(6);
                custCell.addElement(new Paragraph("CUSTOMER DETAILS", smallLabel));
                String custName = invoice.getCustomer() != null ? invoice.getCustomer().getName() : "-";
                String custCode = (invoice.getCustomer() != null && invoice.getCustomer().getCustomerCode() != null) ? invoice.getCustomer().getCustomerCode() : "-";
                PdfPTable customerIdentity = new PdfPTable(2);
                customerIdentity.setWidthPercentage(100);
                customerIdentity.setWidths(new float[]{1f, 3f});
                PdfPCell customerCode = new PdfPCell(new Phrase(custCode, FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10.5f, new Color(71, 85, 105))));
                customerCode.setBorder(Rectangle.NO_BORDER);
                customerCode.setPadding(0f);
                customerIdentity.addCell(customerCode);
                PdfPCell customerName = new PdfPCell(new Phrase(custName, FontFactory.getFont(FontFactory.HELVETICA_BOLD, 12.5f, new Color(15, 23, 42))));
                customerName.setBorder(Rectangle.NO_BORDER);
                customerName.setPadding(0f);
                customerIdentity.addCell(customerName);
                custCell.addElement(customerIdentity);
                String custAddr = (invoice.getCustomer() != null && invoice.getCustomer().getAddress() != null) ? invoice.getCustomer().getAddress() : "—";
                Paragraph addrPara = new Paragraph(custAddr, FontFactory.getFont(FontFactory.HELVETICA, 10.5f, new Color(51, 65, 85)));
                addrPara.setSpacingBefore(4f);
                custCell.addElement(addrPara);
                metaTable.addCell(custCell);

                PdfPCell staffCell = new PdfPCell();
                staffCell.setBackgroundColor(new Color(248, 250, 252));
                staffCell.setBorderColor(new Color(226, 232, 240));
                staffCell.setPadding(5f);
                String staff = invoice.getSalesman() != null ? (invoice.getSalesman().getFullName() != null ? invoice.getSalesman().getFullName() : invoice.getSalesman().getUsername()) : (invoice.getCreatedBy() != null ? invoice.getCreatedBy() : "admin");
                Paragraph preparedLabel = new Paragraph("PREPARED BY", smallLabel);
                preparedLabel.setLeading(9f);
                staffCell.addElement(preparedLabel);
                Paragraph preparedValue = new Paragraph(staff, boldBody);
                preparedValue.setLeading(11f);
                staffCell.addElement(preparedValue);
                var savedAt = invoice.getOriginalHeldCapturedAt() != null ? invoice.getOriginalHeldCapturedAt() : invoice.getCreatedAt();
                String savedAtText = savedAt != null
                        ? savedAt.format(DateTimeFormatter.ofPattern("dd MMM yyyy, hh:mm a", java.util.Locale.ENGLISH))
                        : DateUtils.formatDate(invoice.getInvoiceDate());
                Paragraph billedLabel = new Paragraph("BILLED AT", smallLabel);
                billedLabel.setSpacingBefore(4f);
                billedLabel.setLeading(9f);
                staffCell.addElement(billedLabel);
                Paragraph billedValue = new Paragraph(savedAtText, boldBody);
                billedValue.setLeading(11f);
                staffCell.addElement(billedValue);
                metaTable.addCell(staffCell);
                metaTable.setSpacingAfter(2);
                leftCell.addElement(metaTable);

                PdfPTable remarksTable = new PdfPTable(1);
                remarksTable.setWidthPercentage(100);
                PdfPCell remCell = new PdfPCell();
                remCell.setBackgroundColor(new Color(240, 249, 255));
                remCell.setBorderColor(new Color(219, 234, 254));
                remCell.setPadding(3);
                remCell.setMinimumHeight(25f);
                Paragraph remTitle = new Paragraph("REMARKS", FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9f, new Color(3, 105, 161)));
                remTitle.setLeading(8.5f);
                remCell.addElement(remTitle);
                String rawNotes = invoice.getNotes() != null ? invoice.getNotes().split("\nWarehouse review:")[0].trim() : "";
                Paragraph remText = new Paragraph(rawNotes.isBlank() ? "—" : rawNotes, bodyFont);
                remText.setLeading(10.5f);
                remCell.addElement(remText);
                remarksTable.addCell(remCell);
                leftCell.addElement(remarksTable);

                upperTable.addCell(leftCell);
                PdfPCell packingPanel = new PdfPCell();
                packingPanel.setBorder(Rectangle.NO_BORDER);
                packingPanel.setPadding(0f);
                packingPanel.setPaddingLeft(9f);
                // Match the warehouse form: labels above four separate writing boxes.
                PdfPTable packingHeading = new PdfPTable(1);
                packingHeading.setWidthPercentage(100);
                PdfPCell packingTitle = new PdfPCell(new Phrase("Packing counts", boldBody));
                packingTitle.setBorder(Rectangle.NO_BORDER);
                packingHeading.addCell(packingTitle);
                packingPanel.addElement(packingHeading);

                String[] packingLabels = {"Box", "Bag", "P. Bag", "Others"};
                Integer[] packingValues = {invoice.getPackingBoxes(), invoice.getPackingBags(), invoice.getPackingPBags(), invoice.getPackingOthers()};
                PdfPTable packingTable = new PdfPTable(1);
                packingTable.setWidthPercentage(100);
                for (int p = 0; p < packingLabels.length; p++) {
                    PdfPTable box = new PdfPTable(2);
                    box.setTotalWidth(new float[]{36f, 72f});
                    box.setLockedWidth(true);
                    PdfPCell label = new PdfPCell(new Phrase(packingLabels[p] + ":", smallLabel));
                    label.setBorder(Rectangle.NO_BORDER);
                    label.setBorderColor(new Color(203, 213, 225));
                    label.setPadding(2f);
                    label.setPaddingLeft(0f);
                    label.setVerticalAlignment(Element.ALIGN_MIDDLE);
                    label.setFixedHeight(5.5f * 72f / 25.4f);
                    box.addCell(label);
                    String value = packingValues[p] != null && packingValues[p] > 0 ? packingValues[p].toString() : "";
                    PdfPCell valueCell = new PdfPCell(new Phrase(value, qtyFont));
                    valueCell.setBorderColor(new Color(203, 213, 225));
                    // Each count uses one compact label-and-box row.
                    valueCell.setFixedHeight(5.5f * 72f / 25.4f);
                    valueCell.setHorizontalAlignment(Element.ALIGN_CENTER);
                    valueCell.setVerticalAlignment(Element.ALIGN_MIDDLE);
                    box.addCell(valueCell);
                    PdfPCell wrapper = new PdfPCell(box);
                    wrapper.setBorder(Rectangle.NO_BORDER);
                    wrapper.setPaddingRight(0f);
                    wrapper.setPaddingBottom(3f);
                    packingTable.addCell(wrapper);
                }
                packingTable.setSpacingAfter(0f);
                packingPanel.addElement(packingTable);

                upperTable.addCell(packingPanel);

                upperTable.setSpacingAfter(2);
                document.add(upperTable);


            }

            // Line Items Table (5 columns: #, Code, Product name, Requested qty, Adjusted qty)
            PdfPTable itemsTable = new PdfPTable(5);
            itemsTable.setWidthPercentage(100);
            float tableWidth = document.right() - document.left();
            float noColWidth = 19.84f;   // 0.7 cm
            float codeColWidth = 93.54f; // 3.3 cm
            float reqColWidth = 56.69f;  // 2 cm
            float adjColWidth = 56.69f;  // 2 cm
            float nameColWidth = tableWidth - noColWidth - codeColWidth - reqColWidth - adjColWidth;
            itemsTable.setWidths(new float[]{noColWidth, codeColWidth, nameColWidth, reqColWidth, adjColWidth});

            // Reference row (colspan 6)
            PdfPCell refCell = new PdfPCell();
            refCell.setColspan(5);
            refCell.setBackgroundColor(new Color(248, 250, 252));
            refCell.setBorderColor(new Color(203, 213, 225));
            refCell.setPadding(3);
            PdfPTable refInner = new PdfPTable(2);
            refInner.setWidthPercentage(100);
            String refLeft = heldNumber + " · " + (invoice.getWarehouse() != null ? invoice.getWarehouse().getName() : "WH01");
            PdfPCell rLeft = new PdfPCell(new Phrase(refLeft, FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10f, new Color(71, 85, 105))));
            rLeft.setBorder(Rectangle.NO_BORDER);
            String refRight = totalItems + " product lines · Warehouse review" + " · Page " + pageNum + " of " + totalPages;
            PdfPCell rRight = new PdfPCell(new Phrase(refRight, FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10f, new Color(100, 116, 139))));
            rRight.setBorder(Rectangle.NO_BORDER);
            rRight.setHorizontalAlignment(Element.ALIGN_RIGHT);
            refInner.addCell(rLeft);
            refInner.addCell(rRight);
            refCell.addElement(refInner);
            itemsTable.addCell(refCell);

            // Headers row: #, Code, Product name, Requested qty, Adjusted qty, Remarks
            String[] headers = {"#", "Code", "Product name", "Requested qty", "Adjusted qty"};
            for (int i = 0; i < headers.length; i++) {
                PdfPCell cell = new PdfPCell(new Phrase(headers[i], tableHeadFont));
                cell.setBackgroundColor(new Color(11, 59, 109));
                cell.setPadding(3);
                cell.setBorderColor(new Color(11, 59, 109));
                cell.setHorizontalAlignment(i == 0 || i == 3 || i == 4 ? Element.ALIGN_CENTER : Element.ALIGN_LEFT);
                itemsTable.addCell(cell);
            }

            // Data rows (each row 0.8cm tall = 22.68pt)
            for (int i = 0; i < pageItems.size(); i++) {
                InvoiceItem item = pageItems.get(i);
                int itemNo = startIdx + i + 1;

                PdfPCell noCell = new PdfPCell(new Phrase(String.valueOf(itemNo), FontFactory.getFont(FontFactory.HELVETICA_BOLD, 11.5f, new Color(100, 116, 139))));
                noCell.setBorderColor(new Color(226, 232, 240));
                noCell.setHorizontalAlignment(Element.ALIGN_CENTER);
                noCell.setVerticalAlignment(Element.ALIGN_MIDDLE);
                noCell.setMinimumHeight(22.68f);
                itemsTable.addCell(noCell);

                String sku = item.getProduct().getSku() != null ? item.getProduct().getSku() : "";
                PdfPCell codeCell = new PdfPCell(new Phrase(sku, FontFactory.getFont(FontFactory.HELVETICA_BOLD, 11f, new Color(71, 85, 105))));
                codeCell.setBorderColor(new Color(226, 232, 240));
                codeCell.setPadding(2);
                codeCell.setMinimumHeight(22.68f);
                codeCell.setVerticalAlignment(Element.ALIGN_MIDDLE);
                itemsTable.addCell(codeCell);

                String name = item.getProduct().getName() != null ? item.getProduct().getName() : "";
                PdfPCell nameCell = new PdfPCell(new Phrase(name, FontFactory.getFont(FontFactory.HELVETICA_BOLD, 11.5f, new Color(15, 23, 42))));
                nameCell.setBorderColor(new Color(226, 232, 240));
                nameCell.setPadding(2);
                nameCell.setMinimumHeight(22.68f);
                nameCell.setVerticalAlignment(Element.ALIGN_MIDDLE);
                itemsTable.addCell(nameCell);

                PdfPCell qCell = new PdfPCell();
                qCell.setBorderColor(new Color(226, 232, 240));
                qCell.setPadding(1);
                qCell.setMinimumHeight(22.68f);
                qCell.setHorizontalAlignment(Element.ALIGN_CENTER);
                Paragraph qNum = new Paragraph(NumberUtils.formatQuantity(item.getQuantity()), qtyFont);
                qNum.setLeading(12f);
                qNum.setAlignment(Element.ALIGN_CENTER);
                qCell.addElement(qNum);
                itemsTable.addCell(qCell);

                PdfPCell adjCell = new PdfPCell(new Phrase(""));
                adjCell.setBorderColor(new Color(226, 232, 240));
                adjCell.setMinimumHeight(22.68f);
                itemsTable.addCell(adjCell);


            }

            // Pad the last sheet to twenty product rows
            int emptyRows = Math.max(0, pageSize - pageItems.size());
            for (int i = 0; i < emptyRows; i++) {
                for (int col = 0; col < 5; col++) {
                    PdfPCell c = new PdfPCell(new Phrase(" "));
                    c.setBorderColor(new Color(226, 232, 240));
                    c.setMinimumHeight(22.68f);
                    itemsTable.addCell(c);
                }
            }

            if (isLastPage) {
                // Remarks cell on final page (spans Col 1 & 2: # and Code)
                PdfPCell remCell = new PdfPCell(new Phrase("Remarks: ", FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10f, new Color(71, 85, 105))));
                remCell.setColspan(2);
                remCell.setBackgroundColor(new Color(255, 255, 255));
                remCell.setBorderColor(new Color(203, 213, 225));
                remCell.setHorizontalAlignment(Element.ALIGN_LEFT);
                remCell.setVerticalAlignment(Element.ALIGN_MIDDLE);
                remCell.setPadding(4);
                remCell.setMinimumHeight(22.68f);
                itemsTable.addCell(remCell);

                // Total quantity label (Col 3: Product name)
                PdfPCell totLbl = new PdfPCell(new Phrase("Total quantity", FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10.5f, new Color(15, 23, 42))));
                totLbl.setColspan(1);
                totLbl.setBackgroundColor(new Color(248, 250, 252));
                totLbl.setBorderColor(new Color(203, 213, 225));
                totLbl.setHorizontalAlignment(Element.ALIGN_RIGHT);
                totLbl.setVerticalAlignment(Element.ALIGN_MIDDLE);
                totLbl.setPadding(2);
                totLbl.setMinimumHeight(22.68f);
                itemsTable.addCell(totLbl);

                java.math.BigDecimal totalQuantity = allItems.stream()
                        .map(InvoiceItem::getQuantity)
                        .filter(java.util.Objects::nonNull)
                        .reduce(java.math.BigDecimal.ZERO, java.math.BigDecimal::add);

                // Total quantity value (Col 4: Requested qty)
                PdfPCell totVal = new PdfPCell(new Phrase(NumberUtils.formatQuantity(totalQuantity), FontFactory.getFont(FontFactory.HELVETICA_BOLD, 13f, new Color(3, 105, 161))));
                totVal.setBackgroundColor(new Color(248, 250, 252));
                totVal.setBorderColor(new Color(203, 213, 225));
                totVal.setHorizontalAlignment(Element.ALIGN_CENTER);
                totVal.setVerticalAlignment(Element.ALIGN_MIDDLE);
                totVal.setPadding(2);
                totVal.setMinimumHeight(22.68f);
                itemsTable.addCell(totVal);

                // Blank cell for adjusted total (Col 5: Adjusted qty)
                PdfPCell totAdjBlank = new PdfPCell();
                totAdjBlank.setBackgroundColor(new Color(248, 250, 252));
                totAdjBlank.setBorderColor(new Color(203, 213, 225));
                totAdjBlank.setMinimumHeight(22.68f);
                itemsTable.addCell(totAdjBlank);
            }

            itemsTable.setSpacingAfter(8f);
            document.add(itemsTable);

            // Two independent sign-offs, with writing rules above their labels.
            PdfPTable signatures = new PdfPTable(2);
            signatures.setTotalWidth(document.right() - document.left());
            int signatureRole = 0;
            for (String role : new String[]{"Collected by", "Checked by / warehouse keeper"}) {
                PdfPTable fields = new PdfPTable(2);
                fields.setWidths(new float[]{1.2f, 1f});
                PdfPTable timing = new PdfPTable(3);
                int timingIndex = 0;
                for (String label : new String[]{"Start time", "End time", "Date"}) {
                    PdfPTable field = new PdfPTable(1);
                    PdfPCell caption = new PdfPCell(new Phrase(label, smallLabel));
                    caption.setBorder(Rectangle.NO_BORDER);
                    caption.setPaddingLeft(0f);
                    caption.setPaddingBottom(5f);
                    field.addCell(caption);
                    PdfPCell box = new PdfPCell(new Phrase(" "));
                    box.setFixedHeight(18f);
                    box.setBorder(Rectangle.BOX);
                    box.setBorderColor(new Color(203, 213, 225));
                    field.addCell(box);
                    PdfPCell fieldColumn = new PdfPCell(field);
                    fieldColumn.setBorder(Rectangle.NO_BORDER);
                    fieldColumn.setPaddingRight(timingIndex < 2 ? 7f : 0f);
                    timing.addCell(fieldColumn);
                    timingIndex++;
                }
                PdfPCell timingCell = new PdfPCell(timing);
                timingCell.setColspan(2);
                timingCell.setBorder(Rectangle.NO_BORDER);
                fields.addCell(timingCell);

                PdfPCell signatureLine = new PdfPCell(new Phrase(" "));
                signatureLine.setColspan(2);
                signatureLine.setFixedHeight(22f);
                signatureLine.setBorder(Rectangle.BOTTOM);
                signatureLine.setBorderColor(new Color(100, 116, 139));
                fields.addCell(signatureLine);

                PdfPCell roleLabel = new PdfPCell(new Phrase(role, boldBody));
                roleLabel.setColspan(2);
                roleLabel.setBorder(Rectangle.NO_BORDER);
                roleLabel.setPaddingTop(5f);
                fields.addCell(roleLabel);
                PdfPCell guide = new PdfPCell(new Phrase("Name & Signature", subHeaderFont));
                guide.setColspan(2);
                guide.setBorder(Rectangle.NO_BORDER);
                guide.setPaddingBottom(5f);
                fields.addCell(guide);

                PdfPCell column = new PdfPCell(fields);
                column.setBorder(Rectangle.NO_BORDER);
                column.setPaddingLeft(signatureRole == 0 ? 0f : 10f);
                column.setPaddingRight(signatureRole == 0 ? 10f : 0f);
                signatures.addCell(column);
                signatureRole++;
            }
            // Keep a 1 cm gap below the complete sign-off block.
            final float signatureFooterGap = 10f * 72f / 25.4f;
            float signaturesTop = document.bottom() + 18f + signatureFooterGap + signatures.getTotalHeight();
            signatures.writeSelectedRows(0, -1, document.left(), signaturesTop, writer.getDirectContent());

            // Footer (3 columns: Left, Page number middle, Right) - Fixed at exact bottom position
            PdfPTable footerTable = new PdfPTable(3);
            footerTable.setTotalWidth(document.right() - document.left());
            footerTable.setWidths(new float[]{1.4f, 0.8f, 1.4f});

            PdfPCell fLeft = new PdfPCell();
            fLeft.setBorder(Rectangle.TOP);
            fLeft.setBorderColorTop(new Color(2, 132, 199));
            fLeft.setBorderWidthTop(2f);
            fLeft.setPaddingTop(5);
            Paragraph fl1 = new Paragraph("NBH Enterprise - Confidential", FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9.5f, new Color(71, 85, 105)));
            Paragraph fl2 = new Paragraph("Internal warehouse use only", FontFactory.getFont(FontFactory.HELVETICA, 9f, new Color(100, 116, 139)));
            fLeft.addElement(fl1);
            fLeft.addElement(fl2);

            PdfPCell fCenter = new PdfPCell();
            fCenter.setBorder(Rectangle.TOP);
            fCenter.setBorderColorTop(new Color(2, 132, 199));
            fCenter.setBorderWidthTop(2f);
            fCenter.setPaddingTop(5);
            fCenter.setHorizontalAlignment(Element.ALIGN_CENTER);
            Paragraph fc = new Paragraph("Page " + pageNum + " of " + totalPages, FontFactory.getFont(FontFactory.HELVETICA_BOLD, 10f, new Color(71, 85, 105)));
            fc.setAlignment(Element.ALIGN_CENTER);
            fCenter.addElement(fc);

            PdfPCell fRight = new PdfPCell();
            fRight.setBorder(Rectangle.TOP);
            fRight.setBorderColorTop(new Color(2, 132, 199));
            fRight.setBorderWidthTop(2f);
            fRight.setPaddingTop(5);
            fRight.setHorizontalAlignment(Element.ALIGN_RIGHT);
            Paragraph fr1 = new Paragraph(heldNumber + " · Warehouse review copy", FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9.5f, new Color(71, 85, 105)));
            fr1.setAlignment(Element.ALIGN_RIGHT);
            Paragraph fr2 = new Paragraph("Generated " + printDateStr + " · Sri Lanka", FontFactory.getFont(FontFactory.HELVETICA, 9f, new Color(100, 116, 139)));
            fr2.setAlignment(Element.ALIGN_RIGHT);
            fRight.addElement(fr1);
            fRight.addElement(fr2);

            footerTable.addCell(fLeft);
            footerTable.addCell(fCenter);
            footerTable.addCell(fRight);
            footerTable.writeSelectedRows(0, -1, document.left(), document.bottom() + 18f, writer.getDirectContent());
        }
    }

    private void addGenerousSignatureCell(PdfPTable table, String role, String guide, Font roleFont, Font guideFont) {
        PdfPCell cell = new PdfPCell();
        cell.setBorder(Rectangle.TOP);
        cell.setBorderColorTop(new Color(148, 163, 184));
        cell.setBorderWidthTop(1f);
        cell.setPaddingTop(4);
        cell.setPaddingRight(12);
        cell.setMinimumHeight(48f);
        Paragraph pRole = new Paragraph(role, roleFont);
        cell.addElement(pRole);
        Paragraph pSpace = new Paragraph(" ");
        pSpace.setSpacingBefore(20f);
        cell.addElement(pSpace);
        Paragraph pGuide = new Paragraph(guide, guideFont);
        pGuide.setSpacingBefore(2);
        cell.addElement(pGuide);
        table.addCell(cell);
    }

    private void addMetaBoxCell(PdfPTable table, String label, String value, Font labelFont, Font valueFont) {
        PdfPCell cell = new PdfPCell();
        cell.setBackgroundColor(new Color(248, 250, 252));
        cell.setBorderColor(new Color(226, 232, 240));
        cell.setPadding(3);
        cell.addElement(new Paragraph(label, labelFont));
        Paragraph valPara = new Paragraph(value != null && !value.isBlank() ? value : "—", valueFont);
        valPara.setSpacingBefore(2);
        cell.addElement(valPara);
        table.addCell(cell);
    }

    private void addSignatureCell(PdfPTable table, String role, String guide, Font roleFont, Font guideFont) {
        PdfPCell cell = new PdfPCell();
        cell.setBorder(Rectangle.TOP);
        cell.setBorderColorTop(new Color(148, 163, 184));
        cell.setBorderWidthTop(1f);
        cell.setPaddingTop(5);
        cell.setPaddingRight(10);
        Paragraph pRole = new Paragraph(role, roleFont);
        Paragraph pGuide = new Paragraph(guide, guideFont);
        pGuide.setSpacingBefore(2);
        cell.addElement(pRole);
        cell.addElement(pGuide);
        table.addCell(cell);
    }

    private void generateCommercialInvoicePdf(Document document, Invoice invoice) throws DocumentException {
        Font headerFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 18, new Color(15, 23, 42));
        Font subHeaderFont = FontFactory.getFont(FontFactory.HELVETICA, 9, new Color(100, 116, 139));
        Font titleFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 14, new Color(2, 132, 199));
        Font docNumFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 12, new Color(15, 23, 42));
        Font tableHeadFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9, Color.WHITE);
        Font bodyFont = FontFactory.getFont(FontFactory.HELVETICA, 9, new Color(51, 65, 85));
        Font boldBody = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9, new Color(15, 23, 42));
        Font smallLabel = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8, new Color(100, 116, 139));
        Font badgeFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9, new Color(3, 105, 161));

        String displayStatus = invoice.getStatus() != null ? invoice.getStatus().replace('_', ' ') : "COMPLETED";

        // Header Section
        PdfPTable headerTable = new PdfPTable(2);
        headerTable.setWidthPercentage(100);
        headerTable.setWidths(new float[]{3.2f, 2.0f});

        PdfPCell hLeft = new PdfPCell();
        hLeft.setBorder(Rectangle.NO_BORDER);
        hLeft.addElement(new Paragraph(companyName != null && !companyName.isBlank() ? companyName : "NBH ENTERPRISE", headerFont));
        Paragraph sub = new Paragraph(companyAddress + " | Tel: " + companyPhone, subHeaderFont);
        sub.setSpacingBefore(2);
        hLeft.addElement(sub);

        PdfPCell hRight = new PdfPCell();
        hRight.setBorder(Rectangle.NO_BORDER);
        hRight.setHorizontalAlignment(Element.ALIGN_RIGHT);
        Paragraph dt = new Paragraph("COMMERCIAL INVOICE", titleFont);
        dt.setAlignment(Element.ALIGN_RIGHT);
        hRight.addElement(dt);
        Paragraph dn = new Paragraph(invoice.getDocumentNumber() != null ? invoice.getDocumentNumber() : ("INV-" + invoice.getId()), docNumFont);
        dn.setAlignment(Element.ALIGN_RIGHT);
        hRight.addElement(dn);
        Paragraph st = new Paragraph("STATUS: " + displayStatus, badgeFont);
        st.setAlignment(Element.ALIGN_RIGHT);
        hRight.addElement(st);

        headerTable.addCell(hLeft);
        headerTable.addCell(hRight);
        headerTable.setSpacingAfter(12);
        document.add(headerTable);

        // Document Info Box
        PdfPTable metaTable = new PdfPTable(2);
        metaTable.setWidthPercentage(100);
        metaTable.setWidths(new float[]{1.1f, 0.9f});

        PdfPCell leftCell = new PdfPCell();
        leftCell.setBackgroundColor(new Color(248, 250, 252));
        leftCell.setBorderColor(new Color(226, 232, 240));
        leftCell.setPadding(8);
        leftCell.addElement(new Paragraph("BILLED TO", smallLabel));
        leftCell.addElement(new Paragraph(invoice.getCustomer().getName(), boldBody));
        if (invoice.getCustomer().getPhone() != null && !invoice.getCustomer().getPhone().isBlank()) {
            leftCell.addElement(new Paragraph("Phone: " + invoice.getCustomer().getPhone(), bodyFont));
        }
        if (invoice.getWarehouse() != null) {
            leftCell.addElement(new Paragraph("Warehouse: " + invoice.getWarehouse().getName(), bodyFont));
        }

        PdfPCell rightCell = new PdfPCell();
        rightCell.setBackgroundColor(new Color(248, 250, 252));
        rightCell.setBorderColor(new Color(226, 232, 240));
        rightCell.setPadding(8);
        rightCell.addElement(new Paragraph("PAYMENT DETAILS", smallLabel));
        rightCell.addElement(new Paragraph("Date: " + DateUtils.formatDate(invoice.getInvoiceDate()), bodyFont));
        rightCell.addElement(new Paragraph("Payment: " + (invoice.getPaymentType() != null ? invoice.getPaymentType() : "CASH"), bodyFont));
        if (invoice.getSalesman() != null) {
            String repName = invoice.getSalesman().getFullName() != null ? invoice.getSalesman().getFullName() : invoice.getSalesman().getUsername();
            rightCell.addElement(new Paragraph("Staff: " + repName, bodyFont));
        }
        rightCell.addElement(new Paragraph("Status: " + displayStatus, boldBody));

        metaTable.addCell(leftCell);
        metaTable.addCell(rightCell);
        metaTable.setSpacingAfter(10);
        document.add(metaTable);

        // Line Items Table
        PdfPTable itemsTable = new PdfPTable(6);
        itemsTable.setWidthPercentage(100);
        itemsTable.setWidths(new float[]{1f, 3.5f, 1.2f, 1.5f, 1.2f, 1.6f});
        String[] headers = {"#", "Item Description", "Qty", "Price (" + currencySymbol + ")", "Disc", "Total (" + currencySymbol + ")"};
        for (String h : headers) {
            PdfPCell cell = new PdfPCell(new Phrase(h, tableHeadFont));
            cell.setBackgroundColor(new Color(2, 132, 199));
            cell.setPadding(5);
            cell.setHorizontalAlignment(Element.ALIGN_CENTER);
            itemsTable.addCell(cell);
        }

        int index = 1;
        for (InvoiceItem item : invoice.getItems()) {
            addTableCell(itemsTable, String.valueOf(index++), bodyFont, Element.ALIGN_CENTER);
            addTableCell(itemsTable, item.getProduct().getName() + " (" + item.getProduct().getSku() + ")", bodyFont, Element.ALIGN_LEFT);
            addTableCell(itemsTable, NumberUtils.formatQuantity(item.getQuantity()), bodyFont, Element.ALIGN_RIGHT);
            addTableCell(itemsTable, NumberUtils.formatCurrency(item.getUnitPrice()), bodyFont, Element.ALIGN_RIGHT);
            BigDecimal lineGross = item.getQuantity().multiply(item.getUnitPrice());
            BigDecimal lineDiscount = lineGross.subtract(item.getTotalPrice());
            if (lineDiscount.signum() < 0) lineDiscount = BigDecimal.ZERO;
            addTableCell(itemsTable, NumberUtils.formatCurrency(lineDiscount), bodyFont, Element.ALIGN_RIGHT);
            addTableCell(itemsTable, NumberUtils.formatCurrency(item.getTotalPrice()), bodyFont, Element.ALIGN_RIGHT);
        }

        itemsTable.setSpacingAfter(12);
        document.add(itemsTable);

        // Bottom Section: Packing & Financial Totals
        PdfPTable bottomSection = new PdfPTable(2);
        bottomSection.setWidthPercentage(100);
        bottomSection.setWidths(new float[]{1.2f, 1.0f});

        PdfPCell packCell = new PdfPCell();
        packCell.setBorderColor(new Color(226, 232, 240));
        packCell.setBackgroundColor(new Color(248, 250, 252));
        packCell.setPadding(8);
        packCell.addElement(new Paragraph("PACKING COUNTS", smallLabel));

        PdfPTable packGrid = new PdfPTable(4);
        packGrid.setWidthPercentage(100);
        packGrid.setSpacingBefore(4);
        for (String label : new String[]{"Box", "Bag", "P. Bag", "Others"}) {
            PdfPCell c = new PdfPCell(new Phrase(label, smallLabel));
            c.setBackgroundColor(new Color(241, 245, 249));
            c.setBorderColor(new Color(226, 232, 240));
            c.setHorizontalAlignment(Element.ALIGN_CENTER);
            c.setPadding(3);
            packGrid.addCell(c);
        }
        int boxes = java.util.Objects.requireNonNullElse(invoice.getPackingBoxes(), 0);
        int bags = java.util.Objects.requireNonNullElse(invoice.getPackingBags(), 0);
        int pBags = java.util.Objects.requireNonNullElse(invoice.getPackingPBags(), 0);
        int others = java.util.Objects.requireNonNullElse(invoice.getPackingOthers(), 0);
        for (int val : new int[]{boxes, bags, pBags, others}) {
            PdfPCell c = new PdfPCell(new Phrase(String.valueOf(val), boldBody));
            c.setHorizontalAlignment(Element.ALIGN_CENTER);
            c.setBorderColor(new Color(226, 232, 240));
            c.setPadding(4);
            packGrid.addCell(c);
        }
        packCell.addElement(packGrid);
        bottomSection.addCell(packCell);

        PdfPCell totCell = new PdfPCell();
        totCell.setBorder(Rectangle.NO_BORDER);
        PdfPTable totalsTable = new PdfPTable(2);
        totalsTable.setWidthPercentage(100);
        totalsTable.setWidths(new float[]{1.2f, 1.2f});

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
        totCell.addElement(totalsTable);
        bottomSection.addCell(totCell);

        bottomSection.setSpacingAfter(14);
        document.add(bottomSection);

        // Signatures Section
        PdfPTable signatures = new PdfPTable(2);
        signatures.setWidthPercentage(100);
        signatures.setWidths(new float[]{1f, 1f});
        signatures.setSpacingBefore(8);

        PdfPCell s1 = new PdfPCell();
        s1.setBorder(Rectangle.NO_BORDER);
        s1.addElement(new Paragraph("____________________________________", subHeaderFont));
        s1.addElement(new Paragraph("Prepared / Authorized By", boldBody));
        s1.addElement(new Paragraph("Name & Signature / Date", subHeaderFont));

        PdfPCell s2 = new PdfPCell();
        s2.setBorder(Rectangle.NO_BORDER);
        s2.setHorizontalAlignment(Element.ALIGN_RIGHT);
        Paragraph line2 = new Paragraph("____________________________________", subHeaderFont);
        line2.setAlignment(Element.ALIGN_RIGHT);
        s2.addElement(line2);
        Paragraph role2 = new Paragraph("Customer Acceptance", boldBody);
        role2.setAlignment(Element.ALIGN_RIGHT);
        s2.addElement(role2);
        Paragraph date2 = new Paragraph("Name & Signature / Date", subHeaderFont);
        date2.setAlignment(Element.ALIGN_RIGHT);
        s2.addElement(date2);

        signatures.addCell(s1);
        signatures.addCell(s2);
        document.add(signatures);

        // Footer Note
        Paragraph footer = new Paragraph("Thank you for your business! · Generated by NBH ERP", subHeaderFont);
        footer.setAlignment(Element.ALIGN_CENTER);
        footer.setSpacingBefore(18);
        document.add(footer);
    }

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
            c1.addElement(new Paragraph("Supplier: " + grn.getSupplier().getDisplayName(), bodyFont));
            c1.addElement(new Paragraph("Supplier Inv: " + (grn.getSupplierInvoiceNumber() != null ? grn.getSupplierInvoiceNumber() : "-"), bodyFont));

            PdfPCell c2 = new PdfPCell();
            c2.setBorder(Rectangle.NO_BORDER);
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
            Font bodyFont = FontFactory.getFont(FontFactory.HELVETICA, 9, new Color(51, 65, 85));
            Font boldBody = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 9, new Color(15, 23, 42));

            var sources = gtn.getItems().stream().collect(java.util.stream.Collectors.groupingBy(item -> item.getTransferSource().getId(), java.util.TreeMap::new, java.util.stream.Collectors.toList()));
            if (sources.isEmpty()) sources.put(gtn.getSourceWarehouse().getId(), java.util.List.of());
            int sourceCopy = 0;
            for (var sourceItems : sources.values()) {
            if (sourceCopy > 0) document.newPage();
            sourceCopy++;
            var sourceWarehouse = sourceItems.isEmpty() ? gtn.getSourceWarehouse() : sourceItems.getFirst().getTransferSource();
            var destinations = sourceItems.stream().map(GtnItem::getTransferDestination).collect(java.util.stream.Collectors.toMap(warehouse -> warehouse.getId(), warehouse -> warehouse, (first, second) -> first, java.util.TreeMap::new));
            document.add(new Paragraph(companyName, headerFont));
            Paragraph addr = new Paragraph("GOODS TRANSFER NOTE (GTN)", titleFont);
            addr.setSpacingAfter(10);
            document.add(addr);

            PdfPTable meta = new PdfPTable(2);
            meta.setWidthPercentage(100);

            PdfPCell c1 = new PdfPCell();
            c1.setBorder(Rectangle.NO_BORDER);
            c1.addElement(new Paragraph("GTN #: " + gtn.getGtnNumber(), boldBody));
            c1.addElement(new Paragraph("Source: " + sourceWarehouse.getName(), bodyFont));
            c1.addElement(new Paragraph("Destinations: " + destinations.values().stream().map(warehouse -> warehouse.getName()).collect(java.util.stream.Collectors.joining(", ")), bodyFont));
            c1.addElement(new Paragraph("Source copy " + sourceCopy + " of " + sources.size(), bodyFont));
            c1.addElement(new Paragraph("Responsible staff: " + (gtn.getResponsibleStaff() == null ? "-" : gtn.getResponsibleStaff().getFullName()), boldBody));

            PdfPCell c2 = new PdfPCell();
            c2.setBorder(Rectangle.NO_BORDER);
            c2.addElement(new Paragraph("Status: " + ("RECEIVED".equals(gtn.getStatus()) ? "TRANSFERRED" : gtn.getStatus()), boldBody));
            c2.addElement(new Paragraph("Dispatch Date: " + (gtn.getDispatchDate() != null ? DateUtils.formatDate(gtn.getDispatchDate()) : "-"), bodyFont));
            c2.addElement(new Paragraph("Notes: " + (gtn.getNotes() != null ? gtn.getNotes() : "-"), bodyFont));

            meta.addCell(c1);
            meta.addCell(c2);
            meta.setSpacingAfter(8);
            document.add(meta);

            PdfPTable items = new PdfPTable(5);
            items.setWidthPercentage(100);
            items.setWidths(new float[]{.7f, 3.5f, 2.4f, 1.4f, 1.4f});

            String[] heads = {"#", "Product Description & SKU", "Destination", "Transfer Qty", "Received Qty"};
            for (String h : heads) {
                PdfPCell c = new PdfPCell(new Phrase(h, tableHeadFont));
                c.setBackgroundColor(new Color(37, 99, 235));
                c.setPadding(6);
                c.setHorizontalAlignment(Element.ALIGN_CENTER);
                items.addCell(c);
            }

            items.setHeaderRows(1);
            int idx = 1;
            java.math.BigDecimal totalUnits = java.math.BigDecimal.ZERO;
            for (GtnItem it : sourceItems) {
                addTableCell(items, String.valueOf(idx++), bodyFont, Element.ALIGN_CENTER);
                addTableCell(items, it.getProduct().getName() + " (" + it.getProduct().getSku() + ")", bodyFont, Element.ALIGN_LEFT);
                addTableCell(items, it.getTransferDestination().getName(), bodyFont, Element.ALIGN_LEFT);
                addTableCell(items, NumberUtils.formatQuantity(it.getQuantityTransferred()), bodyFont, Element.ALIGN_RIGHT);
                addTableCell(items, "____________", bodyFont, Element.ALIGN_CENTER);
                totalUnits = totalUnits.add(it.getQuantityTransferred() != null ? it.getQuantityTransferred() : java.math.BigDecimal.ZERO);
            }

            items.setSpacingAfter(10);
            document.add(items);

            Paragraph tot = new Paragraph("Total Transfer Units: " + NumberUtils.formatQuantity(totalUnits), boldBody);
            tot.setAlignment(Element.ALIGN_RIGHT);
            document.add(tot);
            Paragraph instructions = new Paragraph("Return this signed copy to the office. Mark the GTN TRANSFERRED only after all items are received at the destination.", bodyFont);
            instructions.setSpacingBefore(8); instructions.setSpacingAfter(10); document.add(instructions);
            PdfPTable signatures = new PdfPTable(2); signatures.setWidthPercentage(100);
            for (String label : new String[]{"Issued by source warehouse", "Collected by responsible staff"}) {
                PdfPCell signature = new PdfPCell(); signature.setPadding(5); signature.setBorder(Rectangle.NO_BORDER);
                signature.addElement(new Paragraph(label, boldBody));
                signature.addElement(new Paragraph("Name: __________  Signature: __________", bodyFont));
                signature.addElement(new Paragraph("Date: ___________________", bodyFont));
                signatures.addCell(signature);
            }
            document.add(signatures);
            Paragraph receiptHeading = new Paragraph("Accepted by destination warehouse", boldBody);
            receiptHeading.setSpacingBefore(12); receiptHeading.setSpacingAfter(6); document.add(receiptHeading);
            PdfPTable acceptances = new PdfPTable(4); acceptances.setWidthPercentage(100); acceptances.setWidths(new float[]{3f,2f,2f,1.5f});
            for (String label : new String[]{"Destination", "Receiver name", "Signature", "Date"}) addTableCell(acceptances, label, boldBody, Element.ALIGN_LEFT);
            for (var destinationWarehouse : destinations.values()) {
                addTableCell(acceptances, destinationWarehouse.getName(), bodyFont, Element.ALIGN_LEFT);
                for (int blank = 0; blank < 3; blank++) addTableCell(acceptances, "__________", bodyFont, Element.ALIGN_LEFT);
            }
            document.add(acceptances);

            }


            document.close();
        } catch (Exception e) {
            log.error("Failed to generate GTN PDF: " + gtnId, e);
            throw new RuntimeException("Could not generate GTN PDF", e);
        }

        return out.toByteArray();
    }

    @Transactional(readOnly = true)
    public byte[] generateCustomerPdf(Long customerId) {
        var customer = customerRepository.findByIdAndIsActiveTrue(customerId)
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
        var customers = customerRepository.findByIsActiveTrue();

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
        var customer = customerRepository.findByIdAndIsActiveTrue(customerId)
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
