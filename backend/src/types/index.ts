export interface FieldInput {
  id?: string;
  type: 'signature' | 'text' | 'date' | 'checkbox';
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  value?: string;
  required?: boolean;
  placeholder?: string;
  recipientIndex?: number;
}

export interface RecipientInput {
  email: string;
  name: string;
  role?: 'signer' | 'cc' | 'viewer';
  signingOrder?: number;
}

export interface SendDocumentInput {
  subject: string;
  message?: string;
  recipients: RecipientInput[];
  fields: FieldInput[];
}

export interface SigningSubmission {
  fields: {
    id: string;
    value: string;
  }[];
}
