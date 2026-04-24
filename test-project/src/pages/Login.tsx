import React from 'react';
import { useAuth } from '../hooks/useAuth';

export function Login() {
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // BUG: Không có try/catch
    await login(email, password);
  };

  return (
    <div>
      <h1>Đăng nhập</h1>
      <form onSubmit={handleSubmit}>
        <input type="email" placeholder="Email" />
        <input type="password" placeholder="Mật khẩu" />
        <button type="submit">Đăng nhập</button>
      </form>
    </div>
  );
}
