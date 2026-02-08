import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

/**
 * Main Entry Point - React Renderer
 * SEP490 G55 - Automation Antidetect Browser
 * 
 * File này khởi tạo React application và mount vào DOM.
 */

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
