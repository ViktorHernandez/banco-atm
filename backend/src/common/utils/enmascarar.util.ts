export function enmascararNumero(numero: string, visibles = 4): string {
  if (!numero) {
    return '';
  }
  if (numero.length <= visibles) {
    return numero;
  }
  return `****${numero.slice(-visibles)}`;
}

export function generarFolio(id: string): string {
  return `TRX-${id.replace(/-/g, '').slice(0, 10).toUpperCase()}`;
}
