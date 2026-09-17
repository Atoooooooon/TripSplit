import { Trip, Expense, Settlement, AiExpenseDraft, Currency, AiTripDraft } from '../types';

const BASE_URL = '/api';

async function safeFetchJson(url: string, options?: RequestInit): Promise<any> {
  let res: Response;
  try {
    let finalUrl = url;
    const method = (options?.method || 'GET').toUpperCase();
    if (method === 'GET') {
      const sep = url.includes('?') ? '&' : '?';
      finalUrl = `${url}${sep}_t=${Date.now()}`;
    }

    res = await fetch(finalUrl, {
      ...options,
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        ...(options?.headers || {}),
      },
    });
  } catch (netErr: any) {
    throw new Error(`网络请求异常，请检查网络连接: ${netErr.message}`);
  }

  const text = await res.text();
  let json: any;
  try {
    json = text ? JSON.parse(text) : {};
  } catch (parseErr) {
    throw new Error(`服务器响应非JSON (${res.status}): ${text.slice(0, 100) || '无响应内容'}`);
  }

  if (!res.ok || json.success === false) {
    throw new Error(json.error || `请求失败 (HTTP ${res.status})`);
  }

  return json;
}

export async function fetchTrips(codes?: string[]): Promise<Trip[]> {
  const query = codes !== undefined ? `?codes=${encodeURIComponent(codes.join(','))}` : '';
  const json = await safeFetchJson(`${BASE_URL}/trips${query}`);
  return json.data;
}

export async function joinTripByCode(code: string): Promise<{ tripId: string; name: string; accessCode: string }> {
  const json = await safeFetchJson(`${BASE_URL}/trips/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  return json.data;
}

export async function fetchTrip(id: string): Promise<Trip> {
  const json = await safeFetchJson(`${BASE_URL}/trips/${id}`);
  return json.data;
}

export async function deleteTrip(id: string): Promise<void> {
  await safeFetchJson(`${BASE_URL}/trips/${id}`, {
    method: 'DELETE',
  });
}

export async function createTrip(tripData: {
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  settlementCurrency: Currency;
  accessCode?: string;
  creatorName?: string;
  members: Array<{ name: string; isCurrentUser: boolean }>;
}): Promise<{ tripId: string; accessCode: string }> {
  const json = await safeFetchJson(`${BASE_URL}/trips`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tripData),
  });
  return { tripId: json.tripId, accessCode: json.accessCode };
}

export async function parseTripFromNaturalLanguage(text: string): Promise<AiTripDraft> {
  const json = await safeFetchJson(`${BASE_URL}/ai/parse-trip`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  return json.data;
}

export async function addTripMember(tripId: string, name: string): Promise<string> {
  const json = await safeFetchJson(`${BASE_URL}/trips/${tripId}/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  return json.memberId;
}

export async function removeTripMember(tripId: string, memberId: string): Promise<void> {
  await safeFetchJson(`${BASE_URL}/trips/${tripId}/members/${memberId}`, {
    method: 'DELETE',
  });
}

export async function createExpense(tripId: string, expenseData: Partial<Expense>): Promise<string> {
  const json = await safeFetchJson(`${BASE_URL}/${tripId}/expenses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(expenseData),
  });
  return json.expenseId;
}

export async function updateExpense(expenseId: string, expenseData: Partial<Expense>): Promise<void> {
  await safeFetchJson(`${BASE_URL}/${expenseId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(expenseData),
  });
}

export async function deleteExpense(expenseId: string): Promise<void> {
  await safeFetchJson(`${BASE_URL}/expenses/${expenseId}`, {
    method: 'DELETE',
  });
}

export async function recordSettlement(tripId: string, settlementData: {
  fromMemberId: string;
  toMemberId: string;
  amount: number;
  currency: Currency;
  note?: string;
}): Promise<string> {
  const json = await safeFetchJson(`${BASE_URL}/trips/${tripId}/settlements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settlementData),
  });
  return json.settlementId;
}

export async function deleteSettlement(settlementId: string): Promise<void> {
  await safeFetchJson(`${BASE_URL}/settlements/${settlementId}`, {
    method: 'DELETE',
  });
}

export async function updateTripMember(tripId: string, memberId: string, name: string): Promise<void> {
  await safeFetchJson(`${BASE_URL}/trips/${tripId}/members/${memberId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
}

export async function parseNaturalLanguageExpense(
  text: string,
  tripId: string,
  history: Array<{ role: string; content: string }> = [],
  currentMemberId?: string
): Promise<AiExpenseDraft> {
  const json = await safeFetchJson(`${BASE_URL}/ai/parse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, tripId, history, currentMemberId }),
  });
  return json.data;
}

export async function getSettings(): Promise<{ hasDeepSeekKey: boolean; maskedKey: string }> {
  const json = await safeFetchJson(`${BASE_URL}/settings`);
  return json.data;
}

export async function saveSettings(settings: { deepseekApiKey?: string }): Promise<void> {
  await safeFetchJson(`${BASE_URL}/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
}

export async function verifyDevPassword(password: string): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/settings/verify-dev-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const json = await res.json();
    return !!json.success;
  } catch (err) {
    return false;
  }
}
