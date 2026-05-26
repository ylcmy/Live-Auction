import { useState, useEffect, useCallback } from 'react';

interface RuleConfigValues {
  startPrice: number;
  bidIncrement: number;
  ceilingPrice: number | null;
  hasCeilingPrice: boolean;
  durationSeconds: number;
  extendSeconds: number;
  maxExtensions: number;
}

interface RuleConfigProps {
  values?: Partial<RuleConfigValues>;
  onChange?: (values: RuleConfigValues) => void;
}

interface FieldError {
  field: string;
  message: string;
}

const DEFAULT_VALUES: RuleConfigValues = {
  startPrice: 0,
  bidIncrement: 10,
  ceilingPrice: null,
  hasCeilingPrice: false,
  durationSeconds: 300,
  extendSeconds: 20,
  maxExtensions: 10,
};

function validate(values: RuleConfigValues): FieldError[] {
  const errors: FieldError[] = [];

  if (values.startPrice < 0) {
    errors.push({ field: 'startPrice', message: '起拍价不能为负数' });
  }

  if (values.bidIncrement <= 0) {
    errors.push({ field: 'bidIncrement', message: '加价幅度必须大于 0' });
  } else if (values.bidIncrement > 1000000) {
    errors.push({ field: 'bidIncrement', message: '加价幅度不能超过 ¥1,000,000' });
  }

  if (values.hasCeilingPrice) {
    if (values.ceilingPrice === null || values.ceilingPrice <= 0) {
      errors.push({ field: 'ceilingPrice', message: '封顶价必须大于 0' });
    } else if (values.ceilingPrice <= values.startPrice) {
      errors.push({ field: 'ceilingPrice', message: '封顶价必须大于起拍价' });
    } else if (values.ceilingPrice > 100000000) {
      errors.push({ field: 'ceilingPrice', message: '封顶价不能超过 ¥100,000,000' });
    }
  }

  if (values.durationSeconds < 10) {
    errors.push({ field: 'durationSeconds', message: '竞拍时长不能少于 10 秒' });
  } else if (values.durationSeconds > 86400) {
    errors.push({ field: 'durationSeconds', message: '竞拍时长不能超过 24 小时' });
  }

  if (values.extendSeconds < 0) {
    errors.push({ field: 'extendSeconds', message: '延时时长不能为负数' });
  } else if (values.extendSeconds > 600) {
    errors.push({ field: 'extendSeconds', message: '延时时长不能超过 600 秒' });
  }

  if (values.maxExtensions < 0) {
    errors.push({ field: 'maxExtensions', message: '最大延时次数不能为负数' });
  } else if (values.maxExtensions > 100) {
    errors.push({ field: 'maxExtensions', message: '最大延时次数不能超过 100' });
  }

  return errors;
}

export type { RuleConfigValues, FieldError };
export { validate as validateRuleConfig };

