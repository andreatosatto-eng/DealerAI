
import { GoogleGenAI, Type } from "@google/genai";
import { CTE, Segment, Commodity, OfferType, IndexType, ExtractedBill, CanvasOffer, ExtractedTelephonyBill } from "../types";

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- Helpers ---
const fileToPart = (file: File): Promise<{ inlineData: { data: string; mimeType: string } }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve({
        inlineData: {
          data: base64String,
          mimeType: file.type,
        },
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const urlToPart = async (url: string): Promise<{ inlineData: { data: string; mimeType: string } }> => {
  try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch URL");
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = (reader.result as string).split(',')[1];
          resolve({
            inlineData: {
              data: base64String,
              mimeType: blob.type || 'application/pdf',
            },
          });
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
  } catch (e) {
      throw new Error("Impossibile scaricare il file dall'URL fornito (Possibile blocco CORS o Errore Rete).");
  }
};

const cleanJson = (text: string | undefined): string => {
    if (!text) return "";
    return text.replace(/```json/g, '').replace(/```/g, '').trim();
};

// --- CTE Extraction ---
export const extractCteFromPdf = async (file: File): Promise<Partial<CTE>> => {
  const model = "gemini-3-flash-preview";
  const filePart = await fileToPart(file);

  const prompt = `
    Analyze this energy contract document (CTE - Condizioni Tecnico Economiche).
    Extract the following details into a JSON structure.
    If specific values (like F2, F3) are missing, use the F0 value or F1 value.
    
    Fields to extract:
    - supplier_name: Name of the energy provider.
    - offer_name: Commercial name of the offer.
    - offer_code: A unique code if present, otherwise generate one from name + date.
    - commodity: 'luce' or 'gas'.
    - offer_type: 'FIXED' or 'VARIABLE'.
    - index_type: If variable, is it 'PUN' or 'PSV'?
    - f0, f1, f2, f3: Price values. For Gas, use f0 for the Smc price.
    - spread_unit: '€/kWh' or '€/Smc'.
    - fixed_fee_value: The annual fixed cost (PCV/CCV) in €/year.
    - valid_until: The expiration date of the offer conditions (YYYY-MM-DD).
  `;

  const response = await ai.models.generateContent({
    model: model,
    contents: {
      parts: [filePart, { text: prompt }]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          supplier_name: { type: Type.STRING },
          offer_name: { type: Type.STRING },
          offer_code: { type: Type.STRING },
          commodity: { type: Type.STRING, enum: ["luce", "gas"] },
          offer_type: { type: Type.STRING, enum: ["FIXED", "VARIABLE"] },
          index_type: { type: Type.STRING, enum: ["PUN", "PSV"], nullable: true },
          f0: { type: Type.NUMBER },
          f1: { type: Type.NUMBER },
          f2: { type: Type.NUMBER },
          f3: { type: Type.NUMBER },
          spread_unit: { type: Type.STRING },
          fixed_fee_value: { type: Type.NUMBER },
          valid_until: { type: Type.STRING }
        }
      }
    }
  });

  const text = cleanJson(response.text);
  if (!text) throw new Error("No data returned from Gemini");
  
  const data = JSON.parse(text);

  return {
    ...data,
    segment: data.commodity === 'luce' ? Segment.CONSUMER_LUCE : Segment.CONSUMER_GAS,
    uploaded_at: new Date().toISOString(),
    visible_to_agency_ids: [],
    is_default: false,
    other_variable_cost: 0,
    fixed_fee_unit: '€/anno'
  };
};

// --- Bill & ID Card Extraction ---
export const extractBillData = async (file: File): Promise<ExtractedBill & { document_type: 'BILL' | 'ID_CARD' }> => {
  const model = "gemini-3-flash-preview";
  const filePart = await fileToPart(file);

  const prompt = `
    Analyze this document. It could be a Utility Bill OR an Identity Card (Carta d'Identità).
    
    1. Determine document_type: 'BILL' or 'ID_CARD'.
    2. Extract Fiscal Code (Codice Fiscale) accurately. It is crucial.
    3. Extract Client Name (First + Last Name or Company Name).
    4. Extract Address. 
       - If ID CARD: This is the residence address.
       - If BILL: This is the supply address.
    
    IF BILL:
    - Extract POD/PDR, Commodity, Supplier, Consumption, Costs.
    
    IF ID CARD:
    - Set 'is_resident' to true.
    - Set 'commodity' to 'luce' (default placeholder).
    - Leave consumption/costs as 0 or null.
  `;

  const response = await ai.models.generateContent({
    model: model,
    contents: {
        parts: [filePart, { text: prompt }]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          document_type: { type: Type.STRING, enum: ['BILL', 'ID_CARD'] },
          fiscal_code: { type: Type.STRING },
          client_name: { type: Type.STRING },
          address: { type: Type.STRING },
          city: { type: Type.STRING },
          pod_pdr: { type: Type.STRING },
          commodity: { type: Type.STRING, enum: ["luce", "gas"] },
          is_resident: { type: Type.BOOLEAN },
          power_committed: { type: Type.NUMBER, nullable: true },
          supplier_name: { type: Type.STRING, nullable: true },
          period: { type: Type.STRING, nullable: true },
          consumption: { type: Type.NUMBER, nullable: true },
          consumption_f1: { type: Type.NUMBER, nullable: true },
          consumption_f2: { type: Type.NUMBER, nullable: true },
          consumption_f3: { type: Type.NUMBER, nullable: true },
          detected_unit_price: { type: Type.NUMBER, nullable: true },
          detected_fixed_fee: { type: Type.NUMBER, nullable: true }
        }
      }
    }
  });

  const text = cleanJson(response.text);
  if (!text) throw new Error("No data returned from Gemini");

  const data = JSON.parse(text);

  // Normalization
  if (!data.consumption_f1 && data.consumption) {
      data.consumption_f1 = data.consumption * 0.35;
      data.consumption_f2 = data.consumption * 0.30;
      data.consumption_f3 = data.consumption * 0.35;
  }

  return {
    ...data,
    consumption: data.consumption || 0,
    consumption_f1: data.consumption_f1 || 0,
    consumption_f2: data.consumption_f2 || 0,
    consumption_f3: data.consumption_f3 || 0,
    current_raw_cost: (data.consumption || 0) * (data.detected_unit_price || 0.15),
    confidence_map: { supplier: 'high', consumption: 'high' }
  };
};

