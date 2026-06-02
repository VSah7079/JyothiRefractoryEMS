import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
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
import { downloadWorkbookData, downloadWorkbookJSON, loadWorkbookData, saveWorkbookData } from '../lib/workbookApi'
import { normalizeWorkbookData } from '../lib/employeeData'

const WORKBOOK_REFRESH_KEY = 'jyothi-workbook-refresh'

type TabId = 'dashboard' | 'profile' | 'employees' | 'attendance' | 'work' | 'advances' | 'salary' | 'company'

// login state type removed — centralized LoginPage handles login

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
  { id: 'advances', label: 'Advances' },
  { id: 'salary', label: 'Salary' },
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
          <p className="text-sm text-text-light">{subtitle}</p>
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
      <p className="text-xs text-text-light mt-2">{hint}</p>
    </article>
  )
}

function BarChart({ data }: { data: Array<{ label: string; value: number }> }) {
  const max = Math.max(...data.map((entry) => entry.value), 1)

  return (
    <div className="grid gap-3.5">
      {data.map((entry) => (
        <div key={entry.label} className="grid gap-2">
          <div className="flex justify-between items-center gap-3 text-text-light">
            <span>{entry.label}</span>
            <strong>{formatNumber(entry.value)}</strong>
          </div>
          <div className="w-full h-3 overflow-hidden rounded-full bg-gray-100">
            <div className="h-full rounded-full bg-linear-to-r from-indigo to-primary-purple" style={{ width: `${(entry.value / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function Admin({ initialTab }: { initialTab?: TabId } = {}) {
  const navigate = useNavigate()
  const [workbook, setWorkbook] = useState<WorkbookData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [pendingAdvanceId, setPendingAdvanceId] = useState('')
  const [activeUserId, setActiveUserId] = useState<string | null>(() => {
    try {
      return typeof window !== 'undefined' ? sessionStorage.getItem('jyothi-active-user') : null
    } catch (e) {
      return null
    }
  })
  const employeeFormRef = useRef<HTMLDivElement | null>(null)
  const attendanceFormRef = useRef<HTMLDivElement | null>(null)
  const workFormRef = useRef<HTMLDivElement | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>(initialTab ?? 'dashboard')
  
  const [employeeDraft, setEmployeeDraft] = useState<EmployeeDraft>(EMPTY_EMPLOYEE)
  const [editingEmployeeId, setEditingEmployeeId] = useState('')
  const [attendanceDraft, setAttendanceDraft] = useState<AttendanceDraft>(EMPTY_ATTENDANCE)
  const [editingAttendanceId, setEditingAttendanceId] = useState('')
  const [workDraft, setWorkDraft] = useState<WorkDraft>(EMPTY_WORK)
  const [editingWorkId, setEditingWorkId] = useState('')
  const [advanceDraft, setAdvanceDraft] = useState<AdvanceDraft>(EMPTY_ADVANCE)
  const [selectedCompanyId, setSelectedCompanyId] = useState('')
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState('all')
  const [selectedMonthFilter, setSelectedMonthFilter] = useState(monthKeyFromNow())
  const [selectedDateFilter, setSelectedDateFilter] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const importFileRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    let isMounted = true

    async function bootstrap() {
      const remote = await loadWorkbookData()

      if (!isMounted) {
        return
      }

      setWorkbook(remote ? recalculateDerivedData(remote, remote) : null)
      setLoading(false)
    }

    void bootstrap()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    function handleWorkbookRefresh(event: StorageEvent) {
      if (event.key !== WORKBOOK_REFRESH_KEY) {
        return
      }

      void loadWorkbookData().then((remote) => {
        if (remote) {
          setWorkbook(recalculateDerivedData(remote, remote))
        }
      })
    }

    window.addEventListener('storage', handleWorkbookRefresh)

    return () => {
      window.removeEventListener('storage', handleWorkbookRefresh)
    }
  }, [])

  useEffect(() => {
    if (!workbook || activeUserId) {
      return
    }

    const savedUser = sessionStorage.getItem('jyothi-active-user')

    if (savedUser && workbook.employees.some((employee) => employee.EmployeeID === savedUser)) {
      setActiveUserId(savedUser)
    }
  }, [activeUserId, workbook])

  useEffect(() => {
    if (!workbook) {
      return
    }

    if (!selectedCompanyId && workbook.companies[0]) {
      setSelectedCompanyId(workbook.companies[0].CompanyID)
      setAttendanceDraft((current) => ({ ...current, Company: workbook.companies[0].CompanyName }))
      setAdvanceDraft((current) => ({ ...current, EmployeeID: currentUserIdToDefaultEmployee(workbook, currentUser?.Role ?? 'Employee') }))
    }
  }, [selectedCompanyId, workbook])

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

  if (loading) {
    return (
      <div className="grid min-h-screen-vh place-items-center bg-gradient-hero p-4 sm:p-6 lg:p-8">
        <div className="grid w-full max-w-lg gap-4 content-start rounded-24 border border-border-light bg-bg-panel p-5 shadow-glass backdrop-blur-lg sm:p-7">
          <span className="inline-flex mb-2 text-accent-gold uppercase tracking-uppercase text-xs-tiny">Loading data</span>
          <h1>Preparing admin workspace</h1>
          <p>Reading saved workbook data from local browser storage.</p>
        </div>
      </div>
    )
  }

  if (!workbook || !currentUser) return <Navigate to="/login" replace />

  const selectedCompany = workbook?.companies.find((company) => company.CompanyID === selectedCompanyId) ?? workbook?.companies[0] ?? null

  function persist(next: WorkbookData) {
    const recalculated = recalculateDerivedData(next, workbook ?? next)
    setWorkbook(recalculated)
    setSaving(true)
    void saveWorkbookData(recalculated).finally(() => {
      setSaving(false)
      localStorage.setItem(WORKBOOK_REFRESH_KEY, String(Date.now()))
    })
  }

  function signOut() {
    setActiveUserId(null)
    sessionStorage.removeItem('jyothi-active-user')
    navigate('/login', { replace: true })
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
    window.requestAnimationFrame(() => {
      employeeFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
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
        employee.EmployeeID === employeeId ? { ...employee, Status: employee.Status === 'Active' ? 'Inactive' : 'Active' } : employee,
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

  function resetAttendanceDraft(record?: Attendance) {
    if (!record) {
      setAttendanceDraft(EMPTY_ATTENDANCE)
      setEditingAttendanceId('')
      return
    }

    setAttendanceDraft({
      EmployeeID: record.EmployeeID,
      Date: record.Date,
      Company: record.Company,
      Location: record.Location,
      WorkedHour: record.WorkedHour,
    })
    setEditingAttendanceId(record.AttendanceID)
    setActiveTab('attendance')
    window.requestAnimationFrame(() => {
      attendanceFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  function saveAttendance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!workbook || !currentUser) {
      return
    }

    const targetEmployeeId = attendanceDraft.EmployeeID || currentUser.EmployeeID
    const nextAttendance: Attendance = {
      AttendanceID: editingAttendanceId || generateId('ATT', workbook.attendance.map((entry) => entry.AttendanceID)),
      EmployeeID: targetEmployeeId,
      Date: attendanceDraft.Date,
      Company: attendanceDraft.Company,
      Location: attendanceDraft.Location.trim(),
      WorkedHour: Number(attendanceDraft.WorkedHour) || 0,
      Addedby: currentUser.EmployeeName,
    }

    const nextAttendanceList = editingAttendanceId
      ? workbook.attendance.map((entry) => (entry.AttendanceID === editingAttendanceId ? nextAttendance : entry))
      : [...workbook.attendance, nextAttendance]

    persist({ ...workbook, attendance: nextAttendanceList })
    setAttendanceDraft({
      ...EMPTY_ATTENDANCE,
      EmployeeID: currentUser.Role === 'Admin' ? '' : currentUser.EmployeeID,
      Company: workbook.companies[0]?.CompanyName ?? '',
    })
    setEditingAttendanceId('')
  }

  function removeAttendance(attendanceId: string) {
    if (!workbook) {
      return
    }

    const confirmed = window.confirm('Delete this attendance entry?')

    if (!confirmed) {
      return
    }

    persist({
      ...workbook,
      attendance: workbook.attendance.filter((entry) => entry.AttendanceID !== attendanceId),
    })

    if (editingAttendanceId === attendanceId) {
      setAttendanceDraft({
        ...EMPTY_ATTENDANCE,
        EmployeeID: currentUser?.Role === 'Admin' ? '' : currentUser?.EmployeeID ?? '',
        Company: workbook.companies[0]?.CompanyName ?? '',
      })
      setEditingAttendanceId('')
    }
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
    setActiveTab('work')
    window.requestAnimationFrame(() => {
      workFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
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

  async function decideAdvance(advanceId: string, status: 'Approved' | 'Rejected') {
    if (!workbook || !currentUser) {
      return
    }

    setSaving(true)
    setPendingAdvanceId(advanceId)
    try {
      const endpoint = status === 'Approved' ? `/api/advance/${advanceId}/approve` : `/api/advance/${advanceId}/reject`

      setWorkbook((current) => {
        if (!current) {
          return current
        }

        return {
          ...current,
          advances: current.advances.map((advance) =>
            advance.AdvanceID === advanceId
              ? { ...advance, Status: status, ApprovedBy: currentUser.EmployeeName }
              : advance,
          ),
        }
      })

      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvedBy: currentUser.EmployeeName }),
      })

      if (response.ok) {
        const remote = await loadWorkbookData()
        setWorkbook(remote ? recalculateDerivedData(remote, remote) : null)
        localStorage.setItem(WORKBOOK_REFRESH_KEY, String(Date.now()))
      } else {
        console.error('Failed to update advance status', await response.text())
      }
    } catch (error) {
      console.error(error)
    } finally {
      setSaving(false)
      setPendingAdvanceId('')
    }
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

  // `setRoleAndAccount` removed — centralized login page handles role/account selection

  function renderDashboard() {
    if (!summary) {
      return null
    }

    return (
      <div className="grid grid-cols-1 gap-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="rounded-lg p-4 bg-linear-to-br from-[#F3E8FF] to-[#F5F3FF] border border-[#E9D5FF] shadow-sm">
            <span className="text-xs font-semibold text-[#7C3AED] uppercase">Current Attendance</span>
            <strong className="text-3xl text-[#3B0764] block mt-1">{summary.currentAttendance}</strong>
          </div>
          <div className="rounded-lg p-4 bg-linear-to-br from-[#F0F9FF] to-[#F8FAFC] border border-[#E0E7FF] shadow-sm">
            <span className="text-xs font-semibold text-[#3B82F6] uppercase">Net Payable</span>
            <strong className="text-2xl text-[#1E40AF] block mt-1">{formatCurrency(summary.currentNetPayable)}</strong>
          </div>
          <div className="rounded-lg p-4 bg-linear-to-br from-[#FEF3C7] to-[#FFFBEB] border border-[#FCD34D] shadow-sm">
            <span className="text-xs font-semibold text-[#D97706] uppercase">Current Month</span>
            <strong className="text-xl text-[#B45309] block mt-1">{formatMonth(currentMonth)}</strong>
          </div>
          <div className="rounded-lg p-4 bg-linear-to-br from-[#F0FDF4] to-[#F8FAFC] border border-[#86EFAC] shadow-sm">
            <span className="text-xs font-semibold text-[#15803D] uppercase">Status</span>
            <strong className="text-lg text-[#166534] block mt-1">{summary.monthSalaryStatus}</strong>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-card gap-6">
          <Panel title="Attendance Trend" subtitle="Employee wise attendance footprint for the selected period.">
            <BarChart data={attendanceSeries} />
          </Panel>
          <Panel title="Salary Distribution" subtitle={`Net payable for ${formatMonth(selectedMonthFilter)}.`}>
            <BarChart data={salarySeries} />
          </Panel>
          <Panel title="Work Progress" subtitle="Outstanding balances across active work orders.">
            <BarChart data={workSeries} />
          </Panel>
        </div>
      </div>
    )
  }

  function renderEmployees() {
    if (!workbook || !isAdmin) {
      return null
    }

    const filteredEmployees = workbook.employees.filter((employee) =>
      `${employee.EmployeeID} ${employee.EmployeeName} ${employee.Phone}`
        .toLowerCase()
        .includes(searchTerm.toLowerCase()),
    )

    const activeCount = workbook.employees.filter((e) => e.Status === 'Active').length
    const adminCount = workbook.employees.filter((e) => e.Role === 'Admin').length
    const employeeCount = workbook.employees.filter((e) => e.Role === 'Employee').length

    return (
      <div className="grid grid-cols-1 gap-6">
        <div ref={employeeFormRef}>
          <Panel title={editingEmployeeId ? 'Edit employee' : 'Add employee'} subtitle="Every field is saved to the local JSON store.">
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
            <label className="lg:col-span-1">
              Password
              <input
                value={employeeDraft.Password}
                onChange={(event) => setEmployeeDraft((current) => ({ ...current, Password: event.target.value }))}
                required
              />
            </label>
            <div className="flex flex-wrap gap-2.5 mt-1 lg:col-span-3">
              <button type="submit" className="inline-flex items-center justify-center h-10 px-4 rounded-md text-sm font-bold transition-colors duration-150 text-white bg-[#7C3AED] hover:bg-[#6D28D9]">{editingEmployeeId ? 'Save changes' : 'Create employee'}</button>
              <button type="button" className="inline-flex items-center justify-center h-10 px-4 rounded-md text-sm font-bold transition-colors duration-150 text-text-light bg-gray-100 hover:bg-gray-200" onClick={() => resetEmployeeDraft()}>
                Clear
              </button>
            </div>
            </form>
          </Panel>
        </div>

        <Panel title="Employee Overview" subtitle={`${workbook.employees.length} total employee(s)`}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
            <div className="rounded-lg p-4 bg-linear-to-br from-[#F0FDF4] to-[#F8FAFC] border border-[#86EFAC] shadow-sm">
              <span className="text-xs font-semibold text-[#15803D] uppercase">Active</span>
              <strong className="text-2xl text-[#166534] block mt-1">{activeCount}</strong>
            </div>
            <div className="rounded-lg p-4 bg-linear-to-br from-[#F3E8FF] to-[#F5F3FF] border border-[#E9D5FF] shadow-sm">
              <span className="text-xs font-semibold text-[#7C3AED] uppercase">Admins</span>
              <strong className="text-2xl text-[#3B0764] block mt-1">{adminCount}</strong>
            </div>
            <div className="rounded-lg p-4 bg-linear-to-br from-[#F0F9FF] to-[#F8FAFC] border border-[#E0E7FF] shadow-sm">
              <span className="text-xs font-semibold text-[#3B82F6] uppercase">Staff</span>
              <strong className="text-2xl text-[#1E40AF] block mt-1">{employeeCount}</strong>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input 
              className="w-full box-border rounded-md border border-[#D8B4FE] bg-white py-2 px-3 text-text-light outline-none focus:border-[#7C3AED] focus:ring-1 focus:ring-[#7C3AED]/20" 
              value={searchTerm} 
              onChange={(event) => setSearchTerm(event.target.value)} 
              placeholder="Search employees..." 
            />
          </div>
        </Panel>

        {filteredEmployees.length > 0 ? (
          <Panel title="Employee Directory" subtitle={`${filteredEmployees.length} employee(s) found`}>
            <div className="space-y-3">
              {filteredEmployees.map((employee) => (
                <div key={employee.EmployeeID} className={`rounded-lg p-4 border-2 transition-all duration-200 ${employee.Status === 'Active' ? 'bg-linear-to-r from-[#F0FDF4] to-white border-[#86EFAC]' : 'bg-linear-to-r from-[#F3E8FF] to-white border-[#E9D5FF]'}`}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 mb-4 items-start">
                    <div>
                      <span className="text-xs font-semibold text-[#6B7280] uppercase">Name</span>
                      <p className="text-sm font-bold text-[#3B0764] mt-1">{employee.EmployeeName}</p>
                      <p className="text-xs text-[#9CA3AF]">{employee.EmployeeID}</p>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-[#6B7280] uppercase">Phone</span>
                      <p className="text-sm font-bold text-[#3B0764] mt-1">{employee.Phone}</p>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-[#6B7280] uppercase">Daily Rate</span>
                      <p className="text-sm font-bold text-[#3B0764] mt-1">{formatCurrency(employee.PerdayPay)}</p>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-[#6B7280] uppercase">Role</span>
                      <p className={`text-sm font-bold mt-1 ${employee.Role === 'Admin' ? 'text-[#7C3AED]' : 'text-[#0EA5E9]'}`}>{employee.Role}</p>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-[#6B7280] uppercase">Status</span>
                      <Badge value={employee.Status} />
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-[#6B7280] uppercase">Actions</span>
                      <div className="flex flex-wrap gap-2 mt-1">
                        <button type="button" className="inline-flex items-center justify-center h-8 px-2 rounded text-xs font-bold text-white bg-[#7C3AED] hover:bg-[#6D28D9]" onClick={() => resetEmployeeDraft(employee)}>
                          Edit
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-3 border-t border-[#E5E7EB]">
                    <button 
                      type="button" 
                      className={`inline-flex items-center justify-center h-7 px-2 rounded text-xs font-bold transition-all ${employee.Status === 'Active' ? 'text-[#15803D] bg-[#D1FAE5] border border-[#86EFAC]' : 'text-white bg-[#10B981] hover:bg-[#059669]'}`}
                      onClick={() => toggleEmployeeStatus(employee.EmployeeID)}
                      disabled={employee.Status === 'Active'}
                    >
                      {employee.Status === 'Active' ? '✓ Active' : 'Activate'}
                    </button>
                    <button type="button" className="inline-flex items-center justify-center h-7 px-2 rounded text-xs font-bold text-white bg-[#0EA5E9] hover:bg-[#0284C7]" onClick={() => resetPassword(employee.EmployeeID)}>
                      Reset password
                    </button>
                    <button type="button" className="inline-flex items-center justify-center h-7 px-2 rounded text-xs font-bold text-white bg-red-600 hover:bg-red-700" onClick={() => removeEmployee(employee.EmployeeID)}>
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        ) : (
          <Panel title="Employee Directory" subtitle="No employees found">
            <div className="text-center py-12">
              <p className="text-[#6B7280]">No employees match your search</p>
            </div>
          </Panel>
        )}
      </div>
    )
  }

  function renderAttendance() {
    if (!workbook || !currentUser) {
      return null
    }

    const filteredAttendance = visibleAttendance.filter((entry) =>
      (selectedCompanyFilter === 'all' || entry.Company === selectedCompanyFilter) &&
      getMonthKey(entry.Date) === selectedMonthFilter &&
      (selectedDateFilter === '' || entry.Date === selectedDateFilter),
    )

    return (
      <div className="grid grid-cols-1 gap-6">
        <div ref={attendanceFormRef}>
        <Panel title={editingAttendanceId ? 'Edit attendance' : 'Add attendance'} subtitle="The logged-in user can create an entry for self or others.">
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
              <button type="submit" className="inline-flex items-center justify-center h-10 px-4 rounded-md text-sm font-bold text-white bg-[#7C3AED] hover:bg-[#6D28D9]">{editingAttendanceId ? 'Update attendance' : 'Save attendance'}</button>
              <button
                type="button"
                className="inline-flex items-center justify-center h-10 px-4 rounded-md text-sm font-bold text-text-light bg-gray-100 hover:bg-gray-200"
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
        </div>

        <Panel title="Attendance Register" subtitle={`${filteredAttendance.length} record(s) for filters applied`}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            <div>
              <label className="text-xs font-semibold text-[#6B7280] uppercase">Company</label>
              <select className="w-full mt-1 box-border py-2 px-3 text-text-light rounded-md outline-none bg-white border border-[#D8B4FE] focus:border-[#7C3AED] focus:ring-1 focus:ring-[#7C3AED]/20" value={selectedCompanyFilter} onChange={(event) => setSelectedCompanyFilter(event.target.value)}>
                <option value="all">All companies</option>
                {workbook.companies.map((company) => (
                  <option key={company.CompanyID} value={company.CompanyName}>
                    {company.CompanyName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-[#6B7280] uppercase">Month</label>
              <select className="w-full mt-1 box-border py-2 px-3 text-text-light rounded-md outline-none bg-white border border-[#D8B4FE] focus:border-[#7C3AED] focus:ring-1 focus:ring-[#7C3AED]/20" value={selectedMonthFilter} onChange={(event) => setSelectedMonthFilter(event.target.value)}>
                {monthChoicesBackwards(12).map((month) => (
                  <option key={month} value={month}>
                    {formatMonth(month)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-[#6B7280] uppercase">Date</label>
              <input type="date" className="w-full mt-1 box-border py-2 px-3 text-text-light rounded-md outline-none bg-white border border-[#D8B4FE] focus:border-[#7C3AED] focus:ring-1 focus:ring-[#7C3AED]/20" value={selectedDateFilter} onChange={(event) => setSelectedDateFilter(event.target.value)} />
            </div>
          </div>

          {filteredAttendance.length > 0 ? (
            <div className="space-y-3">
              {filteredAttendance.map((entry) => {
                const employee = workbook.employees.find((item) => item.EmployeeID === entry.EmployeeID)
                return (
                  <div key={entry.AttendanceID} className="rounded-lg p-4 bg-linear-to-r from-[#F0F9FF] to-white border-2 border-[#E0E7FF] shadow-sm">
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
                      <div>
                        <span className="text-xs font-semibold text-[#6B7280] uppercase">Employee</span>
                        <p className="text-sm font-bold text-[#3B0764] mt-1">{employee?.EmployeeName ?? entry.EmployeeID}</p>
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-[#6B7280] uppercase">Date</span>
                        <p className="text-sm font-bold text-[#3B0764] mt-1">{formatDate(entry.Date)}</p>
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-[#6B7280] uppercase">Company</span>
                        <p className="text-sm font-bold text-[#3B0764] mt-1">{entry.Company}</p>
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-[#6B7280] uppercase">Location</span>
                        <p className="text-sm font-bold text-[#3B0764] mt-1">{entry.Location}</p>
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-[#6B7280] uppercase">Hours</span>
                        <p className="text-sm font-bold text-[#3B0764] mt-1">{entry.WorkedHour}h</p>
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-[#6B7280] uppercase">Added By</span>
                        <p className="text-sm font-bold text-[#3B0764] mt-1">{entry.Addedby}</p>
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-[#6B7280] uppercase">Actions</span>
                        <div className="flex flex-wrap gap-2 mt-1">
                          <button type="button" className="inline-flex items-center justify-center h-8 px-3 rounded-md text-xs font-bold text-white bg-[#7C3AED] hover:bg-[#6D28D9]" onClick={() => resetAttendanceDraft(entry)}>
                            Edit
                          </button>
                          <button type="button" className="inline-flex items-center justify-center h-8 px-3 rounded-md text-xs font-bold text-white bg-red-600 hover:bg-red-700" onClick={() => removeAttendance(entry.AttendanceID)}>
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-[#6B7280]">No attendance records found for selected filters</p>
            </div>
          )}
        </Panel>
      </div>
    )
  }

  function renderWork() {
    if (!workbook || !currentUser) {
      return null
    }

    const totalAmount = visibleWorks.reduce((sum, work) => sum + work.WorkAmount, 0)
    const totalPending = visibleWorks.reduce((sum, work) => sum + work.PendingAmount, 0)
    const ongoingCount = visibleWorks.filter((work) => work.Status === 'Ongoing').length
    const completedCount = visibleWorks.filter((work) => work.Status === 'Completed').length

    return (
      <div className="grid grid-cols-1 gap-6">
        {isAdmin ? (
          <div ref={workFormRef}>
          <Panel title={editingWorkId ? 'Edit work' : 'Add work'} subtitle="Create new work orders or update existing ones.">
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
                <button type="button" className="inline-flex items-center justify-center h-10 px-4 rounded-md text-sm font-bold text-text-light bg-gray-100 hover:bg-gray-200" onClick={() => resetWorkDraft()}>
                  Clear
                </button>
              </div>
            </form>
          </Panel>
          </div>
        ) : null}

        <Panel title="Work Overview" subtitle={`${visibleWorks.length} total work order(s)`}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-lg p-4 bg-linear-to-br from-[#F3E8FF] to-[#F5F3FF] border border-[#E9D5FF] shadow-sm">
              <span className="text-xs font-semibold text-[#7C3AED] uppercase">Ongoing</span>
              <strong className="text-2xl text-[#3B0764] block mt-1">{ongoingCount}</strong>
            </div>
            <div className="rounded-lg p-4 bg-linear-to-br from-[#F0FDF4] to-[#F8FAFC] border border-[#86EFAC] shadow-sm">
              <span className="text-xs font-semibold text-[#15803D] uppercase">Completed</span>
              <strong className="text-2xl text-[#166534] block mt-1">{completedCount}</strong>
            </div>
            <div className="rounded-lg p-4 bg-linear-to-br from-[#FEF3C7] to-[#FFFBEB] border border-[#FCD34D] shadow-sm">
              <span className="text-xs font-semibold text-[#D97706] uppercase">Pending Amt</span>
              <strong className="text-lg text-[#B45309] block mt-1">{formatCurrency(totalPending)}</strong>
            </div>
            <div className="rounded-lg p-4 bg-linear-to-br from-[#F0F9FF] to-[#F8FAFC] border border-[#E0E7FF] shadow-sm">
              <span className="text-xs font-semibold text-[#3B82F6] uppercase">Total Value</span>
              <strong className="text-lg text-[#1E40AF] block mt-1">{formatCurrency(totalAmount)}</strong>
            </div>
          </div>
        </Panel>

        {visibleWorks.length > 0 ? (
          <Panel title="Work Details" subtitle={`Detailed view of all work orders`}>
            <div className="space-y-3">
              {visibleWorks.map((work) => {
                const isOngoing = work.Status === 'Ongoing'
                const progressPercent = work.WorkAmount > 0 ? Math.round((work.ReceivedAmount / work.WorkAmount) * 100) : 0
                return (
                  <div key={work.WorkID} className={`rounded-lg p-4 border-2 transition-all duration-200 ${isOngoing ? 'bg-linear-to-r from-[#FEF3C7] to-white border-[#FCD34D]' : 'bg-linear-to-r from-[#F0FDF4] to-white border-[#86EFAC]'}`}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 mb-4">
                      <div>
                        <span className="text-xs font-semibold text-[#6B7280] uppercase">Work Title</span>
                        <p className="text-sm font-bold text-[#3B0764] mt-1">{work.WorkTitle}</p>
                        <p className="text-xs text-[#9CA3AF]">{work.WorkID}</p>
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-[#6B7280] uppercase">Company</span>
                        <p className="text-sm font-bold text-[#3B0764] mt-1">{work.CompanyID}</p>
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-[#6B7280] uppercase">Timeline</span>
                        <p className="text-sm font-bold text-[#3B0764] mt-1">{formatDate(work.StartDate)} — {formatDate(work.EndDate)}</p>
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-[#6B7280] uppercase">Amount</span>
                        <p className="text-sm font-bold text-[#3B0764] mt-1">{formatCurrency(work.WorkAmount)}</p>
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-[#6B7280] uppercase">Status</span>
                        <Badge value={work.Status} />
                      </div>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="mb-4 pt-3 border-t border-[#E5E7EB]">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-semibold text-[#6B7280]">Progress: {progressPercent}%</span>
                        <span className="text-xs font-semibold text-[#6B7280]">{formatCurrency(work.ReceivedAmount)} / {formatCurrency(work.WorkAmount)}</span>
                      </div>
                      <div className="w-full bg-[#E5E7EB] rounded-full h-2 overflow-hidden">
                        <div className={`h-full transition-all duration-300 ${progressPercent >= 100 ? 'bg-[#10B981]' : 'bg-[#7C3AED]'}`} style={{ width: `${Math.min(progressPercent, 100)}%` }}></div>
                      </div>
                    </div>

                    {isAdmin && (
                      <div className="pt-2 border-t border-[#E5E7EB]">
                        <button type="button" className="inline-flex items-center justify-center h-8 px-3 rounded-md text-xs font-bold text-white bg-[#7C3AED] hover:bg-[#6D28D9]" onClick={() => resetWorkDraft(work)}>
                          Edit
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </Panel>
        ) : (
          <Panel title="Work Details" subtitle="No work records found">
            <div className="text-center py-12">
              <p className="text-[#6B7280]">No work orders assigned</p>
            </div>
          </Panel>
        )}
      </div>
    )
  }

  function renderAdvances() {
    if (!workbook || !currentUser) {
      return null
    }

    const approvedCount = visibleAdvances.filter((a) => a.Status === 'Approved').length
    const requestedCount = visibleAdvances.filter((a) => a.Status === 'Requested').length
    const rejectedCount = visibleAdvances.filter((a) => a.Status === 'Rejected').length
    const totalAdvanceAmount = visibleAdvances.filter((a) => a.Status === 'Approved').reduce((sum, a) => sum + a.AdvanceAmount, 0)

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
              Advance Amount
              <input type="number" min={0} value={advanceDraft.AdvanceAmount} onChange={(event) => setAdvanceDraft((current) => ({ ...current, AdvanceAmount: Number(event.target.value) }))} required />
            </label>
            <label className="lg:col-span-3">
              Reason
              <textarea rows={2} value={advanceDraft.Reason} onChange={(event) => setAdvanceDraft((current) => ({ ...current, Reason: event.target.value }))} required />
            </label>
            <div className="flex flex-wrap gap-2.5 lg:col-span-3">
              <button type="submit" className="inline-flex items-center justify-center h-10 px-4 rounded-md text-sm font-bold text-white bg-[#7C3AED] hover:bg-[#6D28D9]">Submit request</button>
              <button
                type="button"
                className="inline-flex items-center justify-center h-10 px-4 rounded-md text-sm font-bold text-text-light bg-gray-100 hover:bg-gray-200"
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

        <Panel title="Advance Overview" subtitle={`${visibleAdvances.length} total request(s)`}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-lg p-4 bg-linear-to-br from-[#F0FDF4] to-[#F8FAFC] border border-[#86EFAC] shadow-sm">
              <span className="text-xs font-semibold text-[#15803D] uppercase">Approved</span>
              <strong className="text-2xl text-[#166534] block mt-1">{approvedCount}</strong>
            </div>
            <div className="rounded-lg p-4 bg-linear-to-br from-[#FEF3C7] to-[#FFFBEB] border border-[#FCD34D] shadow-sm">
              <span className="text-xs font-semibold text-[#D97706] uppercase">Requested</span>
              <strong className="text-2xl text-[#B45309] block mt-1">{requestedCount}</strong>
            </div>
            <div className="rounded-lg p-4 bg-linear-to-br from-[#FEE2E2] to-[#FEF2F2] border border-[#FECACA] shadow-sm">
              <span className="text-xs font-semibold text-[#DC2626] uppercase">Rejected</span>
              <strong className="text-2xl text-[#7F1D1D] block mt-1">{rejectedCount}</strong>
            </div>
            <div className="rounded-lg p-4 bg-linear-to-br from-[#F3E8FF] to-[#F5F3FF] border border-[#E9D5FF] shadow-sm">
              <span className="text-xs font-semibold text-[#7C3AED] uppercase">Total Approved</span>
              <strong className="text-lg text-[#3B0764] block mt-1">{formatCurrency(totalAdvanceAmount)}</strong>
            </div>
          </div>
        </Panel>

        {visibleAdvances.length > 0 ? (
          <Panel title="Advance Requests" subtitle="Manage employee advance requests">
            <div className="space-y-3">
              {visibleAdvances.map((advance) => {
                const employee = workbook.employees.find((item) => item.EmployeeID === advance.EmployeeID)
                const isApproved = advance.Status === 'Approved'
                const isRequested = advance.Status === 'Requested'

                return (
                  <div 
                    key={advance.AdvanceID} 
                    className={`rounded-lg p-4 border-2 transition-all duration-200 ${
                      isApproved ? 'bg-linear-to-r from-[#F0FDF4] to-white border-[#86EFAC]' : 
                      isRequested ? 'bg-linear-to-r from-[#FEF3C7] to-white border-[#FCD34D]' :
                      'bg-linear-to-r from-[#FEE2E2] to-white border-[#FECACA]'
                    }`}
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
                      <div>
                        <span className="text-xs font-semibold text-[#6B7280] uppercase">Employee</span>
                        <p className="text-sm font-bold text-[#3B0764] mt-1">{employee?.EmployeeName ?? advance.EmployeeID}</p>
                        <p className="text-xs text-[#9CA3AF]">{advance.AdvanceID}</p>
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-[#6B7280] uppercase">Date</span>
                        <p className="text-sm font-bold text-[#3B0764] mt-1">{formatDate(advance.Date)}</p>
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-[#6B7280] uppercase">Amount</span>
                        <p className="text-sm font-bold text-[#3B0764] mt-1">{formatCurrency(advance.AdvanceAmount)}</p>
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-[#6B7280] uppercase">Reason</span>
                        <p className="text-sm font-bold text-[#3B0764] mt-1 truncate">{advance.Reason}</p>
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-[#6B7280] uppercase">Status</span>
                        <div className="mt-1">
                          <Badge value={advance.Status} />
                        </div>
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-[#6B7280] uppercase">Action</span>
                        {isAdmin ? (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            <button
                              type="button"
                              className="inline-flex items-center justify-center h-6 px-2 rounded-md text-[10px] font-bold tracking-wide text-white bg-[#10B981] hover:bg-[#059669] disabled:opacity-70 disabled:cursor-not-allowed"
                              onClick={() => void decideAdvance(advance.AdvanceID, 'Approved')}
                              disabled={saving && pendingAdvanceId === advance.AdvanceID}
                            >
                              {saving && pendingAdvanceId === advance.AdvanceID ? 'Working...' : '✓ Approve'}
                            </button>
                            <button
                              type="button"
                              className="inline-flex items-center justify-center h-6 px-2 rounded-md text-[10px] font-bold tracking-wide text-white bg-red-600 hover:bg-red-700 disabled:opacity-70 disabled:cursor-not-allowed"
                              onClick={() => void decideAdvance(advance.AdvanceID, 'Rejected')}
                              disabled={saving && pendingAdvanceId === advance.AdvanceID}
                            >
                              {saving && pendingAdvanceId === advance.AdvanceID ? 'Working...' : '✗ Reject'}
                            </button>
                          </div>
                        ) : (
                          <p className="text-xs text-[#9CA3AF] mt-1">-</p>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </Panel>
        ) : (
          <Panel title="Advance Requests" subtitle="No requests found">
            <div className="text-center py-12">
              <p className="text-[#6B7280]">No advance requests</p>
            </div>
          </Panel>
        )}
      </div>
    )
  }

  function renderSalary() {
    if (!workbook || !currentUser) {
      return null
    }

    const monthRows = visibleSalaries.filter((salary) => salary.Month === selectedMonthFilter)
    const totalAttendance = monthRows.reduce((sum, row) => sum + row.TotalAttendance, 0)
    const totalGrossSalary = monthRows.reduce((sum, row) => sum + row.NetSalary, 0)
    const totalDeductions = monthRows.reduce((sum, row) => sum + row.AdvanceDeductions, 0)
    const totalNetPayable = monthRows.reduce((sum, row) => sum + row.NetPayble, 0)
    const totalPaid = monthRows.filter((row) => row.PaidStatus === 'Paid').length
    const totalPending = monthRows.filter((row) => row.PaidStatus === 'Pending').length

    return (
      <div className="grid grid-cols-1 gap-6">
        <Panel title="Salary Management" subtitle="Track salary, attendance, and payment status for selected month.">
          <div className="flex flex-col gap-6">
            {/* Month Filter */}
            <div className="flex items-center gap-3">
              <label className="text-sm font-bold text-[#3B0764] whitespace-nowrap">Select month:</label>
              <select value={selectedMonthFilter} onChange={(event) => setSelectedMonthFilter(event.target.value)} className="w-full sm:w-72 box-border py-2 px-3 text-text-light rounded-md outline-none bg-white border border-[#D8B4FE] focus:border-[#7C3AED] focus:ring-1 focus:ring-[#7C3AED]/20">
                {monthChoicesBackwards(12).map((month) => (
                  <option key={month} value={month}>
                    {formatMonth(month)}
                  </option>
                ))}
              </select>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="rounded-lg p-5 bg-linear-to-br from-[#F3E8FF] to-[#F5F3FF] border border-[#E9D5FF] shadow-sm">
                <span className="text-xs font-semibold text-[#7C3AED] uppercase tracking-widest block mb-1">Total Attendance</span>
                <strong className="text-2xl text-[#3B0764] block">{totalAttendance}</strong>
              </div>
              <div className="rounded-lg p-5 bg-linear-to-br from-[#F0F9FF] to-[#F8FAFC] border border-[#E0E7FF] shadow-sm">
                <span className="text-xs font-semibold text-[#3B82F6] uppercase tracking-widest block mb-1">Gross Salary</span>
                <strong className="text-lg text-[#1E40AF] block">{formatCurrency(totalGrossSalary)}</strong>
              </div>
              <div className="rounded-lg p-5 bg-linear-to-br from-[#FEF3C7] to-[#FFFBEB] border border-[#FCD34D] shadow-sm">
                <span className="text-xs font-semibold text-[#D97706] uppercase tracking-widest block mb-1">Deductions</span>
                <strong className="text-lg text-[#B45309] block">{formatCurrency(totalDeductions)}</strong>
              </div>
              <div className="rounded-lg p-5 bg-linear-to-br from-[#DCFCE7] to-[#F0FDF4] border border-[#86EFAC] shadow-sm">
                <span className="text-xs font-semibold text-[#15803D] uppercase tracking-widest block mb-1">Net Payable</span>
                <strong className="text-lg text-[#166534] block">{formatCurrency(totalNetPayable)}</strong>
              </div>
            </div>

            {/* Payment Status Summary */}
            <div className="grid grid-cols-2 gap-4 p-5 rounded-lg bg-[#F9F5FF] border border-[#E9D5FF]">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-[#7C3AED]"></div>
                <div>
                  <span className="text-xs font-semibold text-[#6B7280] block">Paid</span>
                  <strong className="text-xl text-[#3B0764]">{totalPaid}</strong>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-[#DC2626]"></div>
                <div>
                  <span className="text-xs font-semibold text-[#6B7280] block">Pending</span>
                  <strong className="text-xl text-[#7F1D1D]">{totalPending}</strong>
                </div>
              </div>
            </div>
          </div>
        </Panel>

        {/* Salary Details */}
        {monthRows.length > 0 ? (
          <Panel title="Salary Details" subtitle={`${monthRows.length} employee(s) with salary records`}>
            <div className="space-y-3">
              {monthRows.map((salary) => {
                const employee = workbook.employees.find((item) => item.EmployeeID === salary.EmployeeID)
                const isPaid = salary.PaidStatus === 'Paid'

                return (
                  <div key={salary.SalaryID} className={`rounded-lg p-5 border-2 transition-all duration-200 ${isPaid ? 'bg-linear-to-r from-[#F0FDF4] to-white border-[#86EFAC]' : 'bg-linear-to-r from-[#FEF3C7] to-white border-[#FCD34D]'}`}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-start mb-4">
                      {/* Employee Info */}
                      <div>
                        <span className="text-xs font-semibold text-[#6B7280] uppercase">Employee</span>
                        <p className="text-sm font-bold text-[#3B0764] mt-1">{employee?.EmployeeName ?? salary.EmployeeID}</p>
                        <p className="text-xs text-[#9CA3AF]">{salary.EmployeeID}</p>
                      </div>

                      {/* Attendance */}
                      <div>
                        <span className="text-xs font-semibold text-[#6B7280] uppercase">Days</span>
                        <p className="text-sm font-bold text-[#3B0764] mt-1">{salary.TotalAttendance}</p>
                      </div>

                      {/* Salary Breakdown */}
                      <div>
                        <span className="text-xs font-semibold text-[#6B7280] uppercase">Gross</span>
                        <p className="text-sm font-bold text-[#3B0764] mt-1">{formatCurrency(salary.NetSalary)}</p>
                      </div>

                      {/* Deductions */}
                      <div>
                        <span className="text-xs font-semibold text-[#6B7280] uppercase">Deductions</span>
                        <p className="text-sm font-bold text-[#B45309] mt-1">{formatCurrency(salary.AdvanceDeductions)}</p>
                      </div>

                      {/* Net Payable */}
                      <div>
                        <span className="text-xs font-semibold text-[#6B7280] uppercase">Net Payable</span>
                        <p className="text-sm font-bold text-[#15803D] mt-1">{formatCurrency(salary.NetPayble)}</p>
                      </div>
                    </div>

                    {/* Status and Actions */}
                    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between pt-4 border-t border-[#E5E7EB]">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-[#6B7280]">Status:</span>
                        <Badge value={salary.PaidStatus} />
                      </div>

                      {isAdmin && (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className={`inline-flex items-center justify-center h-9 px-3 rounded-md text-xs font-bold transition-all duration-150 ${isPaid ? 'text-[#15803D] bg-[#D1FAE5] border border-[#86EFAC]' : 'text-white bg-[#7C3AED] hover:bg-[#6D28D9]'}`}
                            onClick={() => setSalaryStatus(salary.SalaryID, 'Paid')}
                            disabled={isPaid}
                          >
                            ✓ Mark paid
                          </button>
                          <button
                            type="button"
                            className={`inline-flex items-center justify-center h-9 px-3 rounded-md text-xs font-bold transition-all duration-150 ${!isPaid ? 'text-[#7F1D1D] bg-[#FEE2E2] border border-[#FECACA]' : 'text-white bg-red-600 hover:bg-red-700'}`}
                            onClick={() => setSalaryStatus(salary.SalaryID, 'Pending')}
                            disabled={!isPaid}
                          >
                            ✗ Mark pending
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </Panel>
        ) : (
          <Panel title="Salary Details" subtitle="No salary records for this period">
            <div className="text-center py-12">
              <p className="text-[#6B7280]">No salary data available for {formatMonth(selectedMonthFilter)}</p>
            </div>
          </Panel>
        )}
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
              <button type="button" className="inline-flex justify-center items-center py-1.5 px-3 border-0 rounded-md cursor-pointer text-sm font-bold text-white bg-indigo hover:bg-indigoHover transition-all duration-150" onClick={() => { if (workbook) void downloadWorkbookData(workbook) }}>
                Download Data
              </button>
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
          <span className="inline-flex mb-2 text-accent-gold uppercase tracking-uppercase text-xs-tiny">Loading data</span>
          <h1>Preparing employee management data</h1>
          <p>Reading saved workbook data from local browser storage.</p>
        </div>
      </div>
    )
  }

  if (!workbook || !currentUser) return <Navigate to="/login" replace />

  const topActions = isAdmin ? (
    <div className="flex flex-wrap gap-2.5">
      <Badge value={saving ? 'Syncing' : 'Live'} />
      <button type="button" className="inline-flex justify-center items-center py-2 px-4 border-0 rounded-md cursor-pointer bg-white text-[#3B0764] hover:bg-gray-100 transition-all duration-150" onClick={() => { if (workbook) downloadWorkbookJSON(workbook) }}>
        Export JSON
      </button>
      <input ref={importFileRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={(e) => {
        const file = e.target.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = () => {
          try {
            const parsed = JSON.parse(String(reader.result))
            const normalized = normalizeWorkbookData(parsed)
            persist(normalized)
          } catch (err) {
            // eslint-disable-next-line no-alert
            alert('Invalid JSON file')
          }
        }
        reader.readAsText(file)
        // reset value so same file can be reselected later
        if (importFileRef.current) importFileRef.current.value = ''
      }} />
      <button type="button" className="inline-flex justify-center items-center py-2 px-4 border-0 rounded-md cursor-pointer bg-white text-[#3B0764] hover:bg-gray-100 transition-all duration-150" onClick={() => importFileRef.current?.click()}>
        Import JSON
      </button>
      <button type="button" className="inline-flex justify-center items-center py-2 px-4 border-0 rounded-md cursor-pointer font-bold text-main-text bg-gray-100 hover:bg-gray-200 transition-all duration-150" onClick={() => setWorkbook((current) => (current ? recalculateDerivedData(current, current) : current))}>
        Refresh totals
      </button>
      <button type="button" className="inline-flex justify-center items-center py-2 px-4 border-0 rounded-md cursor-pointer text-white font-bold bg-indigo hover:bg-indigoHover transition-all duration-150" onClick={() => { if (workbook) void downloadWorkbookData(workbook) }}>
        Download Data
      </button>
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
    <div className="bg-background grid min-h-screen-vh grid-cols-1 text-text-light lg:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="bg-linear-to-b from-[#7C3AED] to-primary-purple flex flex-col gap-5 p-4 sm:p-6 lg:sticky lg:top-0 lg:h-dvh lg:overflow-y-auto lg:p-7 lg:self-start">
        <div className="flex items-center gap-3.5 p-4 rounded-lg bg-white border border-[#E9D5FF] shadow-sm">
          <span className="grid place-items-center w-12 h-12 rounded-md font-bold tracking-wider text-[#7C3AED] bg-[#7C3AED]/10">JR</span>
          <div className="ml-3 min-w-0">
            <div className="text-xs font-semibold text-[#7C3AED] uppercase tracking-widest">Logged in as</div>
            <strong className="block text-sm text-text-light truncate">{currentUser.EmployeeName}</strong>
            <p className="text-xs text-text-softer opacity-85 truncate">{currentUser.EmployeeID}</p>
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
              <span className="inline-flex mb-2 text-[#7C3AED] uppercase tracking-uppercase text-xs-tiny">Project data</span>
              <h2 className="text-[#3B0764]">{isAdmin ? 'Admin control room' : 'Employee workspace'}</h2>
              <p className="text-text-light">
                Data is loaded from local JSON storage in your browser.
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