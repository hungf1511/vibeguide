import React from 'react';
import { useCart } from '../hooks/useCart';

export function PaymentButton() {
  const { checkout } = useCart();

  return (
    <button onClick={checkout}>
      Thanh toán ngay
    </button>
  );
}
