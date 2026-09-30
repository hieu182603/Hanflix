import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { queryClient } from './lib/queryClient'
import { initGA } from './lib/analytics'
import { PandaPet, PandaPetProvider, PandaPlayground } from './components/panda-pet'
import { LanguageProvider } from './i18n'
import { NotificationProvider } from './components/notifications'
import './index.css'

// Initialize Google Analytics (gracefully no-ops if key is empty)
initGA()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <PandaPetProvider>
            {window.location.pathname === '/dev/panda'
              ? import.meta.env.DEV ? (
                  <NotificationProvider>
                    <PandaPlayground />
                    <PandaPet />
                  </NotificationProvider>
                ) : <div>Trang này chỉ có trong môi trường phát triển.</div>
              : (
                <BrowserRouter>
                  <App />
                </BrowserRouter>
              )}
        </PandaPetProvider>
      </LanguageProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)
