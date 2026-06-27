import ExcelJS from 'exceljs';

interface CompanySettings {
  company_name?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  pincode?: string | null;
  phone?: string | null;
  alternate_phone?: string | null;
  email?: string | null;
  website?: string | null;
  gst_number?: string | null;
  logo_url?: string | null;
}

interface ExportOptions {
  title: string;
  headers: string[];
  data: any[][];
  companySettings: CompanySettings | null;
  generatedBy: string;
}

function autofitColumns(worksheet: ExcelJS.Worksheet, startRow: number) {
  worksheet.columns.forEach((column, colIdx) => {
    let maxLength = 0;
    
    const headerCell = worksheet.getRow(startRow).getCell(colIdx + 1);
    const headerStr = headerCell.value ? String(headerCell.value).toUpperCase() : "";
    
    const isSpecialCol = 
      headerStr.includes("PRODUCT") || 
      headerStr.includes("ADDRESS") || 
      headerStr.includes("COMPANY") || 
      headerStr.includes("CUSTOMER") || 
      headerStr.includes("REQUIREMENT");

    if (column.values) {
      column.values.forEach((val, index) => {
        if (index >= startRow && val) {
          const lines = String(val).split('\n');
          lines.forEach(line => {
            if (line.length > maxLength) {
              maxLength = line.length;
            }
          });
        }
      });
    }
    
    let finalWidth = Math.max(maxLength + 4, 12);
    if (isSpecialCol) {
      finalWidth = Math.max(finalWidth, 25);
    }
    column.width = finalWidth;
  });
}

/**
 * Formats and generates a professional styled Excel workbook buffer
 */
