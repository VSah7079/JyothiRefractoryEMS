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
    <div className="relative min-h-screen overflow-hidden bg-linear-to-br from-[#1A0B2E] via-[#3A145F] to-[#FAF5FF] text-white">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-[#8B5CF6]/30 blur-3xl" />
        <div className="absolute right-[-5rem] top-24 h-80 w-80 rounded-full bg-[#F59E0B]/20 blur-3xl" />
        <div className="absolute bottom-[-6rem] left-1/3 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
      </div>

      <div className="relative mx-auto grid min-h-screen w-full max-w-7xl grid-cols-1 items-stretch lg:grid-cols-[1.1fr_0.9fr]">
        <section className="hidden flex-col justify-between px-4 py-6 sm:px-8 sm:py-10 lg:flex lg:px-14 lg:py-14">
          <div className="flex w-fit items-center gap-3 rounded-full border border-white/15 bg-white/10 px-4 py-2 backdrop-blur-md">
            <div className="grid h-11 w-11 place-items-center rounded-full bg-white/15">
              <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
                <circle cx="12" cy="12" r="9" strokeWidth="1.5" />
              </svg>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.32em] text-white/70">Login Portal</p>
              <h1 className="text-lg font-bold sm:text-xl">{companyName}</h1>
            </div>
          </div>

          <div className="mt-8 grid gap-5 lg:mt-0 lg:max-w-xl">
            <div className="space-y-5">
              <span className="inline-flex w-fit rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-white/80 backdrop-blur-md">
                Management & Employee Portal
              </span>
              <h2 className="max-w-xl text-3xl font-black leading-tight text-white sm:text-5xl lg:text-6xl">
                One full-page login for admin and employee access.
              </h2>
              <p className="max-w-lg text-sm leading-7 text-white/80 sm:text-base lg:text-lg">
                Pick a role, choose the account, and open the right dashboard with live workbook data, advances, attendance, and salary records.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-md">
                <p className="text-xs uppercase tracking-[0.24em] text-white/60">Role aware</p>
                <strong className="mt-2 block text-2xl text-white">Admin / Employee</strong>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-md">
                <p className="text-xs uppercase tracking-[0.24em] text-white/60">Live data</p>
                <strong className="mt-2 block text-2xl text-white">Workbook sync</strong>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-md">
                <p className="text-xs uppercase tracking-[0.24em] text-white/60">Secure</p>
                <strong className="mt-2 block text-2xl text-white">Session login</strong>
              </div>
            </div>

            <ul className="grid gap-3 text-sm text-white/85 sm:grid-cols-2">
              <li className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/10 px-4 py-3 backdrop-blur-md">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-white/15 text-sm font-bold">✓</span>
                Admin gets company and management controls.
              </li>
              <li className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/10 px-4 py-3 backdrop-blur-md">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-white/15 text-sm font-bold">✓</span>
                Employee gets only personal work and salary data.
              </li>
            </ul>
          </div>

          <div className="mt-8 flex flex-wrap gap-3 text-xs text-white/70 lg:mt-0">
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 backdrop-blur-md">Fast login</span>
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 backdrop-blur-md">Role buttons</span>
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 backdrop-blur-md">Responsive full screen</span>
          </div>
        </section>

        <section className="flex items-center justify-center px-4 py-4 sm:px-8 sm:py-8 lg:px-14 lg:py-14">
          <div className="w-full max-w-xl max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-[1.75rem] border border-white/15 bg-white/90 p-4 text-[#2E1250] shadow-[0_30px_80px_rgba(18,7,40,0.35)] backdrop-blur-xl sm:p-8 lg:p-10">
            <div className="mb-4 space-y-2 sm:mb-6">
              <div className="flex items-center gap-3 rounded-2xl border border-[#E9D5FF] bg-[#FAF5FF] px-4 py-3 lg:hidden">
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
              <h2 className="text-2xl font-black text-[#1F1147] sm:text-3xl lg:text-4xl">Sign in</h2>
              <p className="text-sm leading-6 text-[#6B7280]">Pick a role, choose an account, and enter the password.</p>
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

            <div className="mt-5 rounded-2xl border border-[#E9D5FF] bg-[#FAF5FF] px-4 py-3 text-center text-xs text-[#6B7280]">
              By signing in you agree to our <a href="/terms" className="font-semibold text-[#7C3AED]">Terms</a>.
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
