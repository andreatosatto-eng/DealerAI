
export enum Segment {
  CONSUMER_LUCE = 'consumer_luce',
  CONSUMER_GAS = 'consumer_gas',
  BUSINESS_LUCE = 'business_luce',
  BUSINESS_GAS = 'business_gas',
}

export enum IndexType {
  PUN = 'PUN',
  PSV = 'PSV',
}

export enum Commodity {
  LUCE = 'luce',
  GAS = 'gas',
}

export enum OfferType {
  FIXED = 'FIXED',
  VARIABLE = 'VARIABLE',
}

export enum Sector {
  CRM = 'crm',
  ENERGY = 'energy',
  TELEPHONY = 'telephony',
  EFFICIENCY = 'efficiency',
  MOBILITY = 'mobility',
  MANAGEMENT = 'management'
}

export interface Agency {
  id: string;
  name: string;
  vat_number: string;
  created_at: string;
}

export interface User {
  id: string;
  username: string;
  password?: string;
  full_name: string;
  agency_id: string;
  role: 'ADMIN' | 'AGENT'; // ADMIN is SuperAdmin if agency_id is 'ag_mt', otherwise AgencyAdmin
  is_active: boolean;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  user_id: string;
  username: string;
  action: string;
  details: string;
  agency_id: string;
}

// Energy, CRM, and other interfaces remain unchanged...
export interface ConsumptionHistoryItem {
  date: string;
  consumption: number;
  cost: number;
  type: 'BILL' | 'READING';
}

export interface CommodityDetails {
  supplier: string;
  status: 'ACTIVE' | 'CHURNED';
  code: string;
  power_committed?: number;
  annual_consumption?: number;
  consumption_f1?: number;
  consumption_f2?: number;
  consumption_f3?: number;
  raw_material_cost: number; 
  fixed_fee_year: number; 
  last_bill_amount?: number;
  history?: ConsumptionHistoryItem[];
}

export interface ConnectivityDetails {
  provider: string;
  status: 'ACTIVE' | 'CHURNED';
  technology: 'FTTH' | 'FTTC' | 'FWA' | 'ADSL';
  monthly_cost: number;
  speed_download_mbps?: number;
  contract_end_date?: string;
  penalty_monthly_cost?: number;
  phone_number?: string;
  migration_code?: string;
}

export interface MobileLine {
    id: string;
    number: string;
    operator: string;
    type: 'VOICE_DATA' | 'DATA_ONLY' | 'FWA_SIM';
    monthly_cost: number;
    data_limit_gb: number | 'UNLIMITED';
    contract_end_date?: string;
    penalty_monthly_cost?: number;
    device?: {
        model: string;
        installment_cost: number;
        installments_remaining: number;
    };
    notes?: string;
    migration_code?: string;
}

export interface EfficiencyDetails {
  type: 'PHOTOVOLTAIC' | 'HEAT_PUMP' | 'WALLBOX' | 'BOILER';
  brand?: string;
  installation_date?: string;
  status: 'PROPOSED' | 'INSTALLED' | 'MAINTENANCE';
  notes?: string;
}

export interface Vehicle {
  id: string;
  plate: string;
  model: string;
  brand: string;
  type: 'OWNED' | 'LEASING' | 'RENTAL';
  contract_end_date?: string;
  monthly_cost?: number;
  insurance_expiry?: string;
}

export type PropertyStatus = 'ACTIVE' | 'SOLD' | 'OBSOLETE';

export interface Property {
  id: string;
  name?: string; 
  status: PropertyStatus; 
  address: string;
  city: string;
  zip_code?: string;
  is_resident: boolean;
  electricity?: CommodityDetails;
  gas?: CommodityDetails;
  connectivity?: ConnectivityDetails;
  efficiency?: EfficiencyDetails[];
}

export interface Customer {
  id: string;
  agency_id: string;
  fiscal_code: string;
  type: 'PERSON' | 'COMPANY';
  first_name?: string;
  last_name?: string;
  family_id?: string;
  is_family_head?: boolean;
  company_name?: string;
  ceo?: string;
  commercial_referent?: string;
  email?: string;
  phone?: string;
  birth_date?: string;
  birth_place?: string;
  gender?: 'M' | 'F';
  properties: Property[];
  vehicles?: Vehicle[]; 
  mobile_lines?: MobileLine[];
  last_bill_date?: string;
  annual_spend_est?: number;
}

