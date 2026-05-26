import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '../../store/authStore';
import { Button } from '../../design-system/components/ui/button';
import { Input } from '../../design-system/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../design-system/components/ui/card';
const stagger = {
    animate: {
        transition: { staggerChildren: 0.08 },
    },
};
const fadeUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
};
export default function Register() {
    const { register, isLoading, error, clearError } = useAuthStore();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [nickname, setNickname] = useState('');
    const [role, setRole] = useState('merchant');
    const [success, setSuccess] = useState(false);
    const handleSubmit = async (e) => {
        e.preventDefault();
        clearError();
        await register(username, password, nickname, role);
        const currentError = useAuthStore.getState().error;
        if (!currentError) {
            setSuccess(true);
        }
    };
    if (success) {
        return (_jsxs("div", { className: "min-h-screen bg-black flex items-center justify-center px-4 relative overflow-hidden", children: [_jsxs("div", { className: "absolute inset-0", children: [_jsx("div", { className: "absolute top-1/4 left-1/4 w-96 h-96 bg-brand/10 rounded-full blur-3xl" }), _jsx("div", { className: "absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl" })] }), _jsx(motion.div, { initial: { opacity: 0, scale: 0.95 }, animate: { opacity: 1, scale: 1 }, transition: { duration: 0.5 }, className: "w-full max-w-md relative z-10", children: _jsx(Card, { className: "bg-surface-card border-white/10 shadow-2xl", children: _jsxs(CardContent, { className: "pt-8 pb-8 text-center", children: [_jsx(motion.div, { initial: { scale: 0 }, animate: { scale: 1 }, transition: { type: 'spring', delay: 0.2 }, className: "w-16 h-16 bg-success/20 rounded-full flex items-center justify-center mx-auto mb-4", children: _jsx("svg", { className: "w-8 h-8 text-success", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M5 13l4 4L19 7" }) }) }), _jsx("h2", { className: "text-xl font-semibold text-white mb-2", children: "\u6CE8\u518C\u6210\u529F" }), _jsx("p", { className: "text-text-tertiary mb-6", children: "\u60A8\u7684\u8D26\u53F7\u5DF2\u521B\u5EFA\u6210\u529F\uFF0C\u8BF7\u767B\u5F55\u540E\u4F7F\u7528" }), _jsx(Link, { to: "/login", children: _jsx(Button, { className: "bg-brand hover:bg-brand-hover text-white shadow-[0_4px_16px_rgba(254,44,85,0.25)]", children: "\u524D\u5F80\u767B\u5F55" }) })] }) }) })] }));
    }
    return (_jsxs("div", { className: "min-h-screen bg-black flex items-center justify-center px-4 relative overflow-hidden", children: [_jsxs("div", { className: "absolute inset-0", children: [_jsx("div", { className: "absolute top-1/4 left-1/4 w-96 h-96 bg-brand/10 rounded-full blur-3xl" }), _jsx("div", { className: "absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl" })] }), _jsxs(motion.div, { className: "w-full max-w-md relative z-10", variants: stagger, initial: "initial", animate: "animate", children: [_jsxs(motion.div, { className: "text-center mb-8", variants: fadeUp, children: [_jsx("div", { className: "inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-brand to-pink-500 mb-4 shadow-[0_0_30px_rgba(254,44,85,0.3)]", children: _jsx("span", { className: "text-2xl font-bold text-white", children: "\u62CD" }) }), _jsx("h1", { className: "text-3xl font-bold text-white", children: "Live Auction" }), _jsx("p", { className: "text-text-tertiary mt-2", children: "\u521B\u5EFA\u60A8\u7684\u8D26\u53F7" })] }), _jsx(motion.div, { variants: fadeUp, children: _jsxs(Card, { className: "bg-surface-card border-white/10 shadow-2xl", children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { className: "text-white text-xl", children: "\u6CE8\u518C" }), _jsx(CardDescription, { className: "text-text-tertiary", children: "\u586B\u5199\u4EE5\u4E0B\u4FE1\u606F\u521B\u5EFA\u8D26\u53F7" })] }), _jsxs(CardContent, { children: [_jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "username", className: "block text-sm font-medium text-text-secondary mb-1.5", children: "\u7528\u6237\u540D" }), _jsx(Input, { id: "username", type: "text", value: username, onChange: (e) => setUsername(e.target.value), placeholder: "\u8BF7\u8F93\u5165\u7528\u6237\u540D", required: true, minLength: 3, className: "bg-surface-secondary border-white/10 text-white placeholder:text-text-tertiary focus-visible:ring-brand" })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "password", className: "block text-sm font-medium text-text-secondary mb-1.5", children: "\u5BC6\u7801" }), _jsx(Input, { id: "password", type: "password", value: password, onChange: (e) => setPassword(e.target.value), placeholder: "\u8BF7\u8F93\u5165\u5BC6\u7801\uFF08\u81F3\u5C116\u4F4D\uFF09", required: true, minLength: 6, className: "bg-surface-secondary border-white/10 text-white placeholder:text-text-tertiary focus-visible:ring-brand" })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "nickname", className: "block text-sm font-medium text-text-secondary mb-1.5", children: "\u6635\u79F0" }), _jsx(Input, { id: "nickname", type: "text", value: nickname, onChange: (e) => setNickname(e.target.value), placeholder: "\u8BF7\u8F93\u5165\u6635\u79F0", required: true, className: "bg-surface-secondary border-white/10 text-white placeholder:text-text-tertiary focus-visible:ring-brand" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-text-secondary mb-1.5", children: "\u89D2\u8272" }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsx("button", { type: "button", onClick: () => setRole('merchant'), className: `px-4 py-3 rounded-lg border text-sm font-medium transition-all duration-200 ${role === 'merchant'
                                                                        ? 'bg-brand/15 border-brand text-brand shadow-[0_0_12px_rgba(254,44,85,0.2)]'
                                                                        : 'bg-surface-secondary text-text-secondary border-white/10 hover:border-white/20'}`, children: "\u5546\u5BB6" }), _jsx("button", { type: "button", onClick: () => setRole('user'), className: `px-4 py-3 rounded-lg border text-sm font-medium transition-all duration-200 ${role === 'user'
                                                                        ? 'bg-brand/15 border-brand text-brand shadow-[0_0_12px_rgba(254,44,85,0.2)]'
                                                                        : 'bg-surface-secondary text-text-secondary border-white/10 hover:border-white/20'}`, children: "\u7528\u6237" })] })] }), error && (_jsx(motion.div, { initial: { opacity: 0, y: -8 }, animate: { opacity: 1, y: 0 }, className: "bg-brand/10 border border-brand/30 rounded-lg px-4 py-3 text-sm text-brand", children: error })), _jsx(Button, { type: "submit", disabled: isLoading, className: "w-full bg-brand hover:bg-brand-hover text-white font-medium h-11 transition-all duration-200 shadow-[0_4px_16px_rgba(254,44,85,0.25)] hover:shadow-[0_6px_24px_rgba(254,44,85,0.4)]", children: isLoading ? '注册中...' : '注册' })] }), _jsxs("p", { className: "text-center text-sm text-text-tertiary mt-6", children: ["\u5DF2\u6709\u8D26\u53F7\uFF1F", ' ', _jsx(Link, { to: "/login", className: "text-brand hover:text-brand-hover transition-colors font-medium", children: "\u7ACB\u5373\u767B\u5F55" })] })] })] }) })] })] }));
}
