import { adminDb } from '@/lib/supabase/admin';
import { getAIResponseSimple } from '@/lib/ai/agent';

interface Mapping {
  [crmField: string]: string; // crm field -> excel column header
}

interface ValidateResult {
  valid: boolean;
  errors: string[];
  normalizedRow: any;
}

/**
 * Normalizes phone numbers
 */
function normalizePhone(phone: any): string {
  if (!phone) return '';
  const str = String(phone).replace(/[^0-9]/g, '');
  if (str.length === 10) return '91' + str; // Default to India country code
  return str;
}

/**
 * Validates columns of a row based on module expectations
 */
async function validateRow(
  module: string,
  row: any,
  mapping: Mapping,
  accountId: string
): Promise<ValidateResult> {
  const errors: string[] = [];
  const normalizedRow: any = {};

  const getValue = (crmKey: string) => {
    const excelCol = mapping[crmKey];
    if (!excelCol) return '';
    return row[excelCol] !== undefined ? String(row[excelCol]).trim() : '';
  };

  // 1. Module-independent format validators
  const validateEmail = (email: string) => {
    if (!email) return true;
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const validateGST = (gst: string) => {
    if (!gst) return true;
    const re = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    return re.test(gst);
  };

  const validatePincode = (pin: string) => {
    if (!pin) return true;
    const re = /^[0-9]{6}$/;
    return re.test(pin);
  };

  const validateDate = (dateStr: string) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
  };

  if (module === 'enquiry') {
    normalizedRow.buyer_name = getValue('buyer_name');
    normalizedRow.company_name = getValue('company_name');
    normalizedRow.phone = normalizePhone(getValue('phone'));
    normalizedRow.email = getValue('email');
    normalizedRow.source = getValue('source') || 'MANUAL';
    normalizedRow.requirement = getValue('requirement');
    normalizedRow.location = getValue('location');
    normalizedRow.city = getValue('city');
    normalizedRow.pincode = getValue('pincode');
    normalizedRow.state = getValue('state');
    normalizedRow.country = getValue('country') || 'India';
    normalizedRow.status = getValue('status') || 'Customer';
    normalizedRow.product_name = getValue('product_name');
    normalizedRow.quantity = getValue('quantity');
    normalizedRow.remarks = getValue('remarks');
    normalizedRow.followup_date = validateDate(getValue('followup_date'));

    if (!normalizedRow.buyer_name && !normalizedRow.company_name) {
      errors.push('Buyer Name or Company Name is required');
    }
    if (!normalizedRow.phone) {
      errors.push('Contact Phone is required');
    } else if (normalizedRow.phone.length < 10) {
      errors.push('Phone number must be at least 10 digits');
    }
    if (normalizedRow.email && !validateEmail(normalizedRow.email)) {
      errors.push(`Invalid email format: ${normalizedRow.email}`);
    }
    if (normalizedRow.pincode && !validatePincode(normalizedRow.pincode)) {
      errors.push(`Invalid Pincode: ${normalizedRow.pincode}`);
    }
  }

  else if (module === 'customer') {
    normalizedRow.name = getValue('name');
    normalizedRow.phone = normalizePhone(getValue('phone'));
    normalizedRow.email = getValue('email');
    normalizedRow.company = getValue('company');
    normalizedRow.address = getValue('address');
    normalizedRow.city = getValue('city');
    normalizedRow.state = getValue('state');
    normalizedRow.pincode = getValue('pincode');
    normalizedRow.country = getValue('country');

    if (!normalizedRow.name && !normalizedRow.company) {
      errors.push('Customer Name or Company Name is required');
    }
    if (!normalizedRow.phone) {
      errors.push('Phone is required');
    }
    if (normalizedRow.email && !validateEmail(normalizedRow.email)) {
      errors.push(`Invalid email format: ${normalizedRow.email}`);
    }
  }

  else if (module === 'product') {
    normalizedRow.product_name = getValue('product_name');
    normalizedRow.category = getValue('category');
    normalizedRow.description = getValue('description');
    normalizedRow.specification = getValue('specification');
    normalizedRow.hsn_code = getValue('hsn_code');
    normalizedRow.price = parseFloat(getValue('price')) || 0;
    normalizedRow.unit = getValue('unit') || 'pcs';

    if (!normalizedRow.product_name) {
      errors.push('Product Name is required');
    }
    if (normalizedRow.price < 0) {
      errors.push('Price cannot be negative');
    }
  }

  else if (['quotation', 'proforma', 'sales'].includes(module)) {
    normalizedRow.company_name = getValue('company_name');
    normalizedRow.contact_person = getValue('contact_person');
    normalizedRow.mobile = normalizePhone(getValue('mobile'));
    normalizedRow.email = getValue('email');
    normalizedRow.gst_no = getValue('gst_no');
    normalizedRow.address = getValue('address') || 'No address provided';
    normalizedRow.city = getValue('city');
    normalizedRow.state = getValue('state');
    normalizedRow.pincode = getValue('pincode');
    normalizedRow.country = getValue('country');
    normalizedRow.subject = getValue('subject');
    normalizedRow.basic_total = parseFloat(getValue('basic_total')) || 0;
    normalizedRow.tax_type = getValue('tax_type') || 'none';
    normalizedRow.tax_amount = parseFloat(getValue('tax_amount')) || 0;
    normalizedRow.grand_total = parseFloat(getValue('grand_total')) || (normalizedRow.basic_total + normalizedRow.tax_amount);
    normalizedRow.status = getValue('status');
    normalizedRow.entry_date = validateDate(getValue('entry_date')) || new Date().toISOString().split('T')[0];

    if (module === 'quotation') {
      normalizedRow.quotation_no = getValue('quotation_no');
      normalizedRow.status = normalizedRow.status || 'draft';
    } else if (module === 'proforma') {
      normalizedRow.proforma_no = getValue('proforma_no');
      normalizedRow.status = normalizedRow.status || 'draft';
    } else {
      normalizedRow.sales_register_no = getValue('sales_no');
      normalizedRow.dispatch_status = getValue('dispatch_status') || 'pending';
      normalizedRow.payment_status = getValue('payment_status') || 'pending';
      normalizedRow.status = normalizedRow.status || 'pending';
    }

    if (!normalizedRow.company_name) {
      errors.push('Company Name is required');
    }
    if (!normalizedRow.mobile) {
      errors.push('Mobile is required');
    }
    if (normalizedRow.email && !validateEmail(normalizedRow.email)) {
      errors.push(`Invalid email: ${normalizedRow.email}`);
    }
    if (normalizedRow.gst_no && !validateGST(normalizedRow.gst_no)) {
      errors.push(`Invalid GSTIN format: ${normalizedRow.gst_no}`);
    }
    if (normalizedRow.pincode && !validatePincode(normalizedRow.pincode)) {
      errors.push(`Invalid pincode: ${normalizedRow.pincode}`);
    }

    // Check Customer existence
    if (normalizedRow.company_name) {
      const { data: customerExists } = await adminDb
        .from('contacts')
        .select('id')
        .eq('account_id', accountId)
        .eq('company', normalizedRow.company_name)
        .limit(1)
        .maybeSingle();

      if (!customerExists) {
        errors.push(`Warning: Customer '${normalizedRow.company_name}' does not exist in contact master (will be created automatically if imported)`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    normalizedRow,
  };
}

/**
 * AI Lead Enrichment Processor for imported enquiries
 */
export async function enrichEnquiriesWithAI(accountId: string, leadIds: string[]) {
  if (leadIds.length === 0) return;

  try {
    // 1. Get OpenRouter API Key
    const { data: config } = await adminDb
      .from('whatsapp_config')
      .select('openrouter_api_key, ai_only_free_models')
      .eq('account_id', accountId)
      .maybeSingle();

    let openrouterApiKey = '';
    let onlyFree = false;
    if (config) {
      onlyFree = config.ai_only_free_models === true;
      if (config.openrouter_api_key) {
        try {
          // Dynamic import of decryption to avoid circular dependencies
          const { decrypt } = await import('@/lib/whatsapp/encryption');
          openrouterApiKey = decrypt(config.openrouter_api_key);
        } catch {}
      }
    }

    // 2. Fetch available Sales agents for potential assignments
    const { data: profiles } = await adminDb
      .from('profiles')
      .select('id, full_name')
      .eq('account_id', accountId)
      .eq('role', 'agent');

    const agentList = (profiles || []).map((p) => `- ${p.full_name} (ID: ${p.id})`).join('\n');

    for (const leadId of leadIds) {
      const { data: lead } = await adminDb
        .from('crm_leads')
        .select('*')
        .eq('id', leadId)
        .single();

      if (!lead) continue;

      const prompt = `
You are the Phoenix CRM AI Agent. Analyze this newly imported B2B Enquiry:
Buyer Name: ${lead.buyer_name || '—'}
Company: ${lead.company_name || '—'}
Phone: ${lead.phone || '—'}
Product Interest: ${lead.product_name || '—'}
Quantity: ${lead.quantity || '—'}
Requirement details: ${lead.requirement || '—'}
Remarks: ${lead.remarks || '—'}

Available Sales Persons to Assign:
${agentList || 'None'}

Your tasks:
1. Detect specific product category/name.
2. Suggest lead temperature score: 'HOT' | 'WARM' | 'COLD' | 'SPAM'.
3. Assign priority level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'.
4. Suggest the best Sales Person to assign from the list above. Return their profile UUID (ID). If no agents available, return null.
5. Suggest a followup date offset (number of days from today, e.g., 2 for high priority, 7 for cold).
6. Generate a concise 1-sentence lead summary.

Provide your answer in strict JSON format:
{
  "detected_product": "string",
  "ai_score": "HOT" | "WARM" | "COLD" | "SPAM",
  "urgency": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "assigned_to": "UUID or null",
  "follow_up_days": 1-14,
  "summary": "string"
}
`;

      try {
        const responseText = await getAIResponseSimple(
          [{ role: 'user', content: prompt }],
          {
            model: 'google/gemini-2.5-flash:free',
            onlyFree,
            openrouterApiKey,
          }
        );

        // Strip markdown backticks if any
        const cleaned = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
        const aiResult = JSON.parse(cleaned);

        const nextFollowup = new Date();
        nextFollowup.setDate(nextFollowup.getDate() + (aiResult.follow_up_days || 3));

        // Update the lead record with AI insights
        await adminDb
          .from('crm_leads')
          .update({
            product_name: aiResult.detected_product || lead.product_name,
            ai_score: aiResult.ai_score || 'WARM',
            urgency: aiResult.urgency || 'MEDIUM',
            assigned_to: aiResult.assigned_to || lead.assigned_to,
            assigned_at: aiResult.assigned_to ? new Date().toISOString() : null,
            next_followup_at: nextFollowup.toISOString(),
            ai_summary: aiResult.summary || lead.ai_summary,
            ai_score_reasons: JSON.stringify(['AI Ingest Processing Completed']),
          })
          .eq('id', leadId);

        // Insert timeline activity
        await adminDb.from('crm_activities').insert({
          account_id: accountId,
          crm_lead_id: leadId,
          activity_type: 'AI_MESSAGE',
          title: 'AI Ingest Enrichment',
          description: `AI processed lead. Score: ${aiResult.ai_score || 'WARM'}. Urgency: ${aiResult.urgency || 'MEDIUM'}. Summary: ${aiResult.summary || '—'}`,
        });

      } catch (aiErr) {
        console.error(`[AI-Process] Failed to enrich lead ${leadId}:`, aiErr);
      }
    }
  } catch (err) {
    console.error('[AI-Process] General error in AI lead enrichment:', err);
  }
}

/**
 * Background processing worker loop
 */
export async function processImportInBackground(
  jobId: string,
  accountId: string,
  userId: string,
  module: string,
  rows: any[],
  duplicateStrategy: 'skip' | 'update' | 'merge' | 'create',
  mapping: Mapping
) {
  const startTime = Date.now();
  let importedCount = 0;
  let failedCount = 0;

  try {
    // 1. Update job status to 'processing'
    await adminDb
      .from('bulk_jobs')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', jobId);

    // Fetch default terms/manager settings snapshots
    const { data: companySettings } = await adminDb
      .from('company_settings')
      .select('*')
      .eq('account_id', accountId)
      .maybeSingle();

    const managerName = companySettings?.manager_name || '';
    const managerDesignation = companySettings?.manager_designation || 'Manager';
    const bankAccountName = companySettings?.bank_account_name || '';
    const bankAccountType = companySettings?.bank_account_type || '';
    const bankAccountNumber = companySettings?.bank_account_number || '';
    const bankName = companySettings?.bank_name || '';
    const bankIfsc = companySettings?.bank_ifsc || '';

    const defaultQuotationTerms = companySettings?.quotation_terms_text || '';
    const defaultProformaTerms = companySettings?.proforma_terms_text || '';
    const defaultSalesTerms = companySettings?.sales_register_terms_text || '';

    const totalRows = rows.length;
    const importedLeadIds: string[] = [];

    // Process rows in batches of 50
    const batchSize = 50;
    for (let i = 0; i < totalRows; i += batchSize) {
      // Check cancellation state first
      const { data: jobState } = await adminDb
        .from('bulk_jobs')
        .select('status')
        .eq('id', jobId)
        .single();

      if (jobState?.status === 'cancelled') {
        // Abort loop
        await adminDb.from('import_logs').insert({
          import_id: jobId,
          message: 'Job cancelled by user request.',
          status: 'warning',
        });
        return;
      }

      const batch = rows.slice(i, i + batchSize);

      for (let j = 0; j < batch.length; j++) {
        const rowIndex = i + j + 1;
        const rawRow = batch[j];

        // 1. Run validations
        const valResult = await validateRow(module, rawRow, mapping, accountId);
        if (!valResult.valid) {
          failedCount++;
          await adminDb.from('import_logs').insert({
            import_id: jobId,
            row_index: rowIndex,
            row_data: JSON.stringify(rawRow),
            status: 'error',
            message: valResult.errors.join('; '),
          });
          continue;
        }

        const dataRow = valResult.normalizedRow;

        // 2. Duplicate Detection & Handling
        let duplicateRecordId: string | null = null;
        let existingRecord: any = null;

        if (module === 'enquiry') {
          const { data: dup } = await adminDb
            .from('crm_leads')
            .select('id, company_name, buyer_name, phone, email')
            .eq('account_id', accountId)
            .eq('phone', dataRow.phone)
            .eq('deleted_at', null)
            .limit(1)
            .maybeSingle();
          if (dup) {
            duplicateRecordId = dup.id;
            existingRecord = dup;
          }
        } else if (module === 'customer') {
          const { data: dup } = await adminDb
            .from('contacts')
            .select('id, company, name, phone, email')
            .eq('account_id', accountId)
            .eq('phone', dataRow.phone)
            .limit(1)
            .maybeSingle();
          if (dup) {
            duplicateRecordId = dup.id;
            existingRecord = dup;
          }
        } else if (module === 'product') {
          const { data: dup } = await adminDb
            .from('company_products')
            .select('id, product_name')
            .eq('account_id', accountId)
            .eq('product_name', dataRow.product_name)
            .limit(1)
            .maybeSingle();
          if (dup) {
            duplicateRecordId = dup.id;
            existingRecord = dup;
          }
        } else if (module === 'quotation' && dataRow.quotation_no) {
          const { data: dup } = await adminDb
            .from('quotations')
            .select('id, quotation_no')
            .eq('account_id', accountId)
            .eq('quotation_no', dataRow.quotation_no)
            .limit(1)
            .maybeSingle();
          if (dup) duplicateRecordId = dup.id;
        } else if (module === 'proforma' && dataRow.proforma_no) {
          const { data: dup } = await adminDb
            .from('proformas')
            .select('id, proforma_no')
            .eq('account_id', accountId)
            .eq('proforma_no', dataRow.proforma_no)
            .limit(1)
            .maybeSingle();
          if (dup) duplicateRecordId = dup.id;
        } else if (module === 'sales' && dataRow.sales_register_no) {
          const { data: dup } = await adminDb
            .from('sales_registers')
            .select('id, sales_register_no')
            .eq('account_id', accountId)
            .eq('sales_register_no', dataRow.sales_register_no)
            .limit(1)
            .maybeSingle();
          if (dup) duplicateRecordId = dup.id;
        }

        if (duplicateRecordId) {
          if (duplicateStrategy === 'skip') {
            // Log as skipped
            await adminDb.from('import_logs').insert({
              import_id: jobId,
              row_index: rowIndex,
              row_data: JSON.stringify(rawRow),
              status: 'warning',
              message: `Duplicate detected. Skipped row according to strategy. Record ID: ${duplicateRecordId}`,
            });
            continue;
          }

          if (duplicateStrategy === 'update' || duplicateStrategy === 'merge') {
            const isMerge = duplicateStrategy === 'merge';
            const updatePayload: any = {};

            // Merge vs Update logic
            Object.keys(dataRow).forEach((key) => {
              if (isMerge) {
                // Merge strategy: only update if current existing record value is empty/falsy
                if (!existingRecord?.[key]) {
                  updatePayload[key] = dataRow[key];
                }
              } else {
                // Update strategy: overwrite values
                updatePayload[key] = dataRow[key];
              }
            });

            let error: any = null;
            if (module === 'enquiry') {
              const { error: e } = await adminDb.from('crm_leads').update(updatePayload).eq('id', duplicateRecordId);
              error = e;
            } else if (module === 'customer') {
              const { error: e } = await adminDb.from('contacts').update(updatePayload).eq('id', duplicateRecordId);
              error = e;
            } else if (module === 'product') {
              const { error: e } = await adminDb.from('company_products').update(updatePayload).eq('id', duplicateRecordId);
              error = e;
            } else if (module === 'quotation') {
              const { error: e } = await adminDb.from('quotations').update(updatePayload).eq('id', duplicateRecordId);
              error = e;
            } else if (module === 'proforma') {
              const { error: e } = await adminDb.from('proformas').update(updatePayload).eq('id', duplicateRecordId);
              error = e;
            } else if (module === 'sales') {
              const { error: e } = await adminDb.from('sales_registers').update(updatePayload).eq('id', duplicateRecordId);
              error = e;
            }

            if (error) {
              failedCount++;
              await adminDb.from('import_logs').insert({
                import_id: jobId,
                row_index: rowIndex,
                row_data: JSON.stringify(rawRow),
                status: 'error',
                message: `Failed to update duplicate record: ${error.message}`,
              });
            } else {
              importedCount++;
            }
            continue;
          }
        }

        // 3. Normal Insert Execution
        let dbErr: any = null;
        let insertedRecord: any = null;

        if (module === 'enquiry') {
          const { data: newLead, error: e } = await adminDb
            .from('crm_leads')
            .insert({
              account_id: accountId,
              buyer_name: dataRow.buyer_name || null,
              company_name: dataRow.company_name || null,
              phone: dataRow.phone,
              email: dataRow.email || null,
              source: dataRow.source,
              stage: dataRow.status,
              requirement: dataRow.requirement || null,
              city: dataRow.city || null,
              state: dataRow.state || null,
              country: dataRow.country,
              pincode: dataRow.pincode || null,
              remarks: dataRow.remarks || null,
              next_followup_at: dataRow.followup_date ? new Date(dataRow.followup_date).toISOString() : null,
            })
            .select()
            .single();
          dbErr = e;
          insertedRecord = newLead;
          if (newLead) {
            importedLeadIds.push(newLead.id);
            // Insert initial crm activity
            await adminDb.from('crm_activities').insert({
              account_id: accountId,
              crm_lead_id: newLead.id,
              activity_type: 'SYSTEM',
              title: 'Lead Imported',
              description: 'Lead imported via Excel spreadsheet upload.',
            });
          }
        }

        else if (module === 'customer') {
          const { error: e } = await adminDb.from('contacts').insert({
            account_id: accountId,
            name: dataRow.name || null,
            phone: dataRow.phone,
            email: dataRow.email || null,
            company: dataRow.company || null,
            address: dataRow.address || null,
            city: dataRow.city || null,
            state: dataRow.state || null,
            pincode: dataRow.pincode || null,
            country: dataRow.country || null,
          });
          dbErr = e;
        }

        else if (module === 'product') {
          const { error: e } = await adminDb.from('company_products').insert({
            account_id: accountId,
            product_name: dataRow.product_name,
            category: dataRow.category || null,
            description: dataRow.description || null,
            specification: dataRow.specification || null,
            hsn_code: dataRow.hsn_code || null,
            price: dataRow.price,
            unit: dataRow.unit,
            is_active: true,
          });
          dbErr = e;
        }

        else if (module === 'quotation') {
          let quotationNo = dataRow.quotation_no;
          if (!quotationNo) {
            const { data: nextNo } = await adminDb.rpc('next_quotation_no', { p_account_id: accountId });
            quotationNo = nextNo || `QT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
          }

          const { data: newQ, error: e } = await adminDb
            .from('quotations')
            .insert({
              account_id: accountId,
              quotation_no: quotationNo,
              entry_date: dataRow.entry_date,
              company_name: dataRow.company_name,
              contact_person: dataRow.contact_person || null,
              email: dataRow.email || null,
              mobile: dataRow.mobile,
              address: dataRow.address,
              city: dataRow.city || null,
              state: dataRow.state || null,
              pincode: dataRow.pincode || null,
              country: dataRow.country || null,
              gst_no: dataRow.gst_no || null,
              subject: dataRow.subject || null,
              basic_total: dataRow.basic_total,
              tax_type: dataRow.tax_type,
              tax_amount: dataRow.tax_amount,
              grand_total: dataRow.grand_total,
              status: dataRow.status,
              manager_name: managerName || null,
              manager_designation: managerDesignation,
            })
            .select()
            .single();
          
          dbErr = e;
          if (newQ) {
            // Save terms
            await adminDb.from('quotation_terms').insert({
              quotation_id: newQ.id,
              terms_text: defaultQuotationTerms,
            });
            // Save status history
            await adminDb.from('quotation_status_history').insert({
              quotation_id: newQ.id,
              old_status: null,
              new_status: dataRow.status,
              note: 'Batch imported from spreadsheet',
            });
          }
        }

        else if (module === 'proforma') {
          let proformaNo = dataRow.proforma_no;
          if (!proformaNo) {
            const { data: nextNo } = await adminDb.rpc('next_proforma_no', { p_account_id: accountId });
            proformaNo = nextNo || `PI-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
          }

          const { data: newP, error: e } = await adminDb
            .from('proformas')
            .insert({
              account_id: accountId,
              proforma_no: proformaNo,
              entry_date: dataRow.entry_date,
              company_name: dataRow.company_name,
              contact_person: dataRow.contact_person || null,
              email: dataRow.email || null,
              mobile: dataRow.mobile,
              address: dataRow.address,
              city: dataRow.city || null,
              state: dataRow.state || null,
              pincode: dataRow.pincode || null,
              country: dataRow.country || null,
              gst_no: dataRow.gst_no || null,
              subject: dataRow.subject || null,
              basic_total: dataRow.basic_total,
              tax_type: dataRow.tax_type,
              tax_amount: dataRow.tax_amount,
              grand_total: dataRow.grand_total,
              status: dataRow.status,
              bank_account_name: bankAccountName || null,
              bank_account_type: bankAccountType || null,
              bank_account_number: bankAccountNumber || null,
              bank_name: bankName || null,
              bank_ifsc: bankIfsc || null,
              manager_name: managerName || null,
              manager_designation: managerDesignation,
            })
            .select()
            .single();

          dbErr = e;
          if (newP) {
            await adminDb.from('proforma_terms').insert({
              proforma_id: newP.id,
              terms_text: defaultProformaTerms,
            });
            await adminDb.from('proforma_status_history').insert({
              proforma_id: newP.id,
              old_status: null,
              new_status: dataRow.status,
              note: 'Batch imported from spreadsheet',
            });
          }
        }

        else if (module === 'sales') {
          let salesNo = dataRow.sales_register_no;
          if (!salesNo) {
            const { data: nextNo } = await adminDb.rpc('next_sales_register_no', { p_account_id: accountId });
            salesNo = nextNo || `SR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
          }

          const { data: newS, error: e } = await adminDb
            .from('sales_registers')
            .insert({
              account_id: accountId,
              sales_register_no: salesNo,
              entry_date: dataRow.entry_date,
              company_name: dataRow.company_name,
              contact_person: dataRow.contact_person || null,
              email: dataRow.email || null,
              mobile: dataRow.mobile,
              address: dataRow.address,
              city: dataRow.city || null,
              state: dataRow.state || null,
              pincode: dataRow.pincode || null,
              country: dataRow.country || null,
              gst_no: dataRow.gst_no || null,
              subject: dataRow.subject || null,
              basic_total: dataRow.basic_total,
              tax_type: dataRow.tax_type,
              tax_amount: dataRow.tax_amount,
              grand_total: dataRow.grand_total,
              dispatch_status: dataRow.dispatch_status,
              payment_status: dataRow.payment_status,
              status: dataRow.status,
              bank_account_name: bankAccountName || null,
              bank_account_type: bankAccountType || null,
              bank_account_number: bankAccountNumber || null,
              bank_name: bankName || null,
              bank_ifsc: bankIfsc || null,
              manager_name: managerName || null,
              manager_designation: managerDesignation,
            })
            .select()
            .single();

          dbErr = e;
          if (newS) {
            await adminDb.from('sales_register_terms').insert({
              sales_register_id: newS.id,
              terms_text: defaultSalesTerms,
            });
            await adminDb.from('sales_register_status_history').insert({
              sales_register_id: newS.id,
              old_status: null,
              new_status: dataRow.status,
              note: 'Batch imported from spreadsheet',
            });
          }
        }

        if (dbErr) {
          failedCount++;
          await adminDb.from('import_logs').insert({
            import_id: jobId,
            row_index: rowIndex,
            row_data: JSON.stringify(rawRow),
            status: 'error',
            message: `DB Insert error: ${dbErr.message}`,
          });
        } else {
          importedCount++;
        }
      }

      // Update progress bar
      const progress = Math.round((Math.min(i + batchSize, totalRows) / totalRows) * 100);
      await adminDb
        .from('bulk_jobs')
        .update({
          progress,
          processed_rows: i + batch.length - failedCount,
          failed_rows: failedCount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId);
    }

    // AI Enrichment Trigger post Enquiry Import
    if (module === 'enquiry' && importedLeadIds.length > 0) {
      // Process AI categorizations asynchronously in the background
      enrichEnquiriesWithAI(accountId, importedLeadIds)
        .catch((e) => console.error('[import/AI] AI enrichment error:', e));
    }

    const duration = Date.now() - startTime;

    // Create import_history record
    const { data: hist } = await adminDb
      .from('import_history')
      .insert({
        account_id: accountId,
        user_id: userId,
        module,
        filename: rows.length > 0 ? 'import.xlsx' : 'spreadsheet.xlsx',
        status: 'completed',
        rows_imported: importedCount,
        rows_failed: failedCount,
        duration,
      })
      .select()
      .single();

    // Link logs to this import_history id instead of jobId
    if (hist) {
      await adminDb
        .from('import_logs')
        .update({ import_id: hist.id })
        .eq('import_id', jobId);
    }

    // Complete job
    await adminDb
      .from('bulk_jobs')
      .update({
        status: 'completed',
        progress: 100,
        processed_rows: importedCount,
        failed_rows: failedCount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);

  } catch (err: any) {
    console.error('[import-processor] Background thread error:', err);
    await adminDb
      .from('bulk_jobs')
      .update({
        status: 'failed',
        error_message: err.message || 'Background worker thread execution failed.',
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);
  }
}
