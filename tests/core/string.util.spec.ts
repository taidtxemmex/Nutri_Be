import { normalizeVietnameseNFC, normalizeVietnameseKey } from '../../src/common/utils/string.util';

describe('StringUtil - Vietnamese Unicode Normalization & Key Generation', () => {
  describe('normalizeVietnameseNFC', () => {
    it('should return empty string for falsy inputs', () => {
      expect(normalizeVietnameseNFC('')).toBe('');
      expect(normalizeVietnameseNFC(null as any)).toBe('');
      expect(normalizeVietnameseNFC(undefined as any)).toBe('');
    });

    it('should trim surrounding whitespace', () => {
      expect(normalizeVietnameseNFC('  Cơm tấm  ')).toBe('Cơm tấm');
      expect(normalizeVietnameseNFC('\n\tThịt bò xào\t ')).toBe('Thịt bò xào');
    });

    it('should normalize NFD decomposed characters into NFC precomposed characters', () => {
      const precomposed = 'Phở bò';
      const decomposed = precomposed.normalize('NFD');
      expect(decomposed).not.toBe(precomposed);
      expect(normalizeVietnameseNFC(decomposed)).toBe(precomposed);
      expect(normalizeVietnameseNFC(decomposed).length).toBe(precomposed.length);
    });

    it('should preserve already NFC normalized strings', () => {
      const str = 'Gà kho gừng';
      expect(normalizeVietnameseNFC(str)).toBe(str);
    });
  });

  describe('normalizeVietnameseKey', () => {
    it('should return empty string for falsy inputs', () => {
      expect(normalizeVietnameseKey('')).toBe('');
      expect(normalizeVietnameseKey(null as any)).toBe('');
      expect(normalizeVietnameseKey(undefined as any)).toBe('');
    });

    it('should convert to lowercase, collapse multiple spaces, and trim', () => {
      expect(normalizeVietnameseKey('  CƠM   TẤM   SƯỜN   BÌ   ')).toBe('cơm tấm sườn bì');
      expect(normalizeVietnameseKey('Canh   Chua    Cá    Hồi')).toBe('canh chua cá hồi');
    });

    it('should normalize NFD characters to NFC while lowercasing', () => {
      const precomposed = '  Phở   Bò  ';
      const decomposed = precomposed.normalize('NFD');
      expect(normalizeVietnameseKey(decomposed)).toBe('phở bò');
    });
  });
});
