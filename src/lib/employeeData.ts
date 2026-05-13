export type UserRole = 'Admin' | 'Employee'

export type AccountStatus = 'Active' | 'Inactive'

export type AdvanceStatus = 'Requested' | 'Approved' | 'Rejected'

export type PaidStatus = 'Paid' | 'Pending'

export type WorkStatus = 'Ongoing' | 'Completed'

export interface Employee {
  EmployeeID: string
  EmployeeName: string
  Phone: string
  PerdayPay: number
  Role: UserRole
  Password: string
  Status: AccountStatus
}

export interface Company {
  CompanyID: string
  CompanyName: string
  Address: string
  WorkAddress: string
  GSTIN: string
  Contact: string
  Email: string
}

export interface Attendance {
  AttendanceID: string
  EmployeeID: string
  Date: string
  Company: string
  Location: string
  WorkedHour: number
  Addedby: string
}

export interface Salary {
  SalaryID: string
  EmployeeID: string
  Month: string
  TotalAttendance: number
  NetSalary: number
  AdvanceDeductions: number
  NetPayble: number
  PaidStatus: PaidStatus
}

export interface Advance {
  AdvanceID: string
  Date: string
  EmployeeID: string
  AdvanceAmount: number
  Reason: string
  Status: AdvanceStatus
  ApprovedBy: string
}

export interface WorkDetail {
  WorkID: string
  EmployeeID: string
  CompanyID: string
  WorkTitle: string
  StartDate: string
  EndDate: string
  WorkAmount: number
  ReceivedAmount: number
  PendingAmount: number
  Status: WorkStatus
}

export interface WorkbookData {
  employees: Employee[]
  companies: Company[]
  attendance: Attendance[]
  salaries: Salary[]
  advances: Advance[]
  workDetails: WorkDetail[]
}

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

const monthFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
})

function pad(value: number) {
  return String(value).padStart(2, '0')
}

export function formatCurrency(value: number) {
  return currencyFormatter.format(Number.isFinite(value) ? value : 0)
}

export function formatDate(value: string) {
  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return dateFormatter.format(parsed)
}

export function formatMonth(value: string) {
  const [year, month] = value.split('-').map(Number)

  if (!year || !month) {
    return value
  }

  return monthFormatter.format(new Date(year, month - 1, 1))
}

