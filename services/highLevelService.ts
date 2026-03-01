import axios from 'axios';
import { Customer, Property } from '../types';
import * as API from './mockApi';

const API_BASE = '/api/highlevel';

export interface HighLevelContact {
  id?: string;
  email: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  address1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  companyName?: string;
  tags?: string[];
  customField?: Record<string, any>;
}

export const syncCustomerToHighLevel = async (customer: Customer): Promise<any> => {
  const contact: HighLevelContact = {
    email: customer.email || '',
    phone: customer.phone || '',
    firstName: customer.first_name || '',
    lastName: customer.last_name || '',
    name: customer.company_name || `${customer.first_name} ${customer.last_name}`,
    address1: customer.properties?.[0]?.address || '',
    city: customer.properties?.[0]?.city || '',
    postalCode: customer.properties?.[0]?.zip_code || '',
    tags: ['DealerAI_Sync', customer.type],
    companyName: customer.company_name
  };

  try {
    const response = await axios.post(`${API_BASE}/sync-contact`, contact);
    return response.data;
  } catch (error) {
    console.error('Failed to sync with HighLevel:', error);
    throw error;
  }
};

export const importContactsFromHighLevel = async (agencyId: string): Promise<{ success: number, failed: number, total: number }> => {
  console.log("Service: importContactsFromHighLevel called for agency", agencyId);
  try {
    console.log("Service: Fetching contacts from API...");
    const response = await axios.get(`${API_BASE}/contacts`);
    console.log("Service: API Response status:", response.status);
    console.log("Service: API Response data:", response.data);
    
    const contacts: HighLevelContact[] = response.data.contacts || [];
    console.log(`Service: Found ${contacts.length} contacts`);
    
    let success = 0;
    let failed = 0;

    const existingCustomers = await API.get_customers(agencyId);
    console.log(`Service: Found ${existingCustomers.length} existing customers locally`);

    for (const contact of contacts) {
      try {
        // Skip if no email (key identifier for now)
        if (!contact.email) continue;

        // Check if exists
        let customer = existingCustomers.find(c => c.email === contact.email);
        
        const isCompany = !!contact.companyName;
        
        if (customer) {
          // Update existing
          let changed = false;
          if (!customer.phone && contact.phone) { customer.phone = contact.phone; changed = true; }
          if (!customer.first_name && contact.firstName) { customer.first_name = contact.firstName; changed = true; }
          if (!customer.last_name && contact.lastName) { customer.last_name = contact.lastName; changed = true; }
          if (!customer.company_name && contact.companyName) { customer.company_name = contact.companyName; changed = true; }
          
          // Add property if address exists and not present
          if (contact.address1 && !customer.properties.some(p => p.address === contact.address1)) {
             const newProp: Property = {
                 id: `prop_${Date.now()}_imp`,
                 status: 'ACTIVE',
                 address: contact.address1,
                 city: contact.city || '',
                 zip_code: contact.postalCode,
                 is_resident: !isCompany
             };
             customer.properties.push(newProp);
             changed = true;
          }

          if (changed) await API.update_customer(customer);
        
        } else {
          // Create new
          const newCustomer: Customer = {
              id: `cust_${Date.now()}_ghl`,
              agency_id: agencyId,
              type: isCompany ? 'COMPANY' : 'PERSON',
              email: contact.email,
              phone: contact.phone,
              first_name: contact.firstName,
              last_name: contact.lastName,
              company_name: contact.companyName,
              fiscal_code: 'DA_VERIFICARE', // Placeholder
              properties: []
          };

          if (contact.address1) {
              newCustomer.properties.push({
                  id: `prop_${Date.now()}_imp`,
                  status: 'ACTIVE',
                  address: contact.address1,
                  city: contact.city || '',
                  zip_code: contact.postalCode,
                  is_resident: !isCompany
              });
          }
          
          await API.add_customer(newCustomer);
        }
        success++;
      } catch (e) {
        console.error("Import error for contact", contact, e);
        failed++;
      }
    }

    return { success, failed, total: contacts.length };

  } catch (error) {
    console.error('Failed to import from HighLevel:', error);
    throw error;
  }
};
