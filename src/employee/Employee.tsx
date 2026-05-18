import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import {
  formatCurrency,
  formatDate,
  formatMonth,
  formatNumber,
  generateId,
  getMonthKey,
  monthChoicesBackwards,
  monthKeyFromNow,
  recalculateDerivedData,
  seedWorkbookData,
  todayValue,
  type Attendance,
  type Advance,
  type Employee,
  type PaidStatus,
  type UserRole,
  type WorkbookData,
} from '../lib/employeeData'
import { getCachedWorkbookData, loadWorkbookData, saveWorkbookData } from '../lib/workbookApi'

type TabId = 'dashboard' | 'profile' | 'employees' | 'attendance' | 'work' | 'advances' | 'salary' | 'company'

type LoginState = {
  role: UserRole
  employeeId: string
  password: string
}

type EmployeeDraft = {
  EmployeeID: string
  EmployeeName: string
  Phone: string
  PerdayPay: number
  Role: UserRole
  Password: string
  Status: 'Active' | 'Inactive'
}

type AttendanceDraft = {
  EmployeeID: string
  Date: string
  Company: string
  Location: string
  WorkedHour: number
}

type AdvanceDraft = {
  EmployeeID: string
  Date: string
  AdvanceAmount: number
  Reason: string
}

const ADMIN_TABS: Array<{ id: TabId; label: string }> = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'employees', label: 'Employees' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'work', label: 'Work Details' },
  { id: 'advances', label: 'Advance Requests' },
  { id: 'salary', label: 'Salary' },
  { id: 'company', label: 'Company' },
]

const EMPLOYEE_TABS: Array<{ id: TabId; label: string }> = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'profile', label: 'Profile' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'advances', label: 'Advances' },
  { id: 'salary', label: 'Salary' },
]

const EMPLOYEE_SESSION_KEY = 'jyothi-active-user-employee'

const EMPTY_EMPLOYEE: EmployeeDraft = {
  EmployeeID: '',
  EmployeeName: '',
  Phone: '',
  PerdayPay: 0,
  Role: 'Employee',
  Password: '',
  Status: 'Active',
}

const EMPTY_ATTENDANCE: AttendanceDraft = {
  EmployeeID: '',
  Date: todayValue(),
  Company: '',
  Location: '',
  WorkedHour: 8,
}

const EMPTY_ADVANCE: AdvanceDraft = {
  EmployeeID: '',
  Date: todayValue(),
  AdvanceAmount: 0,
  Reason: '',
}

function statusClass(value: string) {
  return value.toLowerCase().replace(/\s+/g, '-')
}

function Badge({ value }: { value: string }) {
  return <span className={`inline-flex justify-center items-center py-1.5 px-3 rounded-full text-xs-small font-bold tracking-status uppercase ${statusClass(value) === 'active' || statusClass(value) === 'approved' || statusClass(value) === 'paid' ? 'text-status-success bg-status-success-bg' : 'text-text-light bg-status-neutral'}`}>{value}</span>
}

function Panel({
  title,
  subtitle,
  children,
  action,
}: {
  title: string
  subtitle: string
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <section className="rounded-24 p-5 bg-bg-panel border border-border-light shadow-glass backdrop-blur-lg">
      <header className="mb-4 grid gap-3 md:flex md:items-start md:justify-between md:gap-4">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        {action}
      </header>
      {children}
    </section>
  )
}

function MetricCard({ label, value, hint }: { label: string; value: ReactNode; hint: string }) {
  return (
    <article className="rounded-24 p-5 bg-bg-panel border border-border-light shadow-glass backdrop-blur-lg">
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{hint}</p>
    </article>
  )
}