export async function generateExcelBuffer({
  title,
  headers,
  data,
  companySettings,
  generatedBy,
}: ExportOptions): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(title.substring(0, 30));

  // Enable grid lines
  worksheet.views = [{ showGridLines: true }];

  const numCols = headers.length;
  const endColLetter = String.fromCharCode(65 + numCols - 1);

  // 1. Merged Title Row
  worksheet.mergeCells(`A1:${endColLetter}1`);
  const titleRow = worksheet.getRow(1);
  titleRow.height = 40;
  const titleCell = worksheet.getCell('A1');
  titleCell.value = title.toUpperCase();
  titleCell.font = { name: 'Arial', size: 18, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E293B' }, // Dark slate blue
  };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

  // 2. Company Details Block (Rows 3 to 7)
  const cName = companySettings?.company_name || 'Phoenix CRM';
  const cAddr = [
    companySettings?.address,
    companySettings?.city,
    companySettings?.state,
    companySettings?.pincode ? `PIN: ${companySettings.pincode}` : '',
    companySettings?.country,
  ]
    .filter(Boolean)
    .join(', ');

  const cContact = `Phone: ${companySettings?.phone || '—'}  |  Mobile: ${companySettings?.alternate_phone || '—'}  |  Email: ${companySettings?.email || '—'}  |  Website: ${companySettings?.website || '—'}`;
  const cGst = `GSTIN: ${companySettings?.gst_number || '—'}`;
  const now = new Date();
  const dateStr = now.toLocaleDateString();
  const timeStr = now.toLocaleTimeString();
  const cMeta = `Generated: ${dateStr} ${timeStr}  |  By: ${generatedBy}`;

  worksheet.mergeCells(`A3:${endColLetter}3`);
  worksheet.getCell('A3').value = cName;
  worksheet.getCell('A3').font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF334155' } };

  worksheet.mergeCells(`A4:${endColLetter}4`);
  worksheet.getCell('A4').value = cAddr;
  worksheet.getCell('A4').font = { name: 'Arial', size: 9, color: { argb: 'FF64748B' } };

  worksheet.mergeCells(`A5:${endColLetter}5`);
  worksheet.getCell('A5').value = cContact;
  worksheet.getCell('A5').font = { name: 'Arial', size: 9, color: { argb: 'FF64748B' } };

  worksheet.mergeCells(`A6:${endColLetter}6`);
  worksheet.getCell('A6').value = cGst;
  worksheet.getCell('A6').font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF475569' } };

  worksheet.mergeCells(`A7:${endColLetter}7`);
  worksheet.getCell('A7').value = cMeta;
  worksheet.getCell('A7').font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF64748B' } };

  // Set rows heights for company details
  worksheet.getRow(3).height = 20;
  worksheet.getRow(4).height = 15;
  worksheet.getRow(5).height = 15;
  worksheet.getRow(6).height = 15;
  worksheet.getRow(7).height = 15;

  // 3. Table Header Row (Row 9)
  const headerRowIndex = 9;
  const headerRow = worksheet.getRow(headerRowIndex);
  headerRow.height = 26;

  headers.forEach((h, colIdx) => {
    const cell = headerRow.getCell(colIdx + 1);
    cell.value = h.toUpperCase();
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF475569' }, // Cool grey
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF94A3B8' } },
      bottom: { style: 'medium', color: { argb: 'FF1E293B' } },
      left: { style: 'thin', color: { argb: 'FF94A3B8' } },
      right: { style: 'thin', color: { argb: 'FF94A3B8' } },
    };
  });

  // 4. Table Body Data Rows
  const startRowIndex = 10;
  data.forEach((rowValues, rowIdx) => {
    const currentIdx = startRowIndex + rowIdx;
    const row = worksheet.getRow(currentIdx);
    row.height = 20;

    rowValues.forEach((val, colIdx) => {
      const cell = row.getCell(colIdx + 1);
      cell.value = val;
      cell.font = { name: 'Arial', size: 9, color: { argb: 'FF0F172A' } };

      // Zebra striping - alternating row background color
      const isAltRow = rowIdx % 2 === 1;
      if (isAltRow) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF1F5F9' }, // very light blue/grey slate-100
        };
      }

      // Border and alignment formatting
      cell.alignment = { vertical: 'middle', horizontal: colIdx === 0 ? 'center' : 'left', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    });
  });

  const lastDataRowIndex = startRowIndex + data.length - 1;

  // Add outer thick borders for the table box
  for (let c = 1; c <= numCols; c++) {
    const topCell = worksheet.getCell(headerRowIndex, c);
    topCell.border = {
      ...topCell.border,
      top: { style: 'medium', color: { argb: 'FF1E293B' } },
      left: c === 1 ? { style: 'medium', color: { argb: 'FF1E293B' } } : topCell.border.left,
      right: c === numCols ? { style: 'medium', color: { argb: 'FF1E293B' } } : topCell.border.right,
    };

    const bottomCell = worksheet.getCell(lastDataRowIndex, c);
    bottomCell.border = {
      ...bottomCell.border,
      bottom: { style: 'medium', color: { argb: 'FF1E293B' } },
      left: c === 1 ? { style: 'medium', color: { argb: 'FF1E293B' } } : bottomCell.border.left,
      right: c === numCols ? { style: 'medium', color: { argb: 'FF1E293B' } } : bottomCell.border.right,
    };

    for (let r = headerRowIndex + 1; r < lastDataRowIndex; r++) {
      if (c === 1) {
        const leftCell = worksheet.getCell(r, c);
        leftCell.border = { ...leftCell.border, left: { style: 'medium', color: { argb: 'FF1E293B' } } };
      }
      if (c === numCols) {
        const rightCell = worksheet.getCell(r, c);
        rightCell.border = { ...rightCell.border, right: { style: 'medium', color: { argb: 'FF1E293B' } } };
      }
    }
  }

  // 5. Freeze Header row (Freeze row 9 and above)
  worksheet.views = [
    {
      state: 'frozen',
      xSplit: 0,
      ySplit: 9, // Everything above row 10 remains frozen
      activeCell: 'A10',
      showGridLines: true,
    },
  ];

  // 6. Autofit column widths
  autofitColumns(worksheet, headerRowIndex);

  // 7. Auto filter on header row
  worksheet.autoFilter = {
    from: { row: headerRowIndex, column: 1 },
    to: { row: headerRowIndex, column: numCols },
  };

  // 8. Page setup for Landscape printing, repeats header row, fits to page
  worksheet.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    paperSize: 9, // A4
  } as any;
  (worksheet.pageSetup as any).printTitles = `${headerRowIndex}:${headerRowIndex}`;

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Formats and generates a professional CSV string buffer (UTF-8)
 */
