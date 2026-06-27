export interface IndiaMartRawEnquiry {
  RN?: string
  UNIQUE_QUERY_ID: string
  SENDER_NAME?: string | null
  SENDER_MOBILE?: string | null
  SENDER_EMAIL?: string | null
  SENDER_COMPANY?: string | null
  SENDER_CITY?: string | null
  SENDER_STATE?: string | null
  SENDER_COUNTRY_ISO?: string | null
  QUERY_PRODUCT_NAME?: string | null
  QUERY_QTY?: string | null
  QUERY_MESSAGE?: string | null
  DATE_RECV_TIME?: string | null
  QUERY_TIME?: string | null
  DATE_RECV?: string | null
  GLUSR_MOBILE?: string | null
}

export interface IndiaMartApiResponse {
  STATUS: string
  CODE: string
  RESPONSE?: IndiaMartRawEnquiry[] | string
  MESSAGE?: string
}
