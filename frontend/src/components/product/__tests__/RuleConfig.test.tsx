import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import RuleConfig, { validateRuleConfig } from '../RuleConfig';
import type { RuleConfigValues } from '../RuleConfig';

/** Helper: find the <input> sibling of a label whose text matches `re` */
function getInputByLabelText(container: HTMLElement, re: RegExp): HTMLInputElement {
  const labels = Array.from(container.querySelectorAll('label'));
  const label = labels.find((l) => re.test(l.textContent ?? ''));
  if (!label) throw new Error(`Label not found: ${re}`);
  const parent = label.parentElement!;
  const input = parent.querySelector('input') as HTMLInputElement | null;
  if (!input) throw new Error(`Input not found near label: ${re}`);
  return input;
}

describe('RuleConfig', () => {
  // -- Rendering ----------------------------------------------------------

  it('renders bidIncrement, ceilingPrice and durationSeconds inputs', () => {
    const { container } = render(<RuleConfig />);

    // Labels use Chinese text; they don't have htmlFor, so query via helper
    expect(getInputByLabelText(container, /加价幅度/)).toBeInTheDocument();
    expect(screen.getByLabelText(/设置封顶价/)).toBeInTheDocument(); // checkbox has htmlFor
    expect(getInputByLabelText(container, /竞拍时长/)).toBeInTheDocument();
    expect(getInputByLabelText(container, /延时秒数/)).toBeInTheDocument();
    expect(getInputByLabelText(container, /最大延时次数/)).toBeInTheDocument();
  });

  it('renders startPrice input with default value 0', () => {
    const { container } = render(<RuleConfig />);

    const input = getInputByLabelText(container, /起拍价/);
    expect(input).toBeInTheDocument();
    expect(Number(input.value)).toBe(0);
  });

  // -- Validation: bidIncrement > 0 ---------------------------------------

  describe('validateRuleConfig - bidIncrement', () => {
    const base: RuleConfigValues = {
      startPrice: 0,
      bidIncrement: 10,
      ceilingPrice: null,
      hasCeilingPrice: false,
      durationSeconds: 300,
      extendSeconds: 20,
      maxExtensions: 10,
    };

    it('returns error when bidIncrement is 0', () => {
      const errors = validateRuleConfig({ ...base, bidIncrement: 0 });
      const bidError = errors.find((e) => e.field === 'bidIncrement');
      expect(bidError).toBeDefined();
      expect(bidError!.message).toBe('加价幅度必须大于 0');
    });

    it('returns error when bidIncrement is negative', () => {
      const errors = validateRuleConfig({ ...base, bidIncrement: -5 });
      const bidError = errors.find((e) => e.field === 'bidIncrement');
      expect(bidError).toBeDefined();
      expect(bidError!.message).toBe('加价幅度必须大于 0');
    });

    it('returns no error when bidIncrement is positive', () => {
      const errors = validateRuleConfig({ ...base, bidIncrement: 10 });
      const bidError = errors.find((e) => e.field === 'bidIncrement');
      expect(bidError).toBeUndefined();
    });
  });

  // -- Validation: ceilingPrice >= startPrice -----------------------------

  describe('validateRuleConfig - ceilingPrice', () => {
    const base: RuleConfigValues = {
      startPrice: 100,
      bidIncrement: 10,
      ceilingPrice: null,
      hasCeilingPrice: false,
      durationSeconds: 300,
      extendSeconds: 20,
      maxExtensions: 10,
    };

    it('returns error when ceilingPrice is less than startPrice', () => {
      const errors = validateRuleConfig({
        ...base,
        hasCeilingPrice: true,
        ceilingPrice: 50,
      });
      const ceilError = errors.find((e) => e.field === 'ceilingPrice');
      expect(ceilError).toBeDefined();
      expect(ceilError!.message).toBe('封顶价必须大于起拍价');
    });

    it('returns error when ceilingPrice equals startPrice', () => {
      const errors = validateRuleConfig({
        ...base,
        hasCeilingPrice: true,
        ceilingPrice: 100,
      });
      const ceilError = errors.find((e) => e.field === 'ceilingPrice');
      expect(ceilError).toBeDefined();
      expect(ceilError!.message).toBe('封顶价必须大于起拍价');
    });

    it('returns no error when ceilingPrice is greater than startPrice', () => {
      const errors = validateRuleConfig({
        ...base,
        hasCeilingPrice: true,
        ceilingPrice: 500,
      });
      const ceilError = errors.find((e) => e.field === 'ceilingPrice');
      expect(ceilError).toBeUndefined();
    });

    it('skips ceilingPrice validation when hasCeilingPrice is false', () => {
      const errors = validateRuleConfig({
        ...base,
        hasCeilingPrice: false,
        ceilingPrice: 1, // would fail if validated
      });
      const ceilError = errors.find((e) => e.field === 'ceilingPrice');
      expect(ceilError).toBeUndefined();
    });

    it('returns error when ceilingPrice is null but hasCeilingPrice is true', () => {
      const errors = validateRuleConfig({
        ...base,
        hasCeilingPrice: true,
        ceilingPrice: null,
      });
      const ceilError = errors.find((e) => e.field === 'ceilingPrice');
      expect(ceilError).toBeDefined();
      expect(ceilError!.message).toBe('封顶价必须大于 0');
    });
  });

  // -- onChange callback --------------------------------------------------

  it('calls onChange with current values on mount', () => {
    const onChange = vi.fn();
    render(<RuleConfig onChange={onChange} />);

    expect(onChange).toHaveBeenCalled();
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(lastCall.bidIncrement).toBe(10);
    expect(lastCall.durationSeconds).toBe(300);
  });

  it('calls onChange when bidIncrement input changes', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = render(<RuleConfig onChange={onChange} />);

    onChange.mockClear();
    const input = getInputByLabelText(container, /加价幅度/);
    await user.clear(input);
    await user.type(input, '25');

    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(lastCall.bidIncrement).toBe(25);
  });
});
