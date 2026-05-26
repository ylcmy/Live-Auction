import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Component } from 'react';
export class ErrorBoundary extends Component {
    state = { hasError: false, error: null };
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    componentDidCatch(error, info) {
        console.error('ErrorBoundary caught:', error, info);
    }
    render() {
        if (this.state.hasError) {
            return (_jsx("div", { className: "min-h-screen bg-surface-primary flex items-center justify-center p-8", children: _jsxs("div", { className: "text-center", children: [_jsx("div", { className: "text-6xl mb-4", children: "\uD83D\uDE35" }), _jsx("h2", { className: "text-xl font-bold text-text-primary mb-2", children: "\u51FA\u4E86\u70B9\u95EE\u9898" }), _jsx("p", { className: "text-text-secondary mb-4", children: this.state.error?.message }), _jsx("button", { onClick: () => {
                                this.setState({ hasError: false });
                                window.location.reload();
                            }, className: "px-6 py-2 bg-brand rounded-full text-white font-semibold", children: "\u5237\u65B0\u9875\u9762" })] }) }));
        }
        return this.props.children;
    }
}
