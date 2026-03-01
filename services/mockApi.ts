
import { 
  Segment, IndicesResponse, CTE, IndexType, Commodity, ExtractedBill, ComparisonResult, 
  PdfGenerationResponse, OfferType, User, Agency, Customer, Property, Opportunity, 
  CommodityDetails, ConsumptionHistoryItem, BillAnalysisResponse, PropertyStatus, 
  CanvasOffer, TelephonyOpportunity, TelephonyOperator, ExtractedTelephonyBill, AuditLog, Branch, UserRole 
} from '../types';
import * as GeminiService from './geminiService';
import { MARKET_DB, getLast12Months } from './marketData';

// Firebase Imports
import { db, auth } from './firebase';
import { 
    collection, getDocs, doc, setDoc, addDoc, updateDoc, 
    query, where, deleteDoc, orderBy, limit, getDoc, Timestamp 
} from 'firebase/firestore';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';

// --- UTILS ---
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to convert Firestore dates back to ISO strings if needed
const mapDoc = <T>(doc: any): T => {
    return { id: doc.id, ...doc.data() } as T;
};

// CRITICAL FIX: Firestore throws if a field is 'undefined'. 
// JSON.stringify(obj) automatically removes keys with undefined values.
const sanitizeForFirestore = (obj: any): any => {
    return JSON.parse(JSON.stringify(obj));
};

// Helper to check for permission errors
const isPermissionError = (err: any) => {
    return err?.code === 'permission-denied' || err?.message?.includes('Missing or insufficient permissions');
};

// --- AUTHENTICATION ---
export const login = async (username: string, password?: string): Promise<User | null> => {
    try {
        const email = username.includes('@') ? username : `${username}@mt-dealer.demo`;
        const pwd = password || 'password';
        
        let userCredential;

        try {
            userCredential = await signInWithEmailAndPassword(auth, email, pwd);
        } catch (authError: any) {
            // Fallback for Demo environment / First Init
            if (
                (authError.code === 'auth/user-not-found' || authError.code === 'auth/invalid-credential') && 
                username === 'admin'
            ) {
                 userCredential = await createUserWithEmailAndPassword(auth, email, pwd);
                 // Initialize Super Admin (First Time)
                 const adminId = userCredential.user.uid;
                 const agencyId = 'ag_mt'; // Hardcoded MT Technology ID

                 // Ensure MT Agency Exists
                 await setDoc(doc(db, 'agencies', agencyId), { 
                    id: agencyId, 
                    name: 'MT Technology HQ', 
                    vat_number: 'IT12345678901', 
                    created_at: new Date().toISOString(),
                    branches: [{ id: 'br_hq', name: 'Sede Centrale', city: 'Milano', is_main: true }]
                 }, { merge: true });

                 // Create Super Admin User
                 await setDoc(doc(db, 'users', adminId), {
                    id: adminId,
                    username: email,
                    full_name: 'Super Admin',
                    agency_id: agencyId,
                    role: 'SUPER_ADMIN',
                    is_active: true
                 });
            } else {
                throw authError;
            }
        }

        const firebaseUser = userCredential.user;
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        
        try {
            const userDoc = await getDoc(userDocRef);
            if (userDoc.exists()) {
                const userData = userDoc.data() as User;
                
                // BACKWARD COMPATIBILITY FIX:
                if (userData.agency_id === 'ag_mt' && userData.role === 'ADMIN' as any) {
                    userData.role = 'SUPER_ADMIN';
                }
                if (userData.agency_id !== 'ag_mt' && userData.role === 'ADMIN' as any) {
                    userData.role = 'AGENCY_ADMIN';
                }

                if (!userData.is_active) {
                    throw new Error("Utente disabilitato. Contattare l'amministratore.");
                }
                
                log_audit(userData.id, userData.username, userData.agency_id, 'LOGIN', 'Accesso al portale eseguito.');
                return userData;
            } else {
                // If auth exists but no user doc (shouldn't happen in strict mode, but fallback for dev)
                 return {
                    id: firebaseUser.uid,
                    username: email,
                    full_name: 'Utente non profilato',
                    agency_id: 'unknown',
                    role: 'AGENT',
                    is_active: true
                };
            }
        } catch (dbError: any) {
            console.error("Errore lettura DB:", dbError);
            if (isPermissionError(dbError)) {
                // Fallback for when rules block read but auth passed (should fix rules, but prevents crash)
                return {
                    id: firebaseUser.uid,
                    username: email,
                    full_name: 'Utente Limitato',
                    agency_id: 'unknown',
                    role: 'AGENT',
                    is_active: true
                };
            }
            throw dbError;
        }

    } catch (e) {
        console.error("Login failed", e);
        return null;
    }
}

