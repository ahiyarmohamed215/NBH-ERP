$loginBody = @{ username = 'admin'; password = 'admin123' } | ConvertTo-Json
$loginRes = Invoke-RestMethod -Uri 'http://localhost:8080/api/v1/auth/login' -Method Post -Body $loginBody -ContentType 'application/json'
$token = $loginRes.data.accessToken
Write-Host "Token retrieved successfully: $($token.Substring(0, 15))..."

$headers = @{ Authorization = "Bearer $token" }
$summaryRes = Invoke-RestMethod -Uri 'http://localhost:8080/api/v1/audit-logs/day-summary' -Method Get -Headers $headers
Write-Host "Day Summary Output:"
$summaryRes.data | ConvertTo-Json -Depth 4
