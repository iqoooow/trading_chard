import { describe, expect, it } from 'vitest';
import { dateParts, findZoneAt, formatDate } from './zoneStyle';

describe('findZoneAt', () => {
  const wide = { id: 'wide', from: 0, to: 100, top: 110, bottom: 90 };
  const narrow = { id: 'narrow', from: 50, to: 80, top: 102, bottom: 98 };
  const zones = [wide, narrow];

  it('kursor ostidagi zonani topadi', () => {
    expect(findZoneAt(zones, 10, 95)?.id).toBe('wide');
  });

  it('ichma-ich zonalarda eng ingichkasini tanlaydi', () => {
    expect(findZoneAt(zones, 60, 100)?.id).toBe('narrow');
  });

  it('zona vaqt yoki narx oralig\'idan tashqarida bo\'lsa null', () => {
    expect(findZoneAt(zones, 101, 100)).toBeNull();
    expect(findZoneAt(zones, 60, 111)).toBeNull();
    expect(findZoneAt([], 0, 0)).toBeNull();
  });

  it('chegaralar ichkariga kiradi', () => {
    expect(findZoneAt([wide], 0, 90)?.id).toBe('wide');
    expect(findZoneAt([wide], 100, 110)?.id).toBe('wide');
  });
});

describe('sana formatlash', () => {
  it('UTC soniya, BusinessDay va satr bir xil natija beradi', () => {
    const expected = { year: 2026, month: 2, day: 9 };
    expect(dateParts(Date.UTC(2026, 1, 9) / 1000)).toEqual(expected);
    expect(dateParts('2026-02-09')).toEqual(expected);
    expect(dateParts(expected)).toEqual(expected);
  });

  it('o\'zbekcha oy nomlari', () => {
    expect(formatDate('2026-09-25')).toBe('25 sen 2026');
    expect(formatDate('2026-01-01')).toBe('1 yan 2026');
  });
});
