import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from 'react';
const DEFAULT_VALUES = {
    startPrice: 0,
    bidIncrement: 10,
    ceilingPrice: null,
    hasCeilingPrice: false,
    durationSeconds: 300,
    extendSeconds: 20,
    maxExtensions: 10,
};
function validate(values) {
    const errors = [];
    if (values.startPrice < 0) {
        errors.push({ field: 'startPrice', message: '起拍价不能为负数' });
    }
    if (values.bidIncrement <= 0) {
        errors.push({ field: 'bidIncrement', message: '加价幅度必须大于 0' });
    }
    else if (values.bidIncrement > 1000000) {
        errors.push({ field: 'bidIncrement', message: '加价幅度不能超过 ¥1,000,000' });
    }
    if (values.hasCeilingPrice) {
        if (values.ceilingPrice === null || values.ceilingPrice <= 0) {
            errors.push({ field: 'ceilingPrice', message: '封顶价必须大于 0' });
        }
        else if (values.ceilingPrice <= values.startPrice) {
            errors.push({ field: 'ceilingPrice', message: '封顶价必须大于起拍价' });
        }
        else if (values.ceilingPrice > 100000000) {
            errors.push({ field: 'ceilingPrice', message: '封顶价不能超过 ¥100,000,000' });
        }
    }
    if (values.durationSeconds < 10) {
        errors.push({ field: 'durationSeconds', message: '竞拍时长不能少于 10 秒' });
    }
    else if (values.durationSeconds > 86400) {
        errors.push({ field: 'durationSeconds', message: '竞拍时长不能超过 24 小时' });
    }
    if (values.extendSeconds < 0) {
        errors.push({ field: 'extendSeconds', message: '延时时长不能为负数' });
    }
    else if (values.extendSeconds > 600) {
        errors.push({ field: 'extendSeconds', message: '延时时长不能超过 600 秒' });
    }
    if (values.maxExtensions < 0) {
        errors.push({ field: 'maxExtensions', message: '最大延时次数不能为负数' });
    }
    else if (values.maxExtensions > 100) {
        errors.push({ field: 'maxExtensions', message: '最大延时次数不能超过 100' });
    }
    return errors;
}
export { validate as validateRuleConfig };
export default function RuleConfig({ values: externalValues, onChange }) {
    const [values, setValues] = useState({
        ...DEFAULT_VALUES,
        ...externalValues,
        ceilingPrice: externalValues?.ceilingPrice ?? DEFAULT_VALUES.ceilingPrice,
        hasCeilingPrice: externalValues?.hasCeilingPrice ?? (externalValues?.ceilingPrice !== null && externalValues?.ceilingPrice !== undefined),
    });
    const [errors, setErrors] = useState([]);
    const updateValue = useCallback((field, value) => {
        setValues((prev) => {
            const next = { ...prev, [field]: value };
            return next;
        });
    }, []);
    // Propagate changes and validate
    useEffect(() => {
        const validationErrors = validate(values);
        setErrors(validationErrors);
        onChange?.(values);
    }, [values, onChange]);
    const getError = (field) => errors.find((e) => e.field === field)?.message;
    return (_jsxs("div", { className: "space-y-5", children: [_jsx("h3", { className: "text-base font-semibold text-text-primary", children: "\u7ADE\u62CD\u89C4\u5219" }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-text-secondary mb-1.5", children: "\u8D77\u62CD\u4EF7 (\u00A5)" }), _jsx("input", { type: "number", value: values.startPrice, onChange: (e) => updateValue('startPrice', Number(e.target.value)), min: 0, className: "w-full bg-surface-secondary border border-white/10 rounded-md px-4 py-2.5 text-text-primary placeholder-text-tertiary focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-colors" }), _jsx("p", { className: "text-text-tertiary text-xs mt-1", children: "\u9ED8\u8BA4 0 \u5143\u8D77\u62CD" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-text-secondary mb-1.5", children: "\u52A0\u4EF7\u5E45\u5EA6 (\u00A5)" }), _jsx("input", { type: "number", value: values.bidIncrement, onChange: (e) => updateValue('bidIncrement', Number(e.target.value)), min: 1, required: true, className: "w-full bg-surface-secondary border border-white/10 rounded-md px-4 py-2.5 text-text-primary placeholder-text-tertiary focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-colors" }), getError('bidIncrement') && (_jsx("p", { className: "text-red-400 text-xs mt-1", children: getError('bidIncrement') }))] }), _jsxs("div", { children: [_jsxs("div", { className: "flex items-center gap-2 mb-1.5", children: [_jsx("input", { id: "hasCeilingPrice", type: "checkbox", checked: values.hasCeilingPrice, onChange: (e) => {
                                    updateValue('hasCeilingPrice', e.target.checked);
                                    if (!e.target.checked) {
                                        updateValue('ceilingPrice', null);
                                    }
                                }, className: "w-4 h-4 rounded border-white/10 bg-surface-secondary text-brand focus:ring-brand" }), _jsx("label", { htmlFor: "hasCeilingPrice", className: "text-sm font-medium text-text-secondary", children: "\u8BBE\u7F6E\u5C01\u9876\u4EF7 (\u00A5)" })] }), values.hasCeilingPrice && (_jsxs(_Fragment, { children: [_jsx("input", { type: "number", value: values.ceilingPrice ?? '', onChange: (e) => updateValue('ceilingPrice', e.target.value ? Number(e.target.value) : null), min: 1, placeholder: "\u8BF7\u8F93\u5165\u5C01\u9876\u4EF7", className: "w-full bg-surface-secondary border border-white/10 rounded-md px-4 py-2.5 text-text-primary placeholder-text-tertiary focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-colors" }), getError('ceilingPrice') && (_jsx("p", { className: "text-red-400 text-xs mt-1", children: getError('ceilingPrice') }))] }))] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-text-secondary mb-1.5", children: "\u7ADE\u62CD\u65F6\u957F (\u79D2)" }), _jsx("input", { type: "number", value: values.durationSeconds, onChange: (e) => updateValue('durationSeconds', Number(e.target.value)), min: 10, max: 86400, required: true, className: "w-full bg-surface-secondary border border-white/10 rounded-md px-4 py-2.5 text-text-primary placeholder-text-tertiary focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-colors" }), getError('durationSeconds') && (_jsx("p", { className: "text-red-400 text-xs mt-1", children: getError('durationSeconds') })), _jsx("p", { className: "text-text-tertiary text-xs mt-1", children: "\u8303\u56F4: 10 \u79D2 ~ 24 \u5C0F\u65F6 (86400 \u79D2)" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-text-secondary mb-1.5", children: "\u5EF6\u65F6\u79D2\u6570" }), _jsx("input", { type: "number", value: values.extendSeconds, onChange: (e) => updateValue('extendSeconds', Number(e.target.value)), min: 0, max: 600, required: true, className: "w-full bg-surface-secondary border border-white/10 rounded-md px-4 py-2.5 text-text-primary placeholder-text-tertiary focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-colors" }), getError('extendSeconds') && (_jsx("p", { className: "text-red-400 text-xs mt-1", children: getError('extendSeconds') })), _jsx("p", { className: "text-text-tertiary text-xs mt-1", children: "\u6709\u4EBA\u5728\u6700\u540E\u65F6\u6BB5\u51FA\u4EF7\u65F6\u81EA\u52A8\u5EF6\u65F6" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-text-secondary mb-1.5", children: "\u6700\u5927\u5EF6\u65F6\u6B21\u6570" }), _jsx("input", { type: "number", value: values.maxExtensions, onChange: (e) => updateValue('maxExtensions', Number(e.target.value)), min: 0, max: 100, required: true, className: "w-full bg-surface-secondary border border-white/10 rounded-md px-4 py-2.5 text-text-primary placeholder-text-tertiary focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-colors" }), getError('maxExtensions') && (_jsx("p", { className: "text-red-400 text-xs mt-1", children: getError('maxExtensions') })), _jsx("p", { className: "text-text-tertiary text-xs mt-1", children: "\u9ED8\u8BA4 10 \u6B21\uFF0C0 \u8868\u793A\u4E0D\u9650\u5236" })] })] }));
}
export { DEFAULT_VALUES };
