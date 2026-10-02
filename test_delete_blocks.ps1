$loginBody = @{ username = 'admin'; password = 'admin123' } | ConvertTo-Json
$loginRes = Invoke-RestMethod -Uri 'http://localhost:8080/api/v1/auth/login' -Method Post -Body $loginBody -ContentType 'application/json'
$headers = @{ Authorization = "Bearer $($loginRes.data.accessToken)" }

foreach ($endpoint in @('products/1', 'invoices/1', 'customers/1', 'suppliers/1', 'warehouses/1', 'delivery/routes/1', 'delivery/vehicles/1', 'grn/1', 'quotations/1')) {
    try {
        $res = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/$endpoint" -Method Delete -Headers $headers
        Write-Host "UNEXPECTED: Delete succeeded on $endpoint"
    } catch {
        Write-Host "SUCCESS: Blocked delete on $endpoint -> $($_.Exception.Message)"
        if ($_.Exception.Response) {
            $stream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            Write-Host "         Body: $($reader.ReadToEnd())"
        }
    }
}