// --- LOGGING ---
const log_audit = async (userId: string, username: string, agencyId: string, action: string, details: string) => {
    try {
        const logsRef = collection(db, 'auditLogs');
        await addDoc(logsRef, {
            timestamp: new Date().toISOString(),
            user_id: userId,
            username,
            agency_id: agencyId,
            action,
            details,
            created_at_ts: Timestamp.now()
        });
    } catch (e) {
        console.warn("Audit log failed", e);
    }
};

// --- SCOPED MANAGEMENT (HIERARCHY) ---

export const list_agencies = async (user: User): Promise<Agency[]> => {
    try {
        const agenciesRef = collection(db, 'agencies');
        let q;
        
        if (user.role === 'SUPER_ADMIN') {
             // Super Admin sees all
             q = query(agenciesRef);
        } else {
             // Agency Admin / Agent sees only their own agency
             q = query(agenciesRef, where('id', '==', user.agency_id));
        }
            
        const snapshot = await getDocs(q);
        const agencies = snapshot.docs.map(d => mapDoc<Agency>(d));
        
        if (agencies.length === 0 && user.agency_id) {
             // Fallback if agency doc is missing but ID exists on user
             return [{ 
                 id: user.agency_id, 
                 name: 'Agenzia Default', 
                 vat_number: 'N/D', 
                 created_at: new Date().toISOString(),
                 branches: [{ id: 'br_def', name: 'Sede Unica', is_main: true }]
             }];
        }
        return agencies;
    } catch (e) {
        console.warn("list_agencies failed", e);
        return [];
    }
};

export const list_users = async (user: User): Promise<User[]> => {
    try {
        const usersRef = collection(db, 'users');
        let q;

        if (user.role === 'SUPER_ADMIN') {
            q = query(usersRef);
        } else {
            // Agency Admins and Agents see colleagues
            q = query(usersRef, where('agency_id', '==', user.agency_id));
        }
        
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => mapDoc<User>(d));
    } catch (e) {
        console.warn("list_users failed", e);
        return [user];
    }
};

export const create_agency = async (agency: Omit<Agency, 'id' | 'created_at' | 'branches'>): Promise<Agency> => {
    const newId = `ag_${Date.now()}`;
    const mainBranch: Branch = {
        id: `br_${Date.now()}_main`,
        name: 'Sede Legale',
        city: 'Sede Principale',
        is_main: true
    };

    const newAgency: Agency = { 
        ...agency, 
        id: newId, 
        created_at: new Date().toISOString(),
        branches: [mainBranch]
    };

    try {
        await setDoc(doc(db, 'agencies', newId), sanitizeForFirestore(newAgency));
    } catch(e) { console.warn("Create Agency DB failed", e); }
    return newAgency;
};

export const add_branch_to_agency = async (agencyId: string, branchName: string, city: string): Promise<void> => {
    try {
        const agRef = doc(db, 'agencies', agencyId);
        const agSnap = await getDoc(agRef);
        if(agSnap.exists()) {
            const agency = agSnap.data() as Agency;
            const newBranch: Branch = {
                id: `br_${Date.now()}`,
                name: branchName,
                city: city,
                is_main: false
            };
            const branches = agency.branches || [];
            branches.push(newBranch);
            await updateDoc(agRef, { branches: sanitizeForFirestore(branches) });
        }
    } catch(e) { console.warn("Add Branch failed", e); }
};

