const XLSX = require("xlsx");
const path = require("path");

const filePath = path.join(__dirname, "data", "employee-management.xlsx");

try {
  const workbook = XLSX.readFile(filePath);
  workbook.SheetNames.forEach(sheetName => {
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    console.log(`Sheet: ${sheetName}`);
    console.log(`Row count: ${data.length}`);
    console.log("First 2 rows:");
    console.log(JSON.stringify(data.slice(0, 2), null, 2));
    console.log("---------------------------");
  });
} catch (error) {
  console.error("Error reading file:", error.message);
}
