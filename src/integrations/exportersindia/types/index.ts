export interface ExportersIndiaRawEnquiry {
  enquiry_id: string
  buyer_name?: string | null
  mobile?: string | null
  email?: string | null
  company?: string | null
  city?: string | null
  state?: string | null
  country?: string | null
  product?: string | null
  qty?: string | null
  enq_msg?: string | null
  enq_date?: string | null
}
export interface ExportersIndiaApiResponse {
  status?: string
  message?: string
  enquiries?: ExportersIndiaRawEnquiry[]
}
