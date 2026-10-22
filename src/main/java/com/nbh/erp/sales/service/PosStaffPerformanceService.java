package com.nbh.erp.sales.service;

import com.nbh.erp.sales.entity.Invoice;
import com.nbh.erp.sales.repository.InvoiceRepository;
import com.nbh.erp.user.repository.UserRepository;
import com.nbh.erp.customerrange.repository.CustomerRangeConfigRepository;
import com.nbh.erp.common.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.*;
import java.time.*;
import java.util.*;

@Service @RequiredArgsConstructor
public class PosStaffPerformanceService {
    private final InvoiceRepository invoices;
    private final UserRepository users;
    private final CustomerRangeConfigRepository ranges;
    private final HeldOriginalsService originals;
    private final Clock clock;
    private final com.nbh.erp.salesreturn.repository.SalesReturnRepository returns;
    private final com.nbh.erp.customertarget.repository.CustomerTargetRepository targets;
    public record CustomerPerformance(Long id,String name,String code,long billCount,BigDecimal originalAmount,String range,BigDecimal monthlyAmount) {}
    public record RangeCount(String name,long customers) {}
    public record TargetAchievement(Long customerId,String customerName,String target,String milestone,BigDecimal goal,LocalDate achievedOn) {}
    public record Staff(int rank,String username,String fullName,long billCount,BigDecimal originalAmount,BigDecimal confirmedAmount,
        long pendingPrintCount,long customerCount,long rangeMilestones,BigDecimal averageBillAmount,BigDecimal gapToNext,
        List<CustomerPerformance> customers,List<RangeCount> customerRanges,List<TargetAchievement> targetAchievements) {}
    public record Performance(LocalDate periodStart,LocalDate periodEnd,BigDecimal teamAmount,long teamBillCount,long rangeMilestones,List<Staff> staff) {}
    private static class Totals {
        String username,name;long bills,pending,milestones;BigDecimal amount=BigDecimal.ZERO,confirmed=BigDecimal.ZERO;
        Set<Long> customers=new HashSet<>();
        Map<Long,BigDecimal> customerValues=new HashMap<>();Map<Long,Long> customerBills=new HashMap<>();
        List<TargetAchievement> achievements=new ArrayList<>();
        Totals(String username,String name){this.username=username;this.name=name;}
    }
    private BigDecimal amount(Invoice bill){return bill.getOriginalHeldTotal()!=null?bill.getOriginalHeldTotal():originals.read(bill).getNetTotal();}
    @Transactional(readOnly=true)
    public Performance performance(String requestedMonth){
        YearMonth month;
        try{month=requestedMonth==null || requestedMonth.isBlank()?YearMonth.from(LocalDate.now(clock)):YearMonth.parse(requestedMonth);}
        catch(java.time.DateTimeException error){throw new BusinessException("Choose a valid month (YYYY-MM)");}
        LocalDate start=month.atDay(1),end=month.atEndOfMonth();
        Map<String,Totals> totals=new HashMap<>();
        var people=users.findAll();
        for(var person:people)if(Boolean.TRUE.equals(person.getIsActive()) && "APPROVED".equals(person.getApprovalStatus()) && person.getRoles().stream().filter(r->"ACTIVE".equals(r.getStatus())).anyMatch(r->Set.of("ADMIN","ROLE_ADMIN","SUPER_ADMIN","ROLE_SUPER_ADMIN").contains(r.getName()) || r.getPermissions().stream().anyMatch(p->"SALES_CREATE".equals(p.getName()))))
            totals.put(person.getUsername(),new Totals(person.getUsername(),person.getFullName()));
        Map<String,String> names=new HashMap<>();people.forEach(p->names.put(p.getUsername(),p.getFullName()));
        var copies=invoices.findWarehouseOriginals();
        Map<Long,com.nbh.erp.customer.entity.Customer> customers=new HashMap<>();
        var parentIds=copies.stream().map(Invoice::getMergedInvoiceId).filter(Objects::nonNull).distinct().toList();
        Set<Long> voided=new HashSet<>();invoices.findAllById(parentIds).stream().filter(i->Set.of("VOIDED","CANCELLED").contains(i.getStatus())).forEach(i->voided.add(i.getId()));
        for(var bill:copies){
            if(bill.getInvoiceDate()==null || bill.getInvoiceDate().isBefore(start) || bill.getInvoiceDate().isAfter(end) || Set.of("CANCELLED","VOIDED").contains(bill.getStatus()) || voided.contains(bill.getMergedInvoiceId()) || bill.getCreatedBy()==null)continue;
            var t=totals.computeIfAbsent(bill.getCreatedBy(),n->new Totals(n,names.getOrDefault(n,n)));
            var value=amount(bill);t.bills++;t.amount=t.amount.add(value);t.customers.add(bill.getCustomer().getId());
            customers.put(bill.getCustomer().getId(),bill.getCustomer());
            t.customerValues.merge(bill.getCustomer().getId(),value,BigDecimal::add);t.customerBills.merge(bill.getCustomer().getId(),1L,Long::sum);
            if(bill.getOriginalHeldSentAt()!=null)t.confirmed=t.confirmed.add(value);else t.pending++;
        }
        // Use the same qualifying documents as customer range progress. A threshold is credited once,
        // to the POS bill that crosses it, including earlier purchases made with another staff member.
        var rangeConfigs=ranges.findByIsActiveTrueOrderByMinSpendAsc();
        var thresholds=rangeConfigs.stream().map(r->r.getMinSpend()).filter(v->v.signum()>0).distinct().toList();
        record Event(LocalDate date,LocalDateTime at,Long id,Long customer,BigDecimal change,String author) {}
        var events=new ArrayList<Event>();
        for(var bill:invoices.findPerformanceDocuments(start,end))events.add(new Event(bill.getInvoiceDate(),bill.getOriginalHeldSentAt()!=null?bill.getOriginalHeldSentAt():bill.getCreatedAt(),bill.getId(),bill.getCustomer().getId(),bill.getOriginalHeldSnapshot()!=null?amount(bill):bill.getNetTotal(),bill.getOriginalHeldSnapshot()!=null?bill.getCreatedBy():null));
        for(var credit:returns.findCompletedForPerformance(start,end))events.add(new Event(credit.getReturnDate(),credit.getCreatedAt(),credit.getId(),credit.getCustomer().getId(),credit.getTotalAmount().negate(),null));
        events.sort(Comparator.comparing(Event::date).thenComparing(Event::at,Comparator.nullsFirst(Comparator.naturalOrder())).thenComparing(Event::id));
        Map<Long,BigDecimal> customerAmounts=new HashMap<>();
        Map<Long,Map<BigDecimal,String>> owners=new HashMap<>();
        for(var event:events){
            var before=customerAmounts.getOrDefault(event.customer(),BigDecimal.ZERO);var after=before.add(event.change());customerAmounts.put(event.customer(),after);
            var reached=owners.computeIfAbsent(event.customer(),key->new HashMap<>());
            for(var threshold:thresholds){
                if(after.compareTo(threshold)<0)reached.remove(threshold);
                else if(before.compareTo(threshold)<0)reached.put(threshold,event.author());
            }
        }
        for(var customer:owners.values())for(var author:customer.values())if(author!=null && totals.containsKey(author))totals.get(author).milestones++;
        // Campaign progress uses its complete date window. Only milestones crossed during
        // the selected month are credited, so a multi-month target is not awarded twice.
        for(var target:targets.findAllWithTiers()){
            if(!Boolean.TRUE.equals(target.getIsActive()) || target.getStartDate().isAfter(end) || target.getEndDate().isBefore(start))continue;
            var until=target.getEndDate().isBefore(end)?target.getEndDate():end;
            var campaignEvents=new ArrayList<Event>();
            for(var bill:invoices.findPerformanceDocuments(target.getStartDate(),until)){
                var customer=bill.getCustomer();if(!applies(target,customer))continue;
                campaignEvents.add(new Event(bill.getInvoiceDate(),bill.getOriginalHeldSentAt()!=null?bill.getOriginalHeldSentAt():bill.getCreatedAt(),bill.getId(),customer.getId(),bill.getOriginalHeldSnapshot()!=null?amount(bill):bill.getNetTotal(),bill.getOriginalHeldSnapshot()!=null?bill.getCreatedBy():null));
                customers.putIfAbsent(customer.getId(),customer);
            }
            for(var credit:returns.findCompletedForPerformance(target.getStartDate(),until))if(applies(target,credit.getCustomer()))campaignEvents.add(new Event(credit.getReturnDate(),credit.getCreatedAt(),credit.getId(),credit.getCustomer().getId(),credit.getTotalAmount().negate(),null));
            campaignEvents.sort(Comparator.comparing(Event::date).thenComparing(Event::at,Comparator.nullsFirst(Comparator.naturalOrder())).thenComparing(Event::id));
            Map<BigDecimal,String> goals=new LinkedHashMap<>();
            if(target.getTargetAmount().signum()>0)goals.put(target.getTargetAmount().stripTrailingZeros(),"Overall target");
            for(var tier:target.getTiers())if(tier.getMinAmount().signum()>0)goals.putIfAbsent(tier.getMinAmount().stripTrailingZeros(),tier.getTierName());
            Map<Long,BigDecimal> progress=new HashMap<>();Map<Long,Map<BigDecimal,Event>> crossed=new HashMap<>();
            for(var event:campaignEvents){
                var before=progress.getOrDefault(event.customer(),BigDecimal.ZERO);var after=before.add(event.change());progress.put(event.customer(),after);
                var reached=crossed.computeIfAbsent(event.customer(),key->new HashMap<>());
                for(var goal:goals.keySet())if(after.compareTo(goal)<0)reached.remove(goal);else if(before.compareTo(goal)<0)reached.put(goal,event);
            }
            for(var customer:crossed.entrySet())for(var entry:customer.getValue().entrySet()){
                var event=entry.getValue();var owner=totals.get(event.author());
                if(owner!=null && !event.date().isBefore(start))owner.achievements.add(new TargetAchievement(event.customer(),customers.get(event.customer()).getName(),target.getName(),goals.get(entry.getKey()),entry.getKey(),event.date()));
            }
        }
        var ordered=totals.values().stream().sorted(Comparator.comparing((Totals t)->t.amount).reversed().thenComparing(t->t.username)).toList();
        var rows=new ArrayList<Staff>();int rank=0;BigDecimal previous=null;
        for(int i=0;i<ordered.size();i++){
            var t=ordered.get(i);if(previous==null || t.amount.compareTo(previous)!=0)rank=i+1;previous=t.amount;
            BigDecimal gap=BigDecimal.ZERO;for(int j=i-1;j>=0;j--)if(ordered.get(j).amount.compareTo(t.amount)>0){gap=ordered.get(j).amount.subtract(t.amount);break;}
            var customerRows=t.customers.stream().map(id->{
                var customer=customers.get(id);var monthly=customerAmounts.getOrDefault(id,BigDecimal.ZERO);String range="No range";
                for(var config:rangeConfigs)if(monthly.compareTo(config.getMinSpend())>=0)range=config.getName()==null?"Range "+config.getMinSpend().stripTrailingZeros().toPlainString():config.getName();
                return new CustomerPerformance(id,customer.getName(),customer.getCustomerCode(),t.customerBills.get(id),t.customerValues.get(id),range,monthly);
            }).sorted(Comparator.comparing(CustomerPerformance::originalAmount).reversed().thenComparing(CustomerPerformance::id)).toList();
            var distribution=new LinkedHashMap<String,Long>();for(var customer:customerRows)distribution.merge(customer.range(),1L,Long::sum);
            rows.add(new Staff(rank,t.username,t.name,t.bills,t.amount,t.confirmed,t.pending,t.customers.size(),t.milestones,t.bills==0?BigDecimal.ZERO:t.amount.divide(BigDecimal.valueOf(t.bills),2,RoundingMode.HALF_UP),gap,customerRows,distribution.entrySet().stream().map(e->new RangeCount(e.getKey(),e.getValue())).toList(),List.copyOf(t.achievements)));
        }
        return new Performance(start,end,rows.stream().map(Staff::originalAmount).reduce(BigDecimal.ZERO,BigDecimal::add),rows.stream().mapToLong(Staff::billCount).sum(),rows.stream().mapToLong(Staff::rangeMilestones).sum(),rows);
    }
    private static boolean applies(com.nbh.erp.customertarget.entity.CustomerTarget target,com.nbh.erp.customer.entity.Customer customer){
        if(target.getCustomer()!=null)return target.getCustomer().getId().equals(customer.getId());
        return target.getCustomerGroup()==null || customer.getCustomerGroups().stream().anyMatch(group->group.getId().equals(target.getCustomerGroup().getId()));
    }
}
