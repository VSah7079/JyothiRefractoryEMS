import { type FormEvent } from 'react'
import { type UserRole } from '../lib/employeeData'

type Login = { role: UserRole; employeeId: string; password: string }

export default function LoginForm({
  login,
  setLogin,
  loginError,
  accountList = [],
  onSubmit,
  submitLabel = 'Sign in',
  showAdminLink = true,
  onRoleSelect,
}: {
  login: Login
  setLogin?: (next: Login) => void
  loginError?: string
  accountList?: Array<any>
  onSubmit?: (e: FormEvent<HTMLFormElement>) => void
  submitLabel?: string
  showAdminLink?: boolean
  onRoleSelect?: (role: UserRole) => void
}) {
  return (
    <form className="space-y-6 sm:space-y-8" onSubmit={onSubmit}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onRoleSelect?.('Admin')}
          className={`rounded-2xl border px-4 py-3 text-sm font-semibold shadow-sm transition hover:-translate-y-px ${login.role === 'Admin' ? 'border-[#5B21B6] bg-[#7C3AED] text-white ring-2 ring-[#7C3AED]/20' : 'border-[#E9D5FF] bg-white text-[#3B0764] hover:bg-background'}`}
        >
          Admin
        </button>
        <button
          type="button"
          onClick={() => onRoleSelect?.('Employee')}
          className={`rounded-2xl border px-4 py-3 text-sm font-semibold shadow-sm transition hover:-translate-y-px ${login.role === 'Employee' ? 'border-[#5B21B6] bg-[#7C3AED] text-white ring-2 ring-[#7C3AED]/20' : 'border-[#E5E7EB] bg-white text-[#3B0764] hover:bg-background'}`}
        >
          Employee
        </button>
      </div>

      <div>
        <label className="block mb-1 text-sm font-medium text-[#4B5563] sm:text-sm">Account</label>
        <select
          value={login.employeeId}
          onChange={(e) => setLogin?.({ ...login, employeeId: e.target.value })}
          className="mt-2 w-full rounded-2xl border border-[#E6E9F2] bg-white px-4 py-3 text-sm outline-none transition focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/15">
          <option value="">Choose account</option>
          {accountList
            .filter((acc) => acc.Role === login.role)
            .map((acc) => (
              <option key={acc.EmployeeID} value={acc.EmployeeID}>
                {acc.EmployeeName} ({acc.EmployeeID})
              </option>
            ))}
        </select>
        {accountList.filter((acc) => acc.Role === login.role).length === 0 && (
          <p className="text-xs text-text-light mt-2">No accounts for selected role</p>
        )}
      </div>

      <div>
        <label className="block mb-1 text-sm font-medium text-[#4B5563] sm:text-sm">Password</label>
        <input
          type="password"
          value={login.password}
          onChange={(e) => setLogin?.({ ...login, password: e.target.value })}
          placeholder="Enter your password"
          className="mt-2 w-full rounded-2xl border border-[#E6E9F2] bg-white px-4 py-3 text-sm outline-none transition focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/15"
        />
      </div>

      {loginError && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{loginError}</div>}

      {/* Removed Remember me checkbox and Forgot password link as requested */}

      <button type="submit" className="w-full rounded-2xl bg-linear-to-r from-[#7C3AED] to-[#5B21B6] px-4 py-3 sm:py-4 text-base font-bold text-white shadow-[0_18px_40px_rgba(124,58,237,0.24)] transition hover:-translate-y-px hover:opacity-95">
        {submitLabel}
      </button>

      {showAdminLink && (
        <p className="text-center text-xs text-text-light mt-3">
          Not an employee? <a href="/admin" className="font-semibold text-[#7C3AED]">Admin login</a>
        </p>
      )}
    </form>
  )
}
