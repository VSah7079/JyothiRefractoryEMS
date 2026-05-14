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
  type Company,
  type Employee,
  type PaidStatus,
  type UserRole,
  type WorkDetail,
  type WorkStatus,
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

type WorkDraft = {
  WorkID: string
  EmployeeID: string
  CompanyID: string
  WorkTitle: string
  StartDate: string
  EndDate: string
  WorkAmount: number
  ReceivedAmount: number
  Status: WorkStatus
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
  { id: 'work', label: 'Work Details' },
  { id: 'advances', label: 'Advances' },
  { id: 'salary', label: 'Salary' },
  { id: 'company', label: 'Company' },
]

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

const EMPTY_WORK: WorkDraft = {
  WorkID: '',
  EmployeeID: '',
  CompanyID: '',
  WorkTitle: '',
  StartDate: todayValue(),
  EndDate: todayValue(),
  WorkAmount: 0,
  ReceivedAmount: 0,
  Status: 'Ongoing',
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
  return <span className={`inline-flex justify-center items-center py-1.5 px-3 rounded-full text-xs font-bold uppercase ${statusClass(value) === 'active' || statusClass(value) === 'approved' || statusClass(value) === 'paid' ? 'text-green-700 bg-green-100' : 'text-gray-600 bg-gray-100'}`}>{value}</span>
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
    <section className="rounded-lg p-6 bg-white border border-[#E9D5FF] shadow-sm">
      <header className="mb-6 grid gap-3 md:flex md:items-start md:justify-between md:gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#3B0764] mb-1">{title}</h2>
          <p className="text-sm text-[#4C1D95]">{subtitle}</p>
        </div>
        {action}
      </header>
      {children}
    </section>
  )
}

function MetricCard({ label, value, hint }: { label: string; value: ReactNode; hint: string }) {
  return (
    <article className="rounded-md p-4 bg-white border border-[#E9D5FF] shadow-sm flex-1 min-w-fit">
      <span className="text-xs font-semibold text-[#7C3AED] uppercase tracking-widest">{label}</span>
      <strong className="text-2xl block text-[#3B0764] mt-2">{value}</strong>
      <p className="text-xs text-[#4C1D95] mt-2">{hint}</p>
    </article>
  )
}

