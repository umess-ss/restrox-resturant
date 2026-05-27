export default function formatCurrency(value = 0) {
  const amount = Number(value) || 0;
  return `Rs. ${amount.toLocaleString('en-NP', {
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  })}`;
}
