import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import LoginForm from './components/LoginForm'
import { loadWorkbookData } from './lib/workbookApi'
import { type UserRole } from './lib/employeeData'

const EMPLOYEE_SESSION_KEY = 'jyothi-active-user-employee'

export default function LoginPage() {
  const navigate = useNavigate()
  const [workbook, setWorkbook] = useState<any | null>(null)
  const [login, setLogin] = useState({ role: 'Employee' as UserRole, employeeId: '', password: '' })
  const [loginError, setLoginError] = useState('')

  useEffect(() => {
    let mounted = true
    void loadWorkbookData().then((data) => {
      if (mounted) setWorkbook(data)
    })
    return () => {
      mounted = false
    }
  }, [])

  function setRoleAndAccount(role: UserRole) {
    if (!workbook) {
      setLogin((current) => ({ ...current, role }))
      return
    }

    const firstMatch = workbook.employees.find((employee: any) => employee.Role === role)

    setLogin({ role, employeeId: firstMatch?.EmployeeID ?? '', password: '' })
  }

  async function loginSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!workbook) return

    const selectedAccount = workbook.employees.find((employee: any) => employee.EmployeeID === login.employeeId)

    if (!selectedAccount) {
      setLoginError('Choose a valid account.')
      return
    }

    if (selectedAccount.Role !== login.role) {
      setLoginError('The account does not match the chosen role.')
      return
    }

    if (selectedAccount.Password !== login.password) {
      setLoginError('Invalid password.')
      return
    }

    if (selectedAccount.Status !== 'Active') {
      setLoginError('This account is inactive.')
      return
    }

    setLoginError('')
    if (selectedAccount.Role === 'Admin') {
      sessionStorage.setItem('jyothi-active-user', selectedAccount.EmployeeID)
      navigate('/admin')
    } else {
      sessionStorage.setItem(EMPLOYEE_SESSION_KEY, selectedAccount.EmployeeID)
      navigate('/employee')
    }
  }

  const companyName = workbook?.companies?.[0]?.CompanyName ?? 'Jyothi Refractory'

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-5xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="flex flex-col justify-center px-6 py-8 rounded-xl bg-linear-to-br from-[#F8FAFF] to-[#F5F3FF] border border-[#E9D5FF]">
            <div className="mb-6">
              <div className="text-3xl font-extrabold text-[#3B0764]">{login.role === 'Admin' ? companyName : 'Jyothi Refractory'}</div>
              <p className="text-sm text-text-light mt-2">{login.role === 'Admin' ? 'Management Portal' : 'Employee Workspace'}</p>
            </div>

            <div className="space-y-4 text-sm text-text-light">
              <p>Secure access to attendance, advances, and payroll.</p>
              <p className="text-xs">This page is shared — choose your role to continue.</p>
            </div>
          </div>

          <div className="px-6 py-8 bg-white rounded-xl border border-[#E9D5FF] shadow-sm">
            <div className="max-w-md">
              <LoginForm
                login={login}
                setLogin={setLogin}
                loginError={loginError}
                accountList={workbook?.employees ?? []}
                onSubmit={loginSubmit}
                roleSelectable={true}
                onRoleChange={setRoleAndAccount}
                submitLabel="Sign in"
                showAdminLink={false}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
