import { jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { Navigate } from 'react-router-dom';
export default function ProtectedRoute({ children, requiredRole }) {
    const token = localStorage.getItem('accessToken');
    if (!token) {
        return _jsx(Navigate, { to: "/login", replace: true });
    }
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (requiredRole && payload.role !== requiredRole) {
            return _jsx(Navigate, { to: "/login", replace: true });
        }
    }
    catch {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        return _jsx(Navigate, { to: "/login", replace: true });
    }
    return _jsx(_Fragment, { children: children });
}