export function generateCSVBuffer(headers: string[], data: any[][]): Buffer {
  const escapeCSV = (val: any) => {
    if (val === null || val === undefined) return '';
    let str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      str = '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  };

  const csvRows: string[] = [];

  // Header row
  csvRows.push(headers.map(h => h.toUpperCase()).join(','));

  // Data rows
  data.forEach((row) => {
    csvRows.push(row.map(escapeCSV).join(','));
  });

  const csvContent = csvRows.join('\r\n');
  
  // Prepend UTF-8 BOM to ensure Excel opens CSV with correct encoding
  const bom = Buffer.from('\uFEFF', 'utf-8');
  const contentBuffer = Buffer.from(csvContent, 'utf-8');
  
  return Buffer.concat([bom, contentBuffer]);
}

/**
 * Generates a professional Excel template matching CRM input expectations for bulk uploads.
 */
export async function generateTemplateExcel(module: string): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const title = `${module.toUpperCase()} IMPORT TEMPLATE`;
  const worksheet = workbook.addWorksheet(title.substring(0, 30));

  // Enable grid lines
  worksheet.views = [{ showGridLines: true }];

  let headers: string[] = [];
  if (module === 'enquiry') {
    headers = ['Company Name', 'Buyer Name', 'Contact Phone', 'Email ID', 'Lead Source', 'Requirement Details', 'City', 'State', 'Country', 'Pincode', 'Product Name', 'Quantity', 'Remarks', 'Follow-up Date'];
  } else if (module === 'customer') {
    headers = ['Customer Name', 'Phone', 'Email', 'Company Name', 'Address', 'City', 'State', 'PIN Code', 'Country'];
  } else if (module === 'product') {
    headers = ['Product Name', 'Category', 'Description', 'Specification', 'HSN Code', 'Price', 'Unit'];
  } else if (module === 'quotation') {
    headers = ['Quotation No', 'Date', 'Company Name', 'Address', 'City', 'State', 'PIN Code', 'Country', 'Contact Person', 'Mobile', 'Email', 'GST Number', 'Subject', 'Basic Total', 'Tax Type', 'Tax Amount', 'Grand Total', 'Status'];
  } else if (module === 'proforma') {
    headers = ['Proforma No', 'Date', 'Company Name', 'Address', 'City', 'State', 'PIN Code', 'Country', 'Contact Person', 'Mobile', 'Email', 'GST Number', 'Subject', 'Basic Total', 'Tax Type', 'Tax Amount', 'Grand Total', 'Status'];
  } else if (module === 'sales') {
    headers = ['Sales No', 'Date', 'Company Name', 'Address', 'City', 'State', 'PIN Code', 'Country', 'Contact Person', 'Mobile', 'Email', 'GST Number', 'Basic Total', 'Tax Type', 'Tax Amount', 'Grand Total', 'Dispatch Status', 'Payment Status', 'Status'];
  }

  const numCols = headers.length;
  const endColLetter = String.fromCharCode(65 + numCols - 1);

  // Merged Header Row for Instructions
  worksheet.mergeCells(`A1:${endColLetter}1`);
  const instRow = worksheet.getRow(1);
  instRow.height = 30;
  const instCell = worksheet.getCell('A1');
  instCell.value = `INSTRUCTIONS: DO NOT CHANGE COLUMN HEADERS. INSERT YOUR CRM DATA BELOW ROW 3.`;
  instCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  instCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE11D48' }, // Rose/Red warning color
  };
  instCell.alignment = { vertical: 'middle', horizontal: 'center' };

  // Table Column Headers (Row 3)
  const headerRowIndex = 3;
  const headerRow = worksheet.getRow(headerRowIndex);
  headerRow.height = 24;

  headers.forEach((h, colIdx) => {
    const cell = headerRow.getCell(colIdx + 1);
    cell.value = h.toUpperCase();
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' }, // Dark slate blue
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF0F172A' } },
      bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
      left: { style: 'thin', color: { argb: 'FF475569' } },
      right: { style: 'thin', color: { argb: 'FF475569' } },
    };
  });

  // Freeze header row
  worksheet.views = [
    {
      state: 'frozen',
      xSplit: 0,
      ySplit: 3,
      activeCell: 'A4',
      showGridLines: true,
    },
  ];

  // Set default column widths
  worksheet.columns.forEach((column) => {
    column.width = 20;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
