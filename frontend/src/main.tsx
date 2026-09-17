import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { queryClient } from './lib/queryClient'
import { initGA } from './lib/analytics'
import { PandaPet, PandaPetProvider, PandaPlayground } from './components/panda-pet'
import './index.css'

// Initialize Google Analytics (gracefully no-ops if key is empty)
initGA()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <PandaPetProvider>
        {window.location.pathname === '/dev/panda'
          ? import.meta.env.DEV ? (
              <>
                <PandaPlayground />
                <PandaPet />
              </>
            ) : <div>Trang này chỉ có trong môi trường phát triển.</div>
          : <App />}
      </PandaPetProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)