export const create_system_user = async (userToCreate: Omit<User, 'id'>, currentUser: User): Promise<User> => {
    // --- RBAC CORE LOGIC ---
    
    // 1. Agents cannot create users
    if (currentUser.role === 'AGENT') {
        throw new Error("Permesso negato: Gli agenti non possono creare utenti.");
    }

    let finalAgencyId = userToCreate.agency_id;
    let finalRole = userToCreate.role;

    // 2. Agency Admin Constraints
    if (currentUser.role === 'AGENCY_ADMIN') {
        // Must create user in own agency
        if (finalAgencyId !== currentUser.agency_id) {
            finalAgencyId = currentUser.agency_id; // Enforce
        }
        
        // Cannot create SUPER_ADMIN
        if (finalRole === 'SUPER_ADMIN') {
            throw new Error("Security Violation: Un Admin di Agenzia non può nominare Super Admin.");
        }
    }

    // 3. Super Admin Constraints
    if (currentUser.role === 'SUPER_ADMIN') {
        // Super Admin can do anything, just ensure data integrity
        if (!finalAgencyId) throw new Error("Agency ID mancante per il nuovo utente");
    }

    const newId = `u_${Date.now()}`;
    const newUser: User = { 
        ...userToCreate, 
        id: newId,
        agency_id: finalAgencyId,
        role: finalRole
    };
    
    // In production: Create in Auth via Admin SDK. Here: Mock DB.
    try {
        await setDoc(doc(db, 'users', newId), sanitizeForFirestore(newUser));
        log_audit(currentUser.id, currentUser.username, currentUser.agency_id, 'USER_CREATE', `Creato utente ${newUser.role}: ${newUser.username}`);
    } catch(e) { console.warn("Create User DB failed", e); }
    
    return newUser;
};

export const toggle_user_status = async (userId: string, currentUser: User): Promise<void> => {
    try {
        const userRef = doc(db, 'users', userId);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
            const targetUser = snap.data() as User;
            
            // RBAC Checks
            if (currentUser.role === 'AGENT') return;
            
            if (currentUser.role === 'AGENCY_ADMIN') {
                if (targetUser.agency_id !== currentUser.agency_id) return; // Cannot touch other agencies
                if (targetUser.role === 'SUPER_ADMIN') return; // Cannot touch Super Admins
            }

            await updateDoc(userRef, { is_active: !targetUser.is_active });
            log_audit(currentUser.id, currentUser.username, currentUser.agency_id, 'USER_TOGGLE', `${targetUser.is_active ? 'Disabilitato' : 'Abilitato'} utente ${targetUser.username}`);
        }
    } catch(e) { console.warn("Toggle User failed", e); }
};

// --- CRM & DATABASE ---
export const get_customers = async (agency_id: string): Promise<Customer[]> => {
    try {
        const customersRef = collection(db, 'customers');
        const q = query(customersRef, where('agency_id', '==', agency_id));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => mapDoc<Customer>(d));
    } catch (e) {
        console.warn("get_customers failed", e);
        return [];
    }
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
    try {
        const custRef = doc(db, 'customers', customer.id);
        // SANITIZE: Remove undefined values which break Firestore
        const cleanCustomer = sanitizeForFirestore(customer);
        // Use merge: true to prevent overwriting/deleting fields that might be missing in the frontend object (e.g. family_id if undefined)
        await setDoc(custRef, cleanCustomer, { merge: true }); 
    } catch(e) { 
        console.error("Update customer failed", e); 
        throw e;
    }
    return customer;
}

export const add_customer = async (customer: Customer): Promise<Customer> => {
    try {
        const custRef = doc(db, 'customers', customer.id);
        // SANITIZE: Remove undefined values which break Firestore
        const cleanCustomer = sanitizeForFirestore(customer);
        await setDoc(custRef, cleanCustomer);
    } catch(e) { 
        console.error("Add customer failed", e); 
        throw e;
    }
    return customer;
}

