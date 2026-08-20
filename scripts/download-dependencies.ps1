[CmdletBinding()]
param([switch]$Silent)

$ErrorActionPreference = 'Stop'
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$manifestPath = Join-Path $repositoryRoot 'download-dependencies.manifest.json'
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$dependency = @($manifest.dependencies)[0]

if ($manifest.schemaVersion -ne 1 -or
    $dependency.id -ne 'node-runtime-win-x64' -or
    $dependency.version -ne '22.23.2' -or
    $dependency.sha256 -notmatch '^[a-f0-9]{64}$') {
    throw 'The dependency manifest is unsupported or incomplete.'
}

$toolsRoot = Join-Path $repositoryRoot '.tools'
$cacheRoot = Join-Path $toolsRoot 'cache'
$archivePath = Join-Path $cacheRoot "node-v$($dependency.version)-win-x64.zip"
$destination = Join-Path $repositoryRoot ([string]$dependency.destination)
$nodePath = Join-Path $destination 'node.exe'
$startedAt = Get-Date

New-Item -ItemType Directory -Force -Path $cacheRoot | Out-Null

function Assert-ArchiveDigest {
    $stream = [System.IO.File]::OpenRead($archivePath)
    try {
        $algorithm = [System.Security.Cryptography.SHA256]::Create()
        try {
            $bytes = $algorithm.ComputeHash($stream)
        } finally {
            $algorithm.Dispose()
        }
    } finally {
        $stream.Dispose()
    }
    $actual = ([System.BitConverter]::ToString($bytes) -replace '-', '').ToLowerInvariant()
    if ($actual -ne $dependency.sha256) {
        throw "Node.js archive digest mismatch. Expected $($dependency.sha256); received $actual."
    }
}

if (-not (Test-Path -LiteralPath $archivePath -PathType Leaf)) {
    $partialPath = "$archivePath.partial"
    Write-Host "Downloading Node.js $($dependency.version) from $($dependency.url)"
    Invoke-WebRequest -Uri $dependency.url -OutFile $partialPath -UseBasicParsing
    Move-Item -LiteralPath $partialPath -Destination $archivePath
}

Assert-ArchiveDigest

if (-not (Test-Path -LiteralPath $nodePath -PathType Leaf)) {
    if (Test-Path -LiteralPath $destination) {
        throw "The dependency destination exists but does not contain node.exe: $destination"
    }
    $stagingRoot = Join-Path $toolsRoot ("extract-" + [Guid]::NewGuid().ToString('N'))
    try {
        Expand-Archive -LiteralPath $archivePath -DestinationPath $stagingRoot
        $expandedRoot = Join-Path $stagingRoot ([string]$dependency.archiveRoot)
        if (-not (Test-Path -LiteralPath (Join-Path $expandedRoot 'node.exe') -PathType Leaf)) {
            throw 'The verified Node.js archive did not contain the expected node.exe.'
        }
        Move-Item -LiteralPath $expandedRoot -Destination $destination
    } finally {
        if (Test-Path -LiteralPath $stagingRoot) {
            Remove-Item -LiteralPath $stagingRoot -Recurse -Force
        }
    }
}

$actualVersion = (& $nodePath --version).Trim()
if ($LASTEXITCODE -ne 0 -or $actualVersion -ne "v$($dependency.version)") {
    throw "The prepared Node.js runtime reported '$actualVersion'; expected v$($dependency.version)."
}

$elapsed = [Math]::Round(((Get-Date) - $startedAt).TotalSeconds, 2)
Write-Host "Dependency ready: Node.js $actualVersion at $destination"
Write-Host "Verified archive SHA-256: $($dependency.sha256)"
Write-Host "Dependency preparation completed in $elapsed second(s)."
