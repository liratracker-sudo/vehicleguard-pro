/**
 * Impede que a roda do mouse altere o valor de campos <input type="number">.
 *
 * Sem isso, rolar a página com o cursor sobre um campo numérico focado
 * incrementa/decrementa o valor em silêncio (ex.: 74,90 vira 74,88),
 * o que já causou divergência entre contrato e cobrança.
 */
export const preventWheelChange = (
  e: React.WheelEvent<HTMLInputElement>
) => {
  (e.currentTarget as HTMLInputElement).blur();
};
