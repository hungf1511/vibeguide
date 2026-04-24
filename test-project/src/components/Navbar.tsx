import React from 'react';
import { useAuth } from '../hooks/useAuth';

export function Navbar() {
  const { user } = useAuth();

  return (
    <nav>
      <a href="/">Trang chủ</a>
      <a href="/cart">Giỏ hàng</a>
      {user ? (
        <span>Xin chào, {user.name}</span>
      ) : (
        <a href="/login">Đăng nhập</a>
      )}
    </nav>
  );
}