function BarChart({ data }: { data: Array<{ label: string; value: number }> }) {
  const max = Math.max(...data.map((entry) => entry.value), 1)

  return (
    <div className="grid gap-3.5">
      {data.map((entry) => (
        <div key={entry.label} className="grid gap-2">
          <div className="flex justify-between items-center gap-3 text-main-text">
            <span>{entry.label}</span>
            <strong>{formatNumber(entry.value)}</strong>
          </div>
          <div className="w-full h-3 overflow-hidden rounded-full bg-gray-100">
            <div className="h-full rounded-full bg-gradient-to-r from-[#7C3AED] to-[#A855F7]" style={{ width: `${(entry.value / max) * 100}%` }} />
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
  const [login, setLogin] = useState<LoginState>({
    role: 'Employee',
    employeeId: '',
    password: '',
  })
  const [loginError, setLoginError] = useState('')
  const [employeeDraft, setEmployeeDraft] = useState<EmployeeDraft>(EMPTY_EMPLOYEE)
  const [editingEmployeeId, setEditingEmployeeId] = useState('')
  const [attendanceDraft, setAttendanceDraft] = useState<AttendanceDraft>(EMPTY_ATTENDANCE)
  const [workDraft, setWorkDraft] = useState<WorkDraft>(EMPTY_WORK)
  const [editingWorkId, setEditingWorkId] = useState('')
  const [advanceDraft, setAdvanceDraft] = useState<AdvanceDraft>(EMPTY_ADVANCE)
  const [selectedCompanyId, setSelectedCompanyId] = useState('')
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

    const savedUser = sessionStorage.getItem('jyothi-active-user')

    if (savedUser && workbook.employees.some((employee) => employee.EmployeeID === savedUser)) {
      setActiveUserId(savedUser)
      setLogin((current) => ({ ...current, employeeId: savedUser }))
    }
  }, [activeUserId, workbook])

  useEffect(() => {
    if (!workbook) {
      return
    }

    if (!selectedCompanyId && workbook.companies[0]) {
      setSelectedCompanyId(workbook.companies[0].CompanyID)
      setAttendanceDraft((current) => ({ ...current, Company: workbook.companies[0].CompanyName }))
      setAdvanceDraft((current) => ({ ...current, EmployeeID: currentUserIdToDefaultEmployee(workbook, login.role) }))
    }
  }, [login.role, selectedCompanyId, workbook])

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

  const selectedCompany = workbook?.companies.find((company) => company.CompanyID === selectedCompanyId) ?? workbook?.companies[0] ?? null

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
    setActiveUserId(selectedAccount.EmployeeID)
    sessionStorage.setItem('jyothi-active-user', selectedAccount.EmployeeID)
    setActiveTab('dashboard')
  }

  function signOut() {
    setActiveUserId(null)
    setLogin((current) => ({ ...current, password: '' }))
    sessionStorage.removeItem('jyothi-active-user')
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

  function setRoleAndAccount(role: UserRole) {
    if (!workbook) {
      setLogin((current) => ({ ...current, role }))
      return
    }

    const firstMatch = workbook.employees.find((employee) => employee.Role === role)

    setLogin({
      role,
      employeeId: firstMatch?.EmployeeID ?? '',
      password: '',
    })
  }

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
      <div className="grid grid-cols-1 gap-6">
        <Panel title={editingEmployeeId ? 'Edit employee' : 'Add employee'} subtitle="Every field is synchronized to the workbook.">
          <form className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" onSubmit={saveEmployee}>
            <label>
              Employee ID
              <input
                value={employeeDraft.EmployeeID}
                onChange={(event) => setEmployeeDraft((current) => ({ ...current, EmployeeID: event.target.value }))}
                placeholder="Auto if blank"
              />
            </label>
            <label>
              Employee Name
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
              Per-day Pay
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
            <div className="flex flex-wrap gap-2.5 mt-1 lg:col-span-3">
              <button type="submit" className="inline-flex items-center justify-center h-10 px-4 rounded-md text-sm font-bold transition-colors duration-150 text-white bg-[#7C3AED] hover:bg-[#6D28D9]">{editingEmployeeId ? 'Save changes' : 'Create employee'}</button>
              <button type="button" className="inline-flex items-center justify-center h-10 px-4 rounded-md text-sm font-bold transition-colors duration-150 text-[#4C1D95] bg-gray-100 hover:bg-gray-200" onClick={() => resetEmployeeDraft()}>
                Clear
              </button>
            </div>
          </form>
        </Panel>

        <Panel
          title="Employees"
          subtitle="Add, edit, delete, toggle status, and reset passwords."
          action={<input className="w-full box-border rounded-md border border-[#D8B4FE] bg-white py-2 px-3 text-[#4C1D95] outline-none focus:border-[#7C3AED] focus:ring-1 focus:ring-[#7C3AED]/20 md:w-72" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search employees" />}
        >
          <div className="border border-[#E9D5FF] rounded-lg overflow-auto shadow-sm">
            <table>
              <thead>
                <tr>
                  <th>Employee ID</th>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Per-day Pay</th>
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
                          <button type="button" className="inline-flex items-center justify-center h-10 px-4 rounded-md text-sm font-bold text-white bg-[#7C3AED] hover:bg-[#6D28D9]" onClick={() => resetEmployeeDraft(employee)}>
                            Edit
                          </button>
                          <button type="button" className="inline-flex items-center justify-center h-10 px-4 rounded-md text-sm font-bold text-white bg-[#EC4899] hover:bg-[#DB2777]" onClick={() => toggleEmployeeStatus(employee.EmployeeID)}>
                            {employee.Status === 'Active' ? 'Deactivate' : 'Activate'}
                          </button>
                          <button type="button" className="inline-flex items-center justify-center h-10 px-4 rounded-md text-sm font-bold text-white bg-[#EC4899] hover:bg-[#DB2777]" onClick={() => resetPassword(employee.EmployeeID)}>
                            Reset
                          </button>
                          <button type="button" className="inline-flex items-center justify-center h-10 px-4 rounded-md text-sm font-bold text-white bg-red-600 hover:bg-red-700" onClick={() => removeEmployee(employee.EmployeeID)}>
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
          <form className="grid grid-cols-1 sm:grid-cols-3 gap-4" onSubmit={saveAttendance}>
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
              Worked Hours
              <input
                type="number"
                min={0}
                max={24}
                value={attendanceDraft.WorkedHour}
                onChange={(event) => setAttendanceDraft((current) => ({ ...current, WorkedHour: Number(event.target.value) }))}
                required
              />
            </label>
            <div className="flex flex-wrap gap-2.5 mt-1 sm:col-span-3">
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

        <Panel title="Attendance" subtitle="Add self or team attendance and filter the register.">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-center">
            <select className="w-full box-border py-2 px-3 text-[#4C1D95] rounded-md outline-none bg-white border border-[#D8B4FE] focus:border-[#7C3AED] focus:ring-1 focus:ring-[#7C3AED]/20" value={selectedEmployeeFilter} onChange={(event) => setSelectedEmployeeFilter(event.target.value)}>
              <option value="all">All employees</option>
              {workbook.employees.map((employee) => (
                <option key={employee.EmployeeID} value={employee.EmployeeID}>
                  {employee.EmployeeName}
                </option>
              ))}
            </select>
            <select className="w-full box-border py-2 px-3 text-[#4C1D95] rounded-md outline-none bg-white border border-[#D8B4FE] focus:border-[#7C3AED] focus:ring-1 focus:ring-[#7C3AED]/20" value={selectedCompanyFilter} onChange={(event) => setSelectedCompanyFilter(event.target.value)}>
              <option value="all">All companies</option>
              {workbook.companies.map((company) => (
                <option key={company.CompanyID} value={company.CompanyName}>
                  {company.CompanyName}
                </option>
              ))}
            </select>
            <select className="w-full box-border py-2 px-3 text-[#4C1D95] rounded-md outline-none bg-white border border-[#D8B4FE] focus:border-[#7C3AED] focus:ring-1 focus:ring-[#7C3AED]/20" value={selectedMonthFilter} onChange={(event) => setSelectedMonthFilter(event.target.value)}>
              {monthChoicesBackwards(12).map((month) => (
                <option key={month} value={month}>
                  {formatMonth(month)}
                </option>
              ))}
            </select>
          </div>

          <div className="border border-border-subtle rounded-18 overflow-auto">
            <table>
              <thead>
                <tr>
                  <th>Attendance ID</th>
                  <th>Employee</th>
                  <th>Date</th>
                  <th>Company</th>
                  <th>Location</th>
                  <th>Worked Hours</th>
                  <th>Added By</th>
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

  function renderWork() {
    if (!workbook || !currentUser) {
      return null
    }

    return (
      <div className="grid grid-cols-1 gap-6">
        {isAdmin ? (
          <Panel title={editingWorkId ? 'Edit work' : 'Add work'} subtitle="Update work amount, received amount, and the remaining balance.">
            <form className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" onSubmit={saveWork}>
              <label>
                Company ID
                <select value={workDraft.CompanyID} onChange={(event) => setWorkDraft((current) => ({ ...current, CompanyID: event.target.value }))} required>
                  <option value="">Select company</option>
                  {workbook.companies.map((company) => (
                    <option key={company.CompanyID} value={company.CompanyID}>
                      {company.CompanyID}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Work Title
                <input value={workDraft.WorkTitle} onChange={(event) => setWorkDraft((current) => ({ ...current, WorkTitle: event.target.value }))} required />
              </label>
              <label>
                Start Date
                <input type="date" value={workDraft.StartDate} onChange={(event) => setWorkDraft((current) => ({ ...current, StartDate: event.target.value }))} required />
              </label>
              <label>
                End Date
                <input type="date" value={workDraft.EndDate} onChange={(event) => setWorkDraft((current) => ({ ...current, EndDate: event.target.value }))} required />
              </label>
              <label>
                Work Amount
                <input type="number" min={0} value={workDraft.WorkAmount} onChange={(event) => setWorkDraft((current) => ({ ...current, WorkAmount: Number(event.target.value) }))} required />
              </label>
              <label>
                Received Amount
                <input type="number" min={0} value={workDraft.ReceivedAmount} onChange={(event) => setWorkDraft((current) => ({ ...current, ReceivedAmount: Number(event.target.value) }))} required />
              </label>
              <label>
                Status
                <select value={workDraft.Status} onChange={(event) => setWorkDraft((current) => ({ ...current, Status: event.target.value as WorkStatus }))}>
                  <option value="Ongoing">Ongoing</option>
                  <option value="Completed">Completed</option>
                </select>
              </label>
              <div className="flex flex-wrap gap-2.5 mt-1 lg:col-span-3">
                <button type="submit" className="inline-flex items-center justify-center h-10 px-4 rounded-md text-sm font-bold text-white bg-[#7C3AED] hover:bg-[#6D28D9]">{editingWorkId ? 'Save work' : 'Add work'}</button>
                <button type="button" className="inline-flex items-center justify-center h-10 px-4 rounded-md text-sm font-bold text-[#4C1D95] bg-gray-100 hover:bg-gray-200" onClick={() => resetWorkDraft()}>
                  Clear
                </button>
              </div>
            </form>
          </Panel>
        ) : (
          <Panel title="Work summary" subtitle="Your assigned work items and their current progress.">
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-summary">
              <article className="rounded-lg p-5 bg-white border border-slate-200 shadow-sm">
                <span>Assigned works</span>
                <strong>{visibleWorks.length}</strong>
              </article>
              <article>
                <span>Ongoing works</span>
                <strong>{visibleWorks.filter((work) => work.Status === 'Ongoing').length}</strong>
              </article>
            </div>
          </Panel>
        )}

        <Panel title="Work details" subtitle="Track ongoing and completed work orders.">
          <div className="border border-border-subtle rounded-18 overflow-auto">
            <table>
              <thead>
                <tr>
                  <th>Work ID</th>
                  <th>Company ID</th>
                  <th>Work Title</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>Work Amount</th>
                  <th>Received Amount</th>
                  <th>Pending Amount</th>
                  <th>Status</th>
                  {isAdmin && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {visibleWorks.map((work) => {
                  return (
                    <tr key={work.WorkID}>
                      <td>{work.WorkID}</td>
                      <td>{work.CompanyID}</td>
                      <td>{work.WorkTitle}</td>
                      <td>{formatDate(work.StartDate)}</td>
                      <td>{formatDate(work.EndDate)}</td>
                      <td>{formatCurrency(work.WorkAmount)}</td>
                      <td>{formatCurrency(work.ReceivedAmount)}</td>
                      <td>{formatCurrency(work.PendingAmount)}</td>
                      <td>
                        <Badge value={work.Status} />
                      </td>
                      {isAdmin && (
                        <td>
                          <div className="flex flex-wrap gap-2.5">
                            <button type="button" onClick={() => resetWorkDraft(work)}>
                              Edit
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
            <label>
              Reason
              <textarea rows={4} value={advanceDraft.Reason} onChange={(event) => setAdvanceDraft((current) => ({ ...current, Reason: event.target.value }))} required />
            </label>
            <div className="flex flex-wrap gap-2.5 mt-1 lg:col-span-3">
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
          <div className="border border-border-subtle rounded-18 overflow-auto">
            <table>
              <thead>
                <tr>
                  <th>Advance ID</th>
                  <th>Date</th>
                  <th>Employee</th>
                  <th>Advance Amount</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Approved By</th>
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
                            <button type="button" onClick={() => decideAdvance(advance.AdvanceID, 'Approved')}>
                              Approve
                            </button>
                            <button type="button" className="inline-flex justify-center items-center py-1.5 px-3 border-0 rounded-md cursor-pointer text-sm font-bold text-white bg-red-600 hover:bg-red-700 transition-all duration-150" onClick={() => decideAdvance(advance.AdvanceID, 'Rejected')}>
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
        <Panel title="Salary" subtitle="Current and historical salary rows are derived from attendance and approved advances.">
          <div className="flex flex-wrap gap-2.5">
            <select value={selectedMonthFilter} onChange={(event) => setSelectedMonthFilter(event.target.value)}>
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
            <article>
              <span>Gross salary</span>
              <strong>{formatCurrency(monthRows.reduce((sum, row) => sum + row.NetSalary, 0))}</strong>
            </article>
            <article>
              <span>Deductions</span>
              <strong>{formatCurrency(monthRows.reduce((sum, row) => sum + row.AdvanceDeductions, 0))}</strong>
            </article>
            <article>
              <span>Net payable</span>
              <strong>{formatCurrency(monthRows.reduce((sum, row) => sum + row.NetPayble, 0))}</strong>
            </article>
          </div>
        </Panel>

        <Panel title="Salary list" subtitle="Detailed salary rows for the selected month.">
          <div className="border border-border-subtle rounded-18 overflow-auto">
            <table>
              <thead>
                <tr>
                  <th>Salary ID</th>
                  <th>Employee</th>
                  <th>Month</th>
                  <th>Total Attendance</th>
                  <th>Net Salary</th>
                  <th>Advance Deductions</th>
                  <th>Net Payable</th>
                  <th>Paid Status</th>
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
                            <button
                              type="button"
                              className="inline-flex justify-center items-center py-1.5 px-3 border-0 rounded-md cursor-pointer text-sm font-bold text-white bg-indigo hover:bg-indigoHover transition-all duration-150"
                              onClick={() => setSalaryStatus(salary.SalaryID, 'Paid')}
                            >
                              Mark paid
                            </button>
                            <button type="button" className="inline-flex justify-center items-center py-1.5 px-3 border-0 rounded-md cursor-pointer text-sm font-bold text-white bg-red-600 hover:bg-red-700 transition-all duration-150" onClick={() => setSalaryStatus(salary.SalaryID, 'Pending')}>
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

  function renderCompany() {
    if (!workbook) {
      return null
    }

    return (
      <div className="grid grid-cols-1 gap-6">
        <Panel title="Company details" subtitle="Admins can update company details directly in the workbook.">
          {selectedCompany ? (
            <form className="grid grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={saveCompany}>
              <label>
                Company ID
                <input value={selectedCompany.CompanyID} readOnly />
              </label>
              <label>
                Company Name
                <input value={selectedCompany.CompanyName} onChange={(event) => updateSelectedCompany('CompanyName', event.target.value)} readOnly={!isAdmin} />
              </label>
              <label>
                Address
                <textarea rows={3} value={selectedCompany.Address} onChange={(event) => updateSelectedCompany('Address', event.target.value)} readOnly={!isAdmin} />
              </label>
              <label>
                Work Address
                <textarea rows={3} value={selectedCompany.WorkAddress} onChange={(event) => updateSelectedCompany('WorkAddress', event.target.value)} readOnly={!isAdmin} />
              </label>
              <label>
                GSTIN
                <input value={selectedCompany.GSTIN} onChange={(event) => updateSelectedCompany('GSTIN', event.target.value)} readOnly={!isAdmin} />
              </label>
              <label>
                Contact
                <input value={selectedCompany.Contact} onChange={(event) => updateSelectedCompany('Contact', event.target.value)} readOnly={!isAdmin} />
              </label>
              <label>
                Email
                <input type="email" value={selectedCompany.Email} onChange={(event) => updateSelectedCompany('Email', event.target.value)} readOnly={!isAdmin} />
              </label>
              {isAdmin && (
              <div className="flex flex-wrap gap-2 mt-1 sm:col-span-2">
                  <button type="submit" className="inline-flex items-center justify-center h-10 px-4 rounded-md text-sm font-bold text-white bg-[#7C3AED] hover:bg-[#6D28D9]">Save company</button>
                </div>
              )}
            </form>
          ) : (
            <p className="text-text-softer">No company available.</p>
          )}
        </Panel>

        <Panel title="Companies" subtitle="Select a company to view or edit the record.">
          <div className="grid gap-2.5">
            {workbook.companies.map((company) => (
              <button
                key={company.CompanyID}
                type="button"
                className={company.CompanyID === selectedCompanyId ? 'grid gap-1.5 p-3 text-left text-text-light cursor-pointer rounded-16 bg-accent-gold/15 border border-accent-gold/35' : 'grid gap-1.5 p-3 text-left text-text-light cursor-pointer bg-bg-panel rounded-16'}
                onClick={() => {
                  setSelectedCompanyId(company.CompanyID)
                }}
              >
                <strong>{company.CompanyName}</strong>
                <span>{company.CompanyID}</span>
              </button>
            ))}
          </div>
          {isAdmin && (
            <div className="flex flex-wrap gap-2 mt-3">
              <a className="inline-flex justify-center items-center py-1.5 px-3 border-0 rounded-md cursor-pointer text-sm font-bold text-white bg-indigo hover:bg-indigoHover transition-all duration-150" href="/api/download">
                Download Excel
              </a>
            </div>
          )}
        </Panel>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="grid gap-4.5 min-h-screen-vh p-6 bg-gradient-hero grid-cols-1 lg:grid-cols-2 sm:p-4">
        <div className="grid gap-4.5 content-start p-7 bg-bg-panel border border-border-light shadow-glass backdrop-blur-lg rounded-24">
          <span className="inline-flex mb-2 text-accent-gold uppercase tracking-uppercase text-xs-tiny">Loading workbook</span>
          <h1>Preparing employee management data</h1>
          <p>Reading the spreadsheet model and synchronizing the browser state.</p>
        </div>
      </div>
    )
  }

  if (!workbook || !currentUser) {
    const accountList = workbook?.employees.filter((employee) => employee.Role === login.role) ?? []

    return (
      <div className="grid gap-4.5 min-h-screen-vh p-6 bg-gradient-hero grid-cols-1 lg:grid-cols-2 sm:p-4">
        <section className="grid gap-4.5 content-start p-7 bg-bg-panel border border-border-light shadow-glass backdrop-blur-lg rounded-24">
          <span className="inline-flex mb-2 text-accent-gold uppercase tracking-uppercase text-xs-tiny">Jyothi Refractory</span>
          <h1>Excel-backed employee management for attendance, salary, advances, and work tracking.</h1>
          <p>
            The app reads and writes a workbook in the project folder, then falls back to browser storage if the dev API is unavailable.
          </p>
          <div className="grid gap-3 grid-cols-hero">
            <article className="grid gap-2 p-4 bg-bg-panel rounded-18">
              <strong>{formatNumber(seedWorkbookData.employees.length)}</strong>
              <span>Seed employees</span>
            </article>
            <article>
              <strong>{formatNumber(seedWorkbookData.workDetails.length)}</strong>
              <span>Work orders</span>
            </article>
            <article>
              <strong>{formatNumber(seedWorkbookData.advances.length)}</strong>
              <span>Advance requests</span>
            </article>
          </div>
        </section>

        <section className="grid gap-4.5 content-start p-7 bg-bg-panel border border-border-light shadow-glass backdrop-blur-lg rounded-24">
          <span className="inline-flex mb-2 text-accent-gold uppercase tracking-uppercase text-xs-tiny">Access portal</span>
          <h2>Sign in to continue</h2>
          <form className="grid gap-3" onSubmit={loginSubmit}>
            <label>
              Role
              <select
                value={login.role}
                onChange={(event) => setRoleAndAccount(event.target.value as UserRole)}
              >
                <option value="Employee">Employee</option>
                <option value="Admin">Admin</option>
              </select>
            </label>
            <label>
              Account
              <select value={login.employeeId} onChange={(event) => setLogin((current) => ({ ...current, employeeId: event.target.value }))}>
                <option value="">Choose account</option>
                {accountList.map((employee) => (
                  <option key={employee.EmployeeID} value={employee.EmployeeID}>
                    {employee.EmployeeName} ({employee.EmployeeID})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Password
              <input type="password" value={login.password} onChange={(event) => setLogin((current) => ({ ...current, password: event.target.value }))} placeholder="Enter password" />
            </label>
            {loginError && <p className="text-red-300">{loginError}</p>}
            <button type="submit">Enter dashboard</button>
          </form>
        </section>
      </div>
    )
  }

  const topActions = isAdmin ? (
    <div className="flex flex-wrap gap-2.5">
      <Badge value={saving ? 'Syncing' : 'Live'} />
      <button type="button" className="inline-flex justify-center items-center py-2 px-4 border-0 rounded-md cursor-pointer font-bold text-main-text bg-gray-100 hover:bg-gray-200 transition-all duration-150" onClick={() => setWorkbook((current) => (current ? recalculateDerivedData(current, current) : current))}>
        Refresh totals
      </button>
      <a className="inline-flex justify-center items-center py-2 px-4 border-0 rounded-md cursor-pointer text-white font-bold bg-indigo hover:bg-indigoHover transition-all duration-150" href="/api/download">
        Download Excel
      </a>
    </div>
  ) : (
    <div className="flex flex-wrap gap-2.5">
      <Badge value={saving ? 'Syncing' : 'Live'} />
      <button type="button" className="inline-flex justify-center items-center py-2 px-4 border-0 rounded-md cursor-pointer font-bold text-main-text bg-gray-100 hover:bg-gray-200 transition-all duration-150" onClick={() => setWorkbook((current) => (current ? recalculateDerivedData(current, current) : current))}>
        Refresh totals
      </button>
    </div>
  )

  return (
    <div className="bg-[#FAF5FF] grid min-h-screen-vh grid-cols-1 text-[#4C1D95] lg:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="bg-gradient-to-b from-[#7C3AED] to-[#A855F7] flex flex-col gap-5 p-4 sm:p-6 lg:sticky lg:top-0 lg:h-dvh lg:overflow-y-auto lg:p-7 lg:self-start">
        <div className="flex items-center gap-3.5 p-4 rounded-lg bg-white border border-[#E9D5FF] shadow-sm">
          <span className="grid place-items-center w-12 h-12 rounded-md font-bold tracking-wider text-[#7C3AED] bg-[#7C3AED]/10">JR</span>
          <div className="ml-3 min-w-0">
            <div className="text-xs font-semibold text-[#7C3AED] uppercase tracking-widest">Logged in as</div>
            <strong className="block text-sm text-[#4C1D95] truncate">{currentUser.EmployeeName}</strong>
            <p className="text-xs text-[#7E22CE] opacity-85 truncate">{currentUser.EmployeeID}</p>
          </div>
          <div className="ml-auto">
            <Badge value={currentUser.Status} />
          </div>
        </div>

        <nav className="grid gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={activeTab === tab.id ? 'inline-flex justify-center items-center h-10 px-3 rounded-md text-sm font-bold transition-colors duration-150 text-white bg-white/20' : 'inline-flex justify-center items-center h-10 px-3 rounded-md text-sm font-bold text-white/70 hover:text-white hover:bg-white/10'}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="mt-auto pt-4 border-t border-white/20">
          <button type="button" className="inline-flex w-full justify-center items-center h-10 px-4 rounded-md text-sm font-bold text-white bg-red-600 hover:bg-red-700 transition-colors duration-150" onClick={signOut}>
            Switch account
          </button>
        </div>
      </aside>

      <main className="min-w-0 grid gap-6 p-5 sm:gap-6 sm:p-7 lg:p-8">
        <div className="grid min-w-0 gap-4.5 sm:gap-5">
          <section className="flex flex-col gap-4 rounded-28 border border-[#E9D5FF] bg-white p-5 shadow-sm sm:p-6 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
            <div>
              <span className="inline-flex mb-2 text-[#7C3AED] uppercase tracking-uppercase text-xs-tiny">Project workbook</span>
              <h2 className="text-[#3B0764]">{isAdmin ? 'Admin control room' : 'Employee workspace'}</h2>
              <p className="text-[#4C1D95]">
                Data is stored in the project workbook and mirrored in browser storage for offline fallback.
              </p>
            </div>
            {topActions}
          </section>

          {activeTab === 'dashboard' && (
            <section className="flex gap-2 flex-wrap">
              {/* Removed 'Total employees' and 'Ongoing works' cards as requested */}
              <MetricCard label="Pending advances" value={summary?.pendingAdvances ?? 0} hint="Requests awaiting a decision." />
              <MetricCard label="This month" value={summary?.monthSalaryStatus ?? '0/0 paid'} hint="Current salary payment status." />
            </section>
          )}

          {activeTab === 'dashboard' && renderDashboard()}
          {activeTab === 'profile' && !isAdmin && (
            <Panel title="My profile" subtitle="The employee record visible to the logged-in user.">
              <div className="grid grid-cols-1 gap-3 rounded-24 border border-border-light bg-bg-panel p-4.5 shadow-glass backdrop-blur-lg sm:grid-cols-summary">
                <div>
                  <span className="inline-flex mb-2 text-accent-gold uppercase tracking-uppercase text-xs-tiny">Employee ID</span>
                  <strong>{currentUser.EmployeeID}</strong>
                </div>
                <div>
                  <span className="inline-flex mb-2 text-accent-gold uppercase tracking-uppercase text-xs-tiny">Phone</span>
                  <strong>{currentUser.Phone}</strong>
                </div>
                <div>
                  <span className="inline-flex mb-2 text-accent-gold uppercase tracking-uppercase text-xs-tiny">Per-day pay</span>
                  <strong>{formatCurrency(currentUser.PerdayPay)}</strong>
                </div>
                <div>
                  <span className="inline-flex mb-2 text-accent-gold uppercase tracking-uppercase text-xs-tiny">Status</span>
                  <Badge value={currentUser.Status} />
                </div>
              </div>
            </Panel>
          )}
          {activeTab === 'employees' && renderEmployees()}
          {activeTab === 'attendance' && renderAttendance()}
          {activeTab === 'work' && renderWork()}
          {activeTab === 'advances' && renderAdvances()}
          {activeTab === 'salary' && renderSalary()}
          {activeTab === 'company' && renderCompany()}
        </div>

      </main>
    </div>
  )
}

function currentUserIdToDefaultEmployee(workbook: WorkbookData, role: UserRole) {
  const match = workbook.employees.find((employee) => employee.Role === role)

  return match?.EmployeeID ?? ''
}