function BarChart({ data }: { data: Array<{ label: string; value: number }> }) {
  const max = Math.max(...data.map((entry) => entry.value), 1)

  return (
    <div className="grid gap-3.5">
      {data.map((entry) => (
        <div key={entry.label} className="grid gap-2">
          <div className="flex justify-between items-center gap-3 text-text-secondary">
            <span>{entry.label}</span>
            <strong>{formatNumber(entry.value)}</strong>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-white/6">
            <div className="h-full rounded-full bg-gradient-bar" style={{ width: `${(entry.value / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function Employee({ initialTab }: { initialTab?: TabId } = {}) {
  const [workbook, setWorkbook] = useState<WorkbookData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeUserId, setActiveUserId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>(initialTab ?? 'dashboard')
    const [sidebarOpen, setSidebarOpen] = useState(false)
  const [login, setLogin] = useState<LoginState>({
    role: 'Employee',
    employeeId: '',
    password: '',
  })
  const [loginError, setLoginError] = useState('')
  const [employeeDraft, setEmployeeDraft] = useState<EmployeeDraft>(EMPTY_EMPLOYEE)
  const [editingEmployeeId, setEditingEmployeeId] = useState('')
  const [attendanceDraft, setAttendanceDraft] = useState<AttendanceDraft>(EMPTY_ATTENDANCE)
  const [advanceDraft, setAdvanceDraft] = useState<AdvanceDraft>(EMPTY_ADVANCE)
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState('all')
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState('all')
  const [selectedMonthFilter, setSelectedMonthFilter] = useState(monthKeyFromNow())
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    let isMounted = true

    async function bootstrap() {
      const remote = await loadWorkbookData()
      const cached = getCachedWorkbookData()
      const source = remote ?? cached ?? seedWorkbookData
      const normalized = recalculateDerivedData(source, source)

      if (!isMounted) {
        return
      }

      setWorkbook(normalized)
      setLoading(false)

      if (!remote) {
        localStorage.setItem('jyothi-workbook-data', JSON.stringify(normalized))
      }
    }

    void bootstrap()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (!workbook || activeUserId) {
      return
    }

    const migrateLegacyEmployee = (): string | null => {
      const legacy = sessionStorage.getItem('jyothi-active-user')
      if (!legacy) {
        return null
      }
      const emp = workbook.employees.find((e) => e.EmployeeID === legacy)
      sessionStorage.removeItem('jyothi-active-user')
      if (emp?.Role === 'Employee') {
        sessionStorage.setItem(EMPLOYEE_SESSION_KEY, legacy)
        return legacy
      }
      return null
    }

    const savedUser = sessionStorage.getItem(EMPLOYEE_SESSION_KEY) ?? migrateLegacyEmployee()
    if (!savedUser) {
      return
    }

    const account = workbook.employees.find((employee) => employee.EmployeeID === savedUser)
    if (account?.Role === 'Employee') {
      setActiveUserId(savedUser)
      setLogin((current) => ({ ...current, role: 'Employee', employeeId: savedUser }))
    } else {
      sessionStorage.removeItem(EMPLOYEE_SESSION_KEY)
    }
  }, [activeUserId, workbook])

  useEffect(() => {
    if (!workbook || activeUserId) {
      return
    }
    setLogin((current) => {
      if (current.employeeId) {
        return { ...current, role: 'Employee' }
      }
      const firstEmployee = workbook.employees.find((e) => e.Role === 'Employee')
      return { ...current, role: 'Employee', employeeId: firstEmployee?.EmployeeID ?? '' }
    })
  }, [workbook, activeUserId])

  useEffect(() => {
    if (!workbook) {
      return
    }

    setAdvanceDraft((current) => ({ ...current, EmployeeID: currentUserIdToDefaultEmployee(workbook, login.role) }))
  }, [login.role, workbook])

  const currentUser = useMemo(() => {
    if (!workbook || !activeUserId) {
      return null
    }

    return workbook.employees.find((employee) => employee.EmployeeID === activeUserId) ?? null
  }, [activeUserId, workbook])

  const isAdmin = currentUser?.Role === 'Admin'
  const tabs = isAdmin ? ADMIN_TABS : EMPLOYEE_TABS
  const currentMonth = monthKeyFromNow()

  const visibleEmployees = useMemo(
    () => (isAdmin || !currentUser ? workbook?.employees ?? [] : workbook?.employees.filter((employee) => employee.EmployeeID === currentUser.EmployeeID) ?? []),
    [currentUser, isAdmin, workbook],
  )
  const visibleAttendance = useMemo(
    () => (isAdmin || !currentUser ? workbook?.attendance ?? [] : workbook?.attendance.filter((entry) => entry.EmployeeID === currentUser.EmployeeID) ?? []),
    [currentUser, isAdmin, workbook],
  )
  const visibleAdvances = useMemo(
    () => (isAdmin || !currentUser ? workbook?.advances ?? [] : workbook?.advances.filter((entry) => entry.EmployeeID === currentUser.EmployeeID) ?? []),
    [currentUser, isAdmin, workbook],
  )
  const visibleWorks = useMemo(
    () => (isAdmin || !currentUser ? workbook?.workDetails ?? [] : workbook?.workDetails.filter((entry) => entry.EmployeeID === currentUser.EmployeeID) ?? []),
    [currentUser, isAdmin, workbook],
  )
  const visibleSalaries = useMemo(
    () => (isAdmin || !currentUser ? workbook?.salaries ?? [] : workbook?.salaries.filter((entry) => entry.EmployeeID === currentUser.EmployeeID) ?? []),
    [currentUser, isAdmin, workbook],
  )

  const summary = useMemo(() => {
    if (!workbook) {
      return null
    }

    const currentAttendance = visibleAttendance.filter((entry) => getMonthKey(entry.Date) === currentMonth)
    const currentSalaryRows = visibleSalaries.filter((row) => row.Month === currentMonth)
    const paidRows = currentSalaryRows.filter((row) => row.PaidStatus === 'Paid')

    return {
      totalEmployees: isAdmin ? workbook.employees.length : 1,
      ongoingWorks: visibleWorks.filter((work) => work.Status === 'Ongoing').length,
      pendingAdvances: visibleAdvances.filter((advance) => advance.Status === 'Requested').length,
      monthSalaryStatus: `${paidRows.length}/${currentSalaryRows.length || 0} paid`,
      currentAttendance: currentAttendance.length,
      currentNetPayable: currentSalaryRows.reduce((sum, row) => sum + row.NetPayble, 0),
    }
  }, [currentMonth, isAdmin, visibleAdvances, visibleAttendance, visibleSalaries, visibleWorks, workbook])

  const attendanceSeries = useMemo(() => {
    const rows = visibleEmployees.map((employee) => ({
      label: employee.EmployeeName,
      value: visibleAttendance.filter((entry) => entry.EmployeeID === employee.EmployeeID).length,
    }))

    return rows.length > 0 ? rows : [{ label: 'No data', value: 0 }]
  }, [visibleAttendance, visibleEmployees])

  const salarySeries = useMemo(() => {
    const rows = visibleSalaries
      .filter((salary) => salary.Month === selectedMonthFilter)
      .map((salary) => ({
        label: workbook?.employees.find((employee) => employee.EmployeeID === salary.EmployeeID)?.EmployeeName ?? salary.EmployeeID,
        value: salary.NetPayble,
      }))

    return rows.length > 0 ? rows : [{ label: 'No salaries', value: 0 }]
  }, [selectedMonthFilter, visibleSalaries, workbook?.employees])

  const workSeries = useMemo(() => {
    const rows = visibleWorks.map((work) => ({
      label: work.WorkTitle,
      value: work.PendingAmount,
    }))

    return rows.length > 0 ? rows : [{ label: 'No work items', value: 0 }]
  }, [visibleWorks])

  function persist(next: WorkbookData) {
    const recalculated = recalculateDerivedData(next, workbook ?? next)
    setWorkbook(recalculated)
    setSaving(true)
    void saveWorkbookData(recalculated).finally(() => setSaving(false))
  }

  function loginSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!workbook) {
      return
    }

    const selectedAccount = workbook.employees.find((employee) => employee.EmployeeID === login.employeeId)

    if (!selectedAccount) {
      setLoginError('Choose a valid account.')
      return
    }

    if (selectedAccount.Role !== 'Employee') {
      setLoginError('Administrator accounts must sign in from the admin portal (/admin).')
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
    setActiveUserId(selectedAccount.EmployeeID)
    sessionStorage.setItem(EMPLOYEE_SESSION_KEY, selectedAccount.EmployeeID)
    setActiveTab('dashboard')
  }

  function signOut() {
    setActiveUserId(null)
    setLogin((current) => ({ ...current, password: '', role: 'Employee' }))
    sessionStorage.removeItem(EMPLOYEE_SESSION_KEY)
  }

  function resetEmployeeDraft(record?: Employee) {
    if (!record) {
      setEmployeeDraft(EMPTY_EMPLOYEE)
      setEditingEmployeeId('')
      return
    }

    setEmployeeDraft({
      EmployeeID: record.EmployeeID,
      EmployeeName: record.EmployeeName,
      Phone: record.Phone,
      PerdayPay: record.PerdayPay,
      Role: record.Role,
      Password: record.Password,
      Status: record.Status,
    })
    setEditingEmployeeId(record.EmployeeID)
  }

  function saveEmployee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!workbook) {
      return
    }

    const employeeId = editingEmployeeId || employeeDraft.EmployeeID.trim() || generateId('EMP', workbook.employees.map((employee) => employee.EmployeeID))

    const nextEmployee: Employee = {
      EmployeeID: employeeId,
      EmployeeName: employeeDraft.EmployeeName.trim(),
      Phone: employeeDraft.Phone.trim(),
      PerdayPay: Number(employeeDraft.PerdayPay) || 0,
      Role: employeeDraft.Role,
      Password: employeeDraft.Password.trim() || 'changeme123',
      Status: employeeDraft.Status,
    }

    const nextEmployees = editingEmployeeId
      ? workbook.employees.map((employee) => (employee.EmployeeID === editingEmployeeId ? nextEmployee : employee))
      : [...workbook.employees, nextEmployee]

    persist({ ...workbook, employees: nextEmployees })
    setEmployeeDraft(EMPTY_EMPLOYEE)
    setEditingEmployeeId('')
  }

  function toggleEmployeeStatus(employeeId: string) {
    if (!workbook) {
      return
    }

    persist({
      ...workbook,
      employees: workbook.employees.map((employee) =>
        employee.EmployeeID === employeeId
          ? { ...employee, Status: employee.Status === 'Active' ? 'Inactive' : 'Active' }
          : employee,
      ),
    })
  }

  function resetPassword(employeeId: string) {
    if (!workbook) {
      return
    }

    persist({
      ...workbook,
      employees: workbook.employees.map((employee) =>
        employee.EmployeeID === employeeId ? { ...employee, Password: 'welcome123' } : employee,
      ),
    })
  }

  function removeEmployee(employeeId: string) {
    if (!workbook) {
      return
    }

    persist({
      ...workbook,
      employees: workbook.employees.filter((employee) => employee.EmployeeID !== employeeId),
      attendance: workbook.attendance.filter((entry) => entry.EmployeeID !== employeeId),
      advances: workbook.advances.filter((entry) => entry.EmployeeID !== employeeId),
      salaries: workbook.salaries.filter((entry) => entry.EmployeeID !== employeeId),
      workDetails: workbook.workDetails.filter((entry) => entry.EmployeeID !== employeeId),
    })

    if (activeUserId === employeeId) {
      signOut()
    }
  }

  function saveAttendance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!workbook || !currentUser) {
      return
    }

    const targetEmployeeId = attendanceDraft.EmployeeID || currentUser.EmployeeID
    const nextAttendance: Attendance = {
      AttendanceID: generateId('ATT', workbook.attendance.map((entry) => entry.AttendanceID)),
      EmployeeID: targetEmployeeId,
      Date: attendanceDraft.Date,
      Company: attendanceDraft.Company,
      Location: attendanceDraft.Location.trim(),
      WorkedHour: Number(attendanceDraft.WorkedHour) || 0,
      Addedby: currentUser.EmployeeName,
    }

    persist({ ...workbook, attendance: [...workbook.attendance, nextAttendance] })
    setAttendanceDraft({
      ...EMPTY_ATTENDANCE,
      EmployeeID: currentUser.Role === 'Admin' ? '' : currentUser.EmployeeID,
      Company: workbook.companies[0]?.CompanyName ?? '',
    })
  }

  // Work-related functions (kept for potential future use)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  // Unused - Work Details and Company tabs removed from employee interface
  /*
  function resetWorkDraft(record?: WorkDetail) {
    if (!record) {
      setWorkDraft(EMPTY_WORK)
      setEditingWorkId('')
      return
    }

    setWorkDraft({
      WorkID: record.WorkID,
      EmployeeID: record.EmployeeID,
      CompanyID: record.CompanyID,
      WorkTitle: record.WorkTitle,
      StartDate: record.StartDate,
      EndDate: record.EndDate,
      WorkAmount: record.WorkAmount,
      ReceivedAmount: record.ReceivedAmount,
      Status: record.Status,
    })
    setEditingWorkId(record.WorkID)
  }

  function saveWork(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!workbook || !currentUser) {
      return
    }

    const workId = editingWorkId || workDraft.WorkID || generateId('WRK', workbook.workDetails.map((entry) => entry.WorkID))
    const nextWork: WorkDetail = {
      WorkID: workId,
      EmployeeID: workDraft.EmployeeID || currentUser.EmployeeID,
      CompanyID: workDraft.CompanyID || workbook.companies[0]?.CompanyID || '',
      WorkTitle: workDraft.WorkTitle.trim(),
      StartDate: workDraft.StartDate,
      EndDate: workDraft.EndDate,
      WorkAmount: Number(workDraft.WorkAmount) || 0,
      ReceivedAmount: Number(workDraft.ReceivedAmount) || 0,
      PendingAmount: Math.max((Number(workDraft.WorkAmount) || 0) - (Number(workDraft.ReceivedAmount) || 0), 0),
      Status: workDraft.Status,
    }

    const nextWorks = editingWorkId
      ? workbook.workDetails.map((entry) => (entry.WorkID === editingWorkId ? nextWork : entry))
      : [...workbook.workDetails, nextWork]

    persist({ ...workbook, workDetails: nextWorks })
    setWorkDraft(EMPTY_WORK)
    setEditingWorkId('')
  }
  */

  function saveAdvance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!workbook || !currentUser) {
      return
    }

    const nextAdvance: Advance = {
      AdvanceID: generateId('ADV', workbook.advances.map((entry) => entry.AdvanceID)),
      EmployeeID: advanceDraft.EmployeeID || currentUser.EmployeeID,
      Date: advanceDraft.Date,
      AdvanceAmount: Number(advanceDraft.AdvanceAmount) || 0,
      Reason: advanceDraft.Reason.trim(),
      Status: currentUser.Role === 'Admin' ? 'Approved' : 'Requested',
      ApprovedBy: currentUser.Role === 'Admin' ? currentUser.EmployeeName : '',
    }

    persist({ ...workbook, advances: [...workbook.advances, nextAdvance] })
    setAdvanceDraft({
      ...EMPTY_ADVANCE,
      EmployeeID: currentUser.Role === 'Admin' ? '' : currentUser.EmployeeID,
    })
  }

  function decideAdvance(advanceId: string, status: 'Approved' | 'Rejected') {
    if (!workbook || !currentUser) {
      return
    }

    persist({
      ...workbook,
      advances: workbook.advances.map((entry) =>
        entry.AdvanceID === advanceId
          ? {
              ...entry,
              Status: status,
              ApprovedBy: currentUser.EmployeeName,
            }
          : entry,
      ),
    })
  }

  function setSalaryStatus(salaryId: string, paidStatus: PaidStatus) {
    if (!workbook) {
      return
    }

    persist({
      ...workbook,
      salaries: workbook.salaries.map((entry) =>
        entry.SalaryID === salaryId ? { ...entry, PaidStatus: paidStatus } : entry,
      ),
    })
  }

  // Unused - Company tab removed from employee interface
  /*
  function saveCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!workbook || !selectedCompany) {
      return
    }

    persist({
      ...workbook,
      companies: workbook.companies.map((company) =>
        company.CompanyID === selectedCompany.CompanyID ? selectedCompany : company,
      ),
    })
  }

  function updateSelectedCompany(field: keyof Company, value: string) {
    if (!selectedCompany) {
      return
    }

    const nextCompany = { ...selectedCompany, [field]: value }
    setSelectedCompanyId(nextCompany.CompanyID)

    const nextCompanies = workbook?.companies.map((company) =>
      company.CompanyID === nextCompany.CompanyID ? nextCompany : company,
    )

    if (nextCompanies && workbook) {
      setWorkbook({ ...workbook, companies: nextCompanies })
    }
  }
  */

  function renderDashboard() {
    if (!summary) {
      return null
    }

    return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-card">
        <Panel title="Attendance trend" subtitle="Employee wise attendance footprint for the selected period.">
          <BarChart data={attendanceSeries} />
        </Panel>
        <Panel title="Salary distribution" subtitle={`Net payable for ${formatMonth(selectedMonthFilter)}.`}>
          <BarChart data={salarySeries} />
        </Panel>
        <Panel title="Work progress" subtitle="Outstanding balances across active work orders.">
          <BarChart data={workSeries} />
        </Panel>
        <Panel title="Quick summary" subtitle="Operational numbers filtered to the active login.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-summary">
            <article className="text-center">
              <span className="text-xs font-semibold text-[#7C3AED] uppercase tracking-widest block mb-2">Current attendance</span>
              <strong className="text-3xl text-[#3B0764]">{summary.currentAttendance}</strong>
            </article>
            <article className="text-center">
              <span className="text-xs font-semibold text-[#7C3AED] uppercase tracking-widest block mb-2">Net payable</span>
              <strong className="text-3xl text-[#3B0764]">{formatCurrency(summary.currentNetPayable)}</strong>
            </article>
            <article className="text-center">
              <span className="text-xs font-semibold text-[#7C3AED] uppercase tracking-widest block mb-2">Current month</span>
              <strong className="text-3xl text-[#3B0764]">{formatMonth(currentMonth)}</strong>
            </article>
          </div>
        </Panel>
      </div>
    )
  }

  function renderEmployees() {
    if (!workbook || !isAdmin) {
      return null
    }

    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-card">
        <Panel
          title="Employees"
          subtitle="Add, edit, delete, toggle status, and reset passwords."
          action={<input className="w-full box-border rounded-14 border border-white/12 bg-black/60 py-3.25 px-3.75 text-text-light outline-none md:w-72" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search employees" />}
        >
          <div className="max-w-full min-w-0 overflow-x-auto rounded-18 border border-border-subtle [&_table]:min-w-180">
            <table>
              <thead>
                <tr>
                  <th>EmployeeID</th>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>PerdayPay</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {workbook.employees
                  .filter((employee) =>
                    `${employee.EmployeeID} ${employee.EmployeeName} ${employee.Phone}`
                      .toLowerCase()
                      .includes(searchTerm.toLowerCase()),
                  )
                  .map((employee) => (
                    <tr key={employee.EmployeeID}>
                      <td>{employee.EmployeeID}</td>
                      <td>{employee.EmployeeName}</td>
                      <td>{employee.Phone}</td>
                      <td>{formatCurrency(employee.PerdayPay)}</td>
                      <td>{employee.Role}</td>
                      <td>
                        <Badge value={employee.Status} />
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-2.5">
                          <button type="button" className="inline-flex justify-center items-center py-2 px-4 border-0 rounded-md cursor-pointer text-white font-bold bg-indigo hover:bg-indigoHover transition-all duration-150" onClick={() => resetEmployeeDraft(employee)}>
                            Edit
                          </button>
                          <button type="button" className="inline-flex justify-center items-center py-2 px-4 border-0 rounded-md cursor-pointer text-white font-bold bg-[#EC4899] hover:bg-[#DB2777] transition-all duration-150" onClick={() => toggleEmployeeStatus(employee.EmployeeID)}>
                            {employee.Status === 'Active' ? 'Deactivate' : 'Activate'}
                          </button>
                          <button type="button" className="inline-flex justify-center items-center py-2 px-4 border-0 rounded-md cursor-pointer text-white font-bold bg-[#EC4899] hover:bg-[#DB2777] transition-all duration-150" onClick={() => resetPassword(employee.EmployeeID)}>
                            Reset
                          </button>
                          <button type="button" className="inline-flex justify-center items-center py-2 px-4 border-0 rounded-md cursor-pointer text-white font-bold bg-red-600 hover:bg-red-700 transition-all duration-150" onClick={() => removeEmployee(employee.EmployeeID)}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title={editingEmployeeId ? 'Edit employee' : 'Add employee'} subtitle="Every field is synchronized to the workbook.">
          <form className="grid gap-3" onSubmit={saveEmployee}>
            <label>
              EmployeeID
              <input
                value={employeeDraft.EmployeeID}
                onChange={(event) => setEmployeeDraft((current) => ({ ...current, EmployeeID: event.target.value }))}
                placeholder="Auto if blank"
              />
            </label>
            <label>
              EmployeeName
              <input
                value={employeeDraft.EmployeeName}
                onChange={(event) => setEmployeeDraft((current) => ({ ...current, EmployeeName: event.target.value }))}
                required
              />
            </label>
            <label>
              Phone
              <input
                value={employeeDraft.Phone}
                onChange={(event) => setEmployeeDraft((current) => ({ ...current, Phone: event.target.value }))}
                required
              />
            </label>
            <label>
              PerdayPay
              <input
                type="number"
                value={employeeDraft.PerdayPay}
                onChange={(event) => setEmployeeDraft((current) => ({ ...current, PerdayPay: Number(event.target.value) }))}
                min={0}
                required
              />
            </label>
            <label>
              Role
              <select value={employeeDraft.Role} onChange={(event) => setEmployeeDraft((current) => ({ ...current, Role: event.target.value as UserRole }))}>
                <option value="Admin">Admin</option>
                <option value="Employee">Employee</option>
              </select>
            </label>
            <label>
              Status
              <select
                value={employeeDraft.Status}
                onChange={(event) => setEmployeeDraft((current) => ({ ...current, Status: event.target.value as 'Active' | 'Inactive' }))}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </label>
            <label>
              Password
              <input
                value={employeeDraft.Password}
                onChange={(event) => setEmployeeDraft((current) => ({ ...current, Password: event.target.value }))}
                required
              />
            </label>
            <div className="flex flex-wrap gap-2.5 mt-1">
              <button type="submit" className="inline-flex justify-center items-center py-2 px-4 border-0 rounded-md cursor-pointer text-white font-bold bg-indigo hover:bg-indigoHover transition-all duration-150">{editingEmployeeId ? 'Save changes' : 'Create employee'}</button>
              <button type="button" className="btn-ghost-gold inline-flex items-center justify-center rounded-16 py-2.25 px-4 font-inherit" onClick={() => resetEmployeeDraft()}>
                Clear
              </button>
            </div>
          </form>
        </Panel>
      </div>
    )
  }

  function renderAttendance() {
    if (!workbook || !currentUser) {
      return null
    }

    return (
      <div className="grid grid-cols-1 gap-6">
        <Panel title="Add attendance" subtitle="The logged-in user can create an entry for self or others.">
          <form className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" onSubmit={saveAttendance}>
            <label>
              Employee
              <select
                value={attendanceDraft.EmployeeID}
                onChange={(event) => setAttendanceDraft((current) => ({ ...current, EmployeeID: event.target.value }))}
              >
                <option value="">Select employee</option>
                {workbook.employees.map((employee) => (
                  <option key={employee.EmployeeID} value={employee.EmployeeID}>
                    {employee.EmployeeName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Date
              <input type="date" value={attendanceDraft.Date} onChange={(event) => setAttendanceDraft((current) => ({ ...current, Date: event.target.value }))} required />
            </label>
            <label>
              Company
              <select value={attendanceDraft.Company} onChange={(event) => setAttendanceDraft((current) => ({ ...current, Company: event.target.value }))} required>
                <option value="">Select company</option>
                {workbook.companies.map((company) => (
                  <option key={company.CompanyID} value={company.CompanyName}>
                    {company.CompanyName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Location
              <input value={attendanceDraft.Location} onChange={(event) => setAttendanceDraft((current) => ({ ...current, Location: event.target.value }))} required />
            </label>
            <label>
              WorkedHour
              <input
                type="number"
                min={0}
                max={24}
                value={attendanceDraft.WorkedHour}
                onChange={(event) => setAttendanceDraft((current) => ({ ...current, WorkedHour: Number(event.target.value) }))}
                required
              />
            </label>
            <div className="flex flex-wrap gap-2.5 mt-1 lg:col-span-3">
              <button type="submit" className="inline-flex items-center justify-center h-10 px-4 rounded-md text-sm font-bold text-white bg-[#7C3AED] hover:bg-[#6D28D9]">Save attendance</button>
              <button
                type="button"
                className="inline-flex items-center justify-center h-10 px-4 rounded-md text-sm font-bold text-[#4C1D95] bg-gray-100 hover:bg-gray-200"
                onClick={() =>
                  setAttendanceDraft({
                    ...EMPTY_ATTENDANCE,
                    EmployeeID: currentUser.Role === 'Admin' ? '' : currentUser.EmployeeID,
                    Company: workbook.companies[0]?.CompanyName ?? '',
                  })
                }
              >
                Reset
              </button>
            </div>
          </form>
        </Panel>

        <Panel title="Attendance log" subtitle="View your attendance history and worked hours.">
          <div className="flex flex-wrap gap-2.5 mb-4">
            <select className="w-full sm:w-auto box-border rounded-md border border-[#D8B4FE] bg-white py-2 px-3 text-[#4C1D95] outline-none focus:border-[#7C3AED] focus:ring-1 focus:ring-[#7C3AED]/20" value={selectedEmployeeFilter} onChange={(event) => setSelectedEmployeeFilter(event.target.value)}>
              <option value="all">All employees</option>
              {workbook.employees.map((employee) => (
                <option key={employee.EmployeeID} value={employee.EmployeeID}>
                  {employee.EmployeeName}
                </option>
              ))}
            </select>
            <select value={selectedCompanyFilter} onChange={(event) => setSelectedCompanyFilter(event.target.value)}>
              <option value="all">All companies</option>
              {workbook.companies.map((company) => (
                <option key={company.CompanyID} value={company.CompanyName}>
                  {company.CompanyName}
                </option>
              ))}
            </select>
            <select value={selectedMonthFilter} onChange={(event) => setSelectedMonthFilter(event.target.value)}>
              {monthChoicesBackwards(12).map((month) => (
                <option key={month} value={month}>
                  {formatMonth(month)}
                </option>
              ))}
            </select>
          </div>

          <div className="border border-[#E9D5FF] rounded-lg overflow-auto shadow-sm">
            <table>
              <thead>
                <tr>
                  <th className="bg-[#FAF5FF] text-[#3B0764] font-bold">AttendanceID</th>
                  <th className="bg-[#FAF5FF] text-[#3B0764] font-bold">Employee</th>
                  <th className="bg-[#FAF5FF] text-[#3B0764] font-bold">Date</th>
                  <th className="bg-[#FAF5FF] text-[#3B0764] font-bold">Company</th>
                  <th className="bg-[#FAF5FF] text-[#3B0764] font-bold">Location</th>
                  <th className="bg-[#FAF5FF] text-[#3B0764] font-bold">Worked hour</th>
                  <th>Addedby</th>
                </tr>
              </thead>
              <tbody>
                {visibleAttendance
                  .filter((entry) =>
                    (selectedEmployeeFilter === 'all' || entry.EmployeeID === selectedEmployeeFilter) &&
                    (selectedCompanyFilter === 'all' || entry.Company === selectedCompanyFilter) &&
                    getMonthKey(entry.Date) === selectedMonthFilter,
                  )
                  .map((entry) => {
                    const employee = workbook.employees.find((item) => item.EmployeeID === entry.EmployeeID)

                    return (
                      <tr key={entry.AttendanceID}>
                        <td>{entry.AttendanceID}</td>
                        <td>{employee?.EmployeeName ?? entry.EmployeeID}</td>
                        <td>{formatDate(entry.Date)}</td>
                        <td>{entry.Company}</td>
                        <td>{entry.Location}</td>
                        <td>{entry.WorkedHour}</td>
                        <td>{entry.Addedby}</td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    )
  }

  function renderAdvances() {
    if (!workbook || !currentUser) {
      return null
    }

    return (
      <div className="grid grid-cols-1 gap-6">
        <Panel title="Request advance" subtitle="Create a new request for the current employee or another selected worker.">
          <form className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" onSubmit={saveAdvance}>
            <label>
              Employee
              <select value={advanceDraft.EmployeeID} onChange={(event) => setAdvanceDraft((current) => ({ ...current, EmployeeID: event.target.value }))}>
                <option value="">Select employee</option>
                {workbook.employees.map((employee) => (
                  <option key={employee.EmployeeID} value={employee.EmployeeID}>
                    {employee.EmployeeName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Date
              <input type="date" value={advanceDraft.Date} onChange={(event) => setAdvanceDraft((current) => ({ ...current, Date: event.target.value }))} required />
            </label>
            <label>
              AdvanceAmount
              <input type="number" min={0} value={advanceDraft.AdvanceAmount} onChange={(event) => setAdvanceDraft((current) => ({ ...current, AdvanceAmount: Number(event.target.value) }))} required />
            </label>
            <label className="sm:col-span-2 lg:col-span-3">
              Reason
              <textarea rows={4} value={advanceDraft.Reason} onChange={(event) => setAdvanceDraft((current) => ({ ...current, Reason: event.target.value }))} required />
            </label>
            <div className="flex flex-wrap gap-2.5 mt-1 sm:col-span-2 lg:col-span-3">
              <button type="submit" className="inline-flex items-center justify-center h-10 px-4 rounded-md text-sm font-bold text-white bg-[#7C3AED] hover:bg-[#6D28D9]">Submit request</button>
              <button
                type="button"
                className="inline-flex items-center justify-center h-10 px-4 rounded-md text-sm font-bold text-[#4C1D95] bg-gray-100 hover:bg-gray-200"
                onClick={() =>
                  setAdvanceDraft({
                    ...EMPTY_ADVANCE,
                    EmployeeID: currentUser.Role === 'Admin' ? '' : currentUser.EmployeeID,
                  })
                }
              >
                Reset
              </button>
            </div>
          </form>
        </Panel>

        <Panel title="Advance requests" subtitle="Employees can request advances; admins can approve or reject them.">
          <div className="border border-[#E9D5FF] rounded-lg overflow-auto shadow-sm">
            <table>
              <thead>
                <tr>
                  <th className="bg-[#FAF5FF] text-[#3B0764] font-bold">AdvanceID</th>
                  <th className="bg-[#FAF5FF] text-[#3B0764] font-bold">Date</th>
                  <th className="bg-[#FAF5FF] text-[#3B0764] font-bold">Employee</th>
                  <th className="bg-[#FAF5FF] text-[#3B0764] font-bold">Amount</th>
                  <th className="bg-[#FAF5FF] text-[#3B0764] font-bold">Reason</th>
                  <th className="bg-[#FAF5FF] text-[#3B0764] font-bold">Status</th>
                  <th className="bg-[#FAF5FF] text-[#3B0764] font-bold">Approved by</th>
                  {isAdmin && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {visibleAdvances.map((advance) => {
                  const employee = workbook.employees.find((item) => item.EmployeeID === advance.EmployeeID)

                  return (
                    <tr key={advance.AdvanceID}>
                      <td>{advance.AdvanceID}</td>
                      <td>{formatDate(advance.Date)}</td>
                      <td>{employee?.EmployeeName ?? advance.EmployeeID}</td>
                      <td>{formatCurrency(advance.AdvanceAmount)}</td>
                      <td>{advance.Reason}</td>
                      <td>
                        <Badge value={advance.Status} />
                      </td>
                      <td>{advance.ApprovedBy || '-'}</td>
                      {isAdmin && (
                        <td>
                          <div className="flex flex-wrap gap-2.5">
                            <button type="button" className="inline-flex items-center justify-center h-10 px-4 rounded-md text-sm font-bold text-white bg-[#7C3AED] hover:bg-[#6D28D9]" onClick={() => decideAdvance(advance.AdvanceID, 'Approved')}>
                              Approve
                            </button>
                            <button type="button" className="inline-flex items-center justify-center h-10 px-4 rounded-md text-sm font-bold text-white bg-red-600 hover:bg-red-700" onClick={() => decideAdvance(advance.AdvanceID, 'Rejected')}>
                              Reject
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    )
  }

  function renderSalary() {
    if (!workbook || !currentUser) {
      return null
    }

    const monthRows = visibleSalaries.filter((salary) => salary.Month === selectedMonthFilter)

    return (
      <div className="grid grid-cols-1 gap-6">
        <Panel title="Current month pulse" subtitle="A snapshot of the chosen month for the active employee set.">
          <div className="flex flex-wrap gap-2.5 mb-4">
            <select className="box-border rounded-md border border-[#D8B4FE] bg-white py-2 px-3 text-[#4C1D95] outline-none focus:border-[#7C3AED] focus:ring-1 focus:ring-[#7C3AED]/20" value={selectedMonthFilter} onChange={(event) => setSelectedMonthFilter(event.target.value)}>
              {monthChoicesBackwards(12).map((month) => (
                <option key={month} value={month}>
                  {formatMonth(month)}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-summary mt-6">
            <article className="rounded-lg p-5 bg-white border border-[#E9D5FF] shadow-sm">
              <span className="text-xs font-semibold text-[#7C3AED] uppercase tracking-widest block mb-2">Total attendance</span>
              <strong className="text-2xl text-[#3B0764] block">{monthRows.reduce((sum, row) => sum + row.TotalAttendance, 0)}</strong>
            </article>
            <article className="rounded-lg p-5 bg-white border border-[#E9D5FF] shadow-sm text-center">
              <span className="text-xs font-semibold text-[#7C3AED] uppercase tracking-widest block mb-2">Gross salary</span>
              <strong className="text-2xl text-[#3B0764] block">{formatCurrency(monthRows.reduce((sum, row) => sum + row.NetSalary, 0))}</strong>
            </article>
            <article className="rounded-lg p-5 bg-white border border-[#E9D5FF] shadow-sm text-center">
              <span className="text-xs font-semibold text-[#7C3AED] uppercase tracking-widest block mb-2">Deductions</span>
              <strong className="text-2xl text-[#3B0764] block">{formatCurrency(monthRows.reduce((sum, row) => sum + row.AdvanceDeductions, 0))}</strong>
            </article>
            <article className="rounded-lg p-5 bg-white border border-[#E9D5FF] shadow-sm text-center">
              <span className="text-xs font-semibold text-[#7C3AED] uppercase tracking-widest block mb-2">Net payable</span>
              <strong className="text-2xl text-[#3B0764] block">{formatCurrency(monthRows.reduce((sum, row) => sum + row.NetPayble, 0))}</strong>
            </article>
          </div>
        </Panel>

        <Panel title="Salary" subtitle="Current and historical salary rows are derived from attendance and approved advances.">
          <div className="border border-[#E9D5FF] rounded-lg overflow-auto shadow-sm">
            <table>
              <thead>
                <tr>
                  <th className="bg-[#FAF5FF] text-[#3B0764] font-bold">SalaryID</th>
                  <th className="bg-[#FAF5FF] text-[#3B0764] font-bold">Employee</th>
                  <th className="bg-[#FAF5FF] text-[#3B0764] font-bold">Month</th>
                  <th className="bg-[#FAF5FF] text-[#3B0764] font-bold">Attendance</th>
                  <th className="bg-[#FAF5FF] text-[#3B0764] font-bold">Net salary</th>
                  <th className="bg-[#FAF5FF] text-[#3B0764] font-bold">Deductions</th>
                  <th className="bg-[#FAF5FF] text-[#3B0764] font-bold">Payable</th>
                  <th className="bg-[#FAF5FF] text-[#3B0764] font-bold">Status</th>
                  {isAdmin && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {monthRows.map((salary) => {
                  const employee = workbook.employees.find((item) => item.EmployeeID === salary.EmployeeID)

                  return (
                    <tr key={salary.SalaryID}>
                      <td>{salary.SalaryID}</td>
                      <td>{employee?.EmployeeName ?? salary.EmployeeID}</td>
                      <td>{formatMonth(salary.Month)}</td>
                      <td>{salary.TotalAttendance}</td>
                      <td>{formatCurrency(salary.NetSalary)}</td>
                      <td>{formatCurrency(salary.AdvanceDeductions)}</td>
                      <td>{formatCurrency(salary.NetPayble)}</td>
                      <td>
                        <Badge value={salary.PaidStatus} />
                      </td>
                      {isAdmin && (
                        <td>
                          <div className="flex flex-wrap gap-2.5">
                            <button type="button" onClick={() => setSalaryStatus(salary.SalaryID, 'Paid')}>
                              Mark paid
                            </button>
                            <button type="button" className="danger" onClick={() => setSalaryStatus(salary.SalaryID, 'Pending')}>
                              Mark pending
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="grid min-h-screen-vh place-items-center bg-gradient-hero p-4 sm:p-6 lg:p-8">
        <div className="grid w-full max-w-lg gap-4 content-start rounded-24 border border-border-light bg-bg-panel p-5 shadow-glass backdrop-blur-lg sm:p-7">
          <span className="inline-flex mb-2 text-accent-gold uppercase tracking-uppercase text-xs-tiny">Loading workbook</span>
          <h1>Preparing employee management data</h1>
          <p>Reading the spreadsheet model and synchronizing the browser state.</p>
        </div>
      </div>
    )
  }

  if (!workbook || !currentUser) {
    const accountList = workbook?.employees.filter((employee) => employee.Role === 'Employee') ?? []

    return (
      <div className="min-h-screen-vh bg-gradient-to-br from-[#FAF5FF] via-[#F3E8FF] to-[#EDE9FE] flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-5xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 lg:gap-10">
            {/* Left Section - Brand & Benefits */}
            <div className="flex flex-col justify-center gap-6 sm:gap-8 order-2 lg:order-1">
              {/* Logo Area */}
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-[#7C3AED] to-[#A855F7] rounded-2xl blur-lg opacity-75"></div>
                  <div className="relative bg-gradient-to-br from-[#7C3AED] to-[#A855F7] rounded-2xl p-4 sm:p-5 shadow-lg">
                    <span className="text-white font-black text-2xl sm:text-3xl tracking-wider">JR</span>
                  </div>
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-[#3B0764] leading-tight">Jyothi Refractory</h1>
                  <p className="text-sm sm:text-base text-[#7C3AED] font-medium">Employee Management Portal</p>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-4">
                <p className="text-base sm:text-lg text-[#4C1D95] leading-relaxed font-medium">
                  Welcome to your personal workspace. Manage your professional data with ease.
                </p>
              </div>

              {/* Benefits Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="group rounded-xl p-4 sm:p-5 bg-white border-2 border-[#E9D5FF] hover:border-[#D8B4FE] hover:shadow-lg transition-all duration-200 cursor-default">
                  <div className="text-3xl font-bold bg-gradient-to-r from-[#7C3AED] to-[#A855F7] bg-clip-text text-transparent">
                    {formatNumber(seedWorkbookData.employees.length)}
                  </div>
                  <p className="text-xs sm:text-sm font-semibold text-[#7C3AED] uppercase tracking-widest mt-2">Employees</p>
                  <p className="text-xs text-[#4C1D95] mt-1">in system</p>
                </div>

                <div className="group rounded-xl p-4 sm:p-5 bg-white border-2 border-[#E9D5FF] hover:border-[#D8B4FE] hover:shadow-lg transition-all duration-200 cursor-default">
                  <div className="text-3xl font-bold bg-gradient-to-r from-[#7C3AED] to-[#A855F7] bg-clip-text text-transparent">
                    {formatNumber(seedWorkbookData.workDetails.length)}
                  </div>
                  <p className="text-xs sm:text-sm font-semibold text-[#7C3AED] uppercase tracking-widest mt-2">Work Orders</p>
                  <p className="text-xs text-[#4C1D95] mt-1">active</p>
                </div>

                <div className="group rounded-xl p-4 sm:p-5 bg-white border-2 border-[#E9D5FF] hover:border-[#D8B4FE] hover:shadow-lg transition-all duration-200 cursor-default">
                  <div className="text-3xl font-bold bg-gradient-to-r from-[#7C3AED] to-[#A855F7] bg-clip-text text-transparent">
                    {formatNumber(seedWorkbookData.advances.length)}
                  </div>
                  <p className="text-xs sm:text-sm font-semibold text-[#7C3AED] uppercase tracking-widest mt-2">Advances</p>
                  <p className="text-xs text-[#4C1D95] mt-1">tracked</p>
                </div>
              </div>

              {/* Features List */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-r from-[#7C3AED] to-[#A855F7] flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <span className="text-sm sm:text-base text-[#4C1D95]">Track attendance & work details</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-r from-[#7C3AED] to-[#A855F7] flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <span className="text-sm sm:text-base text-[#4C1D95]">Request & manage advances</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-r from-[#7C3AED] to-[#A855F7] flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <span className="text-sm sm:text-base text-[#4C1D95]">View salary & payroll</span>
                </div>
              </div>
            </div>

            {/* Right Section - Login Form */}
            <div className="order-1 lg:order-2">
              <div className="relative h-full">
                <div className="absolute inset-0 bg-gradient-to-r from-[#7C3AED]/10 to-[#A855F7]/10 rounded-3xl blur-xl"></div>
                <div className="relative bg-white rounded-3xl border-2 border-[#E9D5FF] shadow-2xl p-6 sm:p-8 lg:p-10 h-full flex flex-col justify-center">
                  {/* Header */}
                  <div className="mb-8 sm:mb-10">
                    <p className="text-xs sm:text-sm font-bold text-[#7C3AED] uppercase tracking-widest mb-3">Welcome Back</p>
                    <h2 className="text-2xl sm:text-3xl font-bold text-[#3B0764] mb-2">Staff Sign In</h2>
                    <p className="text-sm sm:text-base text-[#4C1D95]">
                      Access your workspace securely
                    </p>
                  </div>

                  {/* Form */}
                  <form className="space-y-5 sm:space-y-6 flex-1" onSubmit={loginSubmit}>
                    {/* Employee Account Select */}
                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-[#3B0764]">
                        Select Your Account
                      </label>
                      <select 
                        value={login.employeeId} 
                        onChange={(event) => setLogin((current) => ({ ...current, employeeId: event.target.value }))}
                        className="w-full px-4 py-3 rounded-lg border-2 border-[#E9D5FF] text-[#3B0764] font-medium focus:outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 transition-all duration-200 bg-white hover:border-[#D8B4FE]"
                      >
                        <option value="">Choose your employee account</option>
                        {accountList.map((employee) => (
                          <option key={employee.EmployeeID} value={employee.EmployeeID}>
                            {employee.EmployeeName} ({employee.EmployeeID})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Password Input */}
                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-[#3B0764]">
                        Password
                      </label>
                      <input 
                        type="password" 
                        value={login.password} 
                        onChange={(event) => setLogin((current) => ({ ...current, password: event.target.value }))}
                        placeholder="Enter your password"
                        className="w-full px-4 py-3 rounded-lg border-2 border-[#E9D5FF] text-[#3B0764] font-medium placeholder:text-[#A095A8] focus:outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 transition-all duration-200 bg-white hover:border-[#D8B4FE]"
                      />
                    </div>

                    {/* Error Message */}
                    {loginError && (
                      <div className="p-3 sm:p-4 rounded-lg bg-red-50 border-2 border-red-200">
                        <p className="text-sm text-red-700 font-medium">{loginError}</p>
                      </div>
                    )}

                    {/* Submit Button */}
                    <button 
                      type="submit"
                      className="w-full h-12 sm:h-13 px-4 py-3 rounded-lg bg-gradient-to-r from-[#7C3AED] to-[#A855F7] text-white font-bold text-base sm:text-lg shadow-lg hover:shadow-xl hover:from-[#6D28D9] hover:to-[#9333EA] transition-all duration-200 transform hover:scale-105 active:scale-95"
                    >
                      Enter Dashboard
                    </button>

                    {/* Admin Link */}
                    <p className="text-center text-xs sm:text-sm text-[#4C1D95] mt-6 pt-4 border-t border-[#E9D5FF]">
                      Admin user?{' '}
                      <a href="/admin" className="font-bold text-[#7C3AED] hover:text-[#A855F7] transition-colors duration-200">
                        Sign in here
                      </a>
                    </p>
                  </form>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 sm:mt-12 text-center">
            <p className="text-xs sm:text-sm text-[#7C3AED] font-medium">
              Secure • Fast • Reliable Employee Management
            </p>
          </div>
        </div>
      </div>
    )
  }

  const topActions = isAdmin ? (
    <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
      <Badge value={saving ? 'Syncing' : 'Live'} />
      <button
        type="button"
        className="btn-ghost-gold inline-flex items-center justify-center rounded-16 py-2.25 px-4 font-inherit"
        onClick={() => setWorkbook((current) => (current ? recalculateDerivedData(current, current) : current))}
      >
        Refresh totals
      </button>
      <a
        className="inline-flex items-center justify-center rounded-md border-0 bg-indigo py-2 px-4 font-bold text-white no-underline transition-all duration-150 hover:bg-indigoHover"
        href="/api/download"
      >
        Download Excel
      </a>
    </div>
  ) : (
    <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
      <Badge value={saving ? 'Syncing' : 'Live'} />
      <button
        type="button"
        className="btn-ghost-gold inline-flex items-center justify-center rounded-16 py-2.25 px-4 font-inherit"
        onClick={() => setWorkbook((current) => (current ? recalculateDerivedData(current, current) : current))}
      >
        Refresh totals
      </button>
    </div>
  )

  return (
    <div className="bg-[#FAF5FF] grid min-h-screen-vh min-w-0 grid-cols-1 text-[#4C1D95] lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
      {sidebarOpen && <div className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />}
      <aside className={`bg-gradient-to-b from-[#7C3AED] to-[#A855F7] fixed inset-y-0 left-0 z-40 w-80 max-w-full flex-col gap-4 p-4 transition-transform duration-200 sm:gap-5 sm:p-6 lg:w-auto lg:sticky lg:top-0 lg:h-dvh lg:max-h-screen lg:overflow-y-auto lg:p-7 lg:self-start lg:translate-x-0 ${sidebarOpen ? 'flex translate-x-0' : 'flex -translate-x-full lg:translate-x-0'}`}>
        <div className="flex items-center gap-3 rounded-lg border border-white/20 bg-white/10 p-4 shadow-sm sm:gap-3.5 sm:p-4.5 backdrop-blur-sm">
          <span className="grid size-12 shrink-0 place-items-center rounded-md bg-white/20 font-black tracking-widest text-white sm:size-14">
            JR
          </span>
          <div className="min-w-0 text-white">
            <h1 className="text-lg font-semibold leading-tight sm:text-xl">{isAdmin ? 'Work ledger' : 'My workspace'}</h1>
            <p className="text-text-softer mt-0.5 text-xs leading-snug sm:text-sm">
              {isAdmin ? 'Excel-backed employee management' : 'Attendance, work, salary & requests'}
            </p>
          </div>
          <button type="button" className="ml-auto shrink-0 rounded-md p-2 text-white hover:bg-white/10 lg:hidden" onClick={() => setSidebarOpen(false)} title="Close menu">
            <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex items-start justify-between gap-3 rounded-lg border border-white/20 bg-white/10 p-4 shadow-sm sm:gap-4 sm:p-4.5 backdrop-blur-sm">
          <div className="min-w-0 text-white">
            <span className="mb-1.5 inline-flex text-xs font-semibold uppercase opacity-80">Logged in as</span>
            <strong className="block truncate text-[0.95rem] sm:text-base">{currentUser.EmployeeName}</strong>
            <p className="truncate text-sm opacity-75">{currentUser.EmployeeID}</p>
          </div>
          <Badge value={currentUser.Status} />
        </div>

        <nav className="grid gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={
                activeTab === tab.id
                  ? 'inline-flex justify-center items-center h-10 px-3 rounded-md text-sm font-bold transition-colors duration-150 text-white bg-white/20'
                  : 'inline-flex justify-center items-center h-10 px-3 rounded-md text-sm font-bold text-white/70 hover:text-white hover:bg-white/10'
              }
              onClick={() => {
                setActiveTab(tab.id)
                setSidebarOpen(false)
              }}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="mt-auto border-t border-white/20 pt-4">
          <button
            type="button"
            className="inline-flex w-full justify-center items-center h-10 px-4 rounded-md text-sm font-bold text-white bg-red-600 hover:bg-red-700 transition-colors duration-150"
            onClick={signOut}
          >
            Switch account
          </button>
        </div>
      </aside>

      <main
        className={
          isAdmin
            ? 'grid min-w-0 grid-cols-1 gap-4 p-4 sm:gap-5 sm:p-6 xl:p-7'
            : 'flex min-w-0 min-h-0 flex-col gap-4 p-4 sm:gap-5 sm:p-6 lg:p-7'
        }
      >
        <div className="grid min-w-0 gap-4 sm:gap-5">
          <div className="flex items-center justify-between lg:hidden">
            <button type="button" className="rounded-12 p-2 text-text-light hover:bg-white/10" onClick={() => setSidebarOpen(!sidebarOpen)} title="Toggle menu">
              <svg className="size-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>

          <section className="flex flex-col gap-4 rounded-28 border border-[#E9D5FF] bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:p-6">
            <div className="min-w-0">
              <span className="text-[#7C3AED] mb-2 inline-flex text-xs uppercase tracking-widest">Project workbook</span>
              <h2 className="text-xl font-semibold sm:text-2xl text-[#3B0764]">{isAdmin ? 'Admin control room' : 'Employee workspace'}</h2>
              <p className="text-[#4C1D95] mt-1 max-w-2xl text-sm leading-relaxed">
                Data is stored in the project workbook and mirrored in browser storage for offline fallback.
              </p>
            </div>
            <div className="shrink-0">{topActions}</div>
          </section>

          {!isAdmin && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-22 border border-gold-soft bg-black/40 px-4 py-3 text-sm backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <span className="text-text-softer">View</span>
                <strong>{tabs.find((t) => t.id === activeTab)?.label ?? 'Dashboard'}</strong>
              </div>
              <span className="hidden h-4 w-px bg-gold-soft sm:block" aria-hidden />
              <div className="flex items-center gap-2">
                <span className="text-text-softer">Sync</span>
                <strong>{saving ? 'Saving…' : 'Ready'}</strong>
              </div>
              <span className="hidden h-4 w-px bg-gold-soft sm:block" aria-hidden />
              <div className="flex items-center gap-2">
                <span className="text-text-softer">Month</span>
                <strong>{formatMonth(currentMonth)}</strong>
              </div>
            </div>
          )}

          {activeTab === 'dashboard' && (
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Removed 'Total employees' and 'Ongoing works' cards as requested */}
              <MetricCard label="Pending advances" value={summary?.pendingAdvances ?? 0} hint="Requests awaiting a decision." />
              <MetricCard label="This month" value={summary?.monthSalaryStatus ?? '0/0 paid'} hint="Current salary payment status." />
            </section>
          )}

          {activeTab === 'dashboard' && renderDashboard()}
          {activeTab === 'profile' && !isAdmin && (
            <Panel title="My profile" subtitle="The employee record visible to the logged-in user.">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-summary">
                <div>
                  <span className="inline-flex mb-2 text-[#7C3AED] uppercase tracking-widest text-xs font-semibold">Employee ID</span>
                  <strong className="text-lg text-[#3B0764]">{currentUser.EmployeeID}</strong>
                </div>
                <div>
                  <span className="inline-flex mb-2 text-[#7C3AED] uppercase tracking-widest text-xs font-semibold">Phone</span>
                  <strong className="text-lg text-[#3B0764]">{currentUser.Phone}</strong>
                </div>
                <div>
                  <span className="inline-flex mb-2 text-[#7C3AED] uppercase tracking-widest text-xs font-semibold">Per-day pay</span>
                  <strong className="text-lg text-[#3B0764]">{formatCurrency(currentUser.PerdayPay)}</strong>
                </div>
                <div>
                  <span className="inline-flex mb-2 text-[#7C3AED] uppercase tracking-widest text-xs font-semibold">Status</span>
                  <Badge value={currentUser.Status} />
                </div>
              </div>
            </Panel>
          )}
          {activeTab === 'employees' && renderEmployees()}
          {activeTab === 'attendance' && renderAttendance()}
          {activeTab === 'advances' && renderAdvances()}
          {activeTab === 'salary' && renderSalary()}
        </div>

        {isAdmin && (
          <aside className="bg-sidebar-shell grid content-start gap-4 rounded-28 border border-gold-soft p-5 shadow-glass backdrop-blur-lg xl:sticky xl:top-6">
            <div className="grid gap-2">
              <span className="text-accent-gold inline-flex text-xs uppercase tracking-widest">Details</span>
              <h3 className="text-xl font-semibold">Page details</h3>
              <p className="text-text-softer text-sm">Current role, selected tab, and sync state stay visible while you work.</p>
            </div>

            <div className="grid gap-3">
              <div className="rounded-22 border border-gold-soft bg-black/35 p-4">
                <span className="text-accent-gold mb-2 inline-flex text-xs uppercase tracking-widest">Role</span>
                <strong>Admin</strong>
              </div>
              <div className="rounded-22 border border-gold-soft bg-black/35 p-4">
                <span className="text-accent-gold mb-2 inline-flex text-xs uppercase tracking-widest">Active tab</span>
                <strong>{tabs.find((tab) => tab.id === activeTab)?.label ?? 'Dashboard'}</strong>
              </div>
              <div className="rounded-22 border border-gold-soft bg-black/35 p-4">
                <span className="text-accent-gold mb-2 inline-flex text-xs uppercase tracking-widest">Sync</span>
                <strong>{saving ? 'Saving changes' : 'Ready'}</strong>
              </div>
              <div className="rounded-22 border border-gold-soft bg-black/35 p-4">
                <span className="text-accent-gold mb-2 inline-flex text-xs uppercase tracking-widest">Current month</span>
                <strong>{formatMonth(currentMonth)}</strong>
              </div>
            </div>
          </aside>
        )}
      </main>
    </div>
  )
}

function currentUserIdToDefaultEmployee(workbook: WorkbookData, role: UserRole) {
  const match = workbook.employees.find((employee) => employee.Role === role)

  return match?.EmployeeID ?? ''
}