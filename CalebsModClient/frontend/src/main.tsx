import React from 'react'
import {createRoot} from 'react-dom/client'
import {BrowserRouter, Routes, Route} from 'react-router-dom'
import './style.css'
import App from './App'
import Admin from './Admin'
import InstallLauncherPage from './InstallLauncher'
import AllMods from './AllMods'
import Wiki from './Wiki'
import {ToastProvider} from './components/Toast'

const container = document.getElementById('root')

const root = createRoot(container!)

root.render(
    <React.StrictMode>
        <ToastProvider>
            <BrowserRouter>
                <Routes>
                    <Route path="/" element={<App/>} />
                    <Route path="/admin" element={<Admin/>} />
                    <Route path="/install-launcher" element={<InstallLauncherPage/>} />
                    <Route path="/all-mods" element={<AllMods/>} />
                    <Route path="/wiki" element={<Wiki/>} />
                </Routes>
            </BrowserRouter>
        </ToastProvider>
    </React.StrictMode>
)
