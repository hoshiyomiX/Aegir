import { arrayBufferToHex } from '../utils/helpers.js';
import { PROTOCOL_HORSE, PROTOCOL_FLASH, UUID_V4_REGEX } from '../config/constants.js';

export function protocolSniffer(buffer) {
  // Early validation for empty or too small buffers
  if (!buffer || buffer.byteLength < 1) {
    console.warn('[Sniffer] Empty or null buffer received');
    return null; // Return null to indicate unknown protocol
  }

  // Check for Horse (Trojan) protocol - needs at least 62 bytes
  if (buffer.byteLength >= 62) {
    const horseDelimiter = new Uint8Array(buffer.slice(56, 60));
    if (horseDelimiter[0] === 0x0d && horseDelimiter[1] === 0x0a) {
      if (horseDelimiter[2] === 0x01 || horseDelimiter[2] === 0x03 || horseDelimiter[2] === 0x7f) {
        if (horseDelimiter[3] === 0x01 || horseDelimiter[3] === 0x03 || horseDelimiter[3] === 0x04) {
          return PROTOCOL_HORSE;
        }
      }
    }
  }

  // Check for Flash (VMess) protocol - needs at least 17 bytes
  if (buffer.byteLength >= 17) {
    const flashDelimiter = new Uint8Array(buffer.slice(1, 17));
    if (UUID_V4_REGEX.test(arrayBufferToHex(flashDelimiter))) {
      return PROTOCOL_FLASH;
    }
  }

  // Check if first byte is a valid SS addressType (1, 3, or 4)
  const firstByte = new Uint8Array(buffer.slice(0, 1))[0];
  if (firstByte === 1 || firstByte === 3 || firstByte === 4) {
    return "ss";
  }

  // Log warning for unrecognized protocol patterns
  console.warn(`[Sniffer] Unrecognized protocol pattern: firstByte=${firstByte}, bufferLength=${buffer.byteLength}`);
  return null; // Return null instead of defaulting to "ss"
}
