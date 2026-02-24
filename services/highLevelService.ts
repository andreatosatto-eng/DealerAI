import axios from 'axios';
import { Customer } from '../types';

const API_BASE = '/api/highlevel';

export interface HighLevelContact {
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