export default function RuleConfig({ values: externalValues, onChange }: RuleConfigProps) {
  const [values, setValues] = useState<RuleConfigValues>({
    ...DEFAULT_VALUES,
    ...externalValues,
    ceilingPrice: externalValues?.ceilingPrice ?? DEFAULT_VALUES.ceilingPrice,
    hasCeilingPrice: externalValues?.hasCeilingPrice ?? (externalValues?.ceilingPrice !== null && externalValues?.ceilingPrice !== undefined),
  });
  const [errors, setErrors] = useState<FieldError[]>([]);

  const updateValue = useCallback(
    <K extends keyof RuleConfigValues>(field: K, value: RuleConfigValues[K]) => {
      setValues((prev) => {
        const next = { ...prev, [field]: value };
        return next;
      });
    },
    [],
  );

  // Propagate changes and validate
  useEffect(() => {
    const validationErrors = validate(values);
    setErrors(validationErrors);
    onChange?.(values);
  }, [values, onChange]);

  const getError = (field: string) => errors.find((e) => e.field === field)?.message;

  return (
    <div className="space-y-5">
      <h3 className="text-base font-semibold text-text-primary">竞拍规则</h3>

      {/* Start Price (read-only for 0元起拍) */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1.5">起拍价 (¥)</label>
        <input
          type="number"
          value={values.startPrice}
          onChange={(e) => updateValue('startPrice', Number(e.target.value))}
          min={0}
          className="w-full bg-surface-secondary border border-white/10 rounded-md px-4 py-2.5 text-text-primary placeholder-text-tertiary focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-colors"
        />
        <p className="text-text-tertiary text-xs mt-1">默认 0 元起拍</p>
      </div>

      {/* Bid Increment */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1.5">加价幅度 (¥)</label>
        <input
          type="number"
          value={values.bidIncrement}
          onChange={(e) => updateValue('bidIncrement', Number(e.target.value))}
          min={1}
          required
          className="w-full bg-surface-secondary border border-white/10 rounded-md px-4 py-2.5 text-text-primary placeholder-text-tertiary focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-colors"
        />
        {getError('bidIncrement') && (
          <p className="text-red-400 text-xs mt-1">{getError('bidIncrement')}</p>
        )}
      </div>

      {/* Ceiling Price (optional) */}
      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <input
            id="hasCeilingPrice"
            type="checkbox"
            checked={values.hasCeilingPrice}
            onChange={(e) => {
              updateValue('hasCeilingPrice', e.target.checked);
              if (!e.target.checked) {
                updateValue('ceilingPrice', null);
              }
            }}
            className="w-4 h-4 rounded border-white/10 bg-surface-secondary text-brand focus:ring-brand"
          />
          <label htmlFor="hasCeilingPrice" className="text-sm font-medium text-text-secondary">
            设置封顶价 (¥)
          </label>
        </div>
        {values.hasCeilingPrice && (
          <>
            <input
              type="number"
              value={values.ceilingPrice ?? ''}
              onChange={(e) => updateValue('ceilingPrice', e.target.value ? Number(e.target.value) : null)}
              min={1}
              placeholder="请输入封顶价"
              className="w-full bg-surface-secondary border border-white/10 rounded-md px-4 py-2.5 text-text-primary placeholder-text-tertiary focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-colors"
            />
            {getError('ceilingPrice') && (
              <p className="text-red-400 text-xs mt-1">{getError('ceilingPrice')}</p>
            )}
          </>
        )}
      </div>

      {/* Duration */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1.5">竞拍时长 (秒)</label>
        <input
          type="number"
          value={values.durationSeconds}
          onChange={(e) => updateValue('durationSeconds', Number(e.target.value))}
          min={10}
          max={86400}
          required
          className="w-full bg-surface-secondary border border-white/10 rounded-md px-4 py-2.5 text-text-primary placeholder-text-tertiary focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-colors"
        />
        {getError('durationSeconds') && (
          <p className="text-red-400 text-xs mt-1">{getError('durationSeconds')}</p>
        )}
        <p className="text-text-tertiary text-xs mt-1">范围: 10 秒 ~ 24 小时 (86400 秒)</p>
      </div>

      {/* Extend Seconds */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1.5">延时秒数</label>
        <input
          type="number"
          value={values.extendSeconds}
          onChange={(e) => updateValue('extendSeconds', Number(e.target.value))}
          min={0}
          max={600}
          required
          className="w-full bg-surface-secondary border border-white/10 rounded-md px-4 py-2.5 text-text-primary placeholder-text-tertiary focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-colors"
        />
        {getError('extendSeconds') && (
          <p className="text-red-400 text-xs mt-1">{getError('extendSeconds')}</p>
        )}
        <p className="text-text-tertiary text-xs mt-1">有人在最后时段出价时自动延时</p>
      </div>

      {/* Max Extensions */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1.5">最大延时次数</label>
        <input
          type="number"
          value={values.maxExtensions}
          onChange={(e) => updateValue('maxExtensions', Number(e.target.value))}
          min={0}
          max={100}
          required
          className="w-full bg-surface-secondary border border-white/10 rounded-md px-4 py-2.5 text-text-primary placeholder-text-tertiary focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-colors"
        />
        {getError('maxExtensions') && (
          <p className="text-red-400 text-xs mt-1">{getError('maxExtensions')}</p>
        )}
        <p className="text-text-tertiary text-xs mt-1">默认 10 次，0 表示不限制</p>
      </div>
    </div>
  );
}

export { DEFAULT_VALUES };
