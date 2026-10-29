export type HardwareComponentKey =
  | 'cpu'
  | 'ram'
  | 'storage'
  | 'motherboard'
  | 'gpu'
  | 'psu'
  | 'keyboard'
  | 'mouse'
  | 'headset'
  | 'cooler'
  | 'case'
  | 'ups'
  | 'nic';

export interface ComponentFieldConfig {
  key: string;
  label: string;
  type: 'select' | 'text';
  options?: string[];
  placeholder?: string;
  defaultValue: string;
  required?: boolean;
}

export interface ComponentPreset {
  label: string;
  brand: string;
  model: string;
  fields: Record<string, string>;
}

export interface HardwareComponentDefinition {
  id: HardwareComponentKey;
  label: string;
  shortLabel: string;
  subtitle: string;
  codePrefix: string;
  dotColor: string;
  defaultBrand: string;
  defaultModel: string;
  brandPlaceholder: string;
  modelPlaceholder: string;
  fields: ComponentFieldConfig[];
  presets: ComponentPreset[];
}

export const HARDWARE_COMPONENTS_CATALOG: HardwareComponentDefinition[] = [
  {
    id: 'cpu',
    label: 'Procesador (CPU)',
    shortLabel: 'Procesador CPU',
    subtitle: 'Socket, núcleos/hilos, frecuencia y gráficos integrados',
    codePrefix: 'CPU',
    dotColor: '#f59e0b',
    defaultBrand: 'Intel',
    defaultModel: 'Core i5-12400',
    brandPlaceholder: 'Intel, AMD...',
    modelPlaceholder: 'Ej: Core i5-12400, Ryzen 5 5600G, Xeon Silver',
    fields: [
      {
        key: 'socket',
        label: 'Socket *',
        type: 'select',
        options: [
          'LGA 1700 (Intel 12va-14va Gen)',
          'LGA 1200 (Intel 10ma-11va Gen)',
          'LGA 1151 (Intel 6ta-9na Gen)',
          'AM5 (AMD Ryzen 7000/9000)',
          'AM4 (AMD Ryzen 1000-5000)',
          'Servidor (Xeon / EPYC)',
          'Otro Socket'
        ],
        defaultValue: 'LGA 1700 (Intel 12va-14va Gen)',
        required: true
      },
      {
        key: 'coresThreads',
        label: 'Núcleos / Hilos *',
        type: 'text',
        placeholder: 'Ej: 6 Núcleos / 12 Hilos',
        defaultValue: '6 Núcleos / 12 Hilos',
        required: true
      },
      {
        key: 'frequency',
        label: 'Frecuencia Base / Turbo',
        type: 'text',
        placeholder: 'Ej: 2.5 GHz / 4.4 GHz',
        defaultValue: '2.5 GHz Base / 4.4 GHz Turbo'
      },
      {
        key: 'igpu',
        label: 'Gráficos Integrados',
        type: 'select',
        options: [
          'Con Gráficos Integrados (iGPU)',
          'Sin Gráficos (Serie F / Requiere GPU)',
          'Gráficos Radeon Integrados (APU)'
        ],
        defaultValue: 'Con Gráficos Integrados (iGPU)'
      }
    ],
    presets: [
      {
        label: 'Intel Core i5-12400',
        brand: 'Intel',
        model: 'Core i5-12400',
        fields: {
          socket: 'LGA 1700 (Intel 12va-14va Gen)',
          coresThreads: '6 Núcleos / 12 Hilos',
          frequency: '2.5 GHz / 4.4 GHz',
          igpu: 'Con Gráficos Integrados (iGPU)'
        }
      },
      {
        label: 'Intel Core i7-13700',
        brand: 'Intel',
        model: 'Core i7-13700',
        fields: {
          socket: 'LGA 1700 (Intel 12va-14va Gen)',
          coresThreads: '16 Núcleos / 24 Hilos',
          frequency: '2.1 GHz / 5.2 GHz',
          igpu: 'Con Gráficos Integrados (iGPU)'
        }
      },
      {
        label: 'AMD Ryzen 5 5600G',
        brand: 'AMD',
        model: 'Ryzen 5 5600G',
        fields: {
          socket: 'AM4 (AMD Ryzen 1000-5000)',
          coresThreads: '6 Núcleos / 12 Hilos',
          frequency: '3.9 GHz / 4.4 GHz',
          igpu: 'Gráficos Radeon Integrados (APU)'
        }
      }
    ]
  },
  {
    id: 'ram',
    label: 'Memoria RAM',
    shortLabel: 'Memoria RAM',
    subtitle: 'Capacidad GB, tecnología DDR, formato DIMM/SO-DIMM y MHz',
    codePrefix: 'RAM',
    dotColor: '#10b981',
    defaultBrand: 'Kingston',
    defaultModel: 'Fury Beast',
    brandPlaceholder: 'Kingston, Crucial, Corsair, Samsung...',
    modelPlaceholder: 'Ej: Fury Beast, ValueRAM, Vengeance LPX',
    fields: [
      {
        key: 'capacity',
        label: 'Capacidad *',
        type: 'select',
        options: ['4 GB', '8 GB', '16 GB', '32 GB', '64 GB', 'Kit 2x8 GB (16 GB)', 'Kit 2x16 GB (32 GB)'],
        defaultValue: '16 GB',
        required: true
      },
      {
        key: 'ddrType',
        label: 'Tecnología DDR *',
        type: 'select',
        options: ['DDR4', 'DDR5', 'DDR3', 'DDR3L (1.35V)', 'ECC Registrada (Servidor)'],
        defaultValue: 'DDR4',
        required: true
      },
      {
        key: 'formFactor',
        label: 'Formato de Módulo *',
        type: 'select',
        options: ['UDIMM (PC de Escritorio)', 'SO-DIMM (Laptop / Todo en Uno)', 'RDIMM (Servidor)'],
        defaultValue: 'UDIMM (PC de Escritorio)',
        required: true
      },
      {
        key: 'speed',
        label: 'Velocidad / Frecuencia',
        type: 'text',
        placeholder: 'Ej: 3200 MHz, 4800 MHz, 5600 MHz',
        defaultValue: '3200 MHz'
      }
    ],
    presets: [
      {
        label: 'Kingston 16GB DDR4 Desktop',
        brand: 'Kingston',
        model: 'Fury Beast KF432C16BB/16',
        fields: { capacity: '16 GB', ddrType: 'DDR4', formFactor: 'UDIMM (PC de Escritorio)', speed: '3200 MHz' }
      },
      {
        label: 'Crucial 8GB DDR4 Laptop',
        brand: 'Crucial',
        model: 'CT8G4SFRA32A',
        fields: { capacity: '8 GB', ddrType: 'DDR4', formFactor: 'SO-DIMM (Laptop / Todo en Uno)', speed: '3200 MHz' }
      },
      {
        label: 'Kingston 16GB DDR5 Desktop',
        brand: 'Kingston',
        model: 'Fury Beast DDR5',
        fields: { capacity: '16 GB', ddrType: 'DDR5', formFactor: 'UDIMM (PC de Escritorio)', speed: '5600 MHz' }
      }
    ]
  },
  {
    id: 'storage',
    label: 'Disco / Almacenamiento (SSD / NVMe / HDD)',
    shortLabel: 'Almacenamiento',
    subtitle: 'Tipo M.2 NVMe / SSD SATA / HDD, capacidad, interfaz y salud',
    codePrefix: 'SSD',
    dotColor: '#38bdf8',
    defaultBrand: 'Kingston',
    defaultModel: 'NV2 M.2 PCIe 4.0',
    brandPlaceholder: 'Kingston, Western Digital, Samsung, Seagate...',
    modelPlaceholder: 'Ej: NV2, WD Blue SN580, 870 EVO, BarraCuda',
    fields: [
      {
        key: 'driveType',
        label: 'Tipo de Unidad *',
        type: 'select',
        options: [
          'SSD M.2 NVMe',
          'SSD 2.5" SATA',
          'SSD M.2 SATA',
          'Disco Duro HDD 3.5" (PC / NAS)',
          'Disco Duro HDD 2.5" (Laptop)',
          'Unidad Externa Portátil USB'
        ],
        defaultValue: 'SSD M.2 NVMe',
        required: true
      },
      {
        key: 'capacity',
        label: 'Capacidad *',
        type: 'select',
        options: ['120 GB', '240 GB', '256 GB', '480 GB', '500 GB', '512 GB', '1 TB', '2 TB', '4 TB', '8 TB+'],
        defaultValue: '512 GB',
        required: true
      },
      {
        key: 'interface',
        label: 'Interfaz / Bus',
        type: 'select',
        options: ['PCIe Gen4 x4', 'PCIe Gen3 x4', 'SATA III (6 Gb/s)', 'USB 3.2 / Tipo-C', 'SAS Enterprise'],
        defaultValue: 'PCIe Gen4 x4'
      },
      {
        key: 'health',
        label: 'Estado de Salud (SMART %)',
        type: 'text',
        placeholder: 'Ej: 100% Óptimo, 92% Bueno',
        defaultValue: '100% Óptimo'
      }
    ],
    presets: [
      {
        label: 'Kingston NV2 500GB NVMe',
        brand: 'Kingston',
        model: 'NV2 SNV2S/500G',
        fields: { driveType: 'SSD M.2 NVMe', capacity: '500 GB', interface: 'PCIe Gen4 x4', health: '100% Óptimo' }
      },
      {
        label: 'WD Blue SN580 1TB NVMe',
        brand: 'Western Digital',
        model: 'Blue SN580',
        fields: { driveType: 'SSD M.2 NVMe', capacity: '1 TB', interface: 'PCIe Gen4 x4', health: '100% Óptimo' }
      },
      {
        label: 'Kingston A400 480GB SATA',
        brand: 'Kingston',
        model: 'A400 SA400S37/480G',
        fields: { driveType: 'SSD 2.5" SATA', capacity: '480 GB', interface: 'SATA III (6 Gb/s)', health: '100% Óptimo' }
      }
    ]
  },
  {
    id: 'motherboard',
    label: 'Placa Madre (Motherboard)',
    shortLabel: 'Placa Madre',
    subtitle: 'Socket CPU, chipset, factor de forma y ranuras RAM/M.2',
    codePrefix: 'MB',
    dotColor: '#8b5cf6',
    defaultBrand: 'ASUS',
    defaultModel: 'PRIME B660M-A D4',
    brandPlaceholder: 'ASUS, Gigabyte, MSI, ASRock, HP, Dell...',
    modelPlaceholder: 'Ej: PRIME B660M-A, B550M DS3H, Pro H610M',
    fields: [
      {
        key: 'socket',
        label: 'Socket de CPU *',
        type: 'select',
        options: ['LGA 1700', 'LGA 1200', 'LGA 1151', 'AM5', 'AM4', 'Propietario OEM (HP / Dell / Lenovo)'],
        defaultValue: 'LGA 1700',
        required: true
      },
      {
        key: 'chipset',
        label: 'Chipset *',
        type: 'text',
        placeholder: 'Ej: Intel B660, H610, Q470, AMD B550',
        defaultValue: 'Intel B660',
        required: true
      },
      {
        key: 'formFactor',
        label: 'Formato de Placa',
        type: 'select',
        options: ['Micro-ATX', 'ATX Estándar', 'Mini-ITX', 'Propietario SFF / OEM'],
        defaultValue: 'Micro-ATX'
      },
      {
        key: 'ramSlots',
        label: 'Soporte RAM y Expansión',
        type: 'text',
        placeholder: 'Ej: 4x DDR4 (Máx 128GB), 2x M.2 NVMe',
        defaultValue: '4x DDR4, 2x M.2 NVMe'
      }
    ],
    presets: [
      {
        label: 'ASUS PRIME B660M-A D4',
        brand: 'ASUS',
        model: 'PRIME B660M-A D4',
        fields: { socket: 'LGA 1700', chipset: 'Intel B660', formFactor: 'Micro-ATX', ramSlots: '4x DDR4, 2x M.2 NVMe' }
      },
      {
        label: 'Gigabyte H610M H DDR4',
        brand: 'Gigabyte',
        model: 'H610M H V2 DDR4',
        fields: { socket: 'LGA 1700', chipset: 'Intel H610', formFactor: 'Micro-ATX', ramSlots: '2x DDR4, 1x M.2 NVMe' }
      },
      {
        label: 'MSI B550M PRO-VDH WIFI',
        brand: 'MSI',
        model: 'B550M PRO-VDH WIFI',
        fields: { socket: 'AM4', chipset: 'AMD B550', formFactor: 'Micro-ATX', ramSlots: '4x DDR4, 2x M.2 NVMe' }
      }
    ]
  },
  {
    id: 'gpu',
    label: 'Tarjeta de Video (GPU)',
    shortLabel: 'Tarjeta de Video',
    subtitle: 'Memoria VRAM, tipo GDDR, salidas de video y energía PCIe',
    codePrefix: 'GPU',
    dotColor: '#ef4444',
    defaultBrand: 'ASUS',
    defaultModel: 'GeForce RTX 3060 Dual',
    brandPlaceholder: 'ASUS, MSI, Gigabyte, Zotac, PNY...',
    modelPlaceholder: 'Ej: RTX 4060, RTX 3060, GT 1030, Radeon RX 6600',
    fields: [
      {
        key: 'vram',
        label: 'Memoria de Video (VRAM) *',
        type: 'select',
        options: ['2 GB', '4 GB', '6 GB', '8 GB', '12 GB', '16 GB', '24 GB'],
        defaultValue: '12 GB',
        required: true
      },
      {
        key: 'memoryType',
        label: 'Tipo de Memoria',
        type: 'select',
        options: ['GDDR6', 'GDDR6X', 'GDDR5', 'DDR4'],
        defaultValue: 'GDDR6'
      },
      {
        key: 'outputs',
        label: 'Salidas de Video',
        type: 'text',
        placeholder: 'Ej: 3x DisplayPort 1.4, 1x HDMI 2.1',
        defaultValue: '3x DisplayPort, 1x HDMI'
      },
      {
        key: 'powerConnector',
        label: 'Alimentación PCIe',
        type: 'select',
        options: [
          '1x 8-Pin PCIe',
          'Sin Conector Extra (Slot PCIe 75W)',
          '2x 8-Pin PCIe',
          '12VHPWR (16-Pin)',
          '1x 6-Pin PCIe'
        ],
        defaultValue: '1x 8-Pin PCIe'
      }
    ],
    presets: [
      {
        label: 'RTX 4060 8GB',
        brand: 'MSI',
        model: 'GeForce RTX 4060 Ventus 2X',
        fields: { vram: '8 GB', memoryType: 'GDDR6', outputs: '3x DisplayPort, 1x HDMI', powerConnector: '1x 8-Pin PCIe' }
      },
      {
        label: 'RTX 3060 12GB',
        brand: 'ASUS',
        model: 'GeForce RTX 3060 Dual OC',
        fields: { vram: '12 GB', memoryType: 'GDDR6', outputs: '3x DisplayPort, 1x HDMI', powerConnector: '1x 8-Pin PCIe' }
      },
      {
        label: 'GT 1030 2GB (Ofimática)',
        brand: 'Gigabyte',
        model: 'GeForce GT 1030 Low Profile',
        fields: { vram: '2 GB', memoryType: 'GDDR5', outputs: '1x HDMI, 1x DVI-D', powerConnector: 'Sin Conector Extra (Slot PCIe 75W)' }
      }
    ]
  },
  {
    id: 'psu',
    label: 'Fuente de Poder (PSU)',
    shortLabel: 'Fuente de Poder',
    subtitle: 'Potencia en Watts, certificación 80 Plus y tipo de cableado',
    codePrefix: 'PSU',
    dotColor: '#eab308',
    defaultBrand: 'Corsair',
    defaultModel: 'CV650',
    brandPlaceholder: 'Corsair, EVGA, Cooler Master, Seasonic, OEM...',
    modelPlaceholder: 'Ej: CV650, MWE 600, CX750, Propietaria HP 240W',
    fields: [
      {
        key: 'wattage',
        label: 'Potencia Real (Watts) *',
        type: 'select',
        options: [
          '400W',
          '500W',
          '550W',
          '600W',
          '650W',
          '750W',
          '850W',
          '1000W+',
          'Fuente OEM SFF (240W - 350W)'
        ],
        defaultValue: '650W',
        required: true
      },
      {
        key: 'certification',
        label: 'Certificación 80 Plus',
        type: 'select',
        options: [
          '80 Plus Bronze',
          '80 Plus Gold',
          '80 Plus White',
          '80 Plus Platinum',
          'Sin Certificación / Estándar OEM'
        ],
        defaultValue: '80 Plus Bronze'
      },
      {
        key: 'modularity',
        label: 'Tipo de Cableado',
        type: 'select',
        options: ['No Modular (Cables Fijos)', 'Semi-Modular', 'Full Modular'],
        defaultValue: 'No Modular (Cables Fijos)'
      },
      {
        key: 'psuFormat',
        label: 'Formato Físico',
        type: 'select',
        options: ['ATX Estándar', 'SFX Compacta', 'TFX / Propietaria SFF'],
        defaultValue: 'ATX Estándar'
      }
    ],
    presets: [
      {
        label: 'Corsair CV650 Bronze',
        brand: 'Corsair',
        model: 'CV650 650W',
        fields: { wattage: '650W', certification: '80 Plus Bronze', modularity: 'No Modular (Cables Fijos)', psuFormat: 'ATX Estándar' }
      },
      {
        label: 'Cooler Master MWE 600W',
        brand: 'Cooler Master',
        model: 'MWE 600 V2',
        fields: { wattage: '600W', certification: '80 Plus Bronze', modularity: 'No Modular (Cables Fijos)', psuFormat: 'ATX Estándar' }
      },
      {
        label: 'Fuente OEM SFF 240W',
        brand: 'HP / Dell OEM',
        model: 'SFF 240W 80+ Platinum',
        fields: { wattage: 'Fuente OEM SFF (240W - 350W)', certification: '80 Plus Platinum', modularity: 'No Modular (Cables Fijos)', psuFormat: 'TFX / Propietaria SFF' }
      }
    ]
  },
  {
    id: 'keyboard',
    label: 'Teclado',
    shortLabel: 'Teclado',
    subtitle: 'Conexión USB/inalámbrica, tipo de tecla y distribución de idioma',
    codePrefix: 'TEC',
    dotColor: '#06b6d4',
    defaultBrand: 'Logitech',
    defaultModel: 'K120 Corporativo USB',
    brandPlaceholder: 'Logitech, HP, Dell, Lenovo, Genius, Microsoft...',
    modelPlaceholder: 'Ej: K120, KB216, MK270, K380',
    fields: [
      {
        key: 'connection',
        label: 'Tipo de Conexión *',
        type: 'select',
        options: ['USB Alámbrico', 'Inalámbrico 2.4GHz (Receptor USB)', 'Bluetooth', 'Dual (2.4GHz + Bluetooth)'],
        defaultValue: 'USB Alámbrico',
        required: true
      },
      {
        key: 'switchType',
        label: 'Tecnología de Teclas',
        type: 'select',
        options: ['Membrana Corporativo', 'Mecánico', 'Tijera / Perfil Bajo'],
        defaultValue: 'Membrana Corporativo'
      },
      {
        key: 'layout',
        label: 'Distribución / Idioma *',
        type: 'select',
        options: ['Español Latinoamérica (Con Ñ)', 'Español Internacional (ISO)', 'Inglés US (ANSI)'],
        defaultValue: 'Español Latinoamérica (Con Ñ)',
        required: true
      },
      {
        key: 'sizeFormat',
        label: 'Formato de Tamaño',
        type: 'select',
        options: ['Completo 100% (Con Pad Numérico)', 'Compacto TKL (Sin Numérico)', 'Compacto Portátil (75% / 60%)'],
        defaultValue: 'Completo 100% (Con Pad Numérico)'
      }
    ],
    presets: [
      {
        label: 'Logitech K120 USB',
        brand: 'Logitech',
        model: 'K120 Business',
        fields: { connection: 'USB Alámbrico', switchType: 'Membrana Corporativo', layout: 'Español Latinoamérica (Con Ñ)', sizeFormat: 'Completo 100% (Con Pad Numérico)' }
      },
      {
        label: 'Dell KB216 Multimedia',
        brand: 'Dell',
        model: 'KB216 Chiclet USB',
        fields: { connection: 'USB Alámbrico', switchType: 'Tijera / Perfil Bajo', layout: 'Español Latinoamérica (Con Ñ)', sizeFormat: 'Completo 100% (Con Pad Numérico)' }
      },
      {
        label: 'HP 125 Teclado USB',
        brand: 'HP',
        model: 'HP 125 Wired Keyboard',
        fields: { connection: 'USB Alámbrico', switchType: 'Membrana Corporativo', layout: 'Español Latinoamérica (Con Ñ)', sizeFormat: 'Completo 100% (Con Pad Numérico)' }
      }
    ]
  },
  {
    id: 'mouse',
    label: 'Mouse',
    shortLabel: 'Mouse',
    subtitle: 'Conexión USB/inalámbrica, tipo de sensor óptico y DPI',
    codePrefix: 'MOU',
    dotColor: '#14b8a6',
    defaultBrand: 'Logitech',
    defaultModel: 'B100 Óptico USB',
    brandPlaceholder: 'Logitech, HP, Dell, Lenovo, Genius...',
    modelPlaceholder: 'Ej: B100, M90, M185, MS116, MX Master',
    fields: [
      {
        key: 'connection',
        label: 'Tipo de Conexión *',
        type: 'select',
        options: ['USB Alámbrico', 'Inalámbrico 2.4GHz (Receptor USB)', 'Bluetooth', 'Dual (2.4GHz + Bluetooth)'],
        defaultValue: 'USB Alámbrico',
        required: true
      },
      {
        key: 'sensorType',
        label: 'Tipo de Sensor',
        type: 'select',
        options: ['Óptico Corporativo', 'Óptico Alta Precisión', 'Ergonómico Vertical', 'Láser'],
        defaultValue: 'Óptico Corporativo'
      },
      {
        key: 'dpiButtons',
        label: 'DPI y Botones',
        type: 'text',
        placeholder: 'Ej: 1000 DPI / 3 Botones',
        defaultValue: '1000 DPI / 3 Botones'
      }
    ],
    presets: [
      {
        label: 'Logitech B100 USB',
        brand: 'Logitech',
        model: 'B100 Optical USB',
        fields: { connection: 'USB Alámbrico', sensorType: 'Óptico Corporativo', dpiButtons: '800 DPI / 3 Botones' }
      },
      {
        label: 'Logitech M185 Inalámbrico',
        brand: 'Logitech',
        model: 'M185 Wireless',
        fields: { connection: 'Inalámbrico 2.4GHz (Receptor USB)', sensorType: 'Óptico Corporativo', dpiButtons: '1000 DPI / 3 Botones' }
      },
      {
        label: 'Dell MS116 USB',
        brand: 'Dell',
        model: 'MS116 Optical Mouse',
        fields: { connection: 'USB Alámbrico', sensorType: 'Óptico Corporativo', dpiButtons: '1000 DPI / 3 Botones' }
      }
    ]
  },
  {
    id: 'headset',
    label: 'Audífonos / Headset',
    shortLabel: 'Audífonos',
    subtitle: 'Conector USB/Jack 3.5mm, micrófono con cancelación y diseño',
    codePrefix: 'AUD',
    dotColor: '#ec4899',
    defaultBrand: 'Logitech',
    defaultModel: 'H390 USB Headset',
    brandPlaceholder: 'Logitech, Jabra, Plantronics, Sony, HyperX...',
    modelPlaceholder: 'Ej: H390, H111, Evolve 20, Blackwire 3220',
    fields: [
      {
        key: 'connector',
        label: 'Tipo de Conector *',
        type: 'select',
        options: [
          'USB-A / USB-C Digital',
          'Jack 3.5mm Único (TRRS)',
          'Doble Jack 3.5mm (Audio + Mic)',
          'Inalámbrico / Bluetooth'
        ],
        defaultValue: 'USB-A / USB-C Digital',
        required: true
      },
      {
        key: 'microphone',
        label: 'Micrófono',
        type: 'select',
        options: [
          'Integrado con Cancelación de Ruido',
          'Brazo Flexible Estándar',
          'Integrado en Cable',
          'Sin Micrófono'
        ],
        defaultValue: 'Integrado con Cancelación de Ruido'
      },
      {
        key: 'design',
        label: 'Diseño de Diadema',
        type: 'select',
        options: ['Diadema Binaural (2 Auriculares)', 'Diadema Monoaural (1 Auricular)', 'Over-Ear Cerrado'],
        defaultValue: 'Diadema Binaural (2 Auriculares)'
      }
    ],
    presets: [
      {
        label: 'Logitech H390 USB',
        brand: 'Logitech',
        model: 'H390 USB Stereo',
        fields: { connector: 'USB-A / USB-C Digital', microphone: 'Integrado con Cancelación de Ruido', design: 'Diadema Binaural (2 Auriculares)' }
      },
      {
        label: 'Logitech H111 Jack 3.5mm',
        brand: 'Logitech',
        model: 'H111 Stereo Headset',
        fields: { connector: 'Jack 3.5mm Único (TRRS)', microphone: 'Brazo Flexible Estándar', design: 'Diadema Binaural (2 Auriculares)' }
      },
      {
        label: 'Jabra Evolve 20 USB',
        brand: 'Jabra',
        model: 'Evolve 20 UC Stereo',
        fields: { connector: 'USB-A / USB-C Digital', microphone: 'Integrado con Cancelación de Ruido', design: 'Diadema Binaural (2 Auriculares)' }
      }
    ]
  },
  {
    id: 'cooler',
    label: 'Cooler / Refrigeración',
    shortLabel: 'Refrigeración',
    subtitle: 'Disipador de aire, líquida AIO o ventilador de chasis',
    codePrefix: 'FAN',
    dotColor: '#3b82f6',
    defaultBrand: 'Cooler Master',
    defaultModel: 'Hyper 212 Spectrum V3',
    brandPlaceholder: 'Cooler Master, DeepCool, Thermaltake, Noctua...',
    modelPlaceholder: 'Ej: Hyper 212, AK400, MasterLiquid ML240L',
    fields: [
      {
        key: 'coolerType',
        label: 'Tipo de Refrigeración *',
        type: 'select',
        options: [
          'Disipador de Aire por Torre',
          'Cooler Stock OEM (Intel / AMD)',
          'Refrigeración Líquida AIO',
          'Ventilador de Gabinete (Case Fan)'
        ],
        defaultValue: 'Disipador de Aire por Torre',
        required: true
      },
      {
        key: 'fanSize',
        label: 'Tamaño Ventilador / Radiador',
        type: 'select',
        options: ['120 mm', '240 mm (Doble)', '360 mm (Triple)', '92 mm / Compacto', '140 mm'],
        defaultValue: '120 mm'
      },
      {
        key: 'compatibilityTdp',
        label: 'Sockets Compatibles / TDP',
        type: 'text',
        placeholder: 'Ej: LGA1700 / AM4 / AM5 • 180W TDP',
        defaultValue: 'LGA1700 / AM4 / AM5'
      }
    ],
    presets: [
      {
        label: 'Hyper 212 Aire 120mm',
        brand: 'Cooler Master',
        model: 'Hyper 212 Spectrum V3',
        fields: { coolerType: 'Disipador de Aire por Torre', fanSize: '120 mm', compatibilityTdp: 'LGA1700 / LGA1200 / AM4 / AM5' }
      },
      {
        label: 'DeepCool AK400',
        brand: 'DeepCool',
        model: 'AK400 Zero Dark',
        fields: { coolerType: 'Disipador de Aire por Torre', fanSize: '120 mm', compatibilityTdp: '220W TDP • Multi-Socket' }
      }
    ]
  },
  {
    id: 'case',
    label: 'Case / Gabinete',
    shortLabel: 'Case / Gabinete',
    subtitle: 'Factor de forma ATX/Micro-ATX/SFF, fuente incluida y bahías',
    codePrefix: 'CASE',
    dotColor: '#64748b',
    defaultBrand: 'Antryx',
    defaultModel: 'Elegance 320 Corporativo',
    brandPlaceholder: 'Antryx, Halion, Teros, Cooler Master, Corsair...',
    modelPlaceholder: 'Ej: Elegance 320, MasterBox Q300L, 4000D Airflow',
    fields: [
      {
        key: 'caseFormat',
        label: 'Factor de Forma *',
        type: 'select',
        options: ['Mid-Tower ATX', 'Mini-Tower Micro-ATX', 'Slim / SFF Corporativo', 'Full-Tower / Rack'],
        defaultValue: 'Mid-Tower ATX',
        required: true
      },
      {
        key: 'includedPsu',
        label: 'Fuente de Poder Incluida',
        type: 'select',
        options: ['Sin Fuente de Poder', 'Incluye Fuente Integrada'],
        defaultValue: 'Sin Fuente de Poder'
      },
      {
        key: 'panelDetails',
        label: 'Puertos Frontales y Ventilación',
        type: 'text',
        placeholder: 'Ej: 2x USB 3.0 Frontal, Audio HD, 2 Ventiladores',
        defaultValue: 'USB 3.0 Frontal + Ventilación Trasera'
      }
    ],
    presets: [
      {
        label: 'Case Corporativo + Fuente',
        brand: 'Antryx',
        model: 'Corporate S300 + 350W',
        fields: { caseFormat: 'Mini-Tower Micro-ATX', includedPsu: 'Incluye Fuente Integrada', panelDetails: '2x USB Frontal, Audio HD' }
      },
      {
        label: 'Corsair 4000D Airflow',
        brand: 'Corsair',
        model: '4000D Airflow ATX',
        fields: { caseFormat: 'Mid-Tower ATX', includedPsu: 'Sin Fuente de Poder', panelDetails: 'Panel Vidrio Templado, USB-C Frontal' }
      }
    ]
  },
  {
    id: 'ups',
    label: 'Estabilizador / UPS',
    shortLabel: 'UPS / Estabilizador',
    subtitle: 'Respaldo eléctrico VA/Watts, tomas de salida y estado de batería',
    codePrefix: 'UPS',
    dotColor: '#22c55e',
    defaultBrand: 'APC',
    defaultModel: 'Back-UPS 1000VA',
    brandPlaceholder: 'APC, Forza, Elise, CDP, Tripp Lite...',
    modelPlaceholder: 'Ej: BV1000I-MS, NT-1012, FVR-1202',
    fields: [
      {
        key: 'protectionType',
        label: 'Tipo de Equipo Eléctrico *',
        type: 'select',
        options: [
          'UPS Interactivo (Con Batería de Respaldo)',
          'Estabilizador Sólido (Regulador AVR)',
          'UPS Online Doble Conversión'
        ],
        defaultValue: 'UPS Interactivo (Con Batería de Respaldo)',
        required: true
      },
      {
        key: 'capacityVa',
        label: 'Capacidad (VA / Watts) *',
        type: 'text',
        placeholder: 'Ej: 1000 VA / 600W, 1200 VA',
        defaultValue: '1000 VA / 600W',
        required: true
      },
      {
        key: 'outletsBattery',
        label: 'Tomas de Salida y Estado Batería',
        type: 'text',
        placeholder: 'Ej: 6 Tomas NEMA • Batería 100% Operativa',
        defaultValue: '6 Tomas NEMA • Batería Operativa'
      }
    ],
    presets: [
      {
        label: 'APC Back-UPS 1000VA',
        brand: 'APC',
        model: 'BV1000I / BX1000M',
        fields: { protectionType: 'UPS Interactivo (Con Batería de Respaldo)', capacityVa: '1000 VA / 600W', outletsBattery: '6 Tomas • Batería Operativa' }
      },
      {
        label: 'Estabilizador Forza 1200VA',
        brand: 'Forza',
        model: 'FVR-1202USB',
        fields: { protectionType: 'Estabilizador Sólido (Regulador AVR)', capacityVa: '1200 VA / 600W', outletsBattery: '8 Tomas NEMA Regulación Automática' }
      }
    ]
  },
  {
    id: 'nic',
    label: 'Tarjeta de Red / Wi-Fi / Adaptador',
    shortLabel: 'Adaptador de Red',
    subtitle: 'Interfaz PCIe/USB, velocidad Gigabit o Wi-Fi 6 y dirección MAC',
    codePrefix: 'NIC',
    dotColor: '#6366f1',
    defaultBrand: 'TP-Link',
    defaultModel: 'Archer TX55E Wi-Fi 6',
    brandPlaceholder: 'TP-Link, Intel, ASUS, Ugreen, D-Link...',
    modelPlaceholder: 'Ej: Archer TX55E, TG-3468, TL-WN823N',
    fields: [
      {
        key: 'busInterface',
        label: 'Interfaz de Conexión *',
        type: 'select',
        options: ['PCIe x1 Interna', 'USB 3.0 / 2.0 Externa', 'M.2 Key-E Interna', 'Adaptador USB-C a RJ45'],
        defaultValue: 'PCIe x1 Interna',
        required: true
      },
      {
        key: 'speedStandard',
        label: 'Estándar / Velocidad *',
        type: 'select',
        options: [
          'Wi-Fi 6 (AX3000) + Bluetooth',
          'Gigabit Ethernet (10/100/1000 Mbps)',
          'Wi-Fi 5 Dual Band (AC1300)',
          'Ethernet 2.5 Gbps'
        ],
        defaultValue: 'Wi-Fi 6 (AX3000) + Bluetooth',
        required: true
      },
      {
        key: 'macInfo',
        label: 'Dirección MAC (si aplica)',
        type: 'text',
        placeholder: 'Ej: 00:1A:2B:3C:4D:5E',
        defaultValue: ''
      }
    ],
    presets: [
      {
        label: 'TP-Link PCIe Gigabit',
        brand: 'TP-Link',
        model: 'TG-3468 PCIe Gigabit',
        fields: { busInterface: 'PCIe x1 Interna', speedStandard: 'Gigabit Ethernet (10/100/1000 Mbps)', macInfo: '' }
      },
      {
        label: 'TP-Link Wi-Fi 6 + BT PCIe',
        brand: 'TP-Link',
        model: 'Archer TX55E AX3000',
        fields: { busInterface: 'PCIe x1 Interna', speedStandard: 'Wi-Fi 6 (AX3000) + Bluetooth', macInfo: '' }
      }
    ]
  }
];

export function getHardwareComponentDef(key: HardwareComponentKey): HardwareComponentDefinition {
  return HARDWARE_COMPONENTS_CATALOG.find(c => c.id === key) || HARDWARE_COMPONENTS_CATALOG[0];
}

