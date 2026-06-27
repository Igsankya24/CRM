export interface TradeIndiaRawEnquiry {
  inquiry_id?: string
  rfi_id?: string | number | null
  sender_name?: string | null
  sender_mobile?: string | null
  sender_email?: string | null
  sender_co?: string | null
  sender_city?: string | null
  sender_state?: string | null
  sender_country?: string | null
  product_name?: string | null
  quantity?: string | null
  message?: string | null
  generated_date?: string | null
}
export interface TradeIndiaApiResponse {
  status?: string
  message?: string
  data?: TradeIndiaRawEnquiry[]
}
