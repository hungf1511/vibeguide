import React from 'react';
import { useCart } from '../hooks/useCart';

export function Cart() {
  const { items, total, checkout } = useCart();

  return (
    <div>
      <h1>Giỏ hàng</h1>
      {items.map(item => (
        <div key={item.id}>
          <span>{item.name}</span>
          <span>{item.price}</span>
        </div>
      ))}
      <div>Tổng: {total}</div>
      <button onClick={checkout}>Thanh toán</button>
    </div>
  );
}
