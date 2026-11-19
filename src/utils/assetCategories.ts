import type { Device, DeviceType } from '../types';

/**
 * Utilidades para clasificación inteligente de bienes en TayAudit.
 * Permite diferenciar entre equipos de cómputo (PC, Laptop, Servidor),
 * equipos de red, impresoras, y periféricos/bienes pasivos (parlantes,
 * ecrans, monitores, accesorios de hardware).
 */

export const isComputerType = (type?: DeviceType | string): boolean => {
  return type === 'pc' || type === 'laptop' || type === 'server';
};

export const isNetworkType = (type?: DeviceType | string): boolean => {
  return type === 'network';
};

export const isPrinterType = (type?: DeviceType | string): boolean => {
  return type === 'printer';
};

export const isSpeakerType = (type?: DeviceType | string): boolean => {
  if (!type) return false;
  const t = type.toLowerCase().trim();
  return t === 'speaker' || t === 'parlante' || t === 'audio' || t === 'altavoz';
};

export const isEcranType = (type?: DeviceType | string): boolean => {
  if (!type) return false;
  const t = type.toLowerCase().trim();
  return t === 'ecran' || t === 'proyector' || t === 'projector' || t === 'pantalla de proyeccion';
};

export const isMonitorType = (type?: DeviceType | string): boolean => {
  if (!type) return false;
  const t = type.toLowerCase().trim();
  return t === 'monitor' || t === 'pantalla' || t === 'display';
};

export const isComponentType = (type?: DeviceType | string): boolean => {
  if (!type) return false;
  const t = type.toLowerCase().trim();
  return t === 'component' || t === 'hardware' || t === 'disco' || t === 'ram';
};

/**
 * Detecta inteligentemente la categoría real de un bien a partir de sus metadatos
 * (hostname, marca, modelo, especificaciones, etc.) incluso si fue registrado con
 * un deviceType genérico ('pc', 'other' o no especificado).
 */
export const detectSmartCategory = (device?: Partial<Device> | null): DeviceType => {
  if (!device) return 'pc';
  const rawType = (device.deviceType || '').toLowerCase().trim();

  // Si ya tiene un tipo específico y distinto a 'pc'/'other', respetarlo
  if (
    rawType === 'laptop' ||
    rawType === 'server' ||
    rawType === 'printer' ||
    rawType === 'network' ||
    rawType === 'speaker' ||
    rawType === 'ecran' ||
    rawType === 'monitor' ||
    rawType === 'component'
  ) {
    return rawType as DeviceType;
  }

  // Texto consolidado para análisis semántico inteligente
  const text = `${device.hostname || ''} ${device.brand || ''} ${device.model || ''} ${device.specs || ''} ${device.os || ''}`.toLowerCase();

  // 1. Parlantes y Periféricos de Audio
  if (/speaker|parlante|altavoz|soundbar|z207|audio stereo|bluetooth stereo|logitech z/i.test(text)) {
    return 'speaker';
  }

  // 2. Ecrans y Pantallas de Proyección
  if (/ecran|proyector|projector|telon|pantalla de proyecci|kps-310/i.test(text)) {
    return 'ecran';
  }

  // 3. Monitores pasivos (que no son laptop)
  if (/monitor|pantalla|display|viewsonic|led 2|curved|ips 2|fhd 2|p2419h/i.test(text) && !/laptop|notebook/i.test(text)) {
    return 'monitor';
  }

  // 4. Impresoras y Multifuncionales
  if (/impresora|printer|epson|laserjet|deskjet|ecotank|brother|canon pixma/i.test(text)) {
    return 'printer';
  }

  // 5. Redes y Telecomunicaciones
  if (/switch|router|access point|mikrotik|cisco|patch panel|firewall|fortinet/i.test(text)) {
    return 'network';
  }

  // 6. Componentes de Hardware Sueltos
  if (/disco duro|ssd nvme|ddr[345]|memoria ram|tarjeta de video|fuente de poder|motherboard/i.test(text) && !/desktop|pc|laptop/i.test(text)) {
    return 'component';
  }

  // 7. Laptops
  if (/laptop|notebook|thinkpad|macbook|latitude|elitebook|probook/i.test(text)) {
    return 'laptop';
  }

  // 8. Servidores
  if (/servidor|server|poweredge|proliant|blade/i.test(text)) {
    return 'server';
  }

  return (device.deviceType as DeviceType) || 'pc';
};

