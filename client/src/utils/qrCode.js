const QR_VERSION = 5;
const QR_SIZE = 17 + QR_VERSION * 4;
const DATA_CODEWORDS = 108;
const EC_CODEWORDS = 26;
const ALIGNMENT_CENTER = 30;
const PAD_BYTES = [0xec, 0x11];

const escapeXml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const toUtf8Bytes = (value) => Array.from(new TextEncoder().encode(value));

const getBit = (value, index) => (value >> index) & 1;

const appendBits = (bits, value, length) => {
  for (let i = length - 1; i >= 0; i -= 1) {
    bits.push(getBit(value, i));
  }
};

const bitsToCodewords = (bits) => {
  const codewords = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j += 1) {
      byte = (byte << 1) | (bits[i + j] || 0);
    }
    codewords.push(byte);
  }
  return codewords;
};

const createDataCodewords = (payload) => {
  const bytes = toUtf8Bytes(payload).slice(0, 106);
  const bits = [];

  appendBits(bits, 0b0100, 4);
  appendBits(bits, bytes.length, 8);
  bytes.forEach((byte) => appendBits(bits, byte, 8));

  const maxBits = DATA_CODEWORDS * 8;
  appendBits(bits, 0, Math.min(4, maxBits - bits.length));
  while (bits.length % 8 !== 0) bits.push(0);

  const codewords = bitsToCodewords(bits);
  let padIndex = 0;
  while (codewords.length < DATA_CODEWORDS) {
    codewords.push(PAD_BYTES[padIndex % PAD_BYTES.length]);
    padIndex += 1;
  }

  return codewords;
};

const createGaloisTables = () => {
  const exp = Array(512).fill(0);
  const log = Array(256).fill(0);
  let value = 1;

  for (let i = 0; i < 255; i += 1) {
    exp[i] = value;
    log[value] = i;
    value <<= 1;
    if (value & 0x100) value ^= 0x11d;
  }

  for (let i = 255; i < exp.length; i += 1) {
    exp[i] = exp[i - 255];
  }

  return { exp, log };
};

const { exp: gfExp, log: gfLog } = createGaloisTables();

const gfMultiply = (left, right) => {
  if (left === 0 || right === 0) return 0;
  return gfExp[gfLog[left] + gfLog[right]];
};

const createGenerator = (degree) => {
  let generator = [1];

  for (let i = 0; i < degree; i += 1) {
    const next = Array(generator.length + 1).fill(0);
    generator.forEach((coefficient, index) => {
      next[index] ^= gfMultiply(coefficient, gfExp[i]);
      next[index + 1] ^= coefficient;
    });
    generator = next;
  }

  return generator;
};

const createErrorCorrection = (data) => {
  const generator = createGenerator(EC_CODEWORDS);
  const remainder = Array(EC_CODEWORDS).fill(0);

  data.forEach((byte) => {
    const factor = byte ^ remainder.shift();
    remainder.push(0);

    generator.slice(0, EC_CODEWORDS).forEach((coefficient, index) => {
      remainder[index] ^= gfMultiply(coefficient, factor);
    });
  });

  return remainder;
};

const createMatrix = () => ({
  modules: Array.from({ length: QR_SIZE }, () => Array(QR_SIZE).fill(false)),
  reserved: Array.from({ length: QR_SIZE }, () => Array(QR_SIZE).fill(false)),
});

const setModule = (matrix, row, col, isDark, reserve = true) => {
  if (row < 0 || col < 0 || row >= QR_SIZE || col >= QR_SIZE) return;
  matrix.modules[row][col] = Boolean(isDark);
  if (reserve) matrix.reserved[row][col] = true;
};

const addFinder = (matrix, top, left) => {
  for (let row = -1; row <= 7; row += 1) {
    for (let col = -1; col <= 7; col += 1) {
      const r = top + row;
      const c = left + col;
      const isFinder =
        row >= 0 &&
        row <= 6 &&
        col >= 0 &&
        col <= 6 &&
        (row === 0 ||
          row === 6 ||
          col === 0 ||
          col === 6 ||
          (row >= 2 && row <= 4 && col >= 2 && col <= 4));

      setModule(matrix, r, c, isFinder);
    }
  }
};

const addAlignment = (matrix, centerRow, centerCol) => {
  for (let row = -2; row <= 2; row += 1) {
    for (let col = -2; col <= 2; col += 1) {
      const distance = Math.max(Math.abs(row), Math.abs(col));
      setModule(matrix, centerRow + row, centerCol + col, distance !== 1);
    }
  }
};

const addTiming = (matrix) => {
  for (let index = 8; index < QR_SIZE - 8; index += 1) {
    const isDark = index % 2 === 0;
    setModule(matrix, 6, index, isDark);
    setModule(matrix, index, 6, isDark);
  }
};

const reserveFormatAreas = (matrix) => {
  for (let index = 0; index < 9; index += 1) {
    if (index !== 6) {
      matrix.reserved[8][index] = true;
      matrix.reserved[index][8] = true;
    }
  }

  for (let index = QR_SIZE - 8; index < QR_SIZE; index += 1) {
    matrix.reserved[8][index] = true;
    matrix.reserved[index][8] = true;
  }
};

