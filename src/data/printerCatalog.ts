// Catálogo Inteligente de Impresoras, Suministros (Tintas/Tóner) y Equipos Periféricos
// Base de datos predefinida corporativa para autocompletado y auto-detección instantánea

export interface PrinterCatalogItem {
  model: string;
  brand: string;
  technology: 'Inyección Continua (EcoTank/SmartTank)' | 'Láser Monocromático' | 'Láser Color' | 'Térmica de Etiquetas/Tickets' | 'Matricial';
  supplies: string; // Tinta / Tóner / Cartucho oficial compatible
  defaultConnection: 'Red Ethernet (IP)' | 'Wi-Fi / Red' | 'USB Local';
  description?: string;
}

export interface PeripheralCatalogItem {
  type: 'speaker' | 'ecran' | 'monitor';
  brand: string;
  model: string;
  specs: string;
  defaultLocation?: string;
}

// 1. BASE DE DATOS EXTENDIDA DE IMPRESORAS Y TINTAS/TÓNER
export const PRINTER_CATALOG: PrinterCatalogItem[] = [
  // EPSON ECOTANK & WORKFORCE
  {
    model: 'EcoTank L3250',
    brand: 'Epson',
    technology: 'Inyección Continua (EcoTank/SmartTank)',
    supplies: 'Botellas de Tinta Epson 544 (T544120 Negro, T544220 Cyan, T544320 Magenta, T544420 Amarillo)',
    defaultConnection: 'Wi-Fi / Red',
    description: 'Multifuncional inalámbrica tanque de tinta continuo'
  },
  {
    model: 'EcoTank L3210',
    brand: 'Epson',
    technology: 'Inyección Continua (EcoTank/SmartTank)',
    supplies: 'Botellas de Tinta Epson 544 (T544120 Negro, T544220 Cyan, T544320 Magenta, T544420 Amarillo)',
    defaultConnection: 'USB Local',
    description: 'Multifuncional 3 en 1 USB tanque continuo'
  },
  {
    model: 'EcoTank L3150',
    brand: 'Epson',
    technology: 'Inyección Continua (EcoTank/SmartTank)',
    supplies: 'Botellas de Tinta Epson 544 (T544 BK/C/M/Y)',
    defaultConnection: 'Wi-Fi / Red',
    description: 'Multifuncional inalámbrica Wi-Fi Direct'
  },
  {
    model: 'EcoTank L3110',
    brand: 'Epson',
    technology: 'Inyección Continua (EcoTank/SmartTank)',
    supplies: 'Botellas de Tinta Epson 544 (T544 BK/C/M/Y)',
    defaultConnection: 'USB Local',
    description: 'Multifuncional compacta USB'
  },
  {
    model: 'EcoTank L4260',
    brand: 'Epson',
    technology: 'Inyección Continua (EcoTank/SmartTank)',
    supplies: 'Tinta Negra Pigmentada Epson 504 (T504120) + Tintas Color Epson 544 (Cyan, Magenta, Amarillo)',
    defaultConnection: 'Wi-Fi / Red',
    description: 'Doble faz automático (Dúplex) y Wi-Fi Direct'
  },
  {
    model: 'EcoTank L4160',
    brand: 'Epson',
    technology: 'Inyección Continua (EcoTank/SmartTank)',
    supplies: 'Tinta Negra Pigmentada Epson 504 + Color Epson 504 (Cyan, Magenta, Amarillo)',
    defaultConnection: 'Wi-Fi / Red',
    description: 'Impresión dúplex automática'
  },
  {
    model: 'EcoTank L5290',
    brand: 'Epson',
    technology: 'Inyección Continua (EcoTank/SmartTank)',
    supplies: 'Botellas de Tinta Epson 544 (T544 BK/C/M/Y)',
    defaultConnection: 'Red Ethernet (IP)',
    description: 'Multifuncional con ADF y Ethernet para oficina'
  },
  {
    model: 'EcoTank L5190',
    brand: 'Epson',
    technology: 'Inyección Continua (EcoTank/SmartTank)',
    supplies: 'Botellas de Tinta Epson 544 (T544 BK/C/M/Y)',
    defaultConnection: 'Red Ethernet (IP)',
    description: 'Multifuncional de red con alimentador de hojas ADF'
  },
  {
    model: 'EcoTank L6270',
    brand: 'Epson',
    technology: 'Inyección Continua (EcoTank/SmartTank)',
    supplies: 'Botellas de Tinta Epson 504 (Negro pigmentado y Colores CMY)',
    defaultConnection: 'Red Ethernet (IP)',
    description: 'Alto rendimiento corporativo con PrecisionCore'
  },
  {
    model: 'EcoTank L8050',
    brand: 'Epson',
    technology: 'Inyección Continua (EcoTank/SmartTank)',
    supplies: 'Botellas de Tinta Fotográfica Epson 108 (6 colores: BK, C, M, Y, LC, LM)',
    defaultConnection: 'Wi-Fi / Red',
    description: 'Impresora fotográfica de 6 colores A4/PVC'
  },
  {
    model: 'EcoTank L805',
    brand: 'Epson',
    technology: 'Inyección Continua (EcoTank/SmartTank)',
    supplies: 'Botellas de Tinta Fotográfica Epson 673 (6 colores: T6731-T6736)',
    defaultConnection: 'Wi-Fi / Red',
    description: 'Fotográfica 6 colores continua'
  },
  {
    model: 'EcoTank L14150',
    brand: 'Epson',
    technology: 'Inyección Continua (EcoTank/SmartTank)',
    supplies: 'Tinta Negra Pigmentada Epson 504 + Tintas Color Epson 504 (A3+)',
    defaultConnection: 'Red Ethernet (IP)',
    description: 'Multifuncional formato ancho A3+'
  },
  {
    model: 'EcoTank M1120 / M2120 / M3170',
    brand: 'Epson',
    technology: 'Inyección Continua (EcoTank/SmartTank)',
    supplies: 'Botellas de Tinta Negra Monocromática Epson 534 (T534120) / 534XL',
    defaultConnection: 'Red Ethernet (IP)',
    description: 'Monocromática de ultra bajo costo para oficina'
  },
  {
    model: 'WorkForce Pro WF-C5790 / WF-C5890',
    brand: 'Epson',
    technology: 'Inyección Continua (EcoTank/SmartTank)',
    supplies: 'Bolsas de Tinta DURABrite Ultra Epson T941 / T942 / T11A (Alta Capacidad)',
    defaultConnection: 'Red Ethernet (IP)',
    description: 'Workgroup corporativo alta velocidad'
  },
  {
    model: 'TM-T20III / TM-T88VI (Térmica)',
    brand: 'Epson',
    technology: 'Térmica de Etiquetas/Tickets',
    supplies: 'Rollos de Papel Térmico Directo 80mm x 80m (Sin cartucho de tinta)',
    defaultConnection: 'Red Ethernet (IP)',
    description: 'Impresora de tickets POS punto de venta'
  },
  {
    model: 'LX-350 (Matricial)',
    brand: 'Epson',
    technology: 'Matricial',
    supplies: 'Cinta Matricial Epson S015631 Negra (9 pines / 4 millones de caracteres)',
    defaultConnection: 'USB Local',
    description: 'Impresora matricial para formularios continuos y facturas'
  },

  // HP (HEWLETT-PACKARD)
  {
    model: 'LaserJet Pro M404n / M404dw',
    brand: 'HP',
    technology: 'Láser Monocromático',
    supplies: 'Cartucho de Tóner HP 58A (CF258A - 3,000 pág) / HP 58X (CF258X - 10,000 pág)',
    defaultConnection: 'Red Ethernet (IP)',
    description: 'Impresora láser corporativa monocromática de alta velocidad'
  },
  {
    model: 'LaserJet Pro MFP M428fdw',
    brand: 'HP',
    technology: 'Láser Monocromático',
    supplies: 'Cartucho de Tóner HP 58A (CF258A) / Tóner HP 58X (CF258X)',
    defaultConnection: 'Red Ethernet (IP)',
    description: 'Multifuncional láser dúplex con escáner de red'
  },
  {
    model: 'LaserJet Pro M402n / M402dn',
    brand: 'HP',
    technology: 'Láser Monocromático',
    supplies: 'Cartucho de Tóner HP 26A (CF226A) / HP 26X (CF226X)',
    defaultConnection: 'Red Ethernet (IP)',
    description: 'Láser monocromática de oficina'
  },
  {
    model: 'LaserJet Pro MFP M426fdw',
    brand: 'HP',
    technology: 'Láser Monocromático',
    supplies: 'Cartucho de Tóner HP 26A (CF226A) / HP 26X (CF226X)',
    defaultConnection: 'Red Ethernet (IP)',
    description: 'Multifuncional láser empresarial 4 en 1'
  },
  {
    model: 'LaserJet P1102 / P1102w',
    brand: 'HP',
    technology: 'Láser Monocromático',
    supplies: 'Cartucho de Tóner HP 85A (CE285A - 1,600 páginas)',
    defaultConnection: 'USB Local',
    description: 'Láser personal monocromática estándar'
  },
  {
    model: 'LaserJet Pro M15w / MFP M28w',
    brand: 'HP',
    technology: 'Láser Monocromático',
    supplies: 'Cartucho de Tóner HP 48A (CF248A - 1,000 páginas)',
    defaultConnection: 'Wi-Fi / Red',
    description: 'Láser compacta ultra pequeña'
  },
  {
    model: 'LaserJet Pro M102w / MFP M130fw',
    brand: 'HP',
    technology: 'Láser Monocromático',
    supplies: 'Tóner HP 17A (CF217A) + Unidad de Tambor HP 19A (CF219A)',
    defaultConnection: 'Red Ethernet (IP)',
    description: 'Láser JetIntelligence'
  },
  {
    model: 'Neverstop Laser 1000w / MFP 1200w',
    brand: 'HP',
    technology: 'Láser Monocromático',
    supplies: 'Kit de Recarga de Tóner Original HP 103A (W1103A - 2,500 páginas)',
    defaultConnection: 'Wi-Fi / Red',
    description: 'Láser de tanque de tóner recargable'
  },
  {
    model: 'Smart Tank 515 / 530 / 615',
    brand: 'HP',
    technology: 'Inyección Continua (EcoTank/SmartTank)',
    supplies: 'Botella Tinta Negra HP GT53 / GT53XL + Botellas Color HP GT52 (Cyan, Magenta, Amarillo)',
    defaultConnection: 'Wi-Fi / Red',
    description: 'Multifuncional inalámbrica tanque continuo'
  },
  {
    model: 'Smart Tank 580 / 585 / 720 / 750',
    brand: 'HP',
    technology: 'Inyección Continua (EcoTank/SmartTank)',
    supplies: 'Botellas de Tinta HP GT53 (Negro) y HP GT52 (C/M/Y)',
    defaultConnection: 'Wi-Fi / Red',
    description: 'Multifuncional Smart Tank autorreparable'
  },
  {
    model: 'LaserJet Enterprise M506 / M527',
    brand: 'HP',
    technology: 'Láser Monocromático',
    supplies: 'Cartucho de Tóner HP 87A (CF287A) / HP 87X (CF287X - 18,000 pág)',
    defaultConnection: 'Red Ethernet (IP)',
    description: 'Láser empresarial de alto volumen'
  },

  // BROTHER
  {
    model: 'DCP-T520W / DCP-T720DW / MFC-T920DW',
    brand: 'Brother',
    technology: 'Inyección Continua (EcoTank/SmartTank)',
    supplies: 'Botella Tinta Negra Brother BTD60BK + Botellas Color Brother BT5001 (C/M/Y)',
    defaultConnection: 'Wi-Fi / Red',
    description: 'Multifuncional de inyección continua InkBenefit Tank'
  },
  {
    model: 'DCP-T510W / DCP-T310 / DCP-T710W',
    brand: 'Brother',
    technology: 'Inyección Continua (EcoTank/SmartTank)',
    supplies: 'Botella Tinta Negra Brother BTD60BK + Botellas Color Brother BT5000 (C/M/Y)',
    defaultConnection: 'Wi-Fi / Red',
    description: 'Tanque continuo para pymes y oficinas'
  },
  {
    model: 'HL-1212W / DCP-1617NW',
    brand: 'Brother',
    technology: 'Láser Monocromático',
    supplies: 'Cartucho de Tóner Brother TN-1060 + Unidad de Tambor Brother DR-1060',
    defaultConnection: 'Wi-Fi / Red',
    description: 'Láser monocromática compacta con tambor independiente'
  },
  {
    model: 'HL-L2320D / HL-L2360DW / DCP-L2540DW',
    brand: 'Brother',
    technology: 'Láser Monocromático',
    supplies: 'Cartucho de Tóner Brother TN-660 / TN-2370 (2,600 pág) + Tambor DR-630',
    defaultConnection: 'Red Ethernet (IP)',
    description: 'Láser dúplex de alta confiabilidad'
  },
  {
    model: 'HL-L5100DN / DCP-L5650DN / MFC-L5900DW',
    brand: 'Brother',
    technology: 'Láser Monocromático',
    supplies: 'Tóner Brother TN-3479 / TN-3449 (8,000 pág) + Tambor DR-3460 (50,000 pág)',
    defaultConnection: 'Red Ethernet (IP)',
    description: 'Láser de alto rendimiento para centros de cómputo'
  },

  // CANON
  {
    model: 'PIXMA G3110 / G2110 / G4110',
    brand: 'Canon',
    technology: 'Inyección Continua (EcoTank/SmartTank)',
    supplies: 'Botellas de Tinta Canon GI-190 (Negro 135ml, Cyan, Magenta, Amarillo)',
    defaultConnection: 'Wi-Fi / Red',
    description: 'MegaTank sistema de tanques integrados'
  },
  {
    model: 'PIXMA G3160 / G2160 / G6010',
    brand: 'Canon',
    technology: 'Inyección Continua (EcoTank/SmartTank)',
    supplies: 'Botellas de Tinta Canon GI-11 (Negro pigmentado y Colores CMY)',
    defaultConnection: 'Wi-Fi / Red',
    description: 'MegaTank con cabezales reemplazables'
  },
  {
    model: 'imageRUNNER 2520 / 2525 / 2530',
    brand: 'Canon',
    technology: 'Láser Monocromático',
    supplies: 'Tóner Canon GPR-35 / NPG-51 (14,600 páginas)',
    defaultConnection: 'Red Ethernet (IP)',
    description: 'Fotocopiadora multifuncional departamental A3'
  },

  // KYOCERA
  {
    model: 'ECOSYS M2040dn / M2540dn / M2640idw',
    brand: 'Kyocera',
    technology: 'Láser Monocromático',
    supplies: 'Cartucho de Tóner Kyocera TK-1175 (7,200 páginas)',
    defaultConnection: 'Red Ethernet (IP)',
    description: 'Multifuncional láser robusto de componentes de larga vida'
  },
  {
    model: 'ECOSYS M2135dn / P2035d',
    brand: 'Kyocera',
    technology: 'Láser Monocromático',
    supplies: 'Cartucho de Tóner Kyocera TK-1157 (3,000 páginas)',
    defaultConnection: 'Red Ethernet (IP)',
    description: 'Láser corporativo duradero'
  },

  // ZEBRA (TÉRMICAS DE ETIQUETAS)
  {
    model: 'ZD220 / ZD230',
    brand: 'Zebra',
    technology: 'Térmica de Etiquetas/Tickets',
    supplies: 'Ribbon de Cera 110mm x 74m / Rollo de Etiquetas Térmicas 100mm x 50mm',
    defaultConnection: 'USB Local',
    description: 'Impresora de código de barras y etiquetas de escritorio'
  },
  {
    model: 'GC420t / GK420t',
    brand: 'Zebra',
    technology: 'Térmica de Etiquetas/Tickets',
    supplies: 'Ribbon de Cera / Resina 110mm x 74m',
    defaultConnection: 'Red Ethernet (IP)',
    description: 'Impresora industrial ligera de códigos de barra'
  }
];

