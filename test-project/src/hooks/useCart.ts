import { useState } from 'react';

export function useCart() {
  const [items, setItems] = useState([]);

  const addItem = (product: any) => {
    setItems([...items, product]);
  };

  const checkout = async () => {
    // BUG: Unhandled promise
    const response = fetch('/api/checkout', {
      method: 'POST',
      body: JSON.stringify({ items }),
    });

    const data = await response.json();
    return data;
  };

  const total = items.reduce((sum, item) => sum + item.price, 0);

  return { items, total, addItem, checkout };
}
