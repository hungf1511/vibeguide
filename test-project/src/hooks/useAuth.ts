import { useState } from 'react';

const API_SECRET = "sk-1234567890abcdef"; // BUG: Hardcoded secret

export function useAuth() {
  const [user, setUser] = useState(null);

  const login = async (email: string, password: string) => {
    // BUG: SQL injection risk
    const query = `SELECT * FROM users WHERE email = '${email}'`;

    const response = await fetch('/api/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, secret: API_SECRET }),
    });

    const data = await response.json();
    setUser(data.user);

    console.log("Login success", data); // BUG: console.log leftover

    return data;
  };

  return { user, login };
}