// 2. BASE DE DATOS DE PARLANTES Y AUDIO
export const SPEAKER_PRESETS: PeripheralCatalogItem[] = [
  {
    type: 'speaker',
    brand: 'Logitech',
    model: 'Z207 Bluetooth Stereo',
    specs: 'Parlantes estéreo 10W Pico (5W RMS), Conexión Bluetooth 5.0 + Jack 3.5mm, Alimentación directa'
  },
  {
    type: 'speaker',
    brand: 'Logitech',
    model: 'Z120 USB',
    specs: 'Parlantes estéreo compactos USB 2.0 (1.2W RMS), Conector audio 3.5mm estéreo'
  },
  {
    type: 'speaker',
    brand: 'JBL',
    model: 'Flip 6 Portátil',
    specs: 'Altavoz Bluetooth 5.1 portátil resistente al agua IP67, Batería 12h, Potencia 30W RMS'
  },
  {
    type: 'speaker',
    brand: 'Jabra',
    model: 'Speak 510 Conferencia',
    specs: 'Altavoz manos libres para salas de reunión y Zoom/Teams, Bluetooth + USB, Micrófono 360°'
  },
  {
    type: 'speaker',
    brand: 'Sony',
    model: 'SRS-XB13',
    specs: 'Altavoz inalámbrico compacto Bluetooth, Batería 16h, Extra Bass'
  },
  {
    type: 'speaker',
    brand: 'Edifier',
    model: 'R1280T Monitor de Estudio',
    specs: 'Parlantes de estantería 42W RMS, Entradas RCA duales, Control remoto'
  }
];

