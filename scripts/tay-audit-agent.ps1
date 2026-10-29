# ====================================================================
# TAY-AUDIT: AGENTE INTELIGENTE DE AUDITORIA Y LEVANTAMIENTO TI
# Detecta Laptops, PCs de Escritorio OEM, PCs Ensambladas, IPs y MACs
# ====================================================================
param (
    [string]$ServerUrl = "http://localhost:3001"
)

$ServerUrl = $ServerUrl.TrimEnd('/')

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   TAY-AUDIT - LEVANTAMIENTO AUTOMATICO DE INVENTARIO TI  " -ForegroundColor White -BackgroundColor DarkBlue
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "[*] Conectando con servidor central: $ServerUrl" -ForegroundColor Yellow

try {
    # 1. Identificacion Basica
    $Hostname = $env:COMPUTERNAME
    $AssignedUser = $env:USERNAME

    Write-Host "[*] Analizando arquitectura de hardware para $Hostname..." -ForegroundColor Gray

    # 2. Informacion de Sistema Operativo
    $OSInfo = Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue
    $OSName = if ($OSInfo) { "$($OSInfo.Caption) ($($OSInfo.OSArchitecture))" } else { "Windows (Version no identificada)" }

    # 3. Informacion de Memoria RAM
    $ComputerSystem = Get-CimInstance Win32_ComputerSystem -ErrorAction SilentlyContinue
    $TotalRAM_GB = if ($ComputerSystem.TotalPhysicalMemory) {
        [math]::Round($ComputerSystem.TotalPhysicalMemory / 1GB, 1)
    } else { 0 }
    $RAMString = "$TotalRAM_GB GB"

    # 4. Informacion del Procesador (CPU)
    $Processor = Get-CimInstance Win32_Processor -ErrorAction SilentlyContinue | Select-Object -First 1
    $CPUString = if ($Processor) { $Processor.Name.Trim() } else { "CPU Generico" }

    # 5. Placa Madre (Motherboard) y BIOS
    $BIOS = Get-CimInstance Win32_BIOS -ErrorAction SilentlyContinue
    $SerialNumber = if ($BIOS.SerialNumber -and $BIOS.SerialNumber.Trim() -ne '' -and $BIOS.SerialNumber.Trim() -ne 'None') {
        $BIOS.SerialNumber.Trim()
    } else { "SN-DESCONOCIDO" }

    $BaseBoard = Get-CimInstance Win32_BaseBoard -ErrorAction SilentlyContinue
    $MoboManufacturer = if ($BaseBoard.Manufacturer) { $BaseBoard.Manufacturer.Trim() } else { '' }
    $MoboProduct = if ($BaseBoard.Product) { $BaseBoard.Product.Trim() } else { '' }
    $MoboString = if ($MoboManufacturer -or $MoboProduct) {
        (($MoboManufacturer -replace '\s+',' ') + ' ' + $MoboProduct).Trim()
    } else { "Placa Base Estandar" }

    # 6. Almacenamiento (Discos Directos: SATA, NVMe, PCIe, SAS - Excluye conectividad USB/Extraibles)
    $DiskList = @()
    try {
        $InternalDisks = Get-Disk -ErrorAction Stop | Where-Object { 
            $_.BusType -notmatch '(?i)USB|SD|MMC|Bluetooth' -and $_.OperationalStatus -match '(?i)OK|Online'
        }
        foreach ($d in $InternalDisks) {
            $parts = Get-Partition -DiskNumber $d.Number -ErrorAction SilentlyContinue | Where-Object { $_.DriveLetter }
            $addedAny = $false
            foreach ($p in $parts) {
                $vol = Get-Volume -DriveLetter $p.DriveLetter -ErrorAction SilentlyContinue
                if ($vol -and $vol.Size -gt 0) {
                    $sGB = [math]::Round($vol.Size / 1GB, 0)
                    $fGB = [math]::Round($vol.SizeRemaining / 1GB, 0)
                    $DiskList += "$($p.DriveLetter): ($sGB GB total, $fGB GB libre)"
                    $addedAny = $true
                }
            }
            if (-not $addedAny -and $d.Size -gt 0) {
                $rawGB = [math]::Round($d.Size / 1GB, 0)
                $DiskList += "$($d.FriendlyName) ($rawGB GB SATA/NVMe)"
            }
        }
    } catch {
        $logicalDisks = Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" -ErrorAction SilentlyContinue
        foreach ($ld in $logicalDisks) {
            if ($ld.Size -and $ld.Size -gt 0) {
                $sGB = [math]::Round($ld.Size / 1GB, 0)
                $fGB = [math]::Round($ld.FreeSpace / 1GB, 0)
                $DiskList += "$($ld.DeviceID) ($sGB GB total, $fGB GB libre)"
            }
        }
    }
    $StorageString = if ($DiskList.Count -gt 0) { ($DiskList | Select-Object -Unique) -join " | " } else { "No detectado" }

    # 7. Red: Direccion IP y Direccion MAC Fisica Real
    $NetConfigs = Get-CimInstance Win32_NetworkAdapterConfiguration -ErrorAction SilentlyContinue | Where-Object { $_.IPEnabled }
    $PrimaryNet = $NetConfigs | Where-Object { $_.DefaultIPGateway -ne $null } | Select-Object -First 1
    if (-not $PrimaryNet) { $PrimaryNet = $NetConfigs | Select-Object -First 1 }

    $IPAddress = "127.0.0.1"
    $MACAddress = "00:00:00:00:00:00"
    $NetAdapterName = "Adaptador de Red"

    if ($PrimaryNet) {
        $foundIP = $PrimaryNet.IPAddress | Where-Object { $_ -match '^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$' } | Select-Object -First 1
        if ($foundIP) { $IPAddress = $foundIP }
        if ($PrimaryNet.MACAddress) { $MACAddress = $PrimaryNet.MACAddress.ToUpper() }
        if ($PrimaryNet.Description) { $NetAdapterName = $PrimaryNet.Description }
    }

    # 8. Compatibilidad Windows 11 / TPM
    $tpm = try { [bool](Get-CimInstance -Namespace root/cimv2/security/microsofttpm -ClassName Win32_Tpm -ErrorAction SilentlyContinue).SpecVersion } catch { $false }
    $Compatibility = if (($OSName -like '*Windows 11*') -or $tpm) { 'Compatible' } else { 'No Compatible' }

    # 9. DISCRIMINACION INTELIGENTE: LAPTOP vs PC OEM vs PC ENSAMBLADA vs SERVIDOR
    $Enclosure = Get-CimInstance Win32_SystemEnclosure -ErrorAction SilentlyContinue
    $Battery = Get-CimInstance Win32_Battery -ErrorAction SilentlyContinue

    $SysMfg = if ($ComputerSystem.Manufacturer) { $ComputerSystem.Manufacturer.Trim() } else { '' }
    $SysModel = if ($ComputerSystem.Model) { $ComputerSystem.Model.Trim() } else { '' }

    $DeviceType = 'pc'
    $Brand = 'Generico'
    $Model = 'Estacion de Trabajo'
    $CategoryLabel = 'PC de Escritorio'
    $ClassificationDetail = ''

    # A) Servidor
    if ($OSInfo.ProductType -eq 2 -or $OSInfo.ProductType -eq 3 -or $ComputerSystem.PCSystemType -eq 7 -or $Hostname -match '^(SRV|SERVER)') {
        $DeviceType = 'server'
        $CategoryLabel = 'Servidor Dedicado'
        $Brand = if ($SysMfg) { $SysMfg } else { 'Servidor' }
        $Model = if ($SysModel) { $SysModel } else { 'Rack / Tower' }
        $ClassificationDetail = "Servidor Corporativo ($Brand $Model)"
    } else {
        # B) Laptop / Portatil
        $isLaptop = $false
        $laptopChassis = @(8, 9, 10, 11, 12, 14, 18, 21, 30, 31, 32)
        if ($Enclosure.ChassisTypes) {
            foreach ($c in $Enclosure.ChassisTypes) {
                if ($laptopChassis -contains $c) { $isLaptop = $true }
            }
        }
        if ($ComputerSystem.PCSystemType -eq 2) { $isLaptop = $true }
        if ($Battery) { $isLaptop = $true }
        if ($SysModel -match '(Laptop|Notebook|Book|ThinkPad|EliteBook|ProBook|Latitude|Inspiron|IdeaPad|ZenBook|MacBook|Pavilion|Spectre|Envy)') { $isLaptop = $true }

        if ($isLaptop) {
            $DeviceType = 'laptop'
            $CategoryLabel = 'Laptop / Portatil'
            $Brand = if ($SysMfg -and $SysMfg -notmatch 'To Be Filled') { $SysMfg } else { 'Laptop' }
            $Model = if ($SysModel -and $SysModel -notmatch 'System Product') { $SysModel } else { 'Portatil' }
            $ClassificationDetail = "Laptop / Portatil ($Brand $Model)"
        } else {
            # C) PC de Escritorio: OEM de Marca vs Ensamblada
            $DeviceType = 'pc'
            $genericStrings = @('To Be Filled By O.E.M.', 'System manufacturer', 'System Product Name', 'Default string', 'All Series', 'None', '', 'OEM', 'Generic')
            
            $oemBrandsList = @('Dell', 'HP', 'Hewlett-Packard', 'Lenovo', 'Acer', 'Apple', 'Fujitsu', 'Compaq', 'Gateway', 'Toshiba', 'NEC')
            $isOemMatch = $false
            foreach ($oem in $oemBrandsList) {
                if ($SysMfg -match $oem -and $genericStrings -notcontains $SysMfg -and $genericStrings -notcontains $SysModel) {
                    $isOemMatch = $true
                    break
                }
            }

            # Fabricantes de motherboards comunes en PCs armadas/ensambladas
            $isMoboVendor = ($SysMfg -match '^(ASUS|ASUSTeK|GIGABYTE|MSI|Micro-Star|ASRock|BIOSTAR|COLORFUL|EVGA|NZXT|MAXSUN|SOYO|FOXCONN)') -or
                            ($genericStrings -contains $SysMfg) -or
                            ($genericStrings -contains $SysModel)

            if ($isOemMatch -and -not $isMoboVendor) {
                # Computadora OEM de marca de fabrica
                $CategoryLabel = 'PC de Escritorio OEM'
                $Brand = $SysMfg
                $Model = if ($SysModel) { $SysModel } else { 'Desktop OEM' }
                $ClassificationDetail = "PC de Escritorio OEM de Marca ($Brand $Model)"
            } else {
                # Computadora Ensamblada (Placa base comercial montada)
                $CategoryLabel = 'PC de Escritorio Ensamblada'
                $cleanMoboBrand = if ($MoboManufacturer -and $genericStrings -notcontains $MoboManufacturer) {
                    $MoboManufacturer.Replace('Technology Co., Ltd.','').Replace('COMPUTER INC.','').Trim()
                } else { 'Ensamblada' }
                
                $cleanMoboModel = if ($MoboProduct -and $genericStrings -notcontains $MoboProduct) {
                    $MoboProduct
                } else { 'Placa Base Estandar' }

                $Brand = "$cleanMoboBrand (Ensamblada)"
                $Model = $cleanMoboModel
                $ClassificationDetail = "PC de Escritorio Ensamblada (Placa: $MoboString)"
            }
        }
    }

    # 10. Construir Payload JSON
    $AuditData = @{
        hostname      = $Hostname
        deviceType    = $DeviceType
        brand         = $Brand
        model         = $Model
        motherboard   = $MoboString
        os            = $OSName
        ram           = $RAMString
        cpu           = $CPUString
        storage       = $StorageString
        ipAddress     = $IPAddress
        macAddress    = $MACAddress
        serialNumber  = $SerialNumber
        compatibility = $Compatibility
        assignedUser  = $AssignedUser
        department    = "Auditoria Automatizada"
        location      = "Red Local"
        notes         = "$ClassificationDetail • Red: $NetAdapterName"
    }

    $JsonPayload = $AuditData | ConvertTo-Json -Depth 3

    # 11. Transmitir al Servidor Tay-Audit
    $Endpoint = "$ServerUrl/api/agent/report"
    Write-Host "[*] Transmitiendo levantamiento a $Endpoint..." -ForegroundColor Cyan

    $Response = Invoke-RestMethod -Uri $Endpoint -Method Post -Body $JsonPayload -ContentType "application/json; charset=utf-8" -TimeoutSec 15

    Write-Host ""
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host " [EXITO] LEVANTAMIENTO REGISTRADO EN TIEMPO REAL!" -ForegroundColor Green
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host " Hostname       : $Hostname" -ForegroundColor White
    Write-Host " Clasificacion  : $CategoryLabel" -ForegroundColor Yellow
    Write-Host " Marca / Modelo : $Brand $Model" -ForegroundColor White
    Write-Host " Placa Madre    : $MoboString" -ForegroundColor White
    Write-Host " Direccion IP   : $IPAddress" -ForegroundColor Cyan
    Write-Host " Direccion MAC  : $MACAddress" -ForegroundColor Cyan
    Write-Host " Tarjeta de Red : $NetAdapterName" -ForegroundColor Gray
    Write-Host " Memoria RAM    : $RAMString" -ForegroundColor White
    Write-Host " Procesador     : $CPUString" -ForegroundColor White
    Write-Host " No. Serie BIOS : $SerialNumber" -ForegroundColor White
    Write-Host " Compatibilidad : $Compatibility" -ForegroundColor White
    Write-Host " Servidor Resp. : $($Response.message)" -ForegroundColor Green
    Write-Host "==========================================================" -ForegroundColor Green

} catch {
    Write-Host ""
    Write-Host "[ERROR] No se pudo enviar el levantamiento a Tay-Audit:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host "Verifique que el servidor Tay-Audit este activo en $ServerUrl" -ForegroundColor Yellow
    exit 1
}
