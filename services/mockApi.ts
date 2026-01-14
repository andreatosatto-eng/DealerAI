
import { 
  Segment, IndicesResponse, CTE, IndexType, Commodity, ExtractedBill, ComparisonResult, 
  PdfGenerationResponse, OfferType, User, Agency, Customer, Property, Opportunity, 
  CommodityDetails, ConsumptionHistoryItem, BillAnalysisResponse, PropertyStatus, 
  CanvasOffer, TelephonyOpportunity, TelephonyOperator, ExtractedTelephonyBill, AuditLog 
} from '../types';
import * as GeminiService from './geminiService';

// --- DATABASE CORE ENGINE ---
const STORAGE_NAMESPACE = 'mt_dealer_db_v2';

class DatabaseEngine {
    public data: {
        agencies: Agency[];
        users: User[];
        customers: Customer[];
        ctes: CTE[];
        operators: TelephonyOperator[];
        canvas: CanvasOffer[];
        auditLogs: AuditLog[];
    };

    constructor() {
        this.data = this.load();
    }

    private load() {
        const raw = localStorage.getItem(STORAGE_NAMESPACE);
        if (raw) {
            try {
                return JSON.parse(raw);
            } catch (e) {
                console.error("Database corruption detected. Resetting to defaults.");
            }
        }
        return this.getDefaults();
    }

    private getDefaults() {
        return {
            agencies: [
                { id: 'ag_mt', name: 'MT Technology HQ', vat_number: 'IT12345678901', created_at: '2023-01-01' },
                { id: 'ag_partner1', name: 'Agenzia Demo Nord', vat_number: 'IT98765432100', created_at: '2023-05-10' }
            ],
            users: [
                { id: 'u_admin', username: 'admin', password: 'password', full_name: 'Super Admin MT', agency_id: 'ag_mt', role: 'ADMIN' as const, is_active: true },
                { id: 'u_boss_demo', username: 'titolare', password: 'password', full_name: 'Titolare Demo Nord', agency_id: 'ag_partner1', role: 'ADMIN' as const, is_active: true },
                { id: 'u_agent_demo', username: 'agente', password: 'password', full_name: 'Agente Demo Nord', agency_id: 'ag_partner1', role: 'AGENT' as const, is_active: true }
            ],
            customers: [],
            ctes: [],
            operators: [
                { id: 'op_tim', name: 'Tim', color_hex: '#003399', is_active: true },
                { id: 'op_voda', name: 'Vodafone', color_hex: '#E60000', is_active: true },
                { id: 'op_fw', name: 'Fastweb', color_hex: '#FFCC00', is_active: true },
            ],
            canvas: [],
            auditLogs: []
        };
    }

    save() {
        localStorage.setItem(STORAGE_NAMESPACE, JSON.stringify(this.data));
    }

    reset() {
        this.data = this.getDefaults();
        this.save();
    }

    export(agencyId?: string) {
        if (!agencyId || agencyId === 'ag_mt') {
            return JSON.stringify(this.data, null, 2);
        }
        const scopedData = {
            agency_info: this.data.agencies.find(a => a.id === agencyId),
            users: this.data.users.filter(u => u.agency_id === agencyId),
            customers: this.data.customers.filter(c => c.agency_id === agencyId),
            auditLogs: this.data.auditLogs.filter(l => l.agency_id === agencyId)
        };
        return JSON.stringify(scopedData, null, 2);
    }

    import(json: string) {
        try {
            const imported = JSON.parse(json);
            if (imported.agencies && imported.users) {
                this.data = imported;
                this.save();
                return true;
            }
            return false;
        } catch (e) {
            return false;
        }
    }

    getCollection<T extends keyof typeof db.data>(collection: T): typeof db.data[T] {
        return this.data[collection];
    }

    log(userId: string, username: string, agencyId: string, action: string, details: string) {
        const entry: AuditLog = {
            id: `log_${Date.now()}`,
            timestamp: new Date().toISOString(),
            user_id: userId,
            username,
            agency_id: agencyId,
            action,
            details
        };
        this.data.auditLogs.unshift(entry);
        if (this.data.auditLogs.length > 500) this.data.auditLogs.pop();
        this.save();
    }
}

