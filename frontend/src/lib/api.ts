const API_BASE = '/api';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    // Handle token expiry — but not on auth endpoints (401 there means wrong credentials)
    if (res.status === 401 && path && !path.startsWith('/auth/')) {
      // Defer logout so it doesn't interrupt in-flight navigation
      setTimeout(() => {
        localStorage.removeItem('token');
        window.dispatchEvent(new CustomEvent('auth:expired'));
      }, 0);
      throw new Error('Session expired. Please log in again.');
    }
    const data = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(data.error || `HTTP ${res.status}`);
  }

  // Safely parse JSON — handle non-JSON responses (e.g. proxy errors)
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Invalid server response');
  }
}

export const api = {
  // Auth
  register: (data: { email: string; password: string; firstName: string; lastName: string }) =>
    request<{ token: string; user: User }>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),

  login: (data: { email: string; password: string }) =>
    request<{ token: string; user: User }>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),

  getMe: () => request<User>('/auth/me'),

  // Documents
  uploadDocument: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return request<Document>('/documents/upload', { method: 'POST', body: formData });
  },

  getDocuments: () => request<Document[]>('/documents'),

  getDocument: (id: string) => request<Document>('/documents/' + id),

  getDocumentPdfUrl: (id: string) => `${API_BASE}/documents/${id}/pdf`,

  detectFields: (id: string) =>
    request<{ fields: DetectedField[]; pageCount: number; textPreview: string }>('/documents/' + id + '/detect-fields'),

  deleteDocument: (id: string) => request<{ success: boolean }>('/documents/' + id, { method: 'DELETE' }),

  sendDocument: (id: string, data: SendDocumentData) =>
    request<{ envelope: Envelope; signingLinks: SigningLink[] }>('/documents/' + id + '/send', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  downloadDocument: (id: string) => `${API_BASE}/documents/${id}/download`,

  // Signing (public)
  getSigningDocument: (link: string) => request<SigningDocument>('/sign/' + link),

  getSigningPdfUrl: (link: string) => `${API_BASE}/sign/${link}/pdf`,

  completeSigning: (link: string, fields: { id: string; value: string }[]) =>
    request<{ success: boolean; message: string; allComplete: boolean }>('/sign/' + link + '/complete', {
      method: 'POST',
      body: JSON.stringify({ fields }),
    }),

  // Signatures
  getSignatures: () => request<Signature[]>('/signatures'),

  createSignature: (data: { name: string; signatureData: string; isDefault?: boolean }) =>
    request<Signature>('/signatures', { method: 'POST', body: JSON.stringify(data) }),

  deleteSignature: (id: string) => request<{ success: boolean }>('/signatures/' + id, { method: 'DELETE' }),

  // Credits
  getCredits: () => request<{ credits: number; packs: CreditPack[] }>('/credits'),

  purchaseCredits: (packId: string) =>
    request<{ credits: number; purchased: number }>('/credits/purchase', {
      method: 'POST',
      body: JSON.stringify({ packId }),
    }),

  getCreditHistory: () => request<CreditTransaction[]>('/credits/history'),
};

// Types
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  credits: number;
  createdAt?: string;
}

export interface Document {
  id: string;
  userId: string;
  name: string;
  filePath: string;
  pageCount: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  envelopes?: Envelope[];
}

export interface Envelope {
  id: string;
  documentId: string;
  subject: string;
  message?: string;
  status: string;
  createdAt: string;
  completedAt?: string;
  recipients: Recipient[];
  fields: Field[];
}

export interface Recipient {
  id: string;
  email: string;
  name: string;
  role: string;
  signingOrder: number;
  status: string;
  uniqueLink: string;
  viewedAt?: string;
  signedAt?: string;
}

export interface Field {
  id: string;
  envelopeId: string;
  recipientId?: string;
  type: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  required: boolean;
  placeholder?: string;
  value?: string;
}

export interface Signature {
  id: string;
  name: string;
  signatureData: string;
  isDefault: boolean;
  createdAt: string;
}

export interface CreditPack {
  id: string;
  credits: number;
  price: number;
  label: string;
}

export interface CreditTransaction {
  id: string;
  amount: number;
  transactionType: string;
  description?: string;
  createdAt: string;
}

export interface DetectedField {
  question: string;
  type: string;
  fieldType: string;
  context: string;
}

export interface SendDocumentData {
  subject: string;
  message?: string;
  recipients: { email: string; name: string; role?: string; signingOrder?: number }[];
  fields: { recipientIndex: number; type: string; page: number; x: number; y: number; width: number; height: number; required?: boolean; value?: string }[];
}

export interface SigningLink {
  recipientName: string;
  recipientEmail: string;
  signingUrl: string;
}

export interface SigningDocument {
  recipientId: string;
  recipientName: string;
  documentName: string;
  subject: string;
  message?: string;
  pageCount: number;
  fields: Field[];
  allRecipients: { name: string; status: string; isMe: boolean }[];
}