/**
 * Determina si el bien cuenta con especificaciones de cómputo (CPU, RAM, Disco, Placa Madre).
 */
export const supportsComputeSpecs = (type?: DeviceType | string, device?: Partial<Device>): boolean => {
  if (device) {
    const smartType = detectSmartCategory(device);
    return isComputerType(smartType);
  }
  return isComputerType(type);
};

/**
 * Determina si el bien maneja dirección de red IP / MAC.
 */
export const supportsNetworkAddress = (type?: DeviceType | string, device?: Partial<Device>): boolean => {
  const targetType = device ? detectSmartCategory(device) : type;
  return isComputerType(targetType) || isNetworkType(targetType) || isPrinterType(targetType);
};

/**
 * Valida si una dirección IP es real y no un valor por defecto / dummy.
 */
export const isValidIpAddress = (ip?: string | null): boolean => {
  if (!ip) return false;
  const clean = ip.trim().toLowerCase();
  if (
    !clean ||
    clean === '0.0.0.0' ||
    clean === '0' ||
    clean === 'n/a' ||
    clean === 'lan' ||
    clean === 'usb' ||
    clean === 'sin ip' ||
    clean === 'no detectado' ||
    clean === 'no detectada' ||
    clean === '127.0.0.1' // localhost dummy
  ) {
    return false;
  }
  return true;
};

/**
 * Valida si una dirección MAC es real y no un dummy de ceros.
 */
export const isValidMacAddress = (mac?: string | null): boolean => {
  if (!mac) return false;
  const clean = mac.trim().toLowerCase();
  if (
    !clean ||
    clean === '00:00:00:00:00:00' ||
    clean === '00-00-00-00-00-00' ||
    clean === 'n/a' ||
    clean === 'no detectada' ||
    clean === 'no detectado' ||
    clean === 'sin mac'
  ) {
    return false;
  }
  return true;
};

/**
 * Valida si la memoria RAM es un dato real de cómputo.
 */
export const isValidRam = (ram?: string | null): boolean => {
  if (!ram) return false;
  const clean = ram.trim().toLowerCase();
  return (
    clean !== '' &&
    clean !== 'n/a' &&
    clean !== 'no detectada' &&
    clean !== 'no especificada' &&
    clean !== '0' &&
    clean !== '0 gb' &&
    clean !== 'no detectado'
  );
};

/**
 * Valida si el almacenamiento es un dato real de cómputo.
 */
export const isValidStorage = (storage?: string | null): boolean => {
  if (!storage) return false;
  const clean = storage.trim().toLowerCase();
  return (
    clean !== '' &&
    clean !== 'n/a' &&
    clean !== 'no detectado' &&
    clean !== 'no especificado' &&
    clean !== 'disco estándar' &&
    clean !== '0 gb' &&
    clean !== 'disco estandar'
  );
};

/**
 * Retorna etiquetas y valores inteligentes para mostrar en fichas y tarjetas.
 */
export interface AssetSmartFields {
  box1Label: string;
  box1Value: string;
  box2Label: string;
  box2Value: string;
  box3Label: string;
  box3Value: string;
  box4Label: string;
  box4Value: string;
  categoryBadge: string;
  showComputeSpecs: boolean;
  showNetworkSpecs: boolean;
}

