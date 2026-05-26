import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useCallback } from 'react';
import RuleConfig, { validateRuleConfig } from './RuleConfig';
function validateProduct(values) {
    const errors = {};
    if (!values.name.trim()) {
        errors.name = '商品名称不能为空';
    }
    else if (values.name.trim().length > 100) {
        errors.name = '商品名称不能超过 100 个字符';
    }
    if (values.description.length > 2000) {
        errors.description = '商品描述不能超过 2000 个字符';
    }
    return errors;
}
export default function ProductForm({ initialValues, onSubmit, isSubmitting }) {
    const [product, setProduct] = useState({
        name: initialValues?.name ?? '',
        description: initialValues?.description ?? '',
        imageUrl: initialValues?.imageUrl ?? '',
        category: initialValues?.category ?? '',
    });
    const [rules, setRules] = useState(null);
    const [errors, setErrors] = useState({});
    const handleRuleChange = useCallback((values) => {
        setRules(values);
    }, []);
    const handleSubmit = async (e) => {
        e.preventDefault();
        // Validate product fields
        const productErrors = validateProduct(product);
        setErrors(productErrors);
        // Validate rules
        const ruleErrors = rules ? validateRuleConfig(rules) : [{ field: 'general', message: '请填写竞拍规则' }];
        if (Object.keys(productErrors).length > 0 || ruleErrors.length > 0) {
            return;
        }
        if (!rules)
            return;
        await onSubmit(product, rules);
    };
    const updateField = (field, value) => {
        setProduct((prev) => ({ ...prev, [field]: value }));
        // Clear error on change
        if (errors[field]) {
            setErrors((prev) => {
                const next = { ...prev };
                delete next[field];
                return next;
            });
        }
    };
    return (_jsxs("form", { onSubmit: handleSubmit, className: "space-y-8", children: [_jsxs("div", { className: "space-y-5", children: [_jsx("h3", { className: "text-base font-semibold text-text-primary", children: "\u5546\u54C1\u4FE1\u606F" }), _jsxs("div", { children: [_jsxs("label", { htmlFor: "name", className: "block text-sm font-medium text-text-secondary mb-1.5", children: ["\u5546\u54C1\u540D\u79F0 ", _jsx("span", { className: "text-brand", children: "*" })] }), _jsx("input", { id: "name", type: "text", value: product.name, onChange: (e) => updateField('name', e.target.value), placeholder: "\u8BF7\u8F93\u5165\u5546\u54C1\u540D\u79F0", required: true, maxLength: 100, className: "w-full bg-surface-secondary border border-white/10 rounded-md px-4 py-2.5 text-text-primary placeholder-text-tertiary focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-colors" }), errors.name && _jsx("p", { className: "text-red-400 text-xs mt-1", children: errors.name })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "description", className: "block text-sm font-medium text-text-secondary mb-1.5", children: "\u5546\u54C1\u63CF\u8FF0" }), _jsx("textarea", { id: "description", value: product.description, onChange: (e) => updateField('description', e.target.value), placeholder: "\u8BF7\u8F93\u5165\u5546\u54C1\u63CF\u8FF0\uFF08\u9009\u586B\uFF09", rows: 4, maxLength: 2000, className: "w-full bg-surface-secondary border border-white/10 rounded-md px-4 py-2.5 text-text-primary placeholder-text-tertiary focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-colors resize-none" }), errors.description && _jsx("p", { className: "text-red-400 text-xs mt-1", children: errors.description }), _jsxs("p", { className: "text-text-tertiary text-xs mt-1", children: [product.description.length, "/2000"] })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "imageUrl", className: "block text-sm font-medium text-text-secondary mb-1.5", children: "\u56FE\u7247 URL" }), _jsx("input", { id: "imageUrl", type: "url", value: product.imageUrl, onChange: (e) => updateField('imageUrl', e.target.value), placeholder: "\u8BF7\u8F93\u5165\u5546\u54C1\u56FE\u7247\u94FE\u63A5\uFF08\u9009\u586B\uFF09", className: "w-full bg-surface-secondary border border-white/10 rounded-md px-4 py-2.5 text-text-primary placeholder-text-tertiary focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-colors" }), product.imageUrl && (_jsx("div", { className: "mt-2 w-32 h-20 bg-surface-secondary rounded-md overflow-hidden border border-white/10", children: _jsx("img", { src: product.imageUrl, alt: "Preview", className: "w-full h-full object-cover", onError: (e) => {
                                        e.target.style.display = 'none';
                                    } }) }))] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "category", className: "block text-sm font-medium text-text-secondary mb-1.5", children: "\u5206\u7C7B" }), _jsx("input", { id: "category", type: "text", value: product.category, onChange: (e) => updateField('category', e.target.value), placeholder: "\u8BF7\u8F93\u5165\u5206\u7C7B\uFF08\u9009\u586B\uFF0C\u5982\uFF1A\u7535\u5B50\u4EA7\u54C1\u3001\u827A\u672F\u54C1\uFF09", className: "w-full bg-surface-secondary border border-white/10 rounded-md px-4 py-2.5 text-text-primary placeholder-text-tertiary focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-colors" })] })] }), _jsx("div", { className: "border-t border-white/10" }), _jsx(RuleConfig, { onChange: handleRuleChange }), _jsxs("div", { className: "flex justify-end gap-3 pt-4 border-t border-white/10", children: [_jsx("button", { type: "button", onClick: () => window.history.back(), className: "px-6 py-2.5 rounded-md border border-white/10 text-text-secondary hover:bg-surface-secondary transition-colors", children: "\u53D6\u6D88" }), _jsx("button", { type: "submit", disabled: isSubmitting, className: "px-6 py-2.5 bg-brand hover:bg-brand-hover text-white rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed", children: isSubmitting ? '创建中...' : '创建商品' })] })] }));
}
