import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Document as PdfDocument, Page, pdfjs } from 'react-pdf';
import { api } from '../lib/api';
import type { Document, DetectedField } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import {
  PenTool, Type, Calendar, CheckSquare, Plus, Trash2, Send, ChevronLeft, ChevronRight, Users, GripVertical, Edit3, Sparkles, Loader2, X
} from 'lucide-react';
import { PageEntrance, MotionButton, SuccessEntrance, FadeIn } from '../components/Motion';
import { SuccessIllustration } from '../components/Illustrations';
import { motion, useDragControls, useMotionValue } from 'framer-motion';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// UUID fallback for iOS < 15.4
const generateId = (): string =>
  crypto.randomUUID?.() ??
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

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

const RECIPIENT_COLORS = ['#0071E3', '#8B5CF6', '#059669', '#F97316', '#EF4444'];

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// ── Field overlay component — owns drag controls and resize state ──
interface FieldOverlayProps {
  field: PlacedField;
  isSelected: boolean;
  color: string;
  isSelfFill: boolean;
  pageRef: React.RefObject<HTMLDivElement>;
  recipients: RecipientEntry[];
  draggingPlacedField: string | null;
  setDraggingPlacedField: (id: string | null) => void;
  onSelect: (id: string) => void;
  onUpdate: (id: string, updates: Partial<PlacedField>) => void;
  onRemove: (id: string) => void;
}