const db = new DatabaseEngine();
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// --- AUTHENTICATION ---
export const login = async (username: string, password?: string): Promise<User | null> => {
    await delay(600);
    const users = db.getCollection('users');
    const user = users.find(u => 
        u.username.toLowerCase() === username.toLowerCase() && 
        u.password === (password || 'password') &&
        u.is_active
    );
    if (user) {
        db.log(user.id, user.username, user.agency_id, 'LOGIN', 'Accesso al portale eseguito.');
    }
    return user || null;
}

// --- SCOPED MANAGEMENT ---
export const list_agencies = async (user: User): Promise<Agency[]> => {
    const agencies = db.getCollection('agencies');
    if (user.agency_id === 'ag_mt') return agencies;
    return agencies.filter(a => a.id === user.agency_id);
};

export const list_users = async (user: User): Promise<User[]> => {
    const users = db.getCollection('users');
    if (user.agency_id === 'ag_mt') return users;
    return users.filter(u => u.agency_id === user.agency_id);
};

export const create_agency = async (agency: Omit<Agency, 'id' | 'created_at'>): Promise<Agency> => {
    const newAgency: Agency = { ...agency, id: `ag_${Date.now()}`, created_at: new Date().toISOString() };
    db.getCollection('agencies').push(newAgency);
    db.save();
    return newAgency;
};

export const create_system_user = async (user: Omit<User, 'id'>, currentUser: User): Promise<User> => {
    const finalAgencyId = currentUser.agency_id === 'ag_mt' ? user.agency_id : currentUser.agency_id;
    const newUser: User = { ...user, agency_id: finalAgencyId, id: `u_${Date.now()}` };
    db.getCollection('users').push(newUser);
    db.save();
    db.log(currentUser.id, currentUser.username, currentUser.agency_id, 'USER_CREATE', `Creato nuovo utente: ${newUser.username}`);
    return newUser;
};

export const toggle_user_status = async (userId: string, currentUser: User): Promise<void> => {
    const users = db.getCollection('users');
    const user = users.find(u => u.id === userId);
    if (user) {
        if (currentUser.agency_id !== 'ag_mt' && user.agency_id !== currentUser.agency_id) return;
        user.is_active = !user.is_active;
        db.save();
    }
};

// --- CRM & DATABASE (STRICTLY SCOPED) ---
export const get_customers = async (agency_id: string): Promise<Customer[]> => {
    return db.getCollection('customers').filter(c => c.agency_id === agency_id);
}

export const get_families = async (agency_id: string): Promise<Record<string, Customer[]>> => {
    const customers = await get_customers(agency_id);
    const families: Record<string, Customer[]> = {};
    customers.filter(c => c.type === 'PERSON').forEach(c => {
        const key = c.family_id || c.id; 
        if (!families[key]) families[key] = [];
        families[key].push(c);
    });
    return families;
}

export const update_customer = async (customer: Customer): Promise<Customer> => {
    const customers = db.getCollection('customers');
    const idx = customers.findIndex(c => c.id === customer.id);
    if (idx !== -1) {
        customers[idx] = customer;
        db.save();
        return customer;
    }
    throw new Error("Customer not found");
}

export const add_customer = async (customer: Customer): Promise<Customer> => {
    db.getCollection('customers').push(customer);
    db.save();
    return customer;
}

