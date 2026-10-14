import fs from 'node:fs';
const root='../src/main/java/com/nbh/erp';
for(const file of ['DeliveryController','DeliveryRouteController','VehicleController']){
 const path=`${root}/delivery/controller/${file}.java`;let s=fs.readFileSync(path,'utf8');
 if(!s.includes('import org.springframework.security.access.prepost.PreAuthorize;'))s=s.replace('\n\nimport ', '\n\nimport org.springframework.security.access.prepost.PreAuthorize;\nimport ');
 s=s.replace(/(@(?:Post|Put|Patch|Delete)Mapping[^\r\n]*\r?\n)([\s\S]*?)(?=    public )/g,(_all,mapping,annotations)=>mapping+'    @PreAuthorize("hasAnyAuthority(\'ROLE_ADMIN\',\'ROLE_SUPER_ADMIN\',\'DELIVERY_MANAGE\')")\n'+annotations.replace(/    @PreAuthorize\("[^"\r\n]+"\)\r?\n/g,''));
 fs.writeFileSync(path,s);
}
const invoicePath=`${root}/sales/controller/InvoiceController.java`;let s=fs.readFileSync(invoicePath,'utf8');
s=s.replace(/(@GetMapping[^\r\n]*\r?\n)([\s\S]*?)(?=    public )/g,(all,mapping,annotations)=>{
 if(annotations.includes("hasAuthority('ROLE_ADMIN') or hasAuthority('SALES_VIEW_ALL')"))return all;
 return mapping+'    @PreAuthorize("T(com.nbh.erp.security.SecurityUtils).canRead(\'SALES\')")\n'+annotations.replace(/    @PreAuthorize\("[^"\r\n]+"\)\r?\n/g,'');
});fs.writeFileSync(invoicePath,s);
const targetPath=`${root}/customertarget/service/CustomerTargetService.java`;s=fs.readFileSync(targetPath,'utf8').replaceAll('enforceCanEdit("CUSTOMER"','enforceCanEdit("CUSTOMER_TARGET"');fs.writeFileSync(targetPath,s);
