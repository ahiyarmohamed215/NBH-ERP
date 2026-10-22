const cents=value=>Math.round(Number(value || 0)*100);
export function customerCreditBlock(customer, billAmount=0) {
  if (!customer) return '';
  const limit=cents(customer.creditLimit), outstanding=cents(customer.currentBalance), amount=cents(billAmount);
  if (limit<=0) return '';
  if (outstanding>0 && outstanding>=limit) return 'Credit limit reached. Settle outstanding payments or increase the credit limit before creating the final invoice.';
  if (amount>0 && outstanding+amount>limit) return 'Bill exceeds available credit. Settle outstanding payments or increase the credit limit before creating the final invoice.';
  return '';
}