// --- ANALYSIS TOOLS & CONFLICT DETECTION ---
export const analyze_bill = async (file: File, user: User): Promise<BillAnalysisResponse> => {
    await delay(1500);
    const extracted = await GeminiService.extractBillData(file);
    const allCustomers = db.getCollection('customers').filter(c => c.agency_id === user.agency_id);
    
    // 1. Check for Duplicate Customer by Fiscal Code
    let targetCustomer = allCustomers.find(c => c.fiscal_code === extracted.fiscal_code);
    
    if (targetCustomer) {
        // Update existing customer info if it looks sparse
        if (!targetCustomer.first_name || targetCustomer.first_name === 'Nuovo') {
             targetCustomer.first_name = extracted.client_name?.split(' ')[0];
             targetCustomer.last_name = extracted.client_name?.split(' ').slice(1).join(' ');
        }
        db.save();
    } else {
        // Create New Customer
        targetCustomer = {
            id: `cust_${Date.now()}`,
            agency_id: user.agency_id,
            fiscal_code: extracted.fiscal_code || 'N/D',
            type: extracted.client_name?.includes('SPA') || extracted.client_name?.includes('SRL') ? 'COMPANY' : 'PERSON',
            first_name: extracted.client_name?.split(' ')[0] || 'Nuovo',
            last_name: extracted.client_name?.split(' ').slice(1).join(' ') || 'Cliente',
            properties: []
        };
        db.getCollection('customers').push(targetCustomer);
        db.save();
    }

    // 2. Property Logic - PRIORITY TO POD/PDR
    // We try to find the property by POD/PDR first. Address is secondary/fallback.
    let existingProp: Property | undefined;

    if (extracted.pod_pdr) {
        existingProp = targetCustomer.properties.find(p => 
            p.electricity?.code === extracted.pod_pdr || 
            p.gas?.code === extracted.pod_pdr
        );
    }

    // Fallback: If no POD matched (or document has no POD, like ID Card), check Address
    if (!existingProp && extracted.address) {
        const normalizedExtractedAddr = extracted.address.toLowerCase().replace(/\s/g, '');
        existingProp = targetCustomer.properties.find(p => 
            p.address.toLowerCase().replace(/\s/g, '').includes(normalizedExtractedAddr) ||
            normalizedExtractedAddr.includes(p.address.toLowerCase().replace(/\s/g, ''))
        );
    }

    if (!existingProp) {
        // Create New Property
        const newProp: Property = {
            id: `prop_${Date.now()}`,
            status: 'ACTIVE',
            address: extracted.address || 'Indirizzo Sconosciuto',
            city: extracted.city || 'Città',
            is_resident: extracted.is_resident || (extracted.document_type === 'ID_CARD'), 
        };
        
        if (extracted.document_type === 'BILL') {
            const comm = extracted.commodity === 'luce' ? 'electricity' : 'gas';
            newProp[comm] = {
                supplier: extracted.supplier_name || 'N/D',
                status: 'ACTIVE',
                code: extracted.pod_pdr || 'N/D',
                power_committed: extracted.power_committed,
                annual_consumption: extracted.consumption * 6,
                raw_material_cost: extracted.detected_unit_price || 0.15,
                fixed_fee_year: extracted.detected_fixed_fee || 120,
                history: []
            };
        }
        targetCustomer.properties.push(newProp);
        db.save();
    } else if (extracted.document_type === 'BILL') {
        // Update existing property (Found by POD or Address)
         const comm = extracted.commodity === 'luce' ? 'electricity' : 'gas';
         
         // Always update the commodity details with latest bill data
         existingProp[comm] = {
            supplier: extracted.supplier_name || 'N/D',
            status: 'ACTIVE',
            code: extracted.pod_pdr || existingProp[comm]?.code || 'N/D', // Ensure code is updated/set
            power_committed: extracted.power_committed,
            annual_consumption: extracted.consumption * 6,
            raw_material_cost: extracted.detected_unit_price || 0.15,
            fixed_fee_year: extracted.detected_fixed_fee || 120,
            history: existingProp[comm]?.history || []
         };
         
         // If address was missing in DB but found in bill, update it
         if ((!existingProp.address || existingProp.address === 'Indirizzo Sconosciuto') && extracted.address) {
             existingProp.address = extracted.address;
             existingProp.city = extracted.city || existingProp.city;
         }
         
         db.save();
    }

    // 3. Conflict Detection (Only for Bills with POD/PDR)
    // Check if this POD/PDR exists on *another* customer
    if (extracted.document_type === 'BILL' && extracted.pod_pdr) {
        let conflictOwner: Customer | null = null;
        let conflictProperty: Property | null = null;

        for (const cust of allCustomers) {
            if (cust.id === targetCustomer.id) continue; // Skip self
            
            for (const prop of cust.properties) {
                const hasLuceMatch = prop.electricity?.code === extracted.pod_pdr;
                const hasGasMatch = prop.gas?.code === extracted.pod_pdr;
                
                if (hasLuceMatch || hasGasMatch) {
                    conflictOwner = cust;
                    conflictProperty = prop;
                    break;
                }
            }
            if (conflictOwner) break;
        }

        if (conflictOwner && conflictProperty) {
            return {
                status: 'CONFLICT_EXISTING_OWNER',
                extracted_data: extracted,
                conflict_owner: conflictOwner,
                conflict_property: conflictProperty
            };
        }
    }

    return { status: 'SUCCESS', extracted_data: extracted, customer_data: targetCustomer };
};

