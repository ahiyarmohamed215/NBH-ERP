package com.nbh.erp.accounting.service;
import com.nbh.erp.accounting.entity.*;
import com.nbh.erp.accounting.repository.*;
import com.nbh.erp.common.exception.BusinessException;
import com.nbh.erp.common.dto.PagedResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.domain.Pageable;
import java.util.*;
import java.math.*;
import java.time.LocalDate;
@Service @RequiredArgsConstructor
public class AccountingService {
 private final AccountRepository accounts;
 private final JournalRepository journals;
 private final FiscalYearRepository years;
 private final com.nbh.erp.audit.service.AuditLogService audit;
 public record Line(String account,BigDecimal debit,BigDecimal credit) {}
 public record Entry(Long id,String source,LocalDate postingDate,String description,String kind,boolean reversed,boolean reconciled,List<Line> lines) {}
 public record Balance(String code,String name,String type,BigDecimal debit,BigDecimal credit,BigDecimal balance) {}
 public record AccountView(String code,String name,String type,boolean active) {}
 public record Posting(String source,LocalDate postingDate,String description,String kind,List<Line> lines) {}
 private Entry dto(Journal j) { return new Entry(j.getId(),j.getSource(),j.getPostingDate(),j.getDescription(),j.getKind(),j.isReversed(),j.isReconciled(),j.getLines().stream().map(l -> new Line(l.getAccount().getCode(),l.getDebit(),l.getCredit())).toList()); }
 @Transactional(readOnly=true) public List<AccountView> accounts() { return accounts.findAll().stream().map(a -> new AccountView(a.getCode(),a.getName(),a.getType(),a.isActive())).toList(); }
 @Transactional public AccountView createAccount(AccountView req) {
  if(req.code()==null || !req.code().matches("[A-Z0-9_-]{1,30}") || req.name()==null || req.name().isBlank() || !Set.of("ASSET","LIABILITY","EQUITY","INCOME","EXPENSE").contains(req.type())) throw new BusinessException("Valid code, name and account type required");
  if(accounts.existsById(req.code())) throw new BusinessException("Account code exists");
  var a=new Account(); a.setCode(req.code()); a.setName(req.name()); a.setType(req.type()); accounts.save(a);
  audit.log("ACCOUNT_CREATE","Accounting",a.getCode(),a.getName()); return new AccountView(a.getCode(),a.getName(),a.getType(),a.isActive());
 }
 @Transactional public void initializeAccounts() {
  String[][] rows={{"CASH","Cash on hand","ASSET"},{"BANK","Bank clearing","ASSET"},{"CHEQUES","Cheques in hand","ASSET"},{"AR","Accounts receivable","ASSET"},{"INVENTORY","Inventory","ASSET"},{"AP","Accounts payable","LIABILITY"},{"DEPOSITS","Customer credits and advances","LIABILITY"},{"TAX","Tax payable","LIABILITY"},{"EQUITY","Retained earnings","EQUITY"},{"SALES","Sales revenue","INCOME"},{"COGS","Cost of goods sold","EXPENSE"},{"ADJUSTMENTS","Stock adjustments","EXPENSE"},{"EXPENSES","Operating expenses","EXPENSE"}};
  for(var row:rows) if(!accounts.existsById(row[0])) { var a=new Account(); a.setCode(row[0]); a.setName(row[1]); a.setType(row[2]); accounts.save(a); }
 }
 @Transactional(readOnly=true) public PagedResponse<Entry> list(String kind,Pageable page) { return PagedResponse.from(journals.search(kind,page).map(this::dto)); }
 @Transactional public Entry post(Posting request) {
  accounts.postingLock().orElseThrow(() -> new BusinessException("Accounting is not initialized"));
  if(request.source()==null || request.source().isBlank() || request.source().length()>255 || request.description()==null || request.description().isBlank() || request.postingDate()==null || request.lines()==null || request.lines().size()<2) throw new BusinessException("Journal reference, date, description and at least two lines required");
  var existing=journals.findBySource(request.source());
  if(existing.isPresent()) throw new BusinessException("Journal source has already been posted");
  if(years.findById(request.postingDate().getYear()).map(FiscalYear::isClosed).orElse(false)) throw new BusinessException("Fiscal year is closed");
  var journal=new Journal(); journal.setSource(request.source()); journal.setPostingDate(request.postingDate()); journal.setDescription(request.description()); journal.setKind(request.kind()==null?"GENERAL":request.kind());
  BigDecimal debit=BigDecimal.ZERO,credit=BigDecimal.ZERO;
  for(var req:request.lines()) {
   if(req.debit()==null || req.credit()==null || req.debit().signum()<0 || req.credit().signum()<0 || (req.debit().signum()>0 && req.credit().signum()>0)) throw new BusinessException("Each line must be a nonnegative debit or credit");
   BigDecimal d=req.debit().setScale(2,RoundingMode.UNNECESSARY),c=req.credit().setScale(2,RoundingMode.UNNECESSARY);
   Account account=accounts.findById(req.account()).orElseThrow(() -> new BusinessException("Unknown account: "+req.account()));
   if(!account.isActive()) throw new BusinessException("Inactive account");
   var line=new JournalLine(); line.setJournal(journal); line.setAccount(account); line.setDebit(d); line.setCredit(c); journal.getLines().add(line); debit=debit.add(d); credit=credit.add(c);
  }
  if(debit.signum()<=0 || debit.compareTo(credit)!=0) throw new BusinessException("Journal debits must equal credits and exceed zero");
  journals.save(journal); audit.log("JOURNAL_POST","Accounting",journal.getSource(),journal.getDescription()); return dto(journal);
 }
 @Transactional public void transfer(String source,LocalDate date,String description,String kind,String debit,String credit,BigDecimal amount) {
  if(amount.signum()==0) return;
  amount=amount.setScale(2,RoundingMode.HALF_UP);
  if(amount.signum()==0) return;
  post(new Posting(source,date,description,kind,List.of(new Line(debit,amount,BigDecimal.ZERO),new Line(credit,BigDecimal.ZERO,amount))));
 }
 @Transactional public Entry reverse(Long id,String reason) {
  var original=journals.lockById(id).orElseThrow(() -> new BusinessException("Unknown journal"));
  if(original.isReversed() || original.getReversalOf()!=null) throw new BusinessException("Journal already reversed or is a reversal");
  if(reason==null || reason.isBlank()) throw new BusinessException("Reversal reason required");
  var entry=post(new Posting("REV-"+id,LocalDate.now(),reason,original.getKind(),original.getLines().stream().map(l -> new Line(l.getAccount().getCode(),l.getCredit(),l.getDebit())).toList()));
  var reversal=journals.findById(entry.id()).orElseThrow(); reversal.setReversalOf(id); original.setReversed(true); journals.save(original); return entry;
 }
 @Transactional public Entry reverseManual(Long id,String reason) {
  var journal=journals.lockById(id).orElseThrow(() -> new BusinessException("Unknown journal"));
  if(!journal.getSource().startsWith("MANUAL-")) throw new BusinessException("Reverse this entry through its original business document");
  return reverse(id,reason);
 }
 @Transactional public void reverseSource(String source,String reason) { journals.findBySource(source).ifPresent(j -> reverse(j.getId(),reason)); }
 @Transactional public Entry reconcile(Long id) { var j=journals.lockById(id).orElseThrow(); if(!"BANKING".equals(j.getKind())) throw new BusinessException("Only bank journals can be reconciled"); j.setReconciled(true); audit.log("BANK_RECONCILE","Accounting",j.getSource(),"Matched statement"); return dto(j); }
 @Transactional public void closeYear(Integer year) { accounts.postingLock().orElseThrow(); var y=years.findById(year).orElseGet(FiscalYear::new); y.setFiscalYear(year); y.setClosed(true); years.save(y); audit.log("YEAR_CLOSE","Accounting",year.toString(),"Fiscal year closed"); }
 @Transactional(readOnly=true) public List<Balance> trialBalance(LocalDate start,LocalDate end) {
  if(start!=null && end!=null && start.isAfter(end)) throw new BusinessException("Invalid date range");
  return journals.trialBalance(start,end).stream().map(a -> new Balance((String)a[0],(String)a[1],(String)a[2],(BigDecimal)a[3],(BigDecimal)a[4],((BigDecimal)a[3]).subtract((BigDecimal)a[4]))).toList();
 }
 @Transactional(readOnly=true) public List<Balance> balanceSheet(LocalDate end) {
  var all=trialBalance(null,end);
  var result=new ArrayList<>(all.stream().filter(b -> Set.of("ASSET","LIABILITY","EQUITY").contains(b.type())).toList());
  var earnings=all.stream().filter(b -> Set.of("INCOME","EXPENSE").contains(b.type())).map(Balance::balance).reduce(BigDecimal.ZERO,BigDecimal::add);
  result.add(new Balance("CURRENT_EARNINGS","Accumulated unclosed earnings","EQUITY",earnings.max(BigDecimal.ZERO),earnings.negate().max(BigDecimal.ZERO),earnings));
  return result;
 }
 public static String cashAccount(String method) { return "CHEQUE".equals(method)?"CHEQUES":Set.of("BANK_TRANSFER","CARD","ONLINE").contains(method==null?"":method)?"BANK":"CASH"; }
}
