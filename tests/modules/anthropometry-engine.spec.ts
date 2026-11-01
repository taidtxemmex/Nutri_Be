import {
  AnthropometryEngine,
  BmiCategoryWPRO,
} from '../../src/modules/patients/services/anthropometry.service';
import { PatientCodeAllocator } from '../../src/modules/patients/services/patient-code-allocator.service';

describe('AnthropometryEngine & PatientCodeAllocator Domain Algorithm Suite', () => {
  describe('1. Exact Gregorian Civil Age Calculation (Khắc phục hoàn toàn lỗi trôi ngày 365.25)', () => {
    const REF_DATE = '2026-10-27';

    it('Case 1.1: Ngày sinh nhật hôm nay -> Đủ tuổi, không bị trừ', () => {
      const age = AnthropometryEngine.calculateExactAge('2000-10-27', false, REF_DATE);
      expect(age).toBe(26);
    });

    it('Case 1.2: Đúng 1 ngày trước sinh nhật -> Chưa đến sinh nhật, tuổi bị trừ 1', () => {
      const age = AnthropometryEngine.calculateExactAge('2000-10-28', false, REF_DATE);
      expect(age).toBe(25);
    });

    it('Case 1.3: Đúng 1 ngày sau sinh nhật -> Đã qua sinh nhật, giữ nguyên tuổi', () => {
      const age = AnthropometryEngine.calculateExactAge('2000-10-26', false, REF_DATE);
      expect(age).toBe(26);
    });

    it('Case 1.4: Sinh ngày nhuận 29/02/2000, thời điểm tham chiếu 28/02/2024 -> 23 tuổi', () => {
      const age = AnthropometryEngine.calculateExactAge('2000-02-29', false, '2024-02-28');
      expect(age).toBe(23);
    });

    it('Case 1.5: Sinh ngày nhuận 29/02/2000, thời điểm tham chiếu 29/02/2024 -> Đủ 24 tuổi', () => {
      const age = AnthropometryEngine.calculateExactAge('2000-02-29', false, '2024-02-29');
      expect(age).toBe(24);
    });

    it('Case 1.6: Sinh ngày nhuận 29/02/2000 vào năm thường 28/02/2023 -> 22 tuổi', () => {
      const age = AnthropometryEngine.calculateExactAge('2000-02-29', false, '2023-02-28');
      expect(age).toBe(22);
    });

    it('Case 1.7: Sinh ngày nhuận 29/02/2000 vào năm thường 01/03/2023 -> Đã qua sinh nhật (23 tuổi)', () => {
      const age = AnthropometryEngine.calculateExactAge('2000-02-29', false, '2023-03-01');
      expect(age).toBe(23);
    });

    it('Case 1.8: birthYearOnly: true -> Tuổi = currentYear - birthYear (đầu năm)', () => {
      const age = AnthropometryEngine.calculateExactAge('2000-01-01', true, '2026-01-02');
      expect(age).toBe(26);
    });

    it('Case 1.9: birthYearOnly: true -> Tuổi = currentYear - birthYear (cuối năm)', () => {
      const age = AnthropometryEngine.calculateExactAge('2000-12-31', true, '2026-05-15');
      expect(age).toBe(26);
    });

    it('Case 1.10: Trẻ sơ sinh 5 tháng tuổi -> age = 0 (hợp lệ trong khoảng [0, 130])', () => {
      const age = AnthropometryEngine.calculateExactAge('2026-05-10', false, REF_DATE);
      expect(age).toBe(0);
    });

    it('Case 1.11: Ngưỡng sinh học người đại thọ 130 tuổi -> Hợp lệ', () => {
      const age = AnthropometryEngine.calculateExactAge('1896-10-27', false, REF_DATE);
      expect(age).toBe(130);
    });

    it('Case 1.12: Vượt quá ngưỡng sinh học an toàn (131 tuổi) -> Trả về null', () => {
      const age = AnthropometryEngine.calculateExactAge('1895-10-27', false, REF_DATE);
      expect(age).toBeNull();
    });

    it('Case 1.13: Ngày sinh ở tương lai -> Tuổi < 0 -> Trả về null an toàn', () => {
      const age = AnthropometryEngine.calculateExactAge('2026-10-28', false, REF_DATE);
      expect(age).toBeNull();
    });

    it('Case 1.14: Giá trị ngày sinh null / undefined -> Trả về null', () => {
      expect(AnthropometryEngine.calculateExactAge(null)).toBeNull();
      expect(AnthropometryEngine.calculateExactAge(undefined)).toBeNull();
      expect(AnthropometryEngine.calculateExactAge('')).toBeNull();
    });

    it('Case 1.15: Chuỗi ngày sinh không hợp lệ -> Trả về null', () => {
      expect(AnthropometryEngine.calculateExactAge('invalid-date')).toBeNull();
    });

    it('Case 1.16: Hỗ trợ cả định dạng DD/MM/YYYY của Việt Nam', () => {
      const age = AnthropometryEngine.calculateExactAge('27/10/2000', false, REF_DATE);
      expect(age).toBe(26);
    });
  });

  describe('2. BMI Calculation & WPRO Classification (WHO Châu Á - Tây Thái Bình Dương)', () => {
    it('Case 2.1: Thiếu cân (Underweight: < 18.5) -> W=40kg, H=160cm (BMI = 15.6)', () => {
      const res = AnthropometryEngine.calculateBmi(40, 160);
      expect(res.bmi).toBe(15.6);
      expect(res.bmiLevel).toBe(BmiCategoryWPRO.UNDERWEIGHT);
      expect(res.bmiStatus).toBe('Thiếu cân');
    });

    it('Case 2.2: Ngưỡng dưới Bình thường (Normal: 18.5) -> W=47.36kg, H=160cm', () => {
      const res = AnthropometryEngine.calculateBmi(47.36, 160);
      expect(res.bmi).toBe(18.5);
      expect(res.bmiLevel).toBe(BmiCategoryWPRO.NORMAL);
      expect(res.bmiStatus).toBe('Bình thường');
    });

    it('Case 2.3: Bình thường tiêu chuẩn -> W=65kg, H=170cm (BMI = 22.5)', () => {
      const res = AnthropometryEngine.calculateBmi(65, 170);
      expect(res.bmi).toBe(22.5);
      expect(res.bmiLevel).toBe(BmiCategoryWPRO.NORMAL);
      expect(res.bmiStatus).toBe('Bình thường');
    });

    it('Case 2.4: Ngưỡng trên Bình thường (Normal: 22.9) -> W=58.62kg, H=160cm', () => {
      const res = AnthropometryEngine.calculateBmi(58.624, 160);
      expect(res.bmi).toBe(22.9);
      expect(res.bmiLevel).toBe(BmiCategoryWPRO.NORMAL);
      expect(res.bmiStatus).toBe('Bình thường');
    });

    it('Case 2.5: Ngưỡng dưới Thừa cân (Overweight: 23.0) -> W=58.88kg, H=160cm', () => {
      const res = AnthropometryEngine.calculateBmi(58.88, 160);
      expect(res.bmi).toBe(23.0);
      expect(res.bmiLevel).toBe(BmiCategoryWPRO.OVERWEIGHT);
      expect(res.bmiStatus).toBe('Thừa cân');
    });

    it('Case 2.6: Thừa cân tiêu chuẩn -> W=65kg, H=165cm (BMI = 23.9)', () => {
      const res = AnthropometryEngine.calculateBmi(65, 165);
      expect(res.bmi).toBe(23.9);
      expect(res.bmiLevel).toBe(BmiCategoryWPRO.OVERWEIGHT);
      expect(res.bmiStatus).toBe('Thừa cân');
    });

    it('Case 2.7: Ngưỡng trên Thừa cân (Overweight: 24.9) -> W=67.8kg, H=165cm', () => {
      const res = AnthropometryEngine.calculateBmi(67.79, 165);
      expect(res.bmi).toBe(24.9);
      expect(res.bmiLevel).toBe(BmiCategoryWPRO.OVERWEIGHT);
      expect(res.bmiStatus).toBe('Thừa cân');
    });

    it('Case 2.8: Ngưỡng dưới Béo phì độ I (Obese 1: 25.0) -> W=68.06kg, H=165cm', () => {
      const res = AnthropometryEngine.calculateBmi(68.0625, 165);
      expect(res.bmi).toBe(25.0);
      expect(res.bmiLevel).toBe(BmiCategoryWPRO.OBESE_1);
      expect(res.bmiStatus).toBe('Béo phì độ I');
    });

    it('Case 2.9: Béo phì độ I tiêu chuẩn -> W=75kg, H=165cm (BMI = 27.5)', () => {
      const res = AnthropometryEngine.calculateBmi(75, 165);
      expect(res.bmi).toBe(27.5);
      expect(res.bmiLevel).toBe(BmiCategoryWPRO.OBESE_1);
      expect(res.bmiStatus).toBe('Béo phì độ I');
    });

    it('Case 2.10: Ngưỡng trên Béo phì độ I (Obese 1: 29.9) -> W=81.4kg, H=165cm', () => {
      const res = AnthropometryEngine.calculateBmi(81.4, 165);
      expect(res.bmi).toBe(29.9);
      expect(res.bmiLevel).toBe(BmiCategoryWPRO.OBESE_1);
      expect(res.bmiStatus).toBe('Béo phì độ I');
    });

    it('Case 2.11: Ngưỡng dưới Béo phì độ II (Obese 2: 30.0) -> W=81.68kg, H=165cm', () => {
      const res = AnthropometryEngine.calculateBmi(81.675, 165);
      expect(res.bmi).toBe(30.0);
      expect(res.bmiLevel).toBe(BmiCategoryWPRO.OBESE_2);
      expect(res.bmiStatus).toBe('Béo phì độ II');
    });

    it('Case 2.12: Béo phì độ II tiêu chuẩn -> W=85kg, H=165cm (BMI = 31.2)', () => {
      const res = AnthropometryEngine.calculateBmi(85, 165);
      expect(res.bmi).toBe(31.2);
      expect(res.bmiLevel).toBe(BmiCategoryWPRO.OBESE_2);
      expect(res.bmiStatus).toBe('Béo phì độ II');
    });

    it('Case 2.13: Ngưỡng trên Béo phì độ II (Obese 2: 34.9) -> W=95.0kg, H=165cm', () => {
      const res = AnthropometryEngine.calculateBmi(95.01, 165);
      expect(res.bmi).toBe(34.9);
      expect(res.bmiLevel).toBe(BmiCategoryWPRO.OBESE_2);
      expect(res.bmiStatus).toBe('Béo phì độ II');
    });

    it('Case 2.14: Ngưỡng dưới Béo phì độ III (Obese 3: >= 35.0) -> W=95.29kg, H=165cm', () => {
      const res = AnthropometryEngine.calculateBmi(95.2875, 165);
      expect(res.bmi).toBe(35.0);
      expect(res.bmiLevel).toBe(BmiCategoryWPRO.OBESE_3);
      expect(res.bmiStatus).toBe('Béo phì độ III');
    });

    it('Case 2.15: Béo phì độ III cực hạn -> W=110kg, H=165cm (BMI = 40.4)', () => {
      const res = AnthropometryEngine.calculateBmi(110, 165);
      expect(res.bmi).toBe(40.4);
      expect(res.bmiLevel).toBe(BmiCategoryWPRO.OBESE_3);
      expect(res.bmiStatus).toBe('Béo phì độ III');
    });

    it('Case 2.16: An toàn số học: Chiều cao bằng 0 (H = 0) -> Trả về null, KHÔNG sinh NaN / Infinity', () => {
      const res = AnthropometryEngine.calculateBmi(60, 0);
      expect(res.bmi).toBeNull();
      expect(res.bmiLevel).toBeNull();
      expect(res.bmiStatus).toBeNull();
    });

    it('Case 2.17: An toàn số học: Chiều cao âm (H = -160) -> Trả về null', () => {
      const res = AnthropometryEngine.calculateBmi(60, -160);
      expect(res.bmi).toBeNull();
    });

    it('Case 2.18: An toàn số học: Cân nặng bằng 0 (W = 0) -> Trả về null', () => {
      const res = AnthropometryEngine.calculateBmi(0, 160);
      expect(res.bmi).toBeNull();
    });

    it('Case 2.19: An toàn số học: Cân nặng âm (W = -50) -> Trả về null', () => {
      const res = AnthropometryEngine.calculateBmi(-50, 160);
      expect(res.bmi).toBeNull();
    });

    it('Case 2.20: Vượt quá dải sinh học an toàn: Cân nặng 600kg -> Trả về null', () => {
      const res = AnthropometryEngine.calculateBmi(600, 170);
      expect(res.bmi).toBeNull();
    });

    it('Case 2.21: Vượt quá dải sinh học an toàn: Chiều cao 10cm -> Trả về null', () => {
      const res = AnthropometryEngine.calculateBmi(50, 10);
      expect(res.bmi).toBeNull();
    });
  });

  describe('3. BMR Calculation (Mifflin-St Jeor Engine)', () => {
    it('Case 3.1: Nam tiêu chuẩn (W=70kg, H=175cm, A=30) -> BMR = 10*70 + 6.25*175 - 5*30 + 5 = 1648.75', () => {
      const bmr = AnthropometryEngine.calculateBmr(true, 70, 175, 30);
      expect(bmr).toBe(1648.75);
    });

    it('Case 3.2: Nữ tiêu chuẩn (W=55kg, H=160cm, A=25) -> BMR = 10*55 + 6.25*160 - 5*25 - 161 = 1264', () => {
      const bmr = AnthropometryEngine.calculateBmr(false, 55, 160, 25);
      expect(bmr).toBe(1264);
    });

    it('Case 3.3: Nam cao tuổi (W=60kg, H=165cm, A=80) -> BMR = 1236.25', () => {
      const bmr = AnthropometryEngine.calculateBmr(true, 60, 165, 80);
      expect(bmr).toBe(1236.25);
    });

    it('Case 3.4: Nữ vận động viên trẻ (W=62kg, H=172cm, A=20) -> BMR = 1434', () => {
      const bmr = AnthropometryEngine.calculateBmr(false, 62, 172, 20);
      expect(bmr).toBe(1434);
    });

    it('Case 3.5: Biên an toàn: H=0 hoặc W=0 hoặc Age<0 -> BMR trả về 0', () => {
      expect(AnthropometryEngine.calculateBmr(true, 0, 175, 30)).toBe(0);
      expect(AnthropometryEngine.calculateBmr(true, 70, 0, 30)).toBe(0);
      expect(AnthropometryEngine.calculateBmr(true, 70, 175, -5)).toBe(0);
      expect(AnthropometryEngine.calculateBmr(true, null, 175, 30)).toBe(0);
      expect(AnthropometryEngine.calculateBmr(true, 70, null, 30)).toBe(0);
      expect(AnthropometryEngine.calculateBmr(true, 70, 175, null)).toBe(0);
    });
  });

  describe('4. TDEE Calculation, Standard PAL & Clinical Stress Factor', () => {
    const MALE_BMR = 1648.75;
    const _FEMALE_BMR = 1264.0;

    it('Case 4.1: Nam ít vận động (Sedentary: PAL = 1.2) -> TDEE = round(1648.75 * 1.2) = 1979', () => {
      const tdee = AnthropometryEngine.calculateTdee(true, 70, 175, 30, 1.2);
      expect(tdee).toBe(1979);
    });

    it('Case 4.2: Nam vận động nhẹ (Lightly active: PAL = 1.375) -> TDEE = round(1648.75 * 1.375) = 2267', () => {
      const tdee = AnthropometryEngine.calculateTdee(true, 70, 175, 30, 1.375);
      expect(tdee).toBe(2267);
    });

    it('Case 4.3: Nam vận động vừa (Moderately active: PAL = 1.55) -> TDEE = round(1648.75 * 1.55) = 2556', () => {
      const tdee = AnthropometryEngine.calculateTdee(true, 70, 175, 30, 1.55);
      expect(tdee).toBe(2556);
    });

    it('Case 4.4: Nam vận động nhiều (Very active: PAL = 1.725) -> TDEE = round(1648.75 * 1.725) = 2844', () => {
      const tdee = AnthropometryEngine.calculateTdee(true, 70, 175, 30, 1.725);
      expect(tdee).toBe(2844);
    });

    it('Case 4.5: Nam vận động cực nhiều (Extra active: PAL = 1.9) -> TDEE = round(1648.75 * 1.9) = 3133', () => {
      const tdee = AnthropometryEngine.calculateTdee(true, 70, 175, 30, 1.9);
      expect(tdee).toBe(3133);
    });

    it('Case 4.6: Bệnh nhân phẫu thuật nhẹ (StressFactor = 1.1, Nữ BMR = 1264, PAL = 1.2) -> TDEE = 1668', () => {
      const tdee = AnthropometryEngine.calculateTdee(false, 55, 160, 25, 1.2, 1.1);
      // 1264 * 1.2 * 1.1 = 1668.48 -> round = 1668
      expect(tdee).toBe(1668);
    });

    it('Case 4.7: Bệnh nhân nhiễm trùng nặng/Sepsis (StressFactor = 1.5, Nữ BMR = 1264, PAL = 1.2) -> TDEE = 2275', () => {
      const tdee = AnthropometryEngine.calculateTdee(false, 55, 160, 25, 1.2, 1.5);
      // 1264 * 1.2 * 1.5 = 2275.2 -> round = 2275
      expect(tdee).toBe(2275);
    });

    it('Case 4.8: Bệnh nhân bỏng nặng (StressFactor = 1.8, Nam BMR = 1648.75, PAL = 1.2) -> TDEE = 3561', () => {
      const tdee = AnthropometryEngine.calculateTdee(true, 70, 175, 30, 1.2, 1.8);
      // 1648.75 * 1.2 * 1.8 = 3561.3 -> round = 3561
      expect(tdee).toBe(3561);
    });

    it('Case 4.9: TDEE tính trực tiếp từ calculateTdeeFromBmr', () => {
      const tdee = AnthropometryEngine.calculateTdeeFromBmr(MALE_BMR, 1.55, 1.2);
      // 1648.75 * 1.55 * 1.2 = 3066.675 -> round = 3067
      expect(tdee).toBe(3067);
    });

    it('Case 4.10: BMR = 0 dẫn đến TDEE = 0', () => {
      expect(AnthropometryEngine.calculateTdeeFromBmr(0, 1.55)).toBe(0);
      expect(AnthropometryEngine.calculateTdee(true, 0, 0, 0)).toBe(0);
    });

    it('Case 4.11: Đánh giá toàn diện qua evaluate() (DRY SSOT)', () => {
      const evaluation = AnthropometryEngine.evaluate({
        isMale: true,
        weightKg: 70.5,
        heightCm: 172.0,
        dob: '1985-04-12',
        activityFactor: 1.55,
        stressFactor: 1.0,
        referenceDate: '2026-10-27',
      });

      expect(evaluation.age).toBe(41);
      expect(evaluation.bmi).toBe(23.8);
      expect(evaluation.bmiLevel).toBe(BmiCategoryWPRO.OVERWEIGHT);
      expect(evaluation.bmiStatus).toBe('Thừa cân');
      expect(evaluation.bmr).toBeGreaterThan(1500);
      expect(evaluation.tdee).toBeGreaterThan(2000);
    });
  });

  describe('5. PatientCodeAllocator & Gap-Filling Algorithm Suite', () => {
    it('Case 5.1: Người đầu tiên sử dụng SĐT -> Cấp chính chuỗi SĐT', () => {
      const allocator = new PatientCodeAllocator([], []);
      const code = allocator.peek('0901234567');
      expect(code).toBe('0901234567');
    });

    it('Case 5.2: Người thứ 2 dùng chung SĐT -> Tự động gán hậu tố -02', () => {
      const allocator = new PatientCodeAllocator(['0901234567'], ['0901234567']);
      const code = allocator.peek('0901234567');
      expect(code).toBe('0901234567-02');
    });

    it('Case 5.3: Người thứ 3 dùng chung SĐT -> Tự động gán hậu tố -03', () => {
      const allocator = new PatientCodeAllocator(
        ['0901234567', '0901234567-02'],
        ['0901234567', '0901234567'],
      );
      const code = allocator.peek('0901234567');
      expect(code).toBe('0901234567-03');
    });

    it('Case 5.4: Gap-filling: Bệnh nhân cũ mang mã -02 bị xóa -> Tự động lấp vào chỗ trống -02', () => {
      // 0901234567-02 đã bị xóa khỏi hệ thống, chỉ còn SĐT chính và -03
      const allocator = new PatientCodeAllocator(
        ['0901234567', '0901234567-03'],
        ['0901234567', '0901234567'],
      );
      const code = allocator.peek('0901234567');
      expect(code).toBe('0901234567-02');
    });

    it('Case 5.5: Người trước nhập mã tay tùy chỉnh nhưng đã có SĐT -> Người sau vẫn được cấp từ -02', () => {
      const allocator = new PatientCodeAllocator(['MANUAL_CODE_ABC'], ['0901234567']);
      const code = allocator.peek('0901234567');
      expect(code).toBe('0901234567-02');
    });

    it('Case 5.6: Mã chính SĐT đã bị chiếm bởi người khác -> Người có SĐT này được cấp ngay -02', () => {
      const allocator = new PatientCodeAllocator(['0901234567'], []);
      const code = allocator.peek('0901234567');
      expect(code).toBe('0901234567-02');
    });

    it('Case 5.7: preview() trả về đúng đối tượng { code, sharedWith, previewCode }', () => {
      const allocator = new PatientCodeAllocator(['0901234567'], ['0901234567']);
      const preview = allocator.preview('0901234567', ['Nguyễn Văn Cha']);
      expect(preview).toEqual({
        code: '0901234567-02',
        previewCode: '0901234567-02',
        sharedWith: ['Nguyễn Văn Cha'],
      });
    });

    it('Case 5.8: next() gọi liên tiếp giữ chỗ tuần tự không bao giờ sinh trùng lặp', () => {
      const allocator = new PatientCodeAllocator([], []);
      const code1 = allocator.next('0988776655');
      const code2 = allocator.next('0988776655');
      const code3 = allocator.next('0988776655');

      expect(code1).toBe('0988776655');
      expect(code2).toBe('0988776655-02');
      expect(code3).toBe('0988776655-03');
    });

    it('Case 5.9: Không truyền số điện thoại -> Sinh mã dự phòng BN-...', () => {
      const allocator = new PatientCodeAllocator([], []);
      const code = allocator.peek('');
      expect(code).toMatch(/^BN-/);
    });
  });
});
