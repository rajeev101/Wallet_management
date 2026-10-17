const formatStudentAmount = (value, options = {}) => {
  const numericValue = Number(value ?? 0);
  const isNegative = options.negative || numericValue < 0;
  const hasPositiveSign = options.includeSign && numericValue >= 0;
  const absoluteValue = Math.abs(numericValue);

  const formattedValue = Number.isInteger(absoluteValue)
    ? String(absoluteValue)
    : absoluteValue.toFixed(2).replace(/\.00$/, "");

  const sign = isNegative ? "-" : hasPositiveSign ? "+" : "";
  return `${sign}₹${formattedValue}`;
};

export default formatStudentAmount;
