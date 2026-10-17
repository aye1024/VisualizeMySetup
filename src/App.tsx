import { Navigate, Route, Routes } from 'react-router-dom'
import { BuildPage } from './components/BuildPage'
import { HomePage } from './components/HomePage'

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/build" element={<BuildPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
