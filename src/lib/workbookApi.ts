import * as XLSX from 'xlsx'
import { createSeedWorkbookData, normalizeWorkbookData, type WorkbookData } from './employeeData'

const WORKBOOK_STORAGE_KEY = 'jyothi-workbook-data'

export async function loadWorkbookData(): Promise<WorkbookData | null> {
  try {
    const serialized = localStorage.getItem(WORKBOOK_STORAGE_KEY)

    if (!serialized) {
      return createSeedWorkbookData()
    }

    return normalizeWorkbookData(JSON.parse(serialized) as Partial<WorkbookData>)
  } catch {
    return createSeedWorkbookData()
  }
}

export async function saveWorkbookData(data: WorkbookData) {
  try {
    localStorage.setItem(WORKBOOK_STORAGE_KEY, JSON.stringify(data))
  } catch {
    return
  }
}

export async function downloadWorkbookData(data: WorkbookData) {
  const workbook = XLSX.utils.book_new()

  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data.employees), 'Employees')
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data.companies), 'Companies')
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data.attendance), 'Attendance')
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data.salaries), 'Salary')
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data.advances), 'Advance')
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data.workDetails), 'WorkDetails')

  const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = 'employee-management.xlsx'
  link.click()
  URL.revokeObjectURL(url)
}

export function downloadWorkbookJSON(data: WorkbookData) {
  const content = JSON.stringify(data, null, 2)
  const blob = new Blob([content], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = 'employee-management.json'
  link.click()
  URL.revokeObjectURL(url)
}
