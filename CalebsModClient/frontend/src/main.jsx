import React from 'react'
import {createRoot} from 'react-dom/client'
import {BrowserRouter, Routes, Route} from 'react-router-dom'
import './style.css'
import App from './App'
import Admin from './Admin'

const container = document.getElementById('root')

const root = createRoot(container)

root.render(
    <React.StrictMode>
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<App/>} />
                <Route path="/admin" element={<Admin/>} />
            </Routes>
        </BrowserRouter>
    </React.StrictMode>
)