export interface IndexData {
  month: string;
  value: number;
}

export interface IndicesResponse {
  pun: IndexData[];
  psv: IndexData[];
  updated_at: string;
}

export interface CTE {
  id: string;
  offer_code: string;
  segment: Segment;
  supplier_name: string;
  offer_name: string;
  offer_type: OfferType;
  commodity: Commodity;
  f0: number;
  f1: number;
  f2: number;
  f3: number;
  index_type?: IndexType;
  spread_unit: string;
  other_variable_cost: number;
  other_cost_desc?: string; 
  fixed_fee_value: number;
  fixed_fee_unit: string;
  valid_until: string;
  is_default: boolean;
  visible_to_agency_ids: string[];
  uploaded_by_user_id: string;
  uploaded_at: string;
  notes_short?: string;
}

export interface TelephonyOperator {
    id: string;
    name: string;
    color_hex: string;
    logo_url?: string;
    is_active: boolean;
}

export type CanvasOfferType = 'MOBILE' | 'FIXED' | 'FWA' | 'CONVERGENCE' | 'SMARTPHONE';

export interface CanvasOffer {
    id: string;
    operator_id: string;
    operator_name: string;
    name: string; 
    type: CanvasOfferType;
    status: 'ACTIVE' | 'CEASED';
    target_segment: 'CONSUMER' | 'BUSINESS';
    monthly_price: number;
    data_gb?: number | 'UNLIMITED';
    minutes?: number | 'UNLIMITED';
    technology?: string;
    min_contract_months?: number; 
    activation_fee?: number;
    device_model?: string;
    upfront_cost?: number;
    installment_amount?: number;
    installment_count?: number;
    convergence_requirements?: string;
    valid_until: string;
    visible_to_agency_ids: string[];
}

export interface ExtractedBill {
  fiscal_code?: string;
  client_name?: string;
  address?: string;
  city?: string;
  is_resident?: boolean;
  commodity: Commodity;
  pod_pdr: string; 
  power_committed?: number;
  supplier_name?: string;
  period?: string;
  consumption: number;
  consumption_f1: number;
  consumption_f2: number;
  consumption_f3: number;
  current_raw_cost?: number; 
  detected_unit_price?: number; 
  detected_fixed_fee?: number; 
  confidence_map: Record<string, 'high' | 'medium' | 'low'>;
  annual_projection?: number; 
}

export interface ExtractedTelephonyBill {
  fiscal_code?: string;
  client_name?: string;
  address?: string;
  city?: string;
  operator: string;
  type: 'MOBILE' | 'FIXED' | 'FWA';
  number?: string;
  monthly_cost: number;
  plan_name?: string;
  contract_end_date?: string;
  migration_code?: string;
}

export interface BillAnalysisResponse {
    status: 'SUCCESS' | 'AMBIGUOUS_PROPERTY' | 'CONFLICT_EXISTING_OWNER';
    extracted_data: ExtractedBill;
    customer_data?: Customer;
    existing_customer_id?: string;
    existing_properties?: Property[];
    conflict_owner?: Customer;
    conflict_property?: Property;
}

export interface ComparisonResult {
  cte_id: string;
  current_cost_est: number;
  new_cost_est: number;
  delta_value: number;
  verdict: 'CONVIENE' | 'NON CONVIENE';
  reasons: string[];
  notes: string;
  calculation_details: string;
}

export interface PdfGenerationResponse {
  pdf_file_id: string;
  download_url: string;
}

export interface Opportunity {
  property_id: string;
  commodity: Commodity;
  better_cte: CTE;
  estimated_savings: number;
  calculation_basis: string; 
}

export interface TelephonyOpportunity {
    customer_id: string;
    customer_name: string;
    asset_type: 'MOBILE' | 'FIXED';
    current_asset_info: string;
    current_cost: number;
    penalty_monthly: number;
    better_offer: CanvasOffer;
    estimated_monthly_savings: number;
}
