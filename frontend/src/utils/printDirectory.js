import {printA4Report} from './printReport';

const escape = value => String(value ?? '').replace(/[&<>"']/g, char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const text = node => node?.textContent?.replace(/\s+/g,' ').trim() || '—';

export function printCurrentDirectory(root, title) {
  const table=root?.querySelector('table');
  if(!table) return false;
  const headers=[...table.querySelectorAll('thead th')];
  const included=headers.map((header,index)=>({header,index})).filter(({header})=>!/^actions?$/i.test(text(header)));
  const data=[...table.querySelectorAll('tbody tr')].filter(row=>row.cells.length===headers.length && [...row.cells].every(cell=>cell.colSpan===1))
    .map(row=>Object.fromEntries(included.map(({index})=>[String(index),escape(text(row.cells[index]))])));
  const search=root.querySelector('.inventory-toolbar input[placeholder^="Search"], .master-toolbar input[placeholder^="Search"]')?.value;
  const metaItems=search ? [{label:'Search',value:escape(search)}] : [];
  for(const filter of root.querySelectorAll('.modern-filter-trigger[data-filter-active="true"]')) metaItems.push({label:escape(filter.title || 'Filter'),value:escape(text(filter.querySelector('.modern-filter-value')))});
  printA4Report({title:escape(title),metaItems,
    columns:included.map(({header,index})=>({header:escape(text(header)),accessor:String(index)})),data,
    summaryItems:[{label:'Total records',value:String(data.length)}]});
  return true;
}
