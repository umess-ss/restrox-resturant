export const formatCurrency = (amount) => {
  const value = Math.round(Number(amount) || 0);
  return `Rs. ${value.toLocaleString('en-IN')}`;
};

export default formatCurrency;
