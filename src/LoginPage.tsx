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
    <div className="relative min-h-screen overflow-hidden bg-linear-to-br from-[#1A0B2E] via-[#3A145F] to-background text-white">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-[#8B5CF6]/30 blur-3xl" />
        <div className="absolute -right-20 top-24 h-80 w-80 rounded-full bg-[#F59E0B]/20 blur-3xl" />
        <div className="absolute -bottom-24 left-1/3 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
      </div>

      <div className="relative mx-auto grid min-h-screen w-full max-w-7xl grid-cols-1 items-stretch lg:grid-cols-[1.1fr_0.9fr]">
        <section className="hidden flex-col justify-center px-6 py-8 sm:px-8 sm:py-10 lg:flex lg:px-20 lg:py-16">
          <div className="flex items-center gap-4">
            <div className="grid h-11 w-11 place-items-center rounded-full bg-white/12">
              <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
                <circle cx="12" cy="12" r="9" strokeWidth="1.5" />
              </svg>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-white/75">Login Portal</p>
              <h1 className="text-2xl font-extrabold sm:text-3xl text-white">{companyName}</h1>
            </div>
          </div>

          <div className="mt-8 max-w-lg">
            <span className="inline-flex w-fit rounded-full border border-white/12 bg-white/8 px-4 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/80 backdrop-blur-md">
              Management & Employee Portal
            </span>

            <h2 className="mt-4 text-3xl font-extrabold leading-tight text-white sm:text-4xl lg:text-5xl">
              One login, two dashboards — admin and employee access.
            </h2>

            <p className="mt-3 text-base text-white/75">
              Pick a role, choose an account, and open the right dashboard with workbook data stored locally in your browser.
            </p>

            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/12 bg-white/6 p-4">
                <p className="text-xs uppercase text-white/70">Role aware</p>
                <strong className="mt-2 block text-lg text-white">Admin / Employee</strong>
              </div>
              <div className="rounded-2xl border border-white/12 bg-white/6 p-4">
                <p className="text-xs uppercase text-white/70">Live data</p>
                <strong className="mt-2 block text-lg text-white">Workbook sync</strong>
              </div>
              <div className="rounded-2xl border border-white/12 bg-white/6 p-4">
                <p className="text-xs uppercase text-white/70">Secure</p>
                <strong className="mt-2 block text-lg text-white">Session login</strong>
              </div>
            </div>

            {/* Checklist removed per request */}
          </div>

          {/* Small badges removed */}
        </section>

        <section className="flex items-center justify-center px-6 py-6 sm:px-10 sm:py-8 lg:px-14 lg:py-14">
          <div className="w-full max-w-xl max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-28 border border-white/15 bg-background p-6 text-[#2E1250] shadow-[0_30px_80px_rgba(18,7,40,0.35)] backdrop-blur-xl sm:p-10 lg:p-12">
            <div className="mb-4 space-y-2 sm:mb-6">
                <div className="flex items-center gap-3 rounded-2xl border border-[#E9D5FF] bg-background px-4 py-3 lg:hidden">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-[#7C3AED] text-white">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
                    <circle cx="12" cy="12" r="9" strokeWidth="1.5" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#7C3AED]">Login Portal</p>
                  <h1 className="text-base font-bold text-[#1F1147]">{companyName}</h1>
                </div>
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#7C3AED]">Secure sign in</p>
              <h2 className="text-3xl font-black text-[#1F1147] sm:text-4xl lg:text-5xl">Sign in</h2>
              <p className="text-sm leading-7 text-[#4B5563]">Pick a role, choose an account, and enter the password.</p>
            </div>

            <LoginForm
              login={login}
              setLogin={setLogin}
              loginError={loginError}
              accountList={workbook?.employees ?? []}
              onSubmit={loginSubmit}
              submitLabel="Sign in"
              showAdminLink={false}
              onRoleSelect={setRoleAndAccount}
            />

            {/* Terms notice removed as requested */}
          </div>
        </section>
      </div>
    </div>
  )
}