// 3. BASE DE DATOS DE ECRAN Y PANTALLAS DE PROYECCIÓN
export const ECRAN_PRESETS: PeripheralCatalogItem[] = [
  {
    type: 'ecran',
    brand: 'KlipXtreme',
    model: 'KPS-310 Manual Retráctil 100"',
    specs: 'Pantalla de proyección retráctil manual para pared o techo, Medida: 100 pulgadas (2.00m x 1.50m), Formato 4:3 Blanco Mate'
  },
  {
    type: 'ecran',
    brand: 'KlipXtreme',
    model: 'KPS-500 Motorizado Eléctrico 120"',
    specs: 'Pantalla eléctrica motorizada con control remoto inalámbrico, Medida: 120 pulgadas (2.40m x 1.80m), Formato 16:9 / 4:3'
  },
  {
    type: 'ecran',
    brand: 'Elite Screens',
    model: 'Manual B Series 120"',
    specs: 'Pantalla retráctil de alta ganancia MaxWhite 1.1, Medida: 120 pulgadas (2.65m x 1.49m), Formato 16:9'
  },
  {
    type: 'ecran',
    brand: 'Da-Lite',
    model: 'Trípode Portátil 84"',
    specs: 'Pantalla móvil con pedestal trípode metálico plegable, Medida: 84 pulgadas (1.70m x 1.27m)'
  },
  {
    type: 'ecran',
    brand: 'Genérico',
    model: 'Ecran Retráctil de Pared 100"',
    specs: 'Pantalla manual con bloqueo automático a cualquier altura, 100 pulgadas tela vinil blanco mate'
  }
];

// Búsqueda inteligente de impresoras
export function searchPrinterCatalog(query: string): PrinterCatalogItem[] {
  if (!query || query.trim().length === 0) return PRINTER_CATALOG.slice(0, 8);
  const q = query.toLowerCase().trim();
  return PRINTER_CATALOG.filter(p => 
    p.model.toLowerCase().includes(q) ||
    p.brand.toLowerCase().includes(q) ||
    p.supplies.toLowerCase().includes(q) ||
    (p.description && p.description.toLowerCase().includes(q))
  );
}