export function getMonthKey(value: Date | string) {
  const parsed = typeof value === 'string' ? new Date(value) : value

  if (Number.isNaN(parsed.getTime())) {
    return '1970-01'
  }

  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}`
}

export function todayValue() {
  return new Date().toISOString().slice(0, 10)
}

export function monthKeyFromNow() {
  return getMonthKey(new Date())
}

export function monthChoicesBackwards(total = 8) {
  const choices: string[] = []
  const current = new Date()

  for (let index = 0; index < total; index += 1) {
    const date = new Date(current.getFullYear(), current.getMonth() - index, 1)
    choices.push(`${date.getFullYear()}-${pad(date.getMonth() + 1)}`)
  }

  return choices
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat('en-IN').format(Number.isFinite(value) ? value : 0)
}

export function generateId(prefix: string, existingIds: string[]) {
  const next = existingIds.reduce((highest, current) => {
    const match = current.match(/(\d+)$/)
    const parsed = match ? Number(match[1]) : 0

    return Math.max(highest, parsed)
  }, 0)

  return `${prefix}${String(next + 1).padStart(3, '0')}`
}

function toNumber(value: unknown) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)

    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}

function safeText(value: unknown) {
  return typeof value === 'string' ? value : String(value ?? '')
}

export function normalizeWorkbookData(partial: Partial<WorkbookData>): WorkbookData {
  return {
    employees: (partial.employees ?? []).map((employee) => ({
      EmployeeID: safeText(employee.EmployeeID),
      EmployeeName: safeText(employee.EmployeeName),
      Phone: safeText(employee.Phone),
      PerdayPay: toNumber(employee.PerdayPay),
      Role: employee.Role === 'Admin' ? 'Admin' : 'Employee',
      Password: safeText(employee.Password),
      Status: employee.Status === 'Inactive' ? 'Inactive' : 'Active',
    })),
    companies: (partial.companies ?? []).map((company) => ({
      CompanyID: safeText(company.CompanyID),
      CompanyName: safeText(company.CompanyName),
      Address: safeText(company.Address),
      WorkAddress: safeText(company.WorkAddress),
      GSTIN: safeText(company.GSTIN),
      Contact: safeText(company.Contact),
      Email: safeText(company.Email),
    })),
    attendance: (partial.attendance ?? []).map((entry) => ({
      AttendanceID: safeText(entry.AttendanceID),
      EmployeeID: safeText(entry.EmployeeID),
      Date: safeText(entry.Date),
      Company: safeText(entry.Company),
      Location: safeText(entry.Location),
      WorkedHour: toNumber(entry.WorkedHour),
      Addedby: safeText(entry.Addedby),
    })),
    salaries: (partial.salaries ?? []).map((salary) => ({
      SalaryID: safeText(salary.SalaryID),
      EmployeeID: safeText(salary.EmployeeID),
      Month: safeText(salary.Month),
      TotalAttendance: toNumber(salary.TotalAttendance),
      NetSalary: toNumber(salary.NetSalary),
      AdvanceDeductions: toNumber(salary.AdvanceDeductions),
      NetPayble: toNumber(salary.NetPayble),
      PaidStatus: salary.PaidStatus === 'Paid' ? 'Paid' : 'Pending',
    })),
    advances: (partial.advances ?? []).map((advance) => ({
      AdvanceID: safeText(advance.AdvanceID),
      Date: safeText(advance.Date),
      EmployeeID: safeText(advance.EmployeeID),
      AdvanceAmount: toNumber(advance.AdvanceAmount),
      Reason: safeText(advance.Reason),
      Status:
        advance.Status === 'Approved'
          ? 'Approved'
          : advance.Status === 'Rejected'
            ? 'Rejected'
            : 'Requested',
      ApprovedBy: safeText(advance.ApprovedBy),
    })),
    workDetails: (partial.workDetails ?? []).map((work) => ({
      WorkID: safeText(work.WorkID),
      EmployeeID: safeText(work.EmployeeID),
      CompanyID: safeText(work.CompanyID),
      WorkTitle: safeText(work.WorkTitle),
      StartDate: safeText(work.StartDate),
      EndDate: safeText(work.EndDate),
      WorkAmount: toNumber(work.WorkAmount),
      ReceivedAmount: toNumber(work.ReceivedAmount),
      PendingAmount: toNumber(work.PendingAmount),
      Status: work.Status === 'Completed' ? 'Completed' : 'Ongoing',
    })),
  }
}

function createSeedData(): WorkbookData {
  return normalizeWorkbookData({
    employees: [
      {
        EmployeeID: 'EMP001',
        EmployeeName: 'Aarav Shah',
        Phone: '9876543210',
        PerdayPay: 950,
        Role: 'Admin',
        Password: 'admin123',
        Status: 'Active',
      },
      {
        EmployeeID: 'EMP002',
        EmployeeName: 'Meera Joshi',
        Phone: '9876501122',
        PerdayPay: 820,
        Role: 'Employee',
        Password: 'meera@123',
        Status: 'Active',
      },
      {
        EmployeeID: 'EMP003',
        EmployeeName: 'Rohan Patel',
        Phone: '9876503344',
        PerdayPay: 780,
        Role: 'Employee',
        Password: 'rohan@123',
        Status: 'Active',
      },
      {
        EmployeeID: 'EMP004',
        EmployeeName: 'Salma Khan',
        Phone: '9876505566',
        PerdayPay: 860,
        Role: 'Employee',
        Password: 'salma@123',
        Status: 'Inactive',
      },
    ],
    companies: [
      {
        CompanyID: 'CMP001',
        CompanyName: 'Jyothi Refractory Plant',
        Address: 'Survey No. 44, Industrial Estate, Hyderabad',
        WorkAddress: 'Unit 2, North Gate, Hyderabad',
        GSTIN: '36ABCDE1234F1Z5',
        Contact: '+91 98765 00011',
        Email: 'accounts@jyothirefractory.com',
      },
      {
        CompanyID: 'CMP002',
        CompanyName: 'Site Support Warehouse',
        Address: 'Plot 14, Warehouse Road, Vijayawada',
        WorkAddress: 'Receiving Bay, Zone B',
        GSTIN: '37ABCDE5678G1Z2',
        Contact: '+91 98765 00022',
        Email: 'warehouse@jyothirefractory.com',
      },
    ],
    attendance: [
      {
        AttendanceID: 'ATT001',
        EmployeeID: 'EMP001',
        Date: '2026-05-01',
        Company: 'Jyothi Refractory Plant',
        Location: 'Hydrogen Line A',
        WorkedHour: 9,
        Addedby: 'Aarav Shah',
      },
      {
        AttendanceID: 'ATT002',
        EmployeeID: 'EMP002',
        Date: '2026-05-01',
        Company: 'Jyothi Refractory Plant',
        Location: 'Kiln Side',
        WorkedHour: 8,
        Addedby: 'Aarav Shah',
      },
      {
        AttendanceID: 'ATT003',
        EmployeeID: 'EMP003',
        Date: '2026-05-02',
        Company: 'Site Support Warehouse',
        Location: 'Packing Bay',
        WorkedHour: 10,
        Addedby: 'Meera Joshi',
      },
      {
        AttendanceID: 'ATT004',
        EmployeeID: 'EMP002',
        Date: '2026-05-03',
        Company: 'Jyothi Refractory Plant',
        Location: 'Dispatch Floor',
        WorkedHour: 8,
        Addedby: 'Meera Joshi',
      },
      {
        AttendanceID: 'ATT005',
        EmployeeID: 'EMP003',
        Date: '2026-05-04',
        Company: 'Site Support Warehouse',
        Location: 'Maintenance Block',
        WorkedHour: 9,
        Addedby: 'Aarav Shah',
      },
      {
        AttendanceID: 'ATT006',
        EmployeeID: 'EMP001',
        Date: '2026-05-05',
        Company: 'Jyothi Refractory Plant',
        Location: 'Control Room',
        WorkedHour: 7,
        Addedby: 'Aarav Shah',
      },
    ],
    salaries: [],
    advances: [
      {
        AdvanceID: 'ADV001',
        Date: '2026-05-03',
        EmployeeID: 'EMP002',
        AdvanceAmount: 2500,
        Reason: 'Family medical expenses',
        Status: 'Requested',
        ApprovedBy: '',
      },
      {
        AdvanceID: 'ADV002',
        Date: '2026-05-04',
        EmployeeID: 'EMP003',
        AdvanceAmount: 1500,
        Reason: 'Travel support',
        Status: 'Approved',
        ApprovedBy: 'Aarav Shah',
      },
      {
        AdvanceID: 'ADV003',
        Date: '2026-05-06',
        EmployeeID: 'EMP004',
        AdvanceAmount: 1200,
        Reason: 'Emergency personal expense',
        Status: 'Rejected',
        ApprovedBy: 'Aarav Shah',
      },
    ],
    workDetails: [
      {
        WorkID: 'WRK001',
        EmployeeID: 'EMP002',
        CompanyID: 'CMP001',
        WorkTitle: 'Kiln lining repair',
        StartDate: '2026-05-01',
        EndDate: '2026-05-12',
        WorkAmount: 28000,
        ReceivedAmount: 10000,
        PendingAmount: 18000,
        Status: 'Ongoing',
      },
      {
        WorkID: 'WRK002',
        EmployeeID: 'EMP003',
        CompanyID: 'CMP002',
        WorkTitle: 'Dispatch bay rework',
        StartDate: '2026-04-28',
        EndDate: '2026-05-06',
        WorkAmount: 18000,
        ReceivedAmount: 18000,
        PendingAmount: 0,
        Status: 'Completed',
      },
      {
        WorkID: 'WRK003',
        EmployeeID: 'EMP001',
        CompanyID: 'CMP001',
        WorkTitle: 'Raw mix inspection',
        StartDate: '2026-05-03',
        EndDate: '2026-05-16',
        WorkAmount: 14500,
        ReceivedAmount: 7000,
        PendingAmount: 7500,
        Status: 'Ongoing',
      },
      {
        WorkID: 'WRK004',
        EmployeeID: 'EMP004',
        CompanyID: 'CMP002',
        WorkTitle: 'Warehouse inventory audit',
        StartDate: '2026-04-20',
        EndDate: '2026-05-02',
        WorkAmount: 12250,
        ReceivedAmount: 12250,
        PendingAmount: 0,
        Status: 'Completed',
      },
    ],
  })
}

function groupKeys(records: Array<{ EmployeeID: string; Date?: string; Month?: string }>) {
  return records.reduce<string[]>((keys, record) => {
    if (record.Date) {
      keys.push(`${record.EmployeeID}|${getMonthKey(record.Date)}`)
    }

    if (record.Month) {
      keys.push(`${record.EmployeeID}|${record.Month}`)
    }

    return keys
  }, [])
}

export function recalculateDerivedData(data: WorkbookData, previous?: WorkbookData): WorkbookData {
  const normalized = normalizeWorkbookData(data)
  const defaultCompanyId = normalized.companies[0]?.CompanyID ?? ''
  const previousSalaryStatus = new Map(
    (previous?.salaries ?? []).map((row) => [`${row.EmployeeID}|${row.Month}`, row.PaidStatus]),
  )
  const approvedAdvances = normalized.advances.filter((advance) => advance.Status === 'Approved')
  const keySet = new Set([
    ...groupKeys(normalized.attendance),
    ...groupKeys(approvedAdvances),
    ...groupKeys(previous?.salaries ?? []),
  ])

  const salaries: Salary[] = [...keySet]
    .sort((left, right) => right.localeCompare(left))
    .map((pair) => {
      const [employeeId, month] = pair.split('|')
      const employee = normalized.employees.find((entry) => entry.EmployeeID === employeeId)
      const totalAttendance = normalized.attendance.filter(
        (entry) => entry.EmployeeID === employeeId && getMonthKey(entry.Date) === month,
      ).length
      const netSalary = totalAttendance * (employee?.PerdayPay ?? 0)
      const advanceDeductions = approvedAdvances
        .filter((entry) => entry.EmployeeID === employeeId && getMonthKey(entry.Date) === month)
        .reduce((sum, entry) => sum + entry.AdvanceAmount, 0)
      const netPayble = Math.max(netSalary - advanceDeductions, 0)

      return {
        SalaryID: `SAL-${month.replace('-', '')}-${employeeId}`,
        EmployeeID: employeeId,
        Month: month,
        TotalAttendance: totalAttendance,
        NetSalary: netSalary,
        AdvanceDeductions: advanceDeductions,
        NetPayble: netPayble,
        PaidStatus: previousSalaryStatus.get(pair) ?? 'Pending',
      }
    })

  return {
    ...normalized,
    workDetails: normalized.workDetails.map((work) => {
      const pendingAmount = Math.max(work.WorkAmount - work.ReceivedAmount, 0)

      return {
        ...work,
        CompanyID: work.CompanyID || defaultCompanyId,
        PendingAmount: pendingAmount,
        Status: (pendingAmount > 0 ? 'Ongoing' : 'Completed') as WorkStatus,
      }
    }),
    salaries,
  }
}

export const seedWorkbookData = (() => {
  const seed = recalculateDerivedData(createSeedData())

  seed.salaries = seed.salaries.map((salary) =>
    salary.EmployeeID === 'EMP001' && salary.Month === monthKeyFromNow()
      ? { ...salary, PaidStatus: 'Paid' }
      : salary,
  )

  return seed
})()