function FieldOverlay({
  field, isSelected, color, isSelfFill, pageRef,
  recipients, draggingPlacedField, setDraggingPlacedField,
  onSelect, onUpdate, onRemove,
}: FieldOverlayProps) {
  const dragControls = useDragControls();
  // Motion values own the position — no CSS left/top, so Framer Motion
  // never needs to reset a transform on drop, eliminating position jumps.
  const mx = useMotionValue(field.x);
  const my = useMotionValue(field.y);
  const resizeRef = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(null);

  // Sync when position changes externally (arrow key nudge)
  useEffect(() => { mx.set(field.x); }, [field.x]);
  useEffect(() => { my.set(field.y); }, [field.y]);

  const startResize = (e: React.PointerEvent, mode: 'w' | 'both') => {
    e.stopPropagation();
    e.preventDefault();
    resizeRef.current = { startX: e.clientX, startY: e.clientY, startW: field.width, startH: field.height };
    const onMove = (me: PointerEvent) => {
      if (!resizeRef.current) return;
      const dw = me.clientX - resizeRef.current.startX;
      const dh = me.clientY - resizeRef.current.startY;
      const updates: Partial<PlacedField> = {};
      if (mode === 'w' || mode === 'both') updates.width = Math.max(60, resizeRef.current.startW + dw);
      if (mode === 'both') updates.height = Math.max(20, resizeRef.current.startH + dh);
      onUpdate(field.id, updates);
    };
    const onUp = () => {
      resizeRef.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const fieldH = Math.max(field.height, 30);

  return (
    <motion.div
      drag
      dragMomentum={false}
      dragListener={false}
      dragControls={dragControls}
      dragConstraints={pageRef}
      dragElastic={0}
      style={{
        x: mx,
        y: my,
        position: 'absolute',
        left: 0,
        top: 0,
        width: field.width,
        height: fieldH,
        border: isSelected ? `2px solid ${color}` : `1px solid ${color}`,
        borderStyle: isSelfFill ? 'dashed' : 'solid',
        borderRadius: '4px',
        backgroundColor: isSelfFill ? `${color}0D` : `${color}15`,
        boxShadow: isSelected ? `0 0 0 3px ${color}30` : 'none',
        display: 'flex',
        alignItems: 'center',
        cursor: 'default',
        userSelect: 'none',
        touchAction: 'none',
        transition: 'box-shadow 0.15s ease',
      }}
      whileDrag={{ scale: 1.02, boxShadow: '0 4px 16px rgba(0,0,0,0.18)', zIndex: 50 }}
      onDragStart={() => setDraggingPlacedField(field.id)}
      onDragEnd={() => {
        // mx/my already hold the final constrained position — no offset math needed
        onUpdate(field.id, { x: mx.get(), y: my.get() });
        setTimeout(() => setDraggingPlacedField(null), 50);
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (!draggingPlacedField) onSelect(field.id);
      }}
    >
      {isSelfFill ? (
        <div style={{ display: 'flex', alignItems: 'center', width: '100%', height: '100%' }}>
          <div
            onPointerDown={(e) => { e.stopPropagation(); dragControls.start(e); }}
            style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '0 4px', color, cursor: 'grab' }}
            title="Drag to reposition"
          >
            <GripVertical style={{ width: '12px', height: '12px' }} />
          </div>
          <input
            type={field.type === 'date' ? 'date' : 'text'}
            value={field.value || ''}
            placeholder={field.type === 'date' ? '' : 'Type here...'}
            onChange={(e) => { e.stopPropagation(); onUpdate(field.id, { value: e.target.value }); }}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            style={{ flex: 1, minWidth: 0, height: '100%', padding: '0 4px', fontSize: '12px', backgroundColor: 'transparent', border: 'none', outline: 'none', color: '#1D1D1F' }}
          />
        </div>
      ) : (
        <div
          onPointerDown={(e) => { e.stopPropagation(); dragControls.start(e); }}
          style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '0 6px', cursor: 'grab', width: '100%' }}
        >
          <GripVertical style={{ width: '10px', height: '10px', color, flexShrink: 0 }} />
          <span style={{ fontSize: '10px', fontWeight: 600, color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {field.type}
          </span>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: color, marginLeft: '2px', flexShrink: 0 }} />
        </div>
      )}

      {/* Right-edge resize handle — drag to extend width */}
      <div
        onPointerDown={(e) => startResize(e, 'w')}
        style={{ position: 'absolute', right: -5, top: 0, bottom: 0, width: 10, cursor: 'ew-resize', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5 }}
        title="Drag to resize width"
      >
        <div style={{ width: 3, height: Math.min(16, fieldH * 0.6), backgroundColor: color, borderRadius: 2, opacity: isSelected ? 0.7 : 0.25, transition: 'opacity 0.15s' }} />
      </div>

      {/* Bottom-right corner handle — drag to resize both width + height */}
      <div
        onPointerDown={(e) => startResize(e, 'both')}
        style={{ position: 'absolute', right: -4, bottom: -4, width: 10, height: 10, cursor: 'nwse-resize', backgroundColor: color, borderRadius: '2px', opacity: isSelected ? 0.9 : 0, transition: 'opacity 0.15s', zIndex: 6 }}
        title="Drag to resize"
      />

      {/* Selected field toolbar */}
      {isSelected && (
        <div style={{ position: 'absolute', top: '-36px', right: '0', display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#FFFFFF', border: '1px solid #E8E8ED', borderRadius: '8px', padding: '4px 6px', boxShadow: '0 2px 8px rgba(0,0,0,0.12)', zIndex: 10 }}>
          {!isSelfFill && (
            <select
              value={field.recipientIndex}
              onChange={(e) => { e.stopPropagation(); onUpdate(field.id, { recipientIndex: Number(e.target.value) }); }}
              onClick={(e) => e.stopPropagation()}
              style={{ fontSize: '11px', border: '1px solid #E8E8ED', borderRadius: '6px', padding: '2px 6px', height: '26px', color: '#1D1D1F', outline: 'none', cursor: 'pointer', backgroundColor: '#FFFFFF' }}
            >
              {recipients.map((r, i) => (
                <option key={i} value={i}>{r.name || `Recipient ${i + 1}`}</option>
              ))}
            </select>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(field.id); }}
            aria-label="Delete field"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '26px', height: '26px', borderRadius: '6px', border: 'none', backgroundColor: '#B64400', color: '#FFFFFF', cursor: 'pointer', flexShrink: 0 }}
          >
            <Trash2 style={{ width: '12px', height: '12px' }} />
          </button>
          <span style={{ fontSize: '10px', color: '#8A8A8E', whiteSpace: 'nowrap', paddingLeft: '2px' }}>↑↓←→ nudge · ⌘C copy · ⌘V paste</span>
        </div>
      )}
    </motion.div>
  );
}

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
  const [viewportWidth, setViewportWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 612);
  const [draggingField, setDraggingField] = useState<string | null>(null);
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const [draggingPlacedField, setDraggingPlacedField] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const pageRef = useRef<HTMLDivElement>(null);
  const copiedFieldRef = useRef<PlacedField | null>(null);

  // Responsive PDF width — constrain to viewport on mobile
  const pdfWidth = Math.min(612, viewportWidth - 32);

  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [loadingDoc, setLoadingDoc] = useState(true);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [showSmartFill, setShowSmartFill] = useState(false);
  const [detectingFields, setDetectingFields] = useState(false);
  const [detectedFields, setDetectedFields] = useState<(DetectedField & { answer: string })[]>([]);

  const pdfFile = useMemo(() => ({
    url: `/api/documents/${id}/pdf`,
    httpHeaders: { Authorization: `Bearer ${localStorage.getItem('token')}` },
  }), [id]);

  useEffect(() => {
    if (id) {
      setLoadingDoc(true);
      api.getDocument(id).then((d) => {
        setDoc(d);
        setSubject(`Please sign: ${d.name}`);
        if (d.status !== 'draft') {
          navigate('/');
        }
      }).catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load document');
      }).finally(() => {
        setLoadingDoc(false);
      });
    }
  }, [id]);

  // Warn before navigating away with unsaved work
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (fields.length > 0) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [fields.length]);

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
      id: generateId(),
      type: baseType,
      page: currentPage,
      x: Math.max(0, Math.min(x, pdfWidth - fieldType.width)),
      y: Math.max(0, y),
      width: fieldType.width,
      height: fieldType.height,
      recipientIndex: isSelfFill ? -1 : 0,
      value: isSelfFill && baseType === 'date' ? new Date().toISOString().split('T')[0] : '',
    };

    setFields((prev) => [...prev, newField]);
    setDraggingField(null);
  }, [draggingField, draggingPlacedField, currentPage, pdfWidth]);

  const removeField = useCallback((fieldId: string) => {
    setFields((prev) => prev.filter((f) => f.id !== fieldId));
    setSelectedField((sel) => sel === fieldId ? null : sel);
  }, []);

  const updateField = useCallback((fieldId: string, updates: Partial<PlacedField>) => {
    setFields((prev) => prev.map((f) => f.id === fieldId ? { ...f, ...updates } : f));
  }, []);

  // Arrow key nudging + Cmd/Ctrl+C copy + Cmd/Ctrl+V paste
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const mod = e.metaKey || e.ctrlKey;

      // Copy selected field
      if (mod && e.key === 'c' && selectedField) {
        e.preventDefault();
        setFields((prev) => {
          const f = prev.find((f) => f.id === selectedField);
          if (f) copiedFieldRef.current = f;
          return prev;
        });
        return;
      }

      // Paste copied field (offset by 16px so it doesn't perfectly overlap)
      if (mod && e.key === 'v' && copiedFieldRef.current) {
        e.preventDefault();
        const src = copiedFieldRef.current;
        const newField: PlacedField = {
          ...src,
          id: generateId(),
          x: src.x + 16,
          y: src.y + 16,
        };
        setFields((prev) => [...prev, newField]);
        setSelectedField(newField.id);
        copiedFieldRef.current = newField; // next paste offsets from the new copy
        return;
      }

      // Arrow key nudge
      if (!selectedField) return;
      const DIRS: Record<string, [number, number]> = {
        ArrowLeft: [-1, 0], ArrowRight: [1, 0],
        ArrowUp: [0, -1], ArrowDown: [0, 1],
      };
      const dir = DIRS[e.key];
      if (!dir) return;
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      setFields((prev) =>
        prev.map((f) =>
          f.id === selectedField
            ? { ...f, x: Math.max(0, f.x + dir[0] * step), y: Math.max(0, f.y + dir[1] * step) }
            : f
        )
      );
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedField]);

  const handleSmartFill = async () => {
    if (!id) return;
    setDetectingFields(true);
    setShowSmartFill(true);
    setError('');
    try {
      const result = await api.detectFields(id);
      setDetectedFields(result.fields.map((f) => ({ ...f, answer: '' })));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to detect fields');
      setShowSmartFill(false);
    } finally {
      setDetectingFields(false);
    }
  };

  const applySmartFill = () => {
    const answered = detectedFields.filter((f) => f.answer.trim());
    if (answered.length === 0) return;

    const FIELD_SIZES: Record<string, { width: number; height: number }> = {
      text: { width: 180, height: 30 },
      date: { width: 140, height: 30 },
      signature: { width: 200, height: 60 },
    };

    // Place fields in a column on the current page, spaced vertically
    const startY = 80;
    const spacing = 40;

    const newFields: PlacedField[] = answered.map((f, i) => {
      const size = FIELD_SIZES[f.fieldType] || FIELD_SIZES.text;
      return {
        id: generateId(),
        type: f.fieldType,
        page: currentPage,
        x: 60,
        y: startY + i * spacing,
        width: size.width,
        height: size.height,
        recipientIndex: -1,
        value: f.fieldType === 'date' ? f.answer : f.answer,
      };
    });

    setFields((prev) => [...prev, ...newFields]);
    setShowSmartFill(false);
    setDetectedFields([]);
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

    // Validate — collect all errors at once
    const validRecipients = recipients.filter((r) => r.name && r.email);
    const recipientFields = fields.filter((f) => f.recipientIndex >= 0);
    const selfFillFields = fields.filter((f) => f.recipientIndex === -1);
    const errors: string[] = [];

    if (!subject) errors.push('Subject is required');
    if (fields.length === 0) errors.push('Place at least one field on the document');
    if (recipientFields.length > 0 && validRecipients.length === 0) {
      errors.push('Add at least one recipient with name and email');
    }
    const invalidEmails = validRecipients.filter((r) => !isValidEmail(r.email));
    if (invalidEmails.length > 0) {
      errors.push(`Invalid email format: ${invalidEmails.map((r) => r.email).join(', ')}`);
    }
    const emptySelfFields = selfFillFields.filter((f) => !f.value);
    if (emptySelfFields.length > 0) {
      errors.push('Fill in all your text fields before sending');
    }
    if ((user?.credits ?? 0) < 1) {
      errors.push('Insufficient credits. Please purchase more credits');
    }

    if (errors.length > 0) {
      setError(errors.join('. '));
      return;
    }

    // Confirmation dialog
    const confirmMessage = `Send "${subject}" to ${validRecipients.length} recipient(s)?\n\nThis will use 1 credit (${user?.credits ?? 0} remaining).`;
    if (!window.confirm(confirmMessage)) return;

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
      // Re-fetch user to get accurate credit balance from server
      useAuthStore.getState().loadUser();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  if (signingLinks) {
    return (
      <SuccessEntrance>
        <div role="alert" style={{ minHeight: '100vh', backgroundColor: '#F5F5F7', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ maxWidth: '560px', width: '100%', backgroundColor: '#FFFFFF', borderRadius: '18px', boxShadow: '0 8px 24px rgba(0,0,0,0.15)', overflow: 'hidden' }}>
            {/* Success header */}
            <div style={{ padding: '32px 32px 24px', textAlign: 'center', borderBottom: '1px solid #E8E8ED' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                <SuccessIllustration size={96} />
              </div>
              <h2 style={{ fontSize: '21px', fontWeight: 600, color: '#1D1D1F', margin: 0 }}>Document Sent Successfully</h2>
              <p style={{ fontSize: '15px', color: '#6E6E73', marginTop: '6px', marginBottom: 0 }}>Share these signing links with your recipients</p>
            </div>

            {/* Signing links */}
            <div style={{ padding: '24px 32px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                {signingLinks.map((link, i) => (
                  <div key={i} style={{ backgroundColor: '#F5F5F7', borderRadius: '10px', padding: '14px 16px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#1D1D1F', marginBottom: '8px' }}>{link.recipientName}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="text"
                        readOnly
                        value={link.signingUrl}
                        style={{
                          flex: 1,
                          fontSize: '12px',
                          backgroundColor: '#FFFFFF',
                          border: '1px solid #E8E8ED',
                          borderRadius: '8px',
                          padding: '8px 10px',
                          color: '#6E6E73',
                          outline: 'none',
                          minWidth: 0,
                        }}
                      />
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(link.signingUrl);
                          setCopiedLink(link.signingUrl);
                          setTimeout(() => setCopiedLink(null), 2000);
                        }}
                        style={{
                          fontSize: '13px',
                          fontWeight: 500,
                          backgroundColor: copiedLink === link.signingUrl ? '#34C759' : '#0071E3',
                          color: '#FFFFFF',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '8px 16px',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          height: '34px',
                          flexShrink: 0,
                          transition: 'background-color 0.15s ease',
                        }}
                      >
                        {copiedLink === link.signingUrl ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => navigate('/')}
                style={{
                  width: '100%',
                  backgroundColor: '#F5F5F7',
                  color: '#1D1D1F',
                  border: '1px solid #E8E8ED',
                  borderRadius: '10px',
                  padding: '12px',
                  fontSize: '15px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#E8E8ED')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#F5F5F7')}
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </SuccessEntrance>
    );
  }

  if (!doc) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          {error ? (
            <>
              <p style={{ color: '#B64400', fontWeight: 500, marginBottom: '8px' }}>Failed to load document</p>
              <p style={{ fontSize: '14px', color: '#6E6E73', marginBottom: '16px' }}>{error}</p>
              <button
                onClick={() => navigate('/')}
                style={{ fontSize: '14px', color: '#0071E3', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}
              >
                Back to Dashboard
              </button>
            </>
          ) : (
            <>
              <div style={{
                width: '32px', height: '32px', border: '2px solid #E8E8ED', borderTopColor: '#0071E3',
                borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px',
              }} />
              <p style={{ fontSize: '14px', color: '#6E6E73' }}>Loading document...</p>
            </>
          )}
        </div>
      </div>
    );
  }

  const pageFields = fields.filter((f) => f.page === currentPage);

  return (
    <PageEntrance>
      {/* Full-bleed layout: sidebar + content, flush to edges */}
      <div style={{ display: 'flex', height: '100dvh', overflow: 'hidden', margin: '-16px', backgroundColor: '#F5F5F7' }}>

        {/* ── LEFT SIDEBAR ── */}
        <div
          style={{
            width: showSidebar || typeof window !== 'undefined' && window.innerWidth >= 1024 ? '240px' : '0',
            flexShrink: 0,
            backgroundColor: '#FFFFFF',
            borderRight: '1px solid #E8E8ED',
            overflowY: 'auto',
            overflowX: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
          className={`${showSidebar ? 'block' : 'hidden'} lg:flex`}
        >
          <div style={{ padding: '14px', flex: 1 }}>

            {/* Smart Fill button */}
            <button
              onClick={handleSmartFill}
              disabled={detectingFields}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '7px 12px',
                borderRadius: '8px',
                border: '1px solid #D1C4E9',
                backgroundColor: '#F3F0FF',
                color: '#7C3AED',
                fontSize: '12px',
                fontWeight: 500,
                cursor: detectingFields ? 'not-allowed' : 'pointer',
                opacity: detectingFields ? 0.6 : 1,
                marginBottom: '14px',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => { if (!detectingFields) e.currentTarget.style.backgroundColor = '#EDE9FE'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#F3F0FF'; }}
            >
              {detectingFields ? <Loader2 style={{ width: '13px', height: '13px', animation: 'spin 0.8s linear infinite' }} /> : <Sparkles style={{ width: '13px', height: '13px' }} />}
              {detectingFields ? 'Detecting fields...' : 'Smart Fill'}
            </button>

            {/* YOUR FIELDS section */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '10px', fontWeight: 600, color: '#6E6E73', textTransform: 'uppercase', letterSpacing: '0.06em', paddingBottom: '6px', borderBottom: '1px solid #E8E8ED', marginBottom: '8px' }}>
                Your Fields
              </div>
              <p style={{ fontSize: '10px', color: '#6E6E73', marginBottom: '8px' }}>Fill in yourself — added directly to the PDF</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
                <button
                  onClick={() => setDraggingField(draggingField === 'self-text' ? null : 'self-text')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '6px 8px',
                    borderRadius: '6px',
                    border: draggingField === 'self-text' ? '1px solid #0071E3' : '1px solid #E8E8ED',
                    backgroundColor: draggingField === 'self-text' ? 'rgba(0,113,227,0.08)' : '#FFFFFF',
                    color: draggingField === 'self-text' ? '#0071E3' : '#1D1D1F',
                    fontSize: '11px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => { if (draggingField !== 'self-text') { e.currentTarget.style.borderColor = '#0071E3'; e.currentTarget.style.backgroundColor = 'rgba(0,113,227,0.03)'; } }}
                  onMouseLeave={(e) => { if (draggingField !== 'self-text') { e.currentTarget.style.borderColor = '#E8E8ED'; e.currentTarget.style.backgroundColor = '#FFFFFF'; } }}
                >
                  <Edit3 style={{ width: '11px', height: '11px', flexShrink: 0 }} />
                  Text
                </button>
                <button
                  onClick={() => setDraggingField(draggingField === 'self-date' ? null : 'self-date')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '6px 8px',
                    borderRadius: '6px',
                    border: draggingField === 'self-date' ? '1px solid #0071E3' : '1px solid #E8E8ED',
                    backgroundColor: draggingField === 'self-date' ? 'rgba(0,113,227,0.08)' : '#FFFFFF',
                    color: draggingField === 'self-date' ? '#0071E3' : '#1D1D1F',
                    fontSize: '11px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => { if (draggingField !== 'self-date') { e.currentTarget.style.borderColor = '#0071E3'; e.currentTarget.style.backgroundColor = 'rgba(0,113,227,0.03)'; } }}
                  onMouseLeave={(e) => { if (draggingField !== 'self-date') { e.currentTarget.style.borderColor = '#E8E8ED'; e.currentTarget.style.backgroundColor = '#FFFFFF'; } }}
                >
                  <Calendar style={{ width: '11px', height: '11px', flexShrink: 0 }} />
                  Date
                </button>
              </div>
            </div>

            {/* RECIPIENT FIELDS section */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '10px', fontWeight: 600, color: '#6E6E73', textTransform: 'uppercase', letterSpacing: '0.06em', paddingBottom: '6px', borderBottom: '1px solid #E8E8ED', marginBottom: '8px' }}>
                Recipient Fields
              </div>
              <p style={{ fontSize: '10px', color: '#6E6E73', marginBottom: '8px' }}>Recipients fill these in when signing</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
                {FIELD_TYPES.map((ft) => (
                  <button
                    key={ft.type}
                    onClick={() => setDraggingField(draggingField === ft.type ? null : ft.type)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '6px 8px',
                      borderRadius: '6px',
                      border: draggingField === ft.type ? '1px solid #0071E3' : '1px solid #E8E8ED',
                      backgroundColor: draggingField === ft.type ? 'rgba(0,113,227,0.08)' : '#FFFFFF',
                      color: draggingField === ft.type ? '#0071E3' : '#1D1D1F',
                      fontSize: '11px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => { if (draggingField !== ft.type) { e.currentTarget.style.borderColor = '#0071E3'; e.currentTarget.style.backgroundColor = 'rgba(0,113,227,0.03)'; } }}
                    onMouseLeave={(e) => { if (draggingField !== ft.type) { e.currentTarget.style.borderColor = '#E8E8ED'; e.currentTarget.style.backgroundColor = '#FFFFFF'; } }}
                  >
                    <ft.icon style={{ width: '11px', height: '11px', flexShrink: 0 }} />
                    {ft.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Placement hint */}
            {draggingField && (
              <div style={{
                fontSize: '11px',
                padding: '7px 10px',
                borderRadius: '6px',
                marginBottom: '12px',
                backgroundColor: draggingField.startsWith('self-') ? '#F0FDF4' : 'rgba(0,113,227,0.06)',
                color: draggingField.startsWith('self-') ? '#059669' : '#0071E3',
                border: `1px solid ${draggingField.startsWith('self-') ? '#A7F3D0' : 'rgba(0,113,227,0.2)'}`,
              }}>
                Click on the document to place the {draggingField.replace('self-', '')} field
              </div>
            )}

            {/* RECIPIENTS section */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid #E8E8ED', marginBottom: '8px' }}>
                <div style={{ fontSize: '10px', fontWeight: 600, color: '#6E6E73', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Users style={{ width: '11px', height: '11px' }} />
                  Recipients
                </div>
                <button
                  onClick={addRecipient}
                  aria-label="Add recipient"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '22px',
                    height: '22px',
                    borderRadius: '5px',
                    border: '1px solid #E8E8ED',
                    backgroundColor: '#FFFFFF',
                    color: '#0071E3',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(0,113,227,0.06)'; e.currentTarget.style.borderColor = '#0071E3'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#FFFFFF'; e.currentTarget.style.borderColor = '#E8E8ED'; }}
                >
                  <Plus style={{ width: '12px', height: '12px' }} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '4px' }}>
                {recipients.map((r, i) => (
                  <div
                    key={i}
                    style={{
                      border: '1px solid #E8E8ED',
                      borderRadius: '8px',
                      padding: '8px',
                      backgroundColor: '#FAFAFA',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                      <div style={{ width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0, backgroundColor: RECIPIENT_COLORS[i % RECIPIENT_COLORS.length] }} />
                      <span style={{ fontSize: '11px', fontWeight: 500, color: '#6E6E73', flex: 1 }}>Recipient {i + 1}</span>
                      {recipients.length > 1 && (
                        <button
                          onClick={() => removeRecipient(i)}
                          aria-label={`Remove recipient ${i + 1}`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '22px',
                            height: '22px',
                            borderRadius: '5px',
                            border: 'none',
                            backgroundColor: 'transparent',
                            color: '#6E6E73',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#FFF0F0'; e.currentTarget.style.color = '#B64400'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#6E6E73'; }}
                        >
                          <Trash2 style={{ width: '11px', height: '11px' }} />
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder="Full name"
                      value={r.name}
                      onChange={(e) => updateRecipient(i, 'name', e.target.value)}
                      aria-label={`Recipient ${i + 1} name`}
                      style={{
                        width: '100%',
                        height: '28px',
                        padding: '0 8px',
                        fontSize: '12px',
                        border: '1px solid #E8E8ED',
                        borderRadius: '6px',
                        backgroundColor: '#FFFFFF',
                        color: '#1D1D1F',
                        outline: 'none',
                        marginBottom: '4px',
                        boxSizing: 'border-box',
                        transition: 'border-color 0.15s ease',
                      }}
                      onFocus={(e) => { e.target.style.borderColor = '#0071E3'; e.target.style.boxShadow = '0 0 0 2px rgba(0,113,227,0.15)'; }}
                      onBlur={(e) => { e.target.style.borderColor = '#E8E8ED'; e.target.style.boxShadow = 'none'; }}
                    />
                    <input
                      type="email"
                      placeholder="Email address"
                      value={r.email}
                      onChange={(e) => updateRecipient(i, 'email', e.target.value)}
                      aria-label={`Recipient ${i + 1} email`}
                      style={{
                        width: '100%',
                        height: '28px',
                        padding: '0 8px',
                        fontSize: '12px',
                        border: '1px solid #E8E8ED',
                        borderRadius: '6px',
                        backgroundColor: '#FFFFFF',
                        color: '#1D1D1F',
                        outline: 'none',
                        marginBottom: '4px',
                        boxSizing: 'border-box',
                        transition: 'border-color 0.15s ease',
                      }}
                      onFocus={(e) => { e.target.style.borderColor = '#0071E3'; e.target.style.boxShadow = '0 0 0 2px rgba(0,113,227,0.15)'; }}
                      onBlur={(e) => { e.target.style.borderColor = '#E8E8ED'; e.target.style.boxShadow = 'none'; }}
                    />
                    <select
                      value={r.role}
                      onChange={(e) => updateRecipient(i, 'role', e.target.value)}
                      style={{
                        width: '100%',
                        height: '28px',
                        padding: '0 8px',
                        fontSize: '12px',
                        border: '1px solid #E8E8ED',
                        borderRadius: '6px',
                        backgroundColor: '#FFFFFF',
                        color: '#1D1D1F',
                        outline: 'none',
                        boxSizing: 'border-box',
                        cursor: 'pointer',
                        transition: 'border-color 0.15s ease',
                      }}
                      onFocus={(e) => { e.target.style.borderColor = '#0071E3'; e.target.style.boxShadow = '0 0 0 2px rgba(0,113,227,0.15)'; }}
                      onBlur={(e) => { e.target.style.borderColor = '#E8E8ED'; e.target.style.boxShadow = 'none'; }}
                    >
                      <option value="signer">Signer</option>
                      <option value="cc">CC (copy)</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {/* MESSAGE section */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '10px', fontWeight: 600, color: '#6E6E73', textTransform: 'uppercase', letterSpacing: '0.06em', paddingBottom: '6px', borderBottom: '1px solid #E8E8ED', marginBottom: '8px' }}>
                Message
              </div>
              <input
                type="text"
                placeholder="Subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                aria-label="Email subject"
                style={{
                  width: '100%',
                  height: '28px',
                  padding: '0 8px',
                  fontSize: '12px',
                  border: '1px solid #E8E8ED',
                  borderRadius: '6px',
                  backgroundColor: '#FFFFFF',
                  color: '#1D1D1F',
                  outline: 'none',
                  marginBottom: '6px',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.15s ease',
                }}
                onFocus={(e) => { e.target.style.borderColor = '#0071E3'; e.target.style.boxShadow = '0 0 0 3px rgba(0,113,227,0.15)'; }}
                onBlur={(e) => { e.target.style.borderColor = '#E8E8ED'; e.target.style.boxShadow = 'none'; }}
              />
              <textarea
                placeholder="Optional message to recipients..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                aria-label="Message to recipients"
                style={{
                  width: '100%',
                  padding: '7px',
                  fontSize: '12px',
                  border: '1px solid #E8E8ED',
                  borderRadius: '6px',
                  backgroundColor: '#FFFFFF',
                  color: '#1D1D1F',
                  outline: 'none',
                  resize: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.15s ease',
                  fontFamily: 'inherit',
                  lineHeight: '1.5',
                }}
                onFocus={(e) => { e.target.style.borderColor = '#0071E3'; e.target.style.boxShadow = '0 0 0 3px rgba(0,113,227,0.15)'; }}
                onBlur={(e) => { e.target.style.borderColor = '#E8E8ED'; e.target.style.boxShadow = 'none'; }}
              />
            </div>

            {/* Error message */}
            {error && (
              <div role="alert" style={{
                backgroundColor: 'rgba(182,68,0,0.06)',
                border: '1px solid rgba(182,68,0,0.2)',
                color: '#B64400',
                fontSize: '13px',
                padding: '10px 12px',
                borderRadius: '8px',
                marginBottom: '16px',
                lineHeight: '1.4',
              }}>
                {error}
              </div>
            )}

            {/* Send button */}
            <MotionButton
              onClick={handleSend}
              disabled={sending || (user?.credits ?? 0) < 1}
              style={{
                width: '100%',
                height: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                backgroundColor: sending ? '#6E6E73' : '#0071E3',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '10px',
                fontSize: '15px',
                fontWeight: 500,
                cursor: sending || (user?.credits ?? 0) < 1 ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.15s ease',
                opacity: sending || (user?.credits ?? 0) < 1 ? 0.5 : 1,
              }}
              onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => { if (!sending && (user?.credits ?? 0) >= 1) (e.currentTarget as HTMLElement).style.backgroundColor = '#0066CC'; }}
              onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => { if (!sending) (e.currentTarget as HTMLElement).style.backgroundColor = '#0071E3'; }}
            >
              <Send style={{ width: '16px', height: '16px' }} />
              {sending ? 'Sending...' : (user?.credits ?? 0) < 1 ? 'No Credits — Buy to Send' : 'Send for Signing (1 credit)'}
            </MotionButton>

          </div>
        </div>

        {/* ── RIGHT: PDF CANVAS AREA ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: '#F5F5F7' }}>

          {/* Top action bar */}
          <div style={{
            backgroundColor: '#FFFFFF',
            borderBottom: '1px solid #E8E8ED',
            padding: '0 24px',
            height: '56px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}>
            {/* Left: back + doc name */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                onClick={() => navigate('/')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '14px',
                  color: '#0071E3',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 400,
                  padding: '4px 0',
                }}
              >
                <ChevronLeft style={{ width: '16px', height: '16px' }} />
                Dashboard
              </button>
              <span style={{ color: '#E8E8ED', fontSize: '18px', fontWeight: 300 }}>|</span>
              <h1 style={{ fontSize: '15px', fontWeight: 500, color: '#1D1D1F', margin: 0, maxWidth: '320px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {doc.name}
              </h1>
            </div>

            {/* Right: page nav + mobile panel toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {/* Mobile: toggle sidebar */}
              <button
                className="lg:hidden"
                onClick={() => setShowSidebar(!showSidebar)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#0071E3',
                  backgroundColor: 'rgba(0,113,227,0.06)',
                  border: '1px solid rgba(0,113,227,0.2)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                }}
              >
                <Users style={{ width: '14px', height: '14px' }} />
                {showSidebar ? 'Hide Panel' : 'Tools'}
              </button>

              {/* Page navigation */}
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                aria-label="Previous page"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  border: '1px solid #E8E8ED',
                  backgroundColor: currentPage <= 1 ? '#F5F5F7' : '#FFFFFF',
                  color: currentPage <= 1 ? '#C7C7CC' : '#1D1D1F',
                  cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <ChevronLeft style={{ width: '16px', height: '16px' }} />
              </button>

              <span style={{ fontSize: '13px', color: '#6E6E73', whiteSpace: 'nowrap', minWidth: '70px', textAlign: 'center' }}>
                Page {currentPage} of {doc.pageCount}
              </span>

              <button
                onClick={() => setCurrentPage((p) => Math.min(doc.pageCount, p + 1))}
                disabled={currentPage >= doc.pageCount}
                aria-label="Next page"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  border: '1px solid #E8E8ED',
                  backgroundColor: currentPage >= doc.pageCount ? '#F5F5F7' : '#FFFFFF',
                  color: currentPage >= doc.pageCount ? '#C7C7CC' : '#1D1D1F',
                  cursor: currentPage >= doc.pageCount ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <ChevronRight style={{ width: '16px', height: '16px' }} />
              </button>
            </div>
          </div>

          {/* Mobile toolbar — field type quick-access */}
          <div
            className="lg:hidden"
            style={{
              backgroundColor: '#FFFFFF',
              borderBottom: '1px solid #E8E8ED',
              padding: '8px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              overflowX: 'auto',
              flexShrink: 0,
            }}
          >
            <button
              onClick={handleSmartFill}
              disabled={detectingFields}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid #D1C4E9',
                backgroundColor: '#F3F0FF',
                color: '#7C3AED',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
                flexShrink: 0,
                whiteSpace: 'nowrap',
                minHeight: '44px',
              }}
            >
              {detectingFields ? <Loader2 style={{ width: '13px', height: '13px', animation: 'spin 0.8s linear infinite' }} /> : <Sparkles style={{ width: '13px', height: '13px' }} />}
              Smart Fill
            </button>
            {FIELD_TYPES.map((ft) => (
              <button
                key={ft.type}
                onClick={() => setDraggingField(draggingField === ft.type ? null : ft.type)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '6px 10px',
                  borderRadius: '8px',
                  border: `1px solid ${draggingField === ft.type ? '#0071E3' : '#E8E8ED'}`,
                  backgroundColor: draggingField === ft.type ? 'rgba(0,113,227,0.08)' : '#FFFFFF',
                  color: draggingField === ft.type ? '#0071E3' : '#1D1D1F',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                  minHeight: '44px',
                }}
              >
                <ft.icon style={{ width: '12px', height: '12px' }} />
                {ft.label}
              </button>
            ))}
            <button
              onClick={() => setDraggingField(draggingField === 'self-text' ? null : 'self-text')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 10px',
                borderRadius: '8px',
                border: `1px solid ${draggingField === 'self-text' ? '#059669' : '#E8E8ED'}`,
                backgroundColor: draggingField === 'self-text' ? 'rgba(5,150,105,0.08)' : '#FFFFFF',
                color: draggingField === 'self-text' ? '#059669' : '#1D1D1F',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
                flexShrink: 0,
                whiteSpace: 'nowrap',
                minHeight: '44px',
              }}
            >
              <Edit3 style={{ width: '12px', height: '12px' }} />
              My Text
            </button>
          </div>

          {/* Placement mode banner */}
          {draggingField && (
            <div style={{
              backgroundColor: draggingField.startsWith('self-') ? 'rgba(5,150,105,0.08)' : 'rgba(0,113,227,0.08)',
              borderBottom: `1px solid ${draggingField.startsWith('self-') ? 'rgba(5,150,105,0.2)' : 'rgba(0,113,227,0.2)'}`,
              padding: '8px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              fontSize: '13px',
              fontWeight: 500,
              color: draggingField.startsWith('self-') ? '#059669' : '#0071E3',
              flexShrink: 0,
            }}>
              <div style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: 'currentColor',
                animation: 'pulse 1.5s ease-in-out infinite',
              }} />
              Click anywhere on the document to place the <strong>{draggingField.replace('self-', '')}</strong> field &mdash; or press Escape to cancel
            </div>
          )}

          {/* PDF canvas scroll area */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '32px 24px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            {/* PDF page container */}
            <div
              ref={pageRef}
              style={{
                position: 'relative',
                backgroundColor: '#FFFFFF',
                boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                borderRadius: '8px',
                overflow: 'visible',
                cursor: draggingField ? 'crosshair' : 'default',
                outline: draggingField ? '2px solid rgba(0,113,227,0.4)' : 'none',
                outlineOffset: draggingField ? '3px' : '0',
                transition: 'outline 0.15s ease',
              }}
              onClick={handlePageClick}
            >
              <PdfDocument
                file={pdfFile}
                loading={
                  <div style={{
                    width: `${pdfWidth}px`,
                    aspectRatio: '612/792',
                    backgroundColor: '#F5F5F7',
                    borderRadius: '8px',
                    animation: 'pulse 1.5s ease-in-out infinite',
                  }} />
                }
                onLoadSuccess={() => {}}
              >
                <Page
                  pageNumber={currentPage}
                  width={pdfWidth}
                  renderTextLayer={false}
                  renderAnnotationLayer={true}
                  onLoadSuccess={() => {}}
                />
              </PdfDocument>

              {/* Placed fields overlay */}
              {pageFields.map((field) => (
                <FieldOverlay
                  key={field.id}
                  field={field}
                  isSelected={selectedField === field.id}
                  color={field.recipientIndex === -1 ? '#059669' : RECIPIENT_COLORS[field.recipientIndex % RECIPIENT_COLORS.length]}
                  isSelfFill={field.recipientIndex === -1}
                  pageRef={pageRef}
                  recipients={recipients}
                  draggingPlacedField={draggingPlacedField}
                  setDraggingPlacedField={setDraggingPlacedField}
                  onSelect={(id) => setSelectedField(id === selectedField ? null : id)}
                  onUpdate={updateField}
                  onRemove={removeField}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Smart Fill Modal */}
      {showSmartFill && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: '16px',
            backdropFilter: 'blur(4px)',
          }}
          onClick={() => setShowSmartFill(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '18px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
              maxWidth: '520px',
              width: '100%',
              maxHeight: '80vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '20px 24px',
              borderBottom: '1px solid #E8E8ED',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  backgroundColor: '#F3F0FF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Sparkles style={{ width: '18px', height: '18px', color: '#7C3AED' }} />
                </div>
                <div>
                  <h3 style={{ fontSize: '17px', fontWeight: 600, color: '#1D1D1F', margin: 0 }}>Smart Fill</h3>
                  <p style={{ fontSize: '13px', color: '#6E6E73', margin: 0 }}>Answer the questions below to fill the form</p>
                </div>
              </div>
              <button
                onClick={() => setShowSmartFill(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: '#6E6E73',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F5F5F7'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <X style={{ width: '16px', height: '16px' }} />
              </button>
            </div>

            {/* Modal body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
              {detectingFields ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 0' }}>
                  <Loader2 style={{ width: '32px', height: '32px', color: '#7C3AED', animation: 'spin 0.8s linear infinite', marginBottom: '12px' }} />
                  <p style={{ fontSize: '14px', color: '#6E6E73', margin: 0 }}>Analyzing document...</p>
                </div>
              ) : detectedFields.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 0' }}>
                  <p style={{ fontSize: '14px', color: '#6E6E73', marginBottom: '4px' }}>No form fields detected</p>
                  <p style={{ fontSize: '13px', color: '#6E6E73', opacity: 0.7 }}>Try placing fields manually instead</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {detectedFields.map((field, i) => (
                    <div key={field.type + i}>
                      <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#1D1D1F', marginBottom: '6px' }}>
                        {field.question}
                        {field.context && (
                          <span style={{ fontSize: '11px', color: '#6E6E73', fontWeight: 400, marginLeft: '8px' }}>
                            found: &ldquo;...{field.context.substring(0, 40)}...&rdquo;
                          </span>
                        )}
                      </label>
                      {field.fieldType === 'date' ? (
                        <input
                          type="date"
                          value={field.answer}
                          onChange={(e) => {
                            setDetectedFields((prev) =>
                              prev.map((f, j) => j === i ? { ...f, answer: e.target.value } : f)
                            );
                          }}
                          style={{
                            width: '100%',
                            height: '40px',
                            padding: '0 12px',
                            fontSize: '14px',
                            border: '1px solid #E8E8ED',
                            borderRadius: '8px',
                            backgroundColor: '#FFFFFF',
                            color: '#1D1D1F',
                            outline: 'none',
                            boxSizing: 'border-box',
                          }}
                          onFocus={(e) => { e.target.style.borderColor = '#0071E3'; e.target.style.boxShadow = '0 0 0 3px rgba(0,113,227,0.15)'; }}
                          onBlur={(e) => { e.target.style.borderColor = '#E8E8ED'; e.target.style.boxShadow = 'none'; }}
                        />
                      ) : field.fieldType === 'signature' ? (
                        <div style={{ fontSize: '13px', color: '#6E6E73', fontStyle: 'italic', padding: '8px 0' }}>
                          Signature fields will be added for recipients to sign
                        </div>
                      ) : (
                        <input
                          type="text"
                          value={field.answer}
                          onChange={(e) => {
                            setDetectedFields((prev) =>
                              prev.map((f, j) => j === i ? { ...f, answer: e.target.value } : f)
                            );
                          }}
                          placeholder={`Enter ${field.question.toLowerCase()}`}
                          style={{
                            width: '100%',
                            height: '40px',
                            padding: '0 12px',
                            fontSize: '14px',
                            border: '1px solid #E8E8ED',
                            borderRadius: '8px',
                            backgroundColor: '#FFFFFF',
                            color: '#1D1D1F',
                            outline: 'none',
                            boxSizing: 'border-box',
                          }}
                          onFocus={(e) => { e.target.style.borderColor = '#0071E3'; e.target.style.boxShadow = '0 0 0 3px rgba(0,113,227,0.15)'; }}
                          onBlur={(e) => { e.target.style.borderColor = '#E8E8ED'; e.target.style.boxShadow = 'none'; }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal footer */}
            {detectedFields.length > 0 && !detectingFields && (
              <div style={{
                padding: '16px 24px',
                borderTop: '1px solid #E8E8ED',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <p style={{ fontSize: '13px', color: '#6E6E73', margin: 0 }}>
                  {detectedFields.filter((f) => f.answer.trim()).length} of {detectedFields.filter((f) => f.fieldType !== 'signature').length} answered
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    onClick={() => setShowSmartFill(false)}
                    style={{
                      padding: '8px 16px',
                      fontSize: '14px',
                      fontWeight: 400,
                      color: '#6E6E73',
                      backgroundColor: 'transparent',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'background-color 0.15s ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F5F5F7'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={applySmartFill}
                    disabled={detectedFields.filter((f) => f.answer.trim()).length === 0}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 20px',
                      fontSize: '14px',
                      fontWeight: 500,
                      color: '#FFFFFF',
                      backgroundColor: '#7C3AED',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: detectedFields.filter((f) => f.answer.trim()).length === 0 ? 'not-allowed' : 'pointer',
                      opacity: detectedFields.filter((f) => f.answer.trim()).length === 0 ? 0.5 : 1,
                      transition: 'background-color 0.15s ease',
                    }}
                    onMouseEnter={(e) => { if (detectedFields.filter((f) => f.answer.trim()).length > 0) e.currentTarget.style.backgroundColor = '#6D28D9'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#7C3AED'; }}
                  >
                    <Sparkles style={{ width: '14px', height: '14px' }} />
                    Place {detectedFields.filter((f) => f.answer.trim()).length} Fields
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </PageEntrance>
  );
}
