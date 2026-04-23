$f = 'D:/DoAn/SEP490_G55_Automation_Antidetect_Browser/src/renderer/components/ProfileList.jsx'
$lines = [System.IO.File]::ReadAllLines($f)
$newLines = [System.Collections.Generic.List[string]]::new()
$fixed = $false
for ($i = 0; $i -lt $lines.Length; $i++) {
    $line = $lines[$i]
    # Line 601 in editor = index 600 (0-based). Check for "          })" with exactly 10 leading spaces
    if (-not $fixed -and $i -eq 600 -and $line.TrimStart() -eq '})') {
        # Insert the missing ");" line before this line
        $newLines.Add('            );')
        $fixed = $true
        Write-Host "Inserted missing semicolon before line $($i+1)"
    }
    $newLines.Add($line)
}
[System.IO.File]::WriteAllLines($f, $newLines)
Write-Host "Done. Fixed=$fixed"