export const transfer_property = async (extracted: ExtractedBill, user: User, oldOwner: Customer, oldProperty: Property): Promise<{ newCustomer: Customer }> => {
    await delay(1000);
    const customers = db.getCollection('customers');
    
    // 1. Mark old property as OBSOLETE/SOLD
    const ownerIdx = customers.findIndex(c => c.id === oldOwner.id);
    if (ownerIdx !== -1) {
        const propIdx = customers[ownerIdx].properties.findIndex(p => p.id === oldProperty.id);
        if (propIdx !== -1) {
            customers[ownerIdx].properties[propIdx].status = 'SOLD';
        }
    }

    // 2. Get or Create new customer
    let newCustomer = customers.find(c => c.fiscal_code === extracted.fiscal_code && c.agency_id === user.agency_id);
    if (!newCustomer) {
        newCustomer = {
            id: `cust_${Date.now()}`,
            agency_id: user.agency_id,
            fiscal_code: extracted.fiscal_code || 'N/D',
            type: 'PERSON',
            first_name: extracted.client_name?.split(' ')[0] || 'Nuovo',
            last_name: extracted.client_name?.split(' ').slice(1).join(' ') || 'Cliente',
            properties: []
        };
        customers.push(newCustomer);
    }

    // 3. Add fresh property to new customer
    const newProp: Property = {
        id: `prop_${Date.now()}`,
        status: 'ACTIVE',
        address: extracted.address || oldProperty.address,
        city: extracted.city || oldProperty.city,
        is_resident: extracted.is_resident || true,
        [extracted.commodity === 'luce' ? 'electricity' : 'gas']: {
            supplier: extracted.supplier_name || 'N/D',
            status: 'ACTIVE',
            code: extracted.pod_pdr,
            power_committed: extracted.power_committed,
            annual_consumption: extracted.consumption * 6,
            raw_material_cost: extracted.detected_unit_price || 0.15,
            fixed_fee_year: extracted.detected_fixed_fee || 120,
            history: []
        }
    };
    newCustomer.properties.push(newProp);
    
    db.save();
    db.log(user.id, user.username, user.agency_id, 'PROPERTY_TRANSFER', `POD/PDR ${extracted.pod_pdr} trasferito da ${oldOwner.fiscal_code} a ${newCustomer.fiscal_code}`);
    
    return { newCustomer };
};

