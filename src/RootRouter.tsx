import { Routes, Route } from 'react-router-dom'
import App from './App'
import Admin from './admin/Admin'
import Employee from './employee/Employee'

export default function RootRouter() {
  return (
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="/admin/*" element={<Admin />} />
      <Route path="/employee/*" element={<Employee />} />
    </Routes>
  )
}
