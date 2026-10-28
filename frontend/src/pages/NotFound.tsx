// src/pages/NotFound.tsx
import React from 'react';
import { Link } from 'react-router-dom';

const NotFound: React.FC = () => (
  <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-white text-center p-6" style={{ background: 'linear-gradient(135deg,#1e0a3c,#2A0E46)' }}>
    <h1 className="text-5xl font-bold">404</h1>
    <p className="text-lg text-gray-300">Page not found.</p>
    <Link to="/home" className="underline hover:text-purple-300">Back to home</Link>
  </div>
);

export default NotFound;