export const save_analyzed_bill = async (extracted: ExtractedBill, user: User, custId: string | null, propId: string | 'NEW') => {
    const customers = db.getCollection('customers');
    const customer = customers.find(c => c.id === custId && c.agency_id === user.agency_id);
    if (customer) {
        if (propId === 'NEW') {
            const newProp: Property = {
                id: `prop_${Date.now()}`,
                status: 'ACTIVE',
                address: extracted.address || 'Via Sconosciuta',
                city: extracted.city || 'Città',
                is_resident: extracted.is_resident || true,
                [extracted.commodity === 'luce' ? 'electricity' : 'gas']: {
                    supplier: extracted.supplier_name || 'N/D',
                    status: 'ACTIVE',
                    code: extracted.pod_pdr,
                    power_committed: extracted.power_committed,
                    annual_consumption: extracted.consumption * 6,
                    raw_material_cost: extracted.detected_unit_price || 0.15,
                    fixed_fee_year: extracted.detected_fixed_fee || 120,
                    history: []
                }
            };
            customer.properties.push(newProp);
        } else {
            const p = customer.properties.find(prop => prop.id === propId);
            if (p) {
                const comm = extracted.commodity === 'luce' ? 'electricity' : 'gas';
                p[comm] = {
                    supplier: extracted.supplier_name || 'N/D',
                    status: 'ACTIVE',
                    code: extracted.pod_pdr,
                    power_committed: extracted.power_committed,
                    annual_consumption: extracted.consumption * 6,
                    raw_material_cost: extracted.detected_unit_price || 0.15,
                    fixed_fee_year: extracted.detected_fixed_fee || 120,
                    history: []
                };
            }
        }
        db.save();
    }
    return { customer: customer! };
};

// --- TELEPHONY & CANVAS PERSISTENCE ---

export const list_operators = async (): Promise<TelephonyOperator[]> => {
    return db.getCollection('operators').filter(o => o.is_active);
};

export const list_canvas = async (user: User): Promise<CanvasOffer[]> => {
    return db.getCollection('canvas').filter(c => c.visible_to_agency_ids.includes(user.agency_id));
};

export const create_canvas = async (offer: Omit<CanvasOffer, 'id'>): Promise<void> => {
    db.getCollection('canvas').push({...offer, id: `cvs_${Date.now()}`});
    db.save();
};

export const create_operator = async (name: string, color: string) => { 
    const op: TelephonyOperator = { id: `op_${Date.now()}`, name, color_hex: color, is_active: true }; 
    db.getCollection('operators').push(op); 
    db.save(); 
    return op; 
};

export const cease_canvas_offer = async (id: string): Promise<void> => {
    const canvas = db.getCollection('canvas');
    const offer = canvas.find(c => c.id === id);
    if (offer) {
        offer.status = 'CEASED';
        db.save();
    }
};

export const update_canvas = async (offer: CanvasOffer) => {
    const canvas = db.getCollection('canvas');
    const idx = canvas.findIndex(c => c.id === offer.id);
    if (idx !== -1) {
        canvas[idx] = offer;
        db.save();
    }
};

export const delete_canvas = async (id: string) => {
    const canvas = db.getCollection('canvas');
    const idx = canvas.findIndex(c => c.id === id);
    if (idx !== -1) {
        canvas.splice(idx, 1);
        db.save();
    }
};

export const upload_canvas_file = async (file: File, user: User) => {
    const result = await GeminiService.extractCanvasFromDocument(file);
    return await save_imported_canvas(result, user);
};

export const upload_canvas_url = async (url: string, user: User) => {
    const result = await GeminiService.extractCanvasFromUrl(url);
    return await save_imported_canvas(result, user);
};

