import { type FormEvent } from 'react'
import { type UserRole } from '../lib/employeeData'

type Login = { role: UserRole; employeeId: string; password: string }

export default function LoginForm({
  login,
  setLogin,
  loginError,
  accountList = [],
  onSubmit,
  roleSelectable = false,
  onRoleChange,
  submitLabel = 'Sign in',
  showAdminLink = true,
}: {
  login: Login
  setLogin?: (next: Login) => void
  loginError?: string
  accountList?: Array<any>
  onSubmit?: (e: FormEvent<HTMLFormElement>) => void
  roleSelectable?: boolean
  onRoleChange?: (role: UserRole) => void
  submitLabel?: string
  showAdminLink?: boolean
}) {
  return (
    <form className="space-y-5 sm:space-y-6" onSubmit={onSubmit}>
      {roleSelectable && (
        <div>
          <label className="block text-sm font-bold text-[#3B0764]">Role</label>
          <select value={login.role} onChange={(e) => onRoleChange?.(e.target.value as UserRole)} className="w-full mt-1 p-3 rounded-lg border">
            <option value="Employee">Employee</option>
            <option value="Admin">Admin</option>
          </select>
        </div>
      )}

      <div>
        <label className="block text-sm font-bold text-[#3B0764]">Account</label>
        <select value={login.employeeId} onChange={(e) => setLogin?.({ ...login, employeeId: e.target.value })} className="w-full mt-1 p-3 rounded-lg border">
          <option value="">Choose account</option>
          {accountList.map((acc) => (
            <option key={acc.EmployeeID} value={acc.EmployeeID}>
              {acc.EmployeeName} ({acc.EmployeeID})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-bold text-[#3B0764]">Password</label>
        <input type="password" value={login.password} onChange={(e) => setLogin?.({ ...login, password: e.target.value })} className="w-full mt-1 p-3 rounded-lg border" />
      </div>

      {loginError && <div className="p-3 rounded bg-red-50 text-red-700">{loginError}</div>}

      <button type="submit" className="w-full py-3 rounded-lg bg-[#7C3AED] text-white font-bold">
        {submitLabel}
      </button>

      {showAdminLink && (
        <p className="text-center text-xs text-text-light mt-3">
          Admin? <a href="/admin" className="font-bold text-[#7C3AED]">Sign in</a>
        </p>
      )}
    </form>
  )
}