export const getAssetSmartFields = (device: Device): AssetSmartFields => {
  const type = detectSmartCategory(device);
  const sn = device.serialNumber || device.barcode || 'Sin S/N';
  const location = device.location || 'Sede Central';

  if (isSpeakerType(type)) {
    return {
      box1Label: 'S/N:',
      box1Value: sn,
      box2Label: 'CONEXIÓN / AUDIO:',
      box2Value: device.specs || (device.brand && device.model ? `${device.brand} ${device.model}` : 'Parlantes de Audio'),
      box3Label: 'TIPO DE BIEN:',
      box3Value: 'Sistema de Audio / Parlantes',
      box4Label: 'UBICACIÓN:',
      box4Value: location,
      categoryBadge: 'Audio / Parlante',
      showComputeSpecs: false,
      showNetworkSpecs: false
    };
  }

  if (isMonitorType(type)) {
    return {
      box1Label: 'S/N:',
      box1Value: sn,
      box2Label: 'PANTALLA / ENTRADAS:',
      box2Value: device.specs || (device.brand && device.model ? `${device.brand} ${device.model}` : 'Monitor Display'),
      box3Label: 'TIPO DE BIEN:',
      box3Value: 'Monitor / Pantalla',
      box4Label: 'UBICACIÓN:',
      box4Value: location,
      categoryBadge: 'Monitor / Display',
      showComputeSpecs: false,
      showNetworkSpecs: false
    };
  }

  if (isEcranType(type)) {
    return {
      box1Label: 'S/N:',
      box1Value: sn,
      box2Label: 'MEDIDAS / FORMATO:',
      box2Value: device.specs || (device.brand && device.model ? `${device.brand} ${device.model}` : 'Pantalla de Proyección'),
      box3Label: 'TIPO DE BIEN:',
      box3Value: 'Ecran / Proyección',
      box4Label: 'UBICACIÓN:',
      box4Value: location,
      categoryBadge: 'Ecran',
      showComputeSpecs: false,
      showNetworkSpecs: false
    };
  }

  if (isPrinterType(type)) {
    const hasIp = isValidIpAddress(device.ipAddress);
    return {
      box1Label: 'S/N:',
      box1Value: sn,
      box2Label: 'SUMINISTROS:',
      box2Value: device.supplies || 'Tinta / Tóner Estándar',
      box3Label: hasIp ? 'IP DE RED:' : 'CONEXIÓN:',
      box3Value: hasIp ? device.ipAddress : 'Conexión USB / Local',
      box4Label: 'UBICACIÓN:',
      box4Value: location,
      categoryBadge: 'Impresora',
      showComputeSpecs: false,
      showNetworkSpecs: hasIp
    };
  }

  if (isComponentType(type)) {
    return {
      box1Label: 'S/N:',
      box1Value: sn,
      box2Label: 'ESPECIFICACIONES:',
      box2Value: device.specs || device.storage || (device.brand && device.model ? `${device.brand} ${device.model}` : 'Hardware'),
      box3Label: 'CATEGORÍA:',
      box3Value: device.os || 'Componente de Cómputo',
      box4Label: 'UBICACIÓN:',
      box4Value: location,
      categoryBadge: 'Hardware',
      showComputeSpecs: false,
      showNetworkSpecs: false
    };
  }

  if (isNetworkType(type)) {
    const hasIp = isValidIpAddress(device.ipAddress);
    return {
      box1Label: 'S/N:',
      box1Value: sn,
      box2Label: 'MODELO / PUERTOS:',
      box2Value: device.specs || (device.brand && device.model ? `${device.brand} ${device.model}` : 'Equipo de Red'),
      box3Label: 'IP / RED:',
      box3Value: hasIp ? device.ipAddress : 'LAN',
      box4Label: 'UBICACIÓN:',
      box4Value: location,
      categoryBadge: 'Red / Switch',
      showComputeSpecs: false,
      showNetworkSpecs: true
    };
  }

  // Fallback para computadoras (PC, Laptop, Servidor)
  const ramText = isValidRam(device.ram) ? device.ram : '8 GB';
  const diskText = isValidStorage(device.storage) ? device.storage : 'Almacenamiento';
  const hasIp = isValidIpAddress(device.ipAddress);

  return {
    box1Label: 'S/N:',
    box1Value: sn,
    box2Label: 'RAM & DISCO:',
    box2Value: `${ramText} • ${diskText}`,
    box3Label: 'IP / MAC:',
    box3Value: hasIp ? device.ipAddress : '127.0.0.1',
    box4Label: 'UBICACIÓN:',
    box4Value: location,
    categoryBadge: type === 'laptop' ? 'Laptop' : type === 'server' ? 'Servidor' : 'PC Escritorio',
    showComputeSpecs: true,
    showNetworkSpecs: true
  };
};