// DELETE CUSTOMER
export const delete_customer = async (customerId: string): Promise<void> => {
    try {
        await deleteDoc(doc(db, 'customers', customerId));
    } catch (e) {
        console.error("Delete customer failed", e);
        throw e;
    }
};

// DELETE PROPERTY
export const delete_property = async (customerId: string, propertyId: string): Promise<void> => {
    try {
        const custRef = doc(db, 'customers', customerId);
        const snap = await getDoc(custRef);
        if (snap.exists()) {
            const customer = snap.data() as Customer;
            const updatedProperties = customer.properties.filter(p => p.id !== propertyId);
            await updateDoc(custRef, { properties: updatedProperties });
        }
    } catch (e) {
        console.error("Delete property failed", e);
        throw e;
    }
};

// LINK TO FAMILY (Group, don't merge)
export const link_to_family = async (headId: string, memberId: string): Promise<void> => {
    try {
        const headRef = doc(db, 'customers', headId);
        const memberRef = doc(db, 'customers', memberId);
        
        const [headSnap, memberSnap] = await Promise.all([getDoc(headRef), getDoc(memberRef)]);
        
        if (!headSnap.exists()) throw new Error("Capofamiglia non trovato");
        if (!memberSnap.exists()) throw new Error("Membro non trovato");
        
        const headData = headSnap.data() as Customer;
        
        // Use existing family_id if present, otherwise start a new family with Head's ID
        const familyId = headData.family_id || headId; 

        // 1. Update Head (ensure field exists via setDoc merge)
        await setDoc(headRef, { 
            family_id: familyId,
            is_family_head: true 
        }, { merge: true });

        // 2. Link Member to the same family ID
        await setDoc(memberRef, { 
            family_id: familyId,
            is_family_head: false 
        }, { merge: true });

    } catch (e) {
        console.error("Family Link failed", e);
        throw e;
    }
};

// MERGE CUSTOMERS (Deduplicate)
export const merge_customers = async (targetId: string, sourceId: string): Promise<void> => {
    try {
        const targetRef = doc(db, 'customers', targetId);
        const sourceRef = doc(db, 'customers', sourceId);
        
        const [targetSnap, sourceSnap] = await Promise.all([getDoc(targetRef), getDoc(sourceRef)]);
        
        if (!targetSnap.exists() || !sourceSnap.exists()) throw new Error("Customers not found");
        
        const target = targetSnap.data() as Customer;
        const source = sourceSnap.data() as Customer;

        // 1. Merge Properties
        const mergedProperties = [...target.properties, ...source.properties];
        
        // 2. Merge Mobile Lines
        const mergedMobile = [...(target.mobile_lines || []), ...(source.mobile_lines || [])];
        
        // 3. Merge Vehicles
        const mergedVehicles = [...(target.vehicles || []), ...(source.vehicles || [])];

        // 4. Update Target with Source data if Target is missing it
        const updatedTarget = {
            ...target,
            email: target.email || source.email,
            phone: target.phone || source.phone,
            birth_date: target.birth_date || source.birth_date,
            birth_place: target.birth_place || source.birth_place,
            properties: mergedProperties,
            mobile_lines: mergedMobile,
            vehicles: mergedVehicles
        };

        // 5. Save Target and Delete Source
        await setDoc(targetRef, sanitizeForFirestore(updatedTarget));
        await deleteDoc(sourceRef);

    } catch (e) {
        console.error("Merge failed", e);
        throw e;
    }
};

