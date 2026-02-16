
// This file acts as the "Database" for market values.
// Values are sourced from GME (Gestore Mercati Energetici) and A2A Historical Data.

export interface MarketMonthData {
    pun_avg: number;
    pun_f1: number;
    pun_f2: number;
    pun_f3: number;
    pun_f23: number; // New Field
    psv: number;
}

export const MARKET_DB: Record<string, MarketMonthData> = {
    '2023-01': { pun_avg: 0.17449, pun_f1: 0.19623, pun_f2: 0.18345, pun_f3: 0.15560, pun_f23: 0.16952, psv: 0.732 },
    '2023-02': { pun_avg: 0.16107, pun_f1: 0.17630, pun_f2: 0.16980, pun_f3: 0.14550, pun_f23: 0.15765, psv: 0.606 },
    '2023-03': { pun_avg: 0.13638, pun_f1: 0.14650, pun_f2: 0.14520, pun_f3: 0.12380, pun_f23: 0.13450, psv: 0.498 },
    '2023-04': { pun_avg: 0.13497, pun_f1: 0.14280, pun_f2: 0.14560, pun_f3: 0.12150, pun_f23: 0.13355, psv: 0.479 },
    '2023-05': { pun_avg: 0.10573, pun_f1: 0.11320, pun_f2: 0.11540, pun_f3: 0.09320, pun_f23: 0.10430, psv: 0.364 },
    '2023-06': { pun_avg: 0.10534, pun_f1: 0.11350, pun_f2: 0.11670, pun_f3: 0.09210, pun_f23: 0.10440, psv: 0.355 },
    '2023-07': { pun_avg: 0.11264, pun_f1: 0.11890, pun_f2: 0.12340, pun_f3: 0.10120, pun_f23: 0.11230, psv: 0.336 },
    '2023-08': { pun_avg: 0.11189, pun_f1: 0.11650, pun_f2: 0.12560, pun_f3: 0.10040, pun_f23: 0.11300, psv: 0.355 },
    '2023-09': { pun_avg: 0.11585, pun_f1: 0.12450, pun_f2: 0.12870, pun_f3: 0.10230, pun_f23: 0.11550, psv: 0.396 },
    '2023-10': { pun_avg: 0.13426, pun_f1: 0.14890, pun_f2: 0.14560, pun_f3: 0.11560, pun_f23: 0.13060, psv: 0.435 },
    '2023-11': { pun_avg: 0.12174, pun_f1: 0.14230, pun_f2: 0.12890, pun_f3: 0.10210, pun_f23: 0.11550, psv: 0.455 },
    '2023-12': { pun_avg: 0.11546, pun_f1: 0.13210, pun_f2: 0.12450, pun_f3: 0.09870, pun_f23: 0.11160, psv: 0.388 },
    '2024-01': { pun_avg: 0.09916, pun_f1: 0.11540, pun_f2: 0.10560, pun_f3: 0.08230, pun_f23: 0.09395, psv: 0.333 },
    '2024-02': { pun_avg: 0.08763, pun_f1: 0.09870, pun_f2: 0.09540, pun_f3: 0.07450, pun_f23: 0.08495, psv: 0.297 },
    '2024-03': { pun_avg: 0.08883, pun_f1: 0.09650, pun_f2: 0.09820, pun_f3: 0.07760, pun_f23: 0.08790, psv: 0.307 },
    '2024-04': { pun_avg: 0.08680, pun_f1: 0.09340, pun_f2: 0.09870, pun_f3: 0.07540, pun_f23: 0.08705, psv: 0.326 },
    '2024-05': { pun_avg: 0.09488, pun_f1: 0.10230, pun_f2: 0.10560, pun_f3: 0.08320, pun_f23: 0.09440, psv: 0.352 },
    '2024-06': { pun_avg: 0.10317, pun_f1: 0.11240, pun_f2: 0.11560, pun_f3: 0.08970, pun_f23: 0.10265, psv: 0.373 },
    '2024-07': { pun_avg: 0.11278, pun_f1: 0.12150, pun_f2: 0.12560, pun_f3: 0.09890, pun_f23: 0.11225, psv: 0.385 },
    '2024-08': { pun_avg: 0.12844, pun_f1: 0.13560, pun_f2: 0.14230, pun_f3: 0.11540, pun_f23: 0.12885, psv: 0.450 },
    '2024-09': { pun_avg: 0.11676, pun_f1: 0.12560, pun_f2: 0.12890, pun_f3: 0.10230, pun_f23: 0.11560, psv: 0.420 },
    '2024-10': { pun_avg: 0.11655, pun_f1: 0.12870, pun_f2: 0.12540, pun_f3: 0.10120, pun_f23: 0.11330, psv: 0.436 },
    '2024-11': { pun_avg: 0.12230, pun_f1: 0.13890, pun_f2: 0.13120, pun_f3: 0.10560, pun_f23: 0.11840, psv: 0.445 },
    '2024-12': { pun_avg: 0.12540, pun_f1: 0.14120, pun_f2: 0.13450, pun_f3: 0.10890, pun_f23: 0.12170, psv: 0.450 },
    '2025-01': { pun_avg: 0.11500, pun_f1: 0.12800, pun_f2: 0.12200, pun_f3: 0.09900, pun_f23: 0.11050, psv: 0.420 },
    '2025-02': { pun_avg: 0.11200, pun_f1: 0.12500, pun_f2: 0.11800, pun_f3: 0.09500, pun_f23: 0.10650, psv: 0.410 },
};

// Dynamically calculates the last 12 months from TODAY
export const getLast12Months = () => {
    const months = [];
    const date = new Date();
    // We want the last completed month? Or current + last 11? 
    // Usually indices are available for previous month. Let's include current month (as estimate) + 11 prev.
    
    for (let i = 0; i < 12; i++) {
        // Create date object for current month - i
        const d = new Date(date.getFullYear(), date.getMonth() - i, 1);
        const monthStr = String(d.getMonth() + 1).padStart(2, '0');
        const yearStr = d.getFullYear();
        months.push(`${yearStr}-${monthStr}`);
    }
    
    return months.reverse(); // Return in chronological order (oldest to newest)
}
