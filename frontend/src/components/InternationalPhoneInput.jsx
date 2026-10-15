import React from 'react';
import {getCountries,getCountryCallingCode,getExampleNumber,parsePhoneNumberFromString} from 'libphonenumber-js/max';
import examples from 'libphonenumber-js/mobile/examples';
import FilterSelect from './FilterSelect';

const regionNames=new Intl.DisplayNames(['en'],{type:'region'});
const countries=getCountries().sort((a,b)=>regionNames.of(a).localeCompare(regionNames.of(b)));
export default function InternationalPhoneInput({value,country='LK',onChange,onCountryChange,error,onBlur}) {
  const example=getExampleNumber(country,examples)?.formatNational();
  return <>
    <div className="supplier-phone-input">
      <FilterSelect variant="field" selectedLabel={`+${getCountryCallingCode(country)}`} value={country} aria-label="Phone country" onChange={event=>onCountryChange(event.target.value)}>{countries.map(code=><option key={code} value={code}>{regionNames.of(code)} (+{getCountryCallingCode(code)})</option>)}</FilterSelect>
      <input className="erp-field" name="phone" type="tel" inputMode="tel" autoComplete="tel-national" aria-label="Contact number" aria-invalid={Boolean(error)} aria-describedby="supplier-phone-help" value={value || ''} maxLength={30} placeholder={example || 'Contact number'} onBlur={onBlur} onChange={event=>{
        const entered=event.target.value,phone=entered.startsWith('+')?parsePhoneNumberFromString(entered):null;
        if(phone?.country && phone.country!==country)onCountryChange(phone.country);
        onChange(phone?.country ? phone.formatNational() : entered);
      }}/>
    </div>
    <small id="supplier-phone-help" className={error?'supplier-field-error':'supplier-field-hint'}>{error || `Format: ${example || `+${getCountryCallingCode(country)} …`}`}</small>
  </>;
}