// --- ANALYSIS TOOLS ---
export const analyze_bill = async (files: File | File[], user: User): Promise<BillAnalysisResponse> => {
    const fileArray = Array.isArray(files) ? files : [files];
    const extracted = await GeminiService.extractBillData(fileArray);
    
    // Normalize CF to UpperCase and remove whitespace
    const safeCF = extracted.fiscal_code ? extracted.fiscal_code.replace(/[^A-Z0-9]/gi, '').toUpperCase() : 'ND';
    extracted.fiscal_code = safeCF;

    // Get all customers for this agency to check duplicates/conflicts
    const allCustomers = await get_customers(user.agency_id);
    
    // 1. Check Duplicate by Fiscal Code
    let targetCustomer = allCustomers.find(c => c.fiscal_code === safeCF);
    
    // STRICT DETERMINATION OF CUSTOMER TYPE
    // Priority: 
    // 1. Format of CF (16 chars = Person, 11 digits = Company) -> Overrides everything.
    // 2. AI suggestion.
    let determinedType: 'PERSON' | 'COMPANY' = 'PERSON';
    const isPersonCF = /^[A-Z]{6}[0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/i.test(safeCF);
    const isCompanyPIVA = /^[0-9]{11}$/.test(safeCF);

    if (isPersonCF) {
        determinedType = 'PERSON';
    } else if (isCompanyPIVA) {
        determinedType = 'COMPANY';
    } else {
        // Fallback to AI heuristics if CF format is weird or foreign
        const aiSaysCompany = extracted.customer_type === 'COMPANY' || 
                              (extracted.client_name?.toUpperCase().includes(' S.R.L.') || extracted.client_name?.toUpperCase().includes(' SPA'));
        determinedType = aiSaysCompany ? 'COMPANY' : 'PERSON';
    }

    if (targetCustomer) {
        // Update sparse info AND ensure type/name correctness
        let dirty = false;
        
        if (determinedType === 'PERSON') {
             // Force fix type if it was wrong
             if (targetCustomer.type !== 'PERSON') {
                 targetCustomer.type = 'PERSON';
                 dirty = true;
             }
             if (!targetCustomer.first_name || targetCustomer.first_name === 'Nuovo') {
                 targetCustomer.first_name = extracted.client_name?.split(' ')[0];
                 targetCustomer.last_name = extracted.client_name?.split(' ').slice(1).join(' ');
                 dirty = true;
             }
        } else {
             if (targetCustomer.type !== 'COMPANY') {
                 targetCustomer.type = 'COMPANY';
                 dirty = true;
             }
             if (!targetCustomer.company_name || targetCustomer.company_name === 'Nuovo Cliente') {
                 targetCustomer.company_name = extracted.client_name;
                 dirty = true;
             }
        }

        if (dirty) await update_customer(targetCustomer);
    } else {
        // Create New Stub
        targetCustomer = {
            id: `cust_${Date.now()}`,
            agency_id: user.agency_id,
            fiscal_code: safeCF,
            type: determinedType,
            company_name: determinedType === 'COMPANY' ? extracted.client_name : undefined,
            first_name: determinedType === 'PERSON' ? (extracted.client_name?.split(' ')[0] || 'Nuovo') : undefined,
            last_name: determinedType === 'PERSON' ? (extracted.client_name?.split(' ').slice(1).join(' ') || 'Cliente') : undefined,
            properties: []
        };
        await add_customer(targetCustomer);
    }

    // 2. Property Logic
    let existingProp: Property | undefined;
    if (extracted.pod_pdr) {
        existingProp = targetCustomer.properties.find(p => 
            p.electricity?.code === extracted.pod_pdr || 
            p.gas?.code === extracted.pod_pdr
        );
    }
    if (!existingProp && extracted.address) {
        const normalizedExtractedAddr = extracted.address.toLowerCase().replace(/\s/g, '');
        existingProp = targetCustomer.properties.find(p => 
            p.address.toLowerCase().replace(/\s/g, '').includes(normalizedExtractedAddr) ||
            normalizedExtractedAddr.includes(p.address.toLowerCase().replace(/\s/g, ''))
        );
    }

    if (!existingProp) {
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
        await update_customer(targetCustomer);

    } else if (extracted.document_type === 'BILL') {
         const comm = extracted.commodity === 'luce' ? 'electricity' : 'gas';
         existingProp[comm] = {
            supplier: extracted.supplier_name || 'N/D',
            status: 'ACTIVE',
            code: extracted.pod_pdr || existingProp[comm]?.code || 'N/D',
            power_committed: extracted.power_committed,
            annual_consumption: extracted.consumption * 6,
            raw_material_cost: extracted.detected_unit_price || 0.15,
            fixed_fee_year: extracted.detected_fixed_fee || 120,
            history: existingProp[comm]?.history || []
         };
         if ((!existingProp.address || existingProp.address === 'Indirizzo Sconosciuto') && extracted.address) {
             existingProp.address = extracted.address;
             existingProp.city = extracted.city || existingProp.city;
         }
         await update_customer(targetCustomer);
    }

    // 3. Conflict Detection
    if (extracted.document_type === 'BILL' && extracted.pod_pdr) {
        let conflictOwner: Customer | null = null;
        let conflictProperty: Property | null = null;

        for (const cust of allCustomers) {
            if (cust.id === targetCustomer.id) continue;
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
    // 1. Update Old Owner
    const propToUpdate = oldOwner.properties.find(p => p.id === oldProperty.id);
    if (propToUpdate) propToUpdate.status = 'SOLD';
    await update_customer(oldOwner);

    // 2. Get/Create New
    let newCustomer: Customer | undefined;
    const allCustomers = await get_customers(user.agency_id);
    newCustomer = allCustomers.find(c => c.fiscal_code === extracted.fiscal_code);

    if (!newCustomer) {
        // Recalculate type just in case
        const safeCF = extracted.fiscal_code || 'N/D';
        const isPersonCF = /^[A-Z]{6}[0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/i.test(safeCF);
        const determinedType = isPersonCF ? 'PERSON' : 'COMPANY';

        newCustomer = {
            id: `cust_${Date.now()}`,
            agency_id: user.agency_id,
            fiscal_code: safeCF,
            type: determinedType,
            first_name: determinedType === 'PERSON' ? (extracted.client_name?.split(' ')[0] || 'Nuovo') : undefined,
            last_name: determinedType === 'PERSON' ? (extracted.client_name?.split(' ').slice(1).join(' ') || 'Cliente') : undefined,
            company_name: determinedType === 'COMPANY' ? extracted.client_name : undefined,
            properties: []
        };
        await add_customer(newCustomer);
    }

    // 3. Add Property
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
    await update_customer(newCustomer);
    
    log_audit(user.id, user.username, user.agency_id, 'PROPERTY_TRANSFER', `POD/PDR ${extracted.pod_pdr} trasferito a ${newCustomer.fiscal_code}`);
    return { newCustomer };
};

export const save_analyzed_bill = async (extracted: ExtractedBill, user: User, custId: string | null, propId: string | 'NEW') => {
    try {
        const custRef = doc(db, 'customers', custId!);
        const snap = await getDoc(custRef);
        if (!snap.exists()) throw new Error("Customer not found");
        const customer = snap.data() as Customer;

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
        await update_customer(customer);
        return { customer };
    } catch(e) {
        throw e;
    }
};

// --- TELEPHONY & CANVAS PERSISTENCE ---

export const list_operators = async (): Promise<TelephonyOperator[]> => {
    try {
        const ref = collection(db, 'operators');
        const q = query(ref, where('is_active', '==', true));
        const snap = await getDocs(q);
        return snap.docs.map(d => mapDoc<TelephonyOperator>(d));
    } catch (e) {
        return [];
    }
};

export const list_canvas = async (user: User): Promise<CanvasOffer[]> => {
    try {
        const ref = collection(db, 'canvas');
        const q = query(ref, where('visible_to_agency_ids', 'array-contains', user.agency_id));
        const snap = await getDocs(q);
        return snap.docs.map(d => mapDoc<CanvasOffer>(d));
    } catch (e) {
        return [];
    }
};

export const create_canvas = async (offer: Omit<CanvasOffer, 'id'>): Promise<void> => {
    const newId = `cvs_${Date.now()}`;
    try {
        await setDoc(doc(db, 'canvas', newId), sanitizeForFirestore({ ...offer, id: newId }));
    } catch(e) { console.warn("Create canvas failed", e); }
};

export const create_operator = async (name: string, color: string) => { 
    const newId = `op_${Date.now()}`;
    const op: TelephonyOperator = { id: newId, name, color_hex: color, is_active: true };
    try {
        await setDoc(doc(db, 'operators', newId), sanitizeForFirestore(op));
    } catch(e) { console.warn("Create operator failed", e); }
    return op; 
};

export const cease_canvas_offer = async (id: string): Promise<void> => {
    try {
        await updateDoc(doc(db, 'canvas', id), { status: 'CEASED' });
    } catch(e) { console.warn("Cease canvas failed", e); }
};

export const update_canvas = async (offer: CanvasOffer) => {
    try {
        await setDoc(doc(db, 'canvas', offer.id), sanitizeForFirestore(offer));
    } catch(e) { console.warn("Update canvas failed", e); }
};

export const delete_canvas = async (id: string) => {
    try {
        await deleteDoc(doc(db, 'canvas', id));
    } catch(e) { console.warn("Delete canvas failed", e); }
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
    // Check Operator
    const ops = await list_operators();
    let op = ops.find(o => o.name.toLowerCase().includes(result.operator_name.toLowerCase()));
    
    if (!op) {
        op = await create_operator(result.operator_name, '#333333');
    }
    
    let count = 0;
    for (const o of result.offers) {
        const newOffer: CanvasOffer = {
            ...o,
            id: `cvs_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            operator_id: op.id,
            operator_name: op.name,
            status: 'ACTIVE',
            visible_to_agency_ids: [user.agency_id],
            valid_until: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString()
        } as CanvasOffer;
        await create_canvas(newOffer);
        count++;
    }
    
    return { count, operatorName: op.name };
}

export const process_telephony_bill = async (file: File, user: User) => {
    const extracted = await GeminiService.extractTelephonyBill(file);
    const customers = await get_customers(user.agency_id);
    let customer = customers.find(c => c.fiscal_code === extracted.fiscal_code);
    
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
        await add_customer(customer);
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

    await update_customer(customer);
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

// --- MARKETS & INDICES ---

export const fetch_indices = async (force: boolean = false): Promise<IndicesResponse> => {
  const marketRef = doc(db, 'market', 'current');
  let indices: IndicesResponse | undefined;

  // 1. Try Cache if not forced
  if (!force) {
    try {
        const snap = await getDoc(marketRef);
        if (snap.exists()) {
           return snap.data() as IndicesResponse;
        }
    } catch (e) {
        console.warn("Read indices cache failed", e);
    }
  }

  // 2. Try Live Fetch via Gemini Search (Web Scraping Simulation)
  try {
      if (force) {
        const liveData = await GeminiService.retrieveMarketData();
        // Simple validation to ensure we got something back
        if (liveData.pun.length > 0) {
            await setDoc(marketRef, liveData);
            return liveData;
        }
      }
  } catch (e) {
      console.warn("Live fetch failed, falling back to static DB", e);
  }

  // 3. Fallback to Static Data (Offline Mode)
  const pun = [];
  const psv = [];
  const months = getLast12Months();

  for (const m of months) {
      const data = MARKET_DB[m];
      if (data) {
          pun.push({ 
              month: m, 
              value: data.pun_avg,
              f1: data.pun_f1,
              f2: data.pun_f2,
              f3: data.pun_f3,
              f23: data.pun_f23 
          });
          psv.push({ month: m, value: data.psv });
      }
  }

  indices = {
      updated_at: new Date().toISOString(),
      pun,
      psv
  };

  // Attempt to save fallback data to cache
  try {
     await setDoc(marketRef, indices);
  } catch(e) {
     console.warn("Could not save fallback indices", e);
  }
  
  return indices;
};

// --- CTE ---

export const upload_cte_pdf = async (file: File, user: User) => { 
    const extracted = await GeminiService.extractCteFromPdf(file);
    const newId = `cte_${Date.now()}`;
    const newCte: CTE = { 
        ...extracted, 
        id: newId, 
        uploaded_by_user_id: user.id, 
        visible_to_agency_ids: [user.agency_id], 
        uploaded_at: new Date().toISOString(), 
        is_default: false 
    } as CTE; 
    
    try {
        await setDoc(doc(db, 'ctes', newId), sanitizeForFirestore(newCte));
    } catch(e) { console.warn("Upload CTE DB failed", e); }
    return { cte_id: newCte.id, extracted_cte_json: newCte, created_new: true }; 
};

export const list_cte = async (user: User, segment?: Segment) => { 
    try {
        const ref = collection(db, 'ctes');
        const q = query(ref, where('visible_to_agency_ids', 'array-contains', user.agency_id));
        const snap = await getDocs(q);
        let items = snap.docs.map(d => mapDoc<CTE>(d));
        if (segment) items = items.filter(c => c.segment === segment); 
        return { items }; 
    } catch(e) {
        return { items: [] };
    }
};

export const set_default_cte = async (segment: Segment, id: string, agencyId: string) => { 
    try {
        const ref = collection(db, 'ctes');
        const q = query(ref, where('segment', '==', segment), where('visible_to_agency_ids', 'array-contains', agencyId));
        const snap = await getDocs(q);
        
        const batchPromises = snap.docs.map(d => {
            return updateDoc(d.ref, { is_default: d.id === id });
        });
        
        await Promise.all(batchPromises);
    } catch(e) { console.warn("Set default CTE failed", e); }
    return { ok: true }; 
};

export const update_cte = async (cte: CTE) => { 
    try {
        await setDoc(doc(db, 'ctes', cte.id), sanitizeForFirestore(cte));
    } catch(e) { console.warn("Update CTE failed", e); }
    return { ok: true }; 
};

export const delete_cte = async (id: string) => { 
    try {
        await deleteDoc(doc(db, 'ctes', id));
    } catch(e) { console.warn("Delete CTE failed", e); }
    return { ok: true }; 
};

// --- UTILS & AUDIT ---

export const get_audit_logs = async (user: User): Promise<AuditLog[]> => {
    try {
        const logsRef = collection(db, 'auditLogs');
        let q;
        if (user.role === 'SUPER_ADMIN') {
             q = query(logsRef, orderBy('created_at_ts', 'desc'), limit(100));
        } else {
             q = query(logsRef, where('agency_id', '==', user.agency_id), orderBy('created_at_ts', 'desc'), limit(100));
        }
        const snap = await getDocs(q);
        return snap.docs.map(d => mapDoc<AuditLog>(d));
    } catch(e) {
        return [];
    }
};

export const compute_comparison = async (eb: ExtractedBill, cte: CTE, indices: IndicesResponse, mode: any): Promise<ComparisonResult> => {
    const basePrice = cte.f0;
    const currentPrice = eb.detected_unit_price || 0.20;
    const delta = (basePrice - currentPrice) * eb.consumption;
    return { cte_id: cte.id, current_cost_est: parseFloat((currentPrice * eb.consumption).toFixed(2)), new_cost_est: parseFloat((basePrice * eb.consumption).toFixed(2)), delta_value: parseFloat(delta.toFixed(2)), verdict: delta < 0 ? 'CONVIENE' : 'NON CONVIENE', reasons: delta < 0 ? ['Prezzo materia prima inferiore', 'Fissi competitivi'] : ['Tariffa attuale molto vantaggiosa'], notes: '', calculation_details: `P1: ${basePrice} vs P0: ${currentPrice}` };
};

export const db_reset = async () => { console.warn("DB Reset not supported in Firebase mode safely via UI"); };
export const db_export = async (agencyId?: string) => {
    // Basic export implementation
    const customers = await get_customers(agencyId || 'ag_mt');
    return JSON.stringify({ customers }, null, 2);
};
export const db_import = async (json: string) => { return false; };

export const findBestOpportunities = async (c: Customer): Promise<Opportunity[]> => {
    return [];
};
export const parseFiscalCode = (cf: string) => null;
export const update_property_details = async () => {};
export const generate_comparison_pdf = async (data: any) => ({ download_url: '#', pdf_file_id: '1' });
