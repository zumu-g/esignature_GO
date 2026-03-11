import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Document as PdfDocument, Page, pdfjs } from 'react-pdf';
import { api } from '../lib/api';
import type { Document } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import {
  PenTool, Type, Calendar, CheckSquare, Plus, Trash2, Send, ChevronLeft, ChevronRight, Users, GripVertical, Edit3
} from 'lucide-react';
import { PageEntrance, MotionButton, SuccessEntrance, FadeIn } from '../components/Motion';
import { SuccessIllustration } from '../components/Illustrations';
import { motion } from 'framer-motion';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PlacedField {
  id: string;
  type: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  recipientIndex: number; // -1 = self-fill (sender fills in now)
  value?: string;
}

interface RecipientEntry {
  name: string;
  email: string;
  role: string;
}

const FIELD_TYPES = [
  { type: 'signature', label: 'Signature', icon: PenTool, width: 200, height: 60 },
  { type: 'text', label: 'Text', icon: Type, width: 180, height: 30 },
  { type: 'date', label: 'Date', icon: Calendar, width: 140, height: 30 },
  { type: 'checkbox', label: 'Checkbox', icon: CheckSquare, width: 24, height: 24 },
];

const RECIPIENT_COLORS = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6'];

export default function DocumentPrepare() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, updateCredits } = useAuthStore();
  const [doc, setDoc] = useState<Document | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [fields, setFields] = useState<PlacedField[]>([]);
  const [recipients, setRecipients] = useState<RecipientEntry[]>([{ name: '', email: '', role: 'signer' }]);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [signingLinks, setSigningLinks] = useState<{ recipientName: string; signingUrl: string }[] | null>(null);
  const [pdfWidth, setPdfWidth] = useState(612);
  const [draggingField, setDraggingField] = useState<string | null>(null);
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [draggingPlacedField, setDraggingPlacedField] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const pageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (id) {
      api.getDocument(id).then((d) => {
        setDoc(d);
        setSubject(`Please sign: ${d.name}`);
      });
    }
  }, [id]);

  const handlePageClick = useCallback((e: React.MouseEvent) => {
    if (draggingPlacedField) return; // ignore clicks at end of drag
    if (!draggingField || !pageRef.current) return;

    const rect = pageRef.current.getBoundingClientRect();

    const isSelfFill = draggingField.startsWith('self-');
    const baseType = isSelfFill ? draggingField.replace('self-', '') : draggingField;
    const fieldType = FIELD_TYPES.find((f) => f.type === baseType) || { width: 180, height: 30 };

    const x = e.clientX - rect.left - fieldType.width / 2;
    const y = e.clientY - rect.top - fieldType.height / 2;

    const newField: PlacedField = {
      id: crypto.randomUUID(),
      type: baseType,
      page: currentPage - 1,
      x: Math.max(0, Math.min(x, pdfWidth - fieldType.width)),
      y: Math.max(0, y),
      width: fieldType.width,
      height: fieldType.height,
      recipientIndex: isSelfFill ? -1 : 0,
      value: isSelfFill && baseType === 'date' ? new Date().toLocaleDateString() : '',
    };

    setFields((prev) => [...prev, newField]);
    setDraggingField(null);
  }, [draggingField, currentPage, pdfWidth]);

  const removeField = (fieldId: string) => {
    setFields((prev) => prev.filter((f) => f.id !== fieldId));
    if (selectedField === fieldId) setSelectedField(null);
  };

  const addRecipient = () => {
    setRecipients((prev) => [...prev, { name: '', email: '', role: 'signer' }]);
  };

  const updateRecipient = (index: number, field: string, value: string) => {
    setRecipients((prev) => prev.map((r, i) => i === index ? { ...r, [field]: value } : r));
  };

  const removeRecipient = (index: number) => {
    if (recipients.length <= 1) return;
    setRecipients((prev) => prev.filter((_, i) => i !== index));
    setFields((prev) => prev.map((f) =>
      f.recipientIndex === index ? { ...f, recipientIndex: 0 } :
      f.recipientIndex > index ? { ...f, recipientIndex: f.recipientIndex - 1 } : f
    ));
  };

  const handleSend = async () => {
    if (!id || !doc) return;

    // Validate
    const validRecipients = recipients.filter((r) => r.name && r.email);
    const recipientFields = fields.filter((f) => f.recipientIndex >= 0);
    const selfFillFields = fields.filter((f) => f.recipientIndex === -1);

    if (recipientFields.length > 0 && validRecipients.length === 0) {
      setError('Add at least one recipient with name and email');
      return;
    }
    if (fields.length === 0) {
      setError('Place at least one field on the document');
      return;
    }
    // Check self-fill fields have values
    const emptySelfFields = selfFillFields.filter((f) => !f.value);
    if (emptySelfFields.length > 0) {
      setError('Fill in all your text fields before sending');
      return;
    }
    if (!subject) {
      setError('Subject is required');
      return;
    }
    if ((user?.credits ?? 0) < 1) {
      setError('Insufficient credits. Please purchase more credits.');
      return;
    }

    setSending(true);
    setError('');

    try {
      const result = await api.sendDocument(id, {
        subject,
        message: message || undefined,
        recipients: validRecipients.map((r, i) => ({
          email: r.email,
          name: r.name,
          role: r.role,
          signingOrder: i + 1,
        })),
        fields: fields.map((f) => ({
          recipientIndex: f.recipientIndex,
          type: f.type,
          page: f.page,
          x: f.x,
          y: f.y,
          width: f.width,
          height: f.height,
          required: f.recipientIndex >= 0,
          value: f.value || undefined,
        })),
      });

      setSigningLinks(result.signingLinks);
      updateCredits((user?.credits ?? 1) - 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  if (signingLinks) {
    return (
      <SuccessEntrance>
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="text-center mb-6">
              <div className="flex justify-center mb-3">
                <SuccessIllustration size={120} />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Document Sent!</h2>
              <p className="text-sm text-gray-500 mt-1">Share these signing links with your recipients</p>
            </div>

            <div className="space-y-3 mb-6">
              {signingLinks.map((link, i) => (
                <div key={i} className="bg-gray-50 rounded-md p-3">
                  <div className="text-sm font-medium text-gray-700 mb-1">{link.recipientName}</div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={link.signingUrl}
                      className="flex-1 text-xs bg-white px-2 py-1.5 rounded border border-gray-200 text-gray-600"
                    />
                    <button
                      onClick={() => navigator.clipboard.writeText(link.signingUrl)}
                      className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => navigate('/')}
              className="w-full bg-gray-100 text-gray-700 py-2 rounded-md text-sm font-medium hover:bg-gray-200"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </SuccessEntrance>
    );
  }

  if (!doc) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Loading document...</p>
        </div>
      </div>
    );
  }

  const pageFields = fields.filter((f) => f.page === currentPage - 1);

  return (
    <PageEntrance>
    <div className="flex flex-col lg:flex-row gap-0 lg:gap-6 -mx-4 -mt-4">
      {/* Mobile toolbar */}
      <div className="lg:hidden flex items-center gap-2 p-3 bg-white border-b border-gray-200 overflow-x-auto">
        <button
          onClick={() => setShowSidebar(!showSidebar)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 flex-shrink-0"
        >
          <Users className="h-3.5 w-3.5" />
          {showSidebar ? 'Hide Panel' : 'Fields & Recipients'}
        </button>
        {FIELD_TYPES.map((ft) => (
          <button
            key={ft.type}
            onClick={() => setDraggingField(draggingField === ft.type ? null : ft.type)}
            className={`flex items-center gap-1 px-2.5 py-2 rounded-md text-xs font-medium border flex-shrink-0 transition-colors ${
              draggingField === ft.type
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 text-gray-600'
            }`}
          >
            <ft.icon className="h-3 w-3" />
            {ft.label}
          </button>
        ))}
        <button
          onClick={() => setDraggingField(draggingField === 'self-text' ? null : 'self-text')}
          className={`flex items-center gap-1 px-2.5 py-2 rounded-md text-xs font-medium border flex-shrink-0 transition-colors ${
            draggingField === 'self-text'
              ? 'border-green-500 bg-green-50 text-green-700'
              : 'border-gray-200 text-gray-600'
          }`}
        >
          <Edit3 className="h-3 w-3" />
          My Text
        </button>
      </div>

      {/* Left sidebar - Fields & Recipients */}
      <div className={`w-72 flex-shrink-0 bg-white border-r border-gray-200 p-4 overflow-y-auto ${showSidebar ? 'block' : 'hidden'} lg:block lg:min-h-[calc(100vh-64px)]`}>
        <h3 className="text-sm font-semibold text-gray-900 mb-2">Your Fields</h3>
        <p className="text-[11px] text-gray-400 mb-2">Fill in yourself — text is added to the PDF directly</p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          <button
            onClick={() => setDraggingField(draggingField === 'self-text' ? null : 'self-text')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium border transition-colors ${
              draggingField === 'self-text'
                ? 'border-green-500 bg-green-50 text-green-700'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Edit3 className="h-3.5 w-3.5" />
            Text
          </button>
          <button
            onClick={() => setDraggingField(draggingField === 'self-date' ? null : 'self-date')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium border transition-colors ${
              draggingField === 'self-date'
                ? 'border-green-500 bg-green-50 text-green-700'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Calendar className="h-3.5 w-3.5" />
            Date
          </button>
        </div>

        <h3 className="text-sm font-semibold text-gray-900 mb-2">Recipient Fields</h3>
        <p className="text-[11px] text-gray-400 mb-2">Recipients fill these in when signing</p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {FIELD_TYPES.map((ft) => (
            <button
              key={ft.type}
              onClick={() => setDraggingField(draggingField === ft.type ? null : ft.type)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium border transition-colors ${
                draggingField === ft.type
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <ft.icon className="h-3.5 w-3.5" />
              {ft.label}
            </button>
          ))}
        </div>

        {draggingField && (
          <div className={`text-xs p-2 rounded-md mb-4 ${
            draggingField.startsWith('self-')
              ? 'bg-green-50 text-green-700'
              : 'bg-blue-50 text-blue-700'
          }`}>
            Click on the document to place the {draggingField.replace('self-', '')} field
          </div>
        )}

        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            Recipients
          </h3>
          <button onClick={addRecipient} className="text-blue-600 hover:text-blue-700">
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 mb-6">
          {recipients.map((r, i) => (
            <div key={i} className="border border-gray-200 rounded-md p-2">
              <div className="flex items-center gap-1.5 mb-2">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: RECIPIENT_COLORS[i % RECIPIENT_COLORS.length] }} />
                <span className="text-xs font-medium text-gray-500">Recipient {i + 1}</span>
                {recipients.length > 1 && (
                  <button onClick={() => removeRecipient(i)} className="ml-auto text-gray-400 hover:text-red-500">
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
              <input
                type="text"
                placeholder="Name"
                value={r.name}
                onChange={(e) => updateRecipient(i, 'name', e.target.value)}
                className="w-full px-2 py-1 text-xs border border-gray-200 rounded mb-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <input
                type="email"
                placeholder="Email"
                value={r.email}
                onChange={(e) => updateRecipient(i, 'email', e.target.value)}
                className="w-full px-2 py-1 text-xs border border-gray-200 rounded mb-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <select
                value={r.role}
                onChange={(e) => updateRecipient(i, 'role', e.target.value)}
                className="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="signer">Signer</option>
                <option value="cc">CC (copy)</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
          ))}
        </div>

        <h3 className="text-sm font-semibold text-gray-900 mb-3">Message</h3>
        <input
          type="text"
          placeholder="Subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded mb-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <textarea
          placeholder="Optional message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded mb-4 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
        />

        {error && (
          <div className="bg-red-50 text-red-600 text-xs p-2 rounded-md mb-3">{error}</div>
        )}

        <MotionButton
          onClick={handleSend}
          disabled={sending}
          className="w-full bg-blue-600 text-white py-2.5 rounded-md text-sm font-medium hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 transition-colors duration-150 flex items-center justify-center gap-2"
        >
          <Send className="h-4 w-4" />
          {sending ? 'Sending...' : 'Send Document (1 credit)'}
        </MotionButton>
      </div>

      {/* PDF Viewer */}
      <div className="flex-1 overflow-auto">
        <div className="flex items-center justify-between mb-3 px-4">
          <h2 className="text-lg font-semibold text-gray-900">{doc.name}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="text-sm text-gray-600">
              Page {currentPage} of {doc.pageCount}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(doc.pageCount, p + 1))}
              disabled={currentPage >= doc.pageCount}
              className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex justify-center">
          <div
            ref={pageRef}
            className="relative bg-white shadow-lg cursor-crosshair"
            onClick={handlePageClick}
          >
            <PdfDocument
              file={{
                url: `/api/documents/${id}/pdf`,
                httpHeaders: { Authorization: `Bearer ${localStorage.getItem('token')}` },
              }}
              loading={<div className="w-full max-w-[612px] aspect-[612/792] bg-gray-100 animate-pulse" />}
              onLoadSuccess={() => {}}
            >
              <Page
                pageNumber={currentPage}
                width={pdfWidth}
                renderTextLayer={false}
                renderAnnotationLayer={true}
                onLoadSuccess={(page) => setPdfWidth(page.width)}
              />
            </PdfDocument>

            {/* Placed fields overlay — draggable */}
            {pageFields.map((field) => {
              const isSelfFill = field.recipientIndex === -1;
              const color = isSelfFill ? '#059669' : RECIPIENT_COLORS[field.recipientIndex % RECIPIENT_COLORS.length];
              return (
                <motion.div
                  key={field.id}
                  drag
                  dragMomentum={false}
                  dragConstraints={pageRef}
                  dragElastic={0}
                  initial={false}
                  transition={{ duration: 0.2 }}
                  whileDrag={{ scale: 1.05, boxShadow: '0 8px 25px -5px rgba(0,0,0,0.2)', zIndex: 50 }}
                  onDragStart={() => setDraggingPlacedField(field.id)}
                  onDragEnd={(_e, info) => {
                    setFields((prev) =>
                      prev.map((f) => {
                        if (f.id !== field.id) return f;
                        const newX = Math.max(0, f.x + info.offset.x);
                        const newY = Math.max(0, f.y + info.offset.y);
                        return { ...f, x: newX, y: newY };
                      })
                    );
                    setTimeout(() => setDraggingPlacedField(null), 50);
                  }}
                  className={`absolute border-2 rounded flex items-center cursor-grab active:cursor-grabbing select-none ${
                    selectedField === field.id ? 'ring-2 ring-offset-1 ring-blue-400' : ''
                  } ${isSelfFill ? 'border-dashed' : ''}`}
                  style={{
                    left: field.x,
                    top: field.y,
                    width: field.width,
                    height: field.height,
                    borderColor: color,
                    backgroundColor: isSelfFill ? '#05966910' : `${color}15`,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!draggingPlacedField) {
                      setSelectedField(field.id === selectedField ? null : field.id);
                    }
                  }}
                >
                  {isSelfFill ? (
                    <input
                      type={field.type === 'date' ? 'date' : 'text'}
                      value={field.value || ''}
                      placeholder={field.type === 'date' ? '' : 'Type here...'}
                      onChange={(e) => {
                        e.stopPropagation();
                        setFields((prev) =>
                          prev.map((f) => f.id === field.id ? { ...f, value: e.target.value } : f)
                        );
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full h-full px-2 text-sm bg-transparent border-none outline-none text-gray-900 placeholder-gray-400"
                    />
                  ) : (
                    <div className="flex items-center gap-1 pointer-events-none">
                      <GripVertical className="h-3 w-3" style={{ color }} />
                      <span className="text-[10px] font-medium" style={{ color }}>
                        {field.type}
                      </span>
                    </div>
                  )}
                  {selectedField === field.id && (
                    <div className="absolute -top-7 right-0 flex items-center gap-1">
                      <select
                        value={field.recipientIndex}
                        onChange={(e) => {
                          e.stopPropagation();
                          setFields((prev) =>
                            prev.map((f) => f.id === field.id ? { ...f, recipientIndex: Number(e.target.value) } : f)
                          );
                        }}
                        className="text-[10px] bg-white border border-gray-200 rounded px-1 py-0.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {recipients.map((r, i) => (
                          <option key={i} value={i}>
                            {r.name || `Recipient ${i + 1}`}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeField(field.id);
                        }}
                        className="bg-red-500 text-white rounded p-0.5"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
    </PageEntrance>
  );
}
