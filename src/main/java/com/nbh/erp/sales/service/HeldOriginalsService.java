package com.nbh.erp.sales.service;

import com.fasterxml.jackson.core.*;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.module.SimpleModule;
import com.nbh.erp.common.exception.BusinessException;
import com.nbh.erp.sales.dto.*;
import com.nbh.erp.sales.entity.*;
import com.nbh.erp.sales.repository.*;
import com.nbh.erp.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.io.IOException;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;

/** Capture once at POS finalization; reviewed quantities never overwrite this document. */
@Service @RequiredArgsConstructor
public class HeldOriginalsService {
    private final InvoiceRepository invoices;
    private final Clock clock;
    private final HeldBillStaff staff;
    private static final ObjectMapper JSON = mapper();
    private static ObjectMapper mapper() {
        var module = new SimpleModule();
        module.addSerializer(LocalDate.class, new JsonSerializer<>() {public void serialize(LocalDate value, JsonGenerator out, SerializerProvider provider) throws IOException {out.writeString(value.toString());}});
        module.addDeserializer(LocalDate.class, new JsonDeserializer<>() {public LocalDate deserialize(JsonParser in, DeserializationContext context) throws IOException {return LocalDate.parse(in.getValueAsString());}});
        module.addSerializer(LocalDateTime.class, new JsonSerializer<>() {public void serialize(LocalDateTime value, JsonGenerator out, SerializerProvider provider) throws IOException {out.writeString(value.toString());}});
        module.addDeserializer(LocalDateTime.class, new JsonDeserializer<>() {public LocalDateTime deserialize(JsonParser in, DeserializationContext context) throws IOException {return LocalDateTime.parse(in.getValueAsString());}});
        return new ObjectMapper().registerModule(module);
    }
    public void capture(Invoice bill) {
        if (bill.getOriginalHeldSnapshot()!=null) return;
        var dto=InvoiceDto.from(bill);staff.enrich(dto);dto.setStatus("SENT_TO_WAREHOUSE");dto.setOriginalCopy(true);dto.setCanResume(false);
        try {bill.setOriginalHeldSnapshot(JSON.writeValueAsString(dto));}
        catch(Exception e) {throw new IllegalStateException("Unable to preserve original onhold bill",e);}
        bill.setOriginalHeldTotal(bill.getNetTotal());bill.setOriginalHeldCapturedAt(LocalDateTime.now(clock));
    }
    public InvoiceDto read(Invoice bill) {
        if(bill.getOriginalHeldSnapshot()==null) throw new BusinessException("An original warehouse copy is unavailable for this older bill");
        try {var dto=JSON.readValue(bill.getOriginalHeldSnapshot(),InvoiceDto.class);dto.setPosRemarks(dto.getPosRemarks()!=null?dto.getPosRemarks():dto.getNotes());dto.setOriginalCopy(true);dto.setCanResume(false);return dto;}
        catch(Exception e) {throw new IllegalStateException("Unable to read original onhold bill",e);}
    }
    @Transactional
    public HeldBillWorkspaceDto workspace(String scope,String query) {
        if(!Set.of("mine","others","all").contains(scope))throw new BusinessException("Choose My bills, Other bills or All held bills");
        var username=SecurityUtils.getCurrentUsername().orElseThrow();var text=query==null?"":query.trim().toLowerCase(Locale.ROOT);
        // These existing bills have not been reviewed yet; their current lines are still originals.
        for(var candidate:invoices.findByStatusIn(Set.of("SENT_TO_WAREHOUSE")))if(candidate.getOriginalHeldSnapshot()==null){
            var bill=invoices.findByIdForUpdate(candidate.getId()).orElseThrow();
            if("SENT_TO_WAREHOUSE".equals(bill.getStatus()) && bill.getOriginalHeldSnapshot()==null){capture(bill);bill.setOriginalHeldSentAt(LocalDateTime.now(clock));invoices.save(bill);}
        }
        var parents=invoices.findWarehouseOriginals();var all=parents.stream().map(this::read).toList();staff.enrich(all);
        var copies=all.stream().collect(java.util.stream.Collectors.toMap(InvoiceDto::getId,dto->dto));
        var rows=parents.stream().filter(b->"all".equals(scope) || "mine".equals(scope)==Objects.equals(b.getCreatedBy(),username))
            .map(b->{var dto=copies.get(b.getId());
                dto.setStatus("CANCELLED".equals(b.getStatus())?"CANCELLED":"BILLED");dto.setRecordVersion(b.getRecordVersion());dto.setCancellationReason(b.getCancellationReason());dto.setMergedInvoiceId(b.getMergedInvoiceId());
                if(b.getMergedInvoiceId()!=null){var invoice=invoices.findById(b.getMergedInvoiceId()).orElseThrow();dto.setInvoiceNumber(invoice.getInvoiceNumber());if(Set.of("VOIDED","CANCELLED").contains(invoice.getStatus())){dto.setStatus("CANCELLED");if(dto.getCancellationReason()==null)dto.setCancellationReason(invoice.getCancellationReason());}}
                dto.setCanResume(false);return dto;})
            .filter(b->text.isBlank() || (b.getHeldNumber()+" "+b.getCustomerName()+" "+b.getCreatedBy()+" "+b.getCreatedByName()+" "+b.getCreatedByEmployeeCode()).toLowerCase(Locale.ROOT).contains(text)).toList();
        var today=LocalDate.now(clock);var month=all.stream().filter(b->b.getInvoiceDate()!=null && YearMonth.from(b.getInvoiceDate()).equals(YearMonth.from(today))).toList();
        var mine=month.stream().filter(b->Objects.equals(b.getCreatedBy(),username)).toList();var others=month.stream().filter(b->!Objects.equals(b.getCreatedBy(),username)).toList();
        return new HeldBillWorkspaceDto(rows,today.withDayOfMonth(1),today.withDayOfMonth(today.lengthOfMonth()),mine.size(),sum(mine),others.size(),sum(others),sum(rows));
    }
    private BigDecimal sum(List<InvoiceDto> bills){return bills.stream().map(InvoiceDto::getNetTotal).reduce(BigDecimal.ZERO,BigDecimal::add);}
}
