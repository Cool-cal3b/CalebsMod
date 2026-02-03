import React from 'react'
import {createRoot} from 'react-dom/client'
import {BrowserRouter, Routes, Route} from 'react-router-dom'
import './style.css'
import App from './App'
import Admin from './Admin'
import InstallLauncherPage from './InstallLauncher'
import AllMods from './AllMods'

const container = document.getElementById('root')

const root = createRoot(container!)

root.render(
    <React.StrictMode>
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<App/>} />
                <Route path="/admin" element={<Admin/>} />
                <Route path="/install-launcher" element={<InstallLauncherPage/>} />
                <Route path="/all-mods" element={<AllMods/>} />
            </Routes>
        </BrowserRouter>
    </React.StrictMode>
)
