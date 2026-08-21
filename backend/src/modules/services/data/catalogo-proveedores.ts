export interface ProveedorServicio {
  codigo: string;
  nombre: string;
  categoria: string;
  montoMinimo: number;
  montoMaximo: number;
  longitudReferencia: number;
}

export const CATALOGO_PROVEEDORES: ProveedorServicio[] = [
  {
    codigo: 'CFE',
    nombre: 'Comision Federal de Electricidad',
    categoria: 'Energia',
    montoMinimo: 50,
    montoMaximo: 15000,
    longitudReferencia: 12,
  },
  {
    codigo: 'AGUA-MUN',
    nombre: 'Servicio Municipal de Agua',
    categoria: 'Agua',
    montoMinimo: 50,
    montoMaximo: 8000,
    longitudReferencia: 10,
  },
  {
    codigo: 'TELCOM',
    nombre: 'Telefonia e Internet Telcom',
    categoria: 'Telecomunicaciones',
    montoMinimo: 100,
    montoMaximo: 10000,
    longitudReferencia: 10,
  },
  {
    codigo: 'GAS-NAT',
    nombre: 'Gas Natural Regional',
    categoria: 'Gas',
    montoMinimo: 50,
    montoMaximo: 10000,
    longitudReferencia: 8,
  },
  {
    codigo: 'TV-CABLE',
    nombre: 'Television por Cable Vision',
    categoria: 'Entretenimiento',
    montoMinimo: 100,
    montoMaximo: 5000,
    longitudReferencia: 9,
  },
];