const addPatterns = (matrix) => {
  addFinder(matrix, 0, 0);
  addFinder(matrix, 0, QR_SIZE - 7);
  addFinder(matrix, QR_SIZE - 7, 0);
  addAlignment(matrix, ALIGNMENT_CENTER, ALIGNMENT_CENTER);
  addTiming(matrix);
  reserveFormatAreas(matrix);
  setModule(matrix, QR_VERSION * 4 + 9, 8, true);
};

const createFormatBits = () => {
  let data = 0b01000;
  let bits = data << 10;

  for (let i = 14; i >= 10; i -= 1) {
    if (getBit(bits, i)) bits ^= 0x537 << (i - 10);
  }

  return ((data << 10) | bits) ^ 0x5412;
};

const addFormatBits = (matrix) => {
  const bits = createFormatBits();
  const first = [
    [8, 0],
    [8, 1],
    [8, 2],
    [8, 3],
    [8, 4],
    [8, 5],
    [8, 7],
    [8, 8],
    [7, 8],
    [5, 8],
    [4, 8],
    [3, 8],
    [2, 8],
    [1, 8],
    [0, 8],
  ];
  const second = [
    [QR_SIZE - 1, 8],
    [QR_SIZE - 2, 8],
    [QR_SIZE - 3, 8],
    [QR_SIZE - 4, 8],
    [QR_SIZE - 5, 8],
    [QR_SIZE - 6, 8],
    [QR_SIZE - 7, 8],
    [8, QR_SIZE - 8],
    [8, QR_SIZE - 7],
    [8, QR_SIZE - 6],
    [8, QR_SIZE - 5],
    [8, QR_SIZE - 4],
    [8, QR_SIZE - 3],
    [8, QR_SIZE - 2],
    [8, QR_SIZE - 1],
  ];

  first.forEach(([row, col], index) => setModule(matrix, row, col, getBit(bits, index)));
  second.forEach(([row, col], index) => setModule(matrix, row, col, getBit(bits, index)));
};

const shouldMask = (row, col) => (row + col) % 2 === 0;

const addData = (matrix, codewords) => {
  const bits = [];
  codewords.forEach((codeword) => appendBits(bits, codeword, 8));

  let bitIndex = 0;
  let upward = true;

  for (let rightCol = QR_SIZE - 1; rightCol > 0; rightCol -= 2) {
    if (rightCol === 6) rightCol -= 1;

    for (let offset = 0; offset < QR_SIZE; offset += 1) {
      const row = upward ? QR_SIZE - 1 - offset : offset;

      for (let col = rightCol; col >= rightCol - 1; col -= 1) {
        if (matrix.reserved[row][col]) continue;
        const rawBit = bits[bitIndex] || 0;
        setModule(matrix, row, col, Boolean(rawBit) !== shouldMask(row, col), false);
        bitIndex += 1;
      }
    }

    upward = !upward;
  }
};

const createQrMatrix = (payload) => {
  const data = createDataCodewords(payload);
  const errorCorrection = createErrorCorrection(data);
  const matrix = createMatrix();

  addPatterns(matrix);
  addData(matrix, [...data, ...errorCorrection]);
  addFormatBits(matrix);

  return matrix.modules;
};

export const createVendorPaymentPayload = (vendor = {}) => {
  const vendorId = vendor._id || vendor.id || vendor.email || "vendor";
  const name = (vendor.name || "Campus Vendor").slice(0, 48);
  return `campuswallet://pay?vendorId=${encodeURIComponent(vendorId)}&name=${encodeURIComponent(name)}`;
};

export const createQrSvg = (payload, options = {}) => {
  const {
    title = "Campus Wallet Payment QR",
    subtitle = "",
    footer = "",
    moduleSize = 8,
    quietZone = 4,
    includeDetails = false,
  } = options;
  const modules = createQrMatrix(payload);
  const qrPixelSize = (QR_SIZE + quietZone * 2) * moduleSize;
  const detailsHeight = includeDetails ? 88 : 0;
  const width = qrPixelSize;
  const height = qrPixelSize + detailsHeight;
  const darkModules = [];

  modules.forEach((row, rowIndex) => {
    row.forEach((isDark, colIndex) => {
      if (!isDark) return;
      darkModules.push(
        `<rect x="${(colIndex + quietZone) * moduleSize}" y="${(rowIndex + quietZone) * moduleSize}" width="${moduleSize}" height="${moduleSize}" />`
      );
    });
  });

  const detailMarkup = includeDetails
    ? `<text x="${width / 2}" y="${qrPixelSize + 28}" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#111827">${escapeXml(title)}</text>
<text x="${width / 2}" y="${qrPixelSize + 54}" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="#374151">${escapeXml(subtitle)}</text>
<text x="${width / 2}" y="${qrPixelSize + 76}" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" fill="#6b7280">${escapeXml(footer)}</text>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(title)}">
<rect width="100%" height="100%" fill="#ffffff" />
<g fill="#111827">${darkModules.join("")}</g>
${detailMarkup}
</svg>`;
};

export const svgToDataUri = (svg) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
