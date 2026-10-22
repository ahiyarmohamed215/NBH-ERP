export const defaultBadgeRanges=Array.from({length:6},(_,index)=>({rangeCode:`RANGE_${index}`,name:`Range ${index}`,minSpend:index,isActive:true}));
export const rangeBadgePalette={
  gold:{label:'Gold',bg:'#fef3c7',text:'#92400e',border:'#fde68a'},
  silver:{label:'Silver',bg:'#f1f5f9',text:'#475569',border:'#cbd5e1'},
  bronze:{label:'Bronze',bg:'#ffedd5',text:'#9a3412',border:'#fed7aa'},
  blue:{label:'Blue',bg:'#e0f2fe',text:'#075985',border:'#bae6fd'},
  teal:{label:'Teal',bg:'#ccfbf1',text:'#115e59',border:'#99f6e4'},
  violet:{label:'Violet',bg:'#ede9fe',text:'#5b21b6',border:'#ddd6fe'},
  rose:{label:'Rose',bg:'#ffe4e6',text:'#9f1239',border:'#fecdd3'},
  indigo:{label:'Indigo',bg:'#e0e7ff',text:'#3730a3',border:'#c7d2fe'},
  cyan:{label:'Cyan',bg:'#cffafe',text:'#155e75',border:'#a5f3fc'},
  lime:{label:'Lime',bg:'#ecfccb',text:'#3f6212',border:'#d9f99d'},
  standard:{label:'Standard',bg:'#f8fafc',text:'#64748b',border:'#e2e8f0'},
};
const normalize=value=>String(value || '').trim().toLowerCase().replace(/[\s_-]+/g,'');
export function getRangeBadgeAppearance({name,code,id}={},ranges=defaultBadgeRanges) {
  const choices=Array.isArray(ranges) && ranges.length?ranges:defaultBadgeRanges;
  const match=choices.find(range=>(id!=null && String(range.id)===String(id)) || (code && normalize(range.rangeCode)===normalize(code)) || (name && normalize(range.name)===normalize(name)));
  let tone='standard';
  if(match) {
    const levels=choices.filter(range=>range.isActive!==false && Number(range.minSpend)>0)
      .map(range=>Number(range.minSpend)).filter((value,index,all)=>all.indexOf(value)===index).sort((a,b)=>b-a);
    const rank=match.isActive===false?-1:levels.indexOf(Number(match.minSpend));
    if(match.isActive!==false && Number(match.minSpend)===0)tone='teal';
    else if(rank>=0) {
      const medals=['gold','silver','bronze'];
      const colours=['blue','violet','rose','indigo','cyan','lime'];
      tone=rank<medals.length?medals[rank]:colours[(rank-medals.length)%colours.length];
    }
  } else {
    const value=normalize(name || code);
    if(value==='range0')tone='teal';
    else if(value.includes('gold') || value.includes('diamond'))tone='gold';
    else if(value.includes('silver') || value.includes('platinum'))tone='silver';
    else if(value.includes('bronze'))tone='bronze';
  }
  return {tone,...rangeBadgePalette[tone],badge:rangeBadgePalette[tone].text};
}
