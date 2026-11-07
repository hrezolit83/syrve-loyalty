import QRCode from 'qrcode';

/**
 * QR-код номера картки у PNG-буфер.
 *
 * У QR саме номер картки (він же track): касир сканує його в Syrve.
 * errorCorrectionLevel M — компроміс між щільністю й стійкістю до
 * засвіченого екрана телефона.
 */
export const renderCardQr = async (cardNumber) =>
  QRCode.toBuffer(String(cardNumber), {
    type: 'png',
    width: 512,
    margin: 2,
    errorCorrectionLevel: 'M',
  });
