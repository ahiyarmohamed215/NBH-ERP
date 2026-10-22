package com.nbh.erp.sales.service;

import com.nbh.erp.common.exception.BusinessException;
import com.nbh.erp.customerrange.service.CustomerRangeService;
import com.nbh.erp.customertarget.service.CustomerTargetService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.util.List;

/** POS receives presentation values; thresholds and reward calculations stay here. */
@Service
@RequiredArgsConstructor
public class PosProgressService {
    private final InvoiceService invoices;
    private final CustomerRangeService ranges;
    private final CustomerTargetService targets;
    private final Clock businessClock;

    public record Milestone(String name,BigDecimal goal,BigDecimal completedAmount,BigDecimal projectedAmount,
            BigDecimal completedPercent,BigDecimal billPercent,BigDecimal remaining,String state,String reward) {}
    public record Campaign(String name,LocalDate endDate,List<Milestone> milestones) {}
    public record Progress(String currentRangeName,String nextRangeName,boolean highestRange,
            LocalDate periodStart,LocalDate periodEnd,BigDecimal monthlyPurchases,BigDecimal currentBillAmount,
            BigDecimal projectedMonthlyPurchases,Milestone nextRange,List<Milestone> ranges,List<Campaign> targets) {}

    static Milestone milestone(String name,BigDecimal goal,BigDecimal amount,BigDecimal bill,String reward) {
        BigDecimal projected=amount.add(bill),remaining=goal.subtract(projected).max(BigDecimal.ZERO);
        BigDecimal completed=percent(amount,goal),total=percent(projected,goal);
        String state=amount.compareTo(goal)>=0?"ACHIEVED":remaining.signum()==0?"WITH_BILL":"IN_PROGRESS";
        return new Milestone(name,goal,amount,projected,completed,total.subtract(completed).max(BigDecimal.ZERO),remaining,state,reward);
    }
    private static BigDecimal percent(BigDecimal amount,BigDecimal goal) {
        return goal.signum()<=0?BigDecimal.valueOf(100):amount.multiply(BigDecimal.valueOf(100)).divide(goal,2,RoundingMode.HALF_UP).max(BigDecimal.ZERO).min(BigDecimal.valueOf(100));
    }
    @Transactional
    public Progress progress(Long customerId,Long billId) {
        return progress(customerId,billId,null);
    }
    @Transactional
    public Progress progress(Long customerId,Long billId,String requestedMonth) {
        var today=LocalDate.now(businessClock);
        java.time.YearMonth month;
        try{month=requestedMonth==null || requestedMonth.isBlank()?java.time.YearMonth.from(today):java.time.YearMonth.parse(requestedMonth);}
        catch(java.time.DateTimeException error){throw new BusinessException("Choose a valid month (YYYY-MM)");}
        if(month.isAfter(java.time.YearMonth.from(today)))throw new BusinessException("Choose the current month or an earlier month");
        LocalDate through=month.atEndOfMonth().isAfter(today)?today:month.atEndOfMonth();
        BigDecimal bill=BigDecimal.ZERO;
        if(billId!=null){var saved=invoices.getInvoiceById(billId);if(!"HELD".equals(saved.getStatus()) || !customerId.equals(saved.getCustomerId()))throw new BusinessException("Save the current customer on the held bill before loading its progress");bill=saved.getNetTotal();}
        final BigDecimal currentBill=bill;
        var monthly=ranges.getCustomerProgress(customerId,bill,month.toString());
        var milestones=ranges.getActiveRanges().stream().map(range->milestone(range.getName(),range.getMinSpend(),monthly.getMonthlyPurchases(),currentBill,"")).toList();
        var campaigns=targets.getCustomerTargetProgress(customerId,month.atDay(1),through).stream().map(target->{
            var levels=new java.util.ArrayList<Milestone>();
            levels.add(milestone("Overall target",target.getTargetAmount(),target.getCurrentAchievedAmount(),currentBill,""));
            for(var tier:target.getTiers()){
                String reward=tier.getRewardDescription();
                if(reward==null || reward.isBlank())reward=tier.getDiscountPercentage()!=null && tier.getDiscountPercentage().signum()>0?tier.getDiscountPercentage().stripTrailingZeros().toPlainString()+"% discount":tier.getDiscountAmount()!=null && tier.getDiscountAmount().signum()>0?"Rs. "+tier.getDiscountAmount().toPlainString()+" discount":"";
                levels.add(milestone(tier.getTierName(),tier.getMinAmount(),target.getCurrentAchievedAmount(),currentBill,reward));
            }
            return new Campaign(target.getTargetName(),target.getEndDate(),levels);
        }).toList();
        return new Progress(monthly.getCurrentRangeName(),monthly.getNextRangeName(),Boolean.TRUE.equals(monthly.getIsHighestRange()),
            month.atDay(1),month.atEndOfMonth(),monthly.getMonthlyPurchases(),bill,monthly.getMonthlyPurchases().add(bill),
            milestone(monthly.getNextRangeName(),monthly.getNextRangeThreshold(),monthly.getMonthlyPurchases(),bill,""),milestones,campaigns);
    }
}
