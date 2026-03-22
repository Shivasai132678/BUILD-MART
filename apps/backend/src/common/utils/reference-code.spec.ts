import {
  generateOrderReferenceCode,
  generateQuoteReferenceCode,
  generateRfqReferenceCode,
} from './reference-code';

describe('reference-code utilities', () => {
  const tx = {
    $executeRaw: jest.fn(),
    $queryRaw: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('generates RFQ reference code with zero-padding from max sequence', async () => {
    (tx.$queryRaw as jest.Mock).mockResolvedValue([{ max_seq: 9 }]);

    const code = await generateRfqReferenceCode(tx as never);

    expect(code).toBe('RFQ-00010');
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('generates QUO reference code when no existing rows', async () => {
    (tx.$queryRaw as jest.Mock).mockResolvedValue([{ max_seq: null }]);

    const code = await generateQuoteReferenceCode(tx as never);

    expect(code).toBe('QUO-00001');
  });

  it('generates ORD reference code from high sequence safely', async () => {
    (tx.$queryRaw as jest.Mock).mockResolvedValue([{ max_seq: 99999 }]);

    const code = await generateOrderReferenceCode(tx as never);

    expect(code).toBe('ORD-100000');
  });
});