const save_imported_canvas = async (result: { operator_name: string, offers: Partial<CanvasOffer>[] }, user: User) => {
    const operators = db.getCollection('operators');
    let op = operators.find(o => o.name.toLowerCase().includes(result.operator_name.toLowerCase()));
    
    if (!op) {
        op = {
            id: `op_${Date.now()}_new`,
            name: result.operator_name,
            color_hex: '#333333',
            is_active: true
        };
        operators.push(op);
    }
    
    const canvas = db.getCollection('canvas');
    let count = 0;
    result.offers.forEach(o => {
        const newOffer: CanvasOffer = {
            ...o,
            id: `cvs_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            operator_id: op!.id,
            operator_name: op!.name,
            status: 'ACTIVE',
            visible_to_agency_ids: [user.agency_id],
            valid_until: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString()
        } as CanvasOffer;
        canvas.push(newOffer);
        count++;
    });
    
    db.save();
    return { count, operatorName: op.name };
}

export const process_telephony_bill = async (file: File, user: User) => {
    const extracted = await GeminiService.extractTelephonyBill(file);
    const customers = db.getCollection('customers');
    
    let customer = customers.find(c => c.fiscal_code === extracted.fiscal_code && c.agency_id === user.agency_id);
    
    if (!customer) {
        customer = {
            id: `cust_${Date.now()}`,
            agency_id: user.agency_id,
            fiscal_code: extracted.fiscal_code || 'N/D',
            type: 'PERSON',
            first_name: extracted.client_name?.split(' ')[0] || 'Nuovo',
            last_name: extracted.client_name?.split(' ').slice(1).join(' ') || 'Cliente',
            properties: []
        };
        customers.push(customer);
    }

    if (extracted.type === 'MOBILE' || extracted.type === 'FWA') { 
        if (!customer.mobile_lines) customer.mobile_lines = [];
        customer.mobile_lines.push({
            id: `sim_${Date.now()}`,
            number: extracted.number || 'N/D',
            operator: extracted.operator,
            type: extracted.type === 'FWA' ? 'FWA_SIM' : 'VOICE_DATA',
            monthly_cost: extracted.monthly_cost,
            data_limit_gb: 'UNLIMITED',
            contract_end_date: extracted.contract_end_date,
            migration_code: extracted.migration_code
        });
    } else {
        let prop = customer.properties.find(p => p.address.toLowerCase().includes((extracted.address||'').toLowerCase()));
        if (!prop) {
            prop = {
                id: `prop_${Date.now()}`,
                status: 'ACTIVE',
                address: extracted.address || 'Indirizzo Sconosciuto',
                city: extracted.city || 'Città',
                is_resident: true
            };
            customer.properties.push(prop);
        }
        prop.connectivity = {
            provider: extracted.operator,
            status: 'ACTIVE',
            technology: 'FTTH',
            monthly_cost: extracted.monthly_cost,
            contract_end_date: extracted.contract_end_date,
            migration_code: extracted.migration_code,
            phone_number: extracted.number
        };
    }

    db.save();
    return { customer, extracted };
};

export const findTelephonyOpportunities = async (user: User): Promise<TelephonyOpportunity[]> => {
    const customers = await get_customers(user.agency_id);
    const canvas = await list_canvas(user);
    const opportunities: TelephonyOpportunity[] = [];

    for (const c of customers) {
        if (c.mobile_lines) {
            for (const line of c.mobile_lines) {
                const better = canvas.find(o => 
                    o.status === 'ACTIVE' && 
                    o.type === 'MOBILE' && 
                    o.monthly_price < line.monthly_cost &&
                    o.operator_name !== line.operator
                );
                
                if (better) {
                    opportunities.push({
                        customer_id: c.id,
                        customer_name: c.first_name ? `${c.first_name} ${c.last_name}` : c.company_name!,
                        asset_type: 'MOBILE',
                        current_asset_info: `${line.operator} - ${line.number}`,
                        current_cost: line.monthly_cost,
                        penalty_monthly: line.penalty_monthly_cost || 0,
                        better_offer: better,
                        estimated_monthly_savings: line.monthly_cost - better.monthly_price
                    });
                }
            }
        }

        for (const p of c.properties) {
            if (p.connectivity && p.connectivity.status === 'ACTIVE') {
                 const better = canvas.find(o => 
                    o.status === 'ACTIVE' && 
                    o.type === 'FIXED' && 
                    o.monthly_price < p.connectivity!.monthly_cost &&
                    o.operator_name !== p.connectivity!.provider
                );

                if (better) {
                    opportunities.push({
                        customer_id: c.id,
                        customer_name: c.first_name ? `${c.first_name} ${c.last_name}` : c.company_name!,
                        asset_type: 'FIXED',
                        current_asset_info: `${p.connectivity.provider} - ${p.address}`,
                        current_cost: p.connectivity.monthly_cost,
                        penalty_monthly: p.connectivity.penalty_monthly_cost || 0,
                        better_offer: better,
                        estimated_monthly_savings: p.connectivity.monthly_cost - better.monthly_price
                    });
                }
            }
        }
    }
    return opportunities;
};

// --- REMAINING UTILS ---
export const compute_comparison = async (eb: ExtractedBill, cte: CTE, indices: IndicesResponse, mode: any): Promise<ComparisonResult> => {
    const basePrice = cte.f0;
    const currentPrice = eb.detected_unit_price || 0.20;
    const delta = (basePrice - currentPrice) * eb.consumption;
    return { cte_id: cte.id, current_cost_est: parseFloat((currentPrice * eb.consumption).toFixed(2)), new_cost_est: parseFloat((basePrice * eb.consumption).toFixed(2)), delta_value: parseFloat(delta.toFixed(2)), verdict: delta < 0 ? 'CONVIENE' : 'NON CONVIENE', reasons: delta < 0 ? ['Prezzo materia prima inferiore', 'Fissi competitivi'] : ['Tariffa attuale molto vantaggiosa'], notes: '', calculation_details: `P1: ${basePrice} vs P0: ${currentPrice}` };
};

export const fetch_indices = async (force: boolean = false): Promise<IndicesResponse> => {
  const getMonthsAgo = (m: number) => { const d = new Date(); d.setMonth(d.getMonth() - m); return d.toISOString().slice(0, 7); };
  return { updated_at: new Date().toISOString(), pun: Array.from({ length: 12 }, (_, i) => ({ month: getMonthsAgo(12 - i), value: 0.10 + Math.random() * 0.05 })), psv: Array.from({ length: 12 }, (_, i) => ({ month: getMonthsAgo(12 - i), value: 0.35 + Math.random() * 0.10 })) };
};

export const get_audit_logs = async (user: User): Promise<AuditLog[]> => {
    const logs = db.getCollection('auditLogs');
    if (user.agency_id === 'ag_mt') return logs;
    return logs.filter(l => l.agency_id === user.agency_id);
};

export const db_reset = async () => db.reset();
export const db_export = async (agencyId?: string) => db.export(agencyId);
export const db_import = async (json: string) => db.import(json);

export const findBestOpportunities = async (c: Customer): Promise<Opportunity[]> => {
    // Basic Stub for Energy Opportunities
    return [];
};
export const parseFiscalCode = (cf: string) => null;
export const update_property_details = async () => {};
export const generate_comparison_pdf = async (data: any) => ({ download_url: '#', pdf_file_id: '1' });

export const upload_cte_pdf = async (file: File, user: User) => { const extracted = await GeminiService.extractCteFromPdf(file); const newCte: CTE = { ...extracted, id: `cte_${Date.now()}`, uploaded_by_user_id: user.id, visible_to_agency_ids: [user.agency_id], uploaded_at: new Date().toISOString(), is_default: false } as CTE; db.getCollection('ctes').push(newCte); db.save(); return { cte_id: newCte.id, extracted_cte_json: newCte, created_new: true }; };
export const set_default_cte = async (segment: Segment, id: string, agencyId: string) => { db.getCollection('ctes').forEach(c => { if (c.segment === segment && c.visible_to_agency_ids.includes(agencyId)) c.is_default = (c.id === id); }); db.save(); return { ok: true }; };
export const update_cte = async (cte: CTE) => { const ctes = db.getCollection('ctes'); const idx = ctes.findIndex(c => c.id === cte.id); if(idx !== -1) { ctes[idx] = cte; db.save(); return { ok: true }; } return { ok: false }; };
export const delete_cte = async (id: string) => { const ctes = db.getCollection('ctes'); const idx = ctes.findIndex(c => c.id === id); if(idx !== -1) { ctes.splice(idx, 1); db.save(); } return { ok: true }; };
export const list_cte = async (user: User, segment?: Segment) => { let items = db.getCollection('ctes').filter(c => c.visible_to_agency_ids.includes(user.agency_id)); if (segment) items = items.filter(c => c.segment === segment); return { items }; };
