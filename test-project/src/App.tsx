import React from 'react';
import { Navbar } from './components/Navbar';
import { Login } from './pages/Login';
import { Cart } from './pages/Cart';

export function App() {
  return (
    <div>
      <Navbar />
      <Login />
      <Cart />
    </div>
  );
}
