package com.nbh.erp.recyclebin;
import com.nbh.erp.common.dto.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;
import java.util.List;

@RestController @RequestMapping("/api/v1/recycle-bin") @RequiredArgsConstructor
public class RecycleBinController {
    private final RecycleBinService service;
    @GetMapping @PreAuthorize("isAuthenticated()") public ApiResponse<List<RecycleBinService.Entry>> list(){return ApiResponse.ok(service.list());}
    @DeleteMapping("/{type}/{id}") @PreAuthorize("isAuthenticated()") public void delete(@PathVariable String type,@PathVariable Long id,@RequestParam(required=false) String reason){service.delete(type.toUpperCase(java.util.Locale.ROOT),id,reason);}
    @PostMapping("/{type}/{id}/restore") @PreAuthorize("isAuthenticated()") public void restore(@PathVariable String type,@PathVariable Long id){service.restore(type.toUpperCase(java.util.Locale.ROOT),id);}
    @DeleteMapping("/{type}/{id}/permanent") @PreAuthorize("isAuthenticated()") public void purge(@PathVariable String type,@PathVariable Long id){service.purge(type.toUpperCase(java.util.Locale.ROOT),id);}
}