// --- Telephony Bill Extraction ---
export const extractTelephonyBill = async (file: File): Promise<ExtractedTelephonyBill> => {
  const model = "gemini-3-flash-preview";
  const filePart = await fileToPart(file);

  const prompt = `
    Analyze this telephone/internet bill.
    Extract the customer details, current operator, and costs.
    Determine if it is a Mobile line or Fixed line (Landline/Fiber).
    
    - type: 'MOBILE' or 'FIXED' or 'FWA'.
    - operator: Name of the current provider (e.g. Tim, Vodafone).
    - number: The main phone number or line identifier.
    - monthly_cost: The total monthly amount for the service.
    - plan_name: The name of the active plan if visible.
    - migration_code: Migration code (Codice Migrazione) if present.
  `;

  const response = await ai.models.generateContent({
    model: model,
    contents: {
      parts: [filePart, { text: prompt }]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          fiscal_code: { type: Type.STRING },
          client_name: { type: Type.STRING },
          address: { type: Type.STRING },
          city: { type: Type.STRING },
          operator: { type: Type.STRING },
          type: { type: Type.STRING, enum: ['MOBILE', 'FIXED', 'FWA'] },
          number: { type: Type.STRING },
          monthly_cost: { type: Type.NUMBER },
          plan_name: { type: Type.STRING },
          contract_end_date: { type: Type.STRING },
          migration_code: { type: Type.STRING }
        }
      }
    }
  });

  const text = cleanJson(response.text);
  if (!text) throw new Error("No data returned from Gemini");
  return JSON.parse(text);
};

// --- Canvas (Telephony Offer) Extraction Shared Logic ---
const generateCanvasContent = async (part: any): Promise<{ operator_name: string, offers: Partial<CanvasOffer>[] }> => {
  const model = "gemini-3-flash-preview";
  
  const prompt = `
    Analyze this Telephony Canvas / Price List (PDF/Image).
    Return a JSON with 'operator_name' and a comprehensive 'offers' list.
  `;

  const response = await ai.models.generateContent({
    model: model,
    contents: {
      parts: [part, { text: prompt }]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          operator_name: { type: Type.STRING },
          offers: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                type: { type: Type.STRING, enum: ['MOBILE', 'FIXED', 'FWA', 'CONVERGENCE', 'SMARTPHONE'] },
                target_segment: { type: Type.STRING, enum: ['CONSUMER', 'BUSINESS'] },
                monthly_price: { type: Type.NUMBER },
                data_gb: { type: Type.STRING, nullable: true }, 
                minutes: { type: Type.STRING, nullable: true },
                technology: { type: Type.STRING, nullable: true },
                activation_fee: { type: Type.NUMBER, nullable: true },
                device_model: { type: Type.STRING, nullable: true },
                upfront_cost: { type: Type.NUMBER, nullable: true },
                installment_amount: { type: Type.NUMBER, nullable: true },
                installment_count: { type: Type.NUMBER, nullable: true },
                convergence_requirements: { type: Type.STRING, nullable: true }
              }
            }
          }
        }
      }
    }
  });

  const text = cleanJson(response.text);
  if (!text) throw new Error("No data returned from Gemini");
  
  const data = JSON.parse(text);
  
  const rawOffers = Array.isArray(data.offers) ? data.offers : [];
  const cleanedOffers = rawOffers.map((o: any) => ({
      ...o,
      data_gb: (typeof o.data_gb === 'string' && o.data_gb.toUpperCase().includes('UNLIMITED')) ? 'UNLIMITED' : parseFloat(o.data_gb) || 0,
      minutes: (typeof o.minutes === 'string' && o.minutes.toUpperCase().includes('UNLIMITED')) ? 'UNLIMITED' : parseFloat(o.minutes) || 0
  }));

  return {
      operator_name: data.operator_name || 'Gestore Sconosciuto',
      offers: cleanedOffers
  };
};

export const extractCanvasFromDocument = async (file: File): Promise<{ operator_name: string, offers: Partial<CanvasOffer>[] }> => {
  const filePart = await fileToPart(file);
  return generateCanvasContent(filePart);
};

export const extractCanvasFromUrl = async (url: string): Promise<{ operator_name: string, offers: Partial<CanvasOffer>[] }> => {
  const urlPart = await urlToPart(url);
  return generateCanvasContent(urlPart);
};
