import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Document as PdfDocument, Page, pdfjs } from 'react-pdf';
import { api } from '../lib/api';
import type { SigningDocument } from '../lib/api';
import { PenTool, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { PageEntrance, MotionButton, SuccessEntrance, ModalOverlay, motion } from '../components/Motion';
import { SuccessIllustration, WaitingIllustration } from '../components/Illustrations';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface FieldValue {
  id: string;
  value: string;
}

export default function SigningView() {
  const { link } = useParams<{ link: string }>();
  const [signingDoc, setSigningDoc] = useState<SigningDocument | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [fieldValues, setFieldValues] = useState<FieldValue[]>([]);
  const [showSignPad, setShowSignPad] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [allComplete, setAllComplete] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const [viewportWidth, setViewportWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 612);

  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const pdfWidth = Math.min(612, viewportWidth - 32);

  useEffect(() => {
    if (!link) return;
    api.getSigningDocument(link).then((doc) => {
      setSigningDoc(doc);
      setFieldValues(doc.fields.map((f) => ({ id: f.id, value: f.value || '' })));
    }).catch((err) => {
      setError(err instanceof Error ? err.message : 'Failed to load document');
    });
  }, [link]);

  const updateFieldValue = (fieldId: string, value: string) => {
    setFieldValues((prev) => prev.map((fv) => fv.id === fieldId ? { ...fv, value } : fv));
  };

  // Canvas signature methods
  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    isDrawing.current = true;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const point = 'touches' in e
      ? { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top }
      : { x: e.clientX - rect.left, y: e.clientY - rect.top };
    lastPoint.current = point;
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing.current || !canvasRef.current || !lastPoint.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const point = 'touches' in e
      ? { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top }
      : { x: e.clientX - rect.left, y: e.clientY - rect.top };

    ctx.beginPath();
    ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
    ctx.lineTo(point.x, point.y);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();
    lastPoint.current = point;
  };

  const stopDrawing = () => {
    isDrawing.current = false;
    lastPoint.current = null;
  };

  const isCanvasBlank = (canvas: HTMLCanvasElement): boolean => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return true;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > 0 && (data[i] < 250 || data[i + 1] < 250 || data[i + 2] < 250)) {
        return false;
      }
    }
    return true;
  };

  const applySignature = (fieldId: string) => {
    if (!canvasRef.current) return;
    if (isCanvasBlank(canvasRef.current)) {
      setError('Please draw your signature before applying');
      return;
    }
    const dataUrl = canvasRef.current.toDataURL('image/png');
    updateFieldValue(fieldId, dataUrl);
    setShowSignPad(null);
  };

  const clearCanvas = () => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  };

  const handleSubmit = async () => {
    if (!link || !signingDoc) return;

    if (!window.confirm('Are you sure you want to submit? You cannot change your signature after submission.')) return;

    // Validate required fields
    const requiredFields = signingDoc.fields.filter((f) => f.required);
    for (const field of requiredFields) {
      const value = fieldValues.find((fv) => fv.id === field.id);
      if (!value || !value.value) {
        setError(`Please fill all required fields (missing ${field.type} field)`);
        return;
      }
    }

    setSubmitting(true);
    setError('');

    try {
      const result = await api.completeSigning(link, fieldValues.filter((fv) => fv.value));
      setCompleted(true);
      setAllComplete(result.allComplete);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Error state (no document loaded) ────────────────────────────────────────
  if (error && !signingDoc) {
    return (
      <div
        style={{
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#F5F5F7',
          padding: 16,
        }}
      >
        <div
          style={{
            maxWidth: 420,
            width: '100%',
            background: '#FFFFFF',
            border: '1px solid #E8E8ED',
            borderRadius: 18,
            boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
            padding: '40px 32px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: '#FFF2ED',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="#B64400" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#1D1D1F', marginBottom: 8 }}>
            Unable to load document
          </div>
          <p style={{ fontSize: 14, color: '#6E6E73' }}>{error}</p>
        </div>
      </div>
    );
  }

  // ── Success / completed state ────────────────────────────────────────────────
  if (completed) {
    return (
      <div
        style={{
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#F5F5F7',
          padding: 16,
        }}
      >
        <SuccessEntrance
          style={{
            maxWidth: 440,
            width: '100%',
            background: '#FFFFFF',
            border: '1px solid #E8E8ED',
            borderRadius: 18,
            boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
            padding: '48px 40px',
            textAlign: 'center',
          }}
        >
          {/* Large green checkmark */}
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              background: '#34C759',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px',
            }}
          >
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
              <path d="M8 18l7 7 13-13" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <SuccessIllustration size={100} className="mx-auto mb-2" />

          <h2 style={{ fontSize: 26, fontWeight: 700, color: '#1D1D1F', marginBottom: 12 }}>
            Document Signed
          </h2>
          <p style={{ fontSize: 15, color: '#6E6E73', lineHeight: 1.5, maxWidth: 320, margin: '0 auto' }}>
            {allComplete
              ? 'All parties have signed. The completed document will be sent to everyone.'
              : 'Your signature has been recorded. Waiting for other signers to complete.'}
          </p>

          {!allComplete && (
            <div style={{ marginTop: 28 }}>
              <WaitingIllustration size={90} className="mx-auto" />
              <p style={{ fontSize: 13, color: '#6E6E73', marginTop: 12 }}>Waiting for remaining signers…</p>
            </div>
          )}
        </SuccessEntrance>
      </div>
    );
  }

  // ── Loading state ────────────────────────────────────────────────────────────
  if (!signingDoc) {
    return (
      <div
        style={{
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#F5F5F7',
        }}
      >
        <div
          className="animate-spin"
          style={{
            width: 36,
            height: 36,
            border: '3px solid #E8E8ED',
            borderTopColor: '#0071E3',
            borderRadius: '50%',
          }}
        />
      </div>
    );
  }

  const pageFields = signingDoc.fields.filter((f) => f.page === currentPage);
  const filledCount = fieldValues.filter((fv) => fv.value).length;
  const totalRequired = signingDoc.fields.filter((f) => f.required).length;

  return (
    <PageEntrance style={{ minHeight: '100dvh', background: '#F5F5F7', display: 'flex', flexDirection: 'column' }}>

      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <div
        style={{
          background: '#FFFFFF',
          borderBottom: '1px solid #E8E8ED',
          height: 56,
          position: 'sticky',
          top: 0,
          zIndex: 40,
          display: 'flex',
          alignItems: 'center',
          padding: '0 20px',
        }}
      >
        <div
          style={{
            maxWidth: 900,
            width: '100%',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          {/* Left: branding + doc info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <PenTool style={{ width: 18, height: 18, color: '#0071E3' }} />
              <span style={{ fontSize: 15, fontWeight: 700, color: '#0071E3' }}>eSignatureGO</span>
            </div>
            <div
              style={{
                width: 1,
                height: 20,
                background: '#E8E8ED',
                flexShrink: 0,
              }}
            />
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: '#1D1D1F',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: 260,
                }}
              >
                {signingDoc.subject}
              </div>
              <div style={{ fontSize: 12, color: '#6E6E73' }}>
                Signing as {signingDoc.recipientName}
              </div>
            </div>
          </div>

          {/* Right: progress counter */}
          <div
            style={{
              fontSize: 13,
              color: '#6E6E73',
              flexShrink: 0,
              background: '#F5F5F7',
              border: '1px solid #E8E8ED',
              borderRadius: 6,
              padding: '4px 12px',
            }}
          >
            <span style={{ fontWeight: 600, color: '#1D1D1F' }}>{filledCount}</span>
            <span>/{totalRequired} fields</span>
          </div>
        </div>
      </div>

      {/* ── Scrollable body ──────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 96 }}>

        {/* Error banner */}
        {error && (
          <div style={{ maxWidth: 900, margin: '16px auto 0', padding: '0 16px' }}>
            <div
              style={{
                background: '#FFF2ED',
                color: '#B64400',
                fontSize: 14,
                padding: '12px 16px',
                borderRadius: 8,
                border: '1px solid #FFDDC8',
              }}
            >
              {error}
            </div>
          </div>
        )}

        {/* Optional sender message */}
        {signingDoc.message && (
          <div style={{ maxWidth: 900, margin: '16px auto 0', padding: '0 16px' }}>
            <div
              style={{
                background: '#EBF3FE',
                color: '#0071E3',
                fontSize: 14,
                padding: '12px 16px',
                borderRadius: 8,
                border: '1px solid #C0DAFD',
              }}
            >
              {signingDoc.message}
            </div>
          </div>
        )}

        {/* Page navigation */}
        <div
          style={{
            maxWidth: 900,
            margin: '16px auto 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            aria-label="Previous page"
            style={{
              minWidth: 44,
              minHeight: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'none',
              border: 'none',
              borderRadius: 8,
              cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
              color: currentPage <= 1 ? '#C7C7CC' : '#1D1D1F',
              transition: 'background 0.15s',
            }}
          >
            <ChevronLeft style={{ width: 20, height: 20 }} />
          </button>

          <span
            style={{
              fontSize: 14,
              color: '#6E6E73',
              background: '#FFFFFF',
              border: '1px solid #E8E8ED',
              borderRadius: 8,
              padding: '6px 16px',
              fontWeight: 500,
            }}
          >
            Page {currentPage} of {signingDoc.pageCount}
          </span>

          <button
            onClick={() => setCurrentPage((p) => Math.min(signingDoc.pageCount, p + 1))}
            disabled={currentPage >= signingDoc.pageCount}
            aria-label="Next page"
            style={{
              minWidth: 44,
              minHeight: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'none',
              border: 'none',
              borderRadius: 8,
              cursor: currentPage >= signingDoc.pageCount ? 'not-allowed' : 'pointer',
              color: currentPage >= signingDoc.pageCount ? '#C7C7CC' : '#1D1D1F',
              transition: 'background 0.15s',
            }}
          >
            <ChevronRight style={{ width: 20, height: 20 }} />
          </button>
        </div>

        {/* PDF + field overlays */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            padding: '16px 16px 0',
          }}
        >
          <div
            style={{
              position: 'relative',
              background: '#FFFFFF',
              boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
              borderRadius: 4,
            }}
          >
            <PdfDocument
              file={`/api/sign/${link}/pdf`}
              loading={
                <div
                  className="animate-pulse"
                  style={{
                    width: pdfWidth,
                    height: pdfWidth * (792 / 612),
                    background: '#E8E8ED',
                    borderRadius: 4,
                  }}
                />
              }
            >
              <Page
                pageNumber={currentPage}
                width={pdfWidth}
                renderTextLayer={true}
                renderAnnotationLayer={true}
              />
            </PdfDocument>

            {/* Field overlays — scaled to match responsive PDF width */}
            {pageFields.map((field) => {
              const fieldValue = fieldValues.find((fv) => fv.id === field.id);
              const isFilled = !!fieldValue?.value;
              const scale = pdfWidth / 612;

              const isSignatureField = field.type === 'signature';
              const isCheckbox = field.type === 'checkbox';

              return (
                <div
                  key={field.id}
                  style={{
                    position: 'absolute',
                    left: field.x * scale,
                    top: field.y * scale,
                    width: field.width * scale,
                    height: field.height * scale,
                    cursor: isSignatureField ? 'pointer' : 'default',
                    background: isFilled
                      ? 'rgba(52,199,89,0.08)'
                      : isSignatureField
                        ? 'rgba(0,113,227,0.08)'
                        : '#F5F5F7',
                    border: isFilled
                      ? '2px solid #34C759'
                      : isSignatureField
                        ? '2px dashed #0071E3'
                        : '1px solid #E8E8ED',
                    borderRadius: 4,
                    transition: 'background 0.15s, border-color 0.15s',
                    overflow: 'hidden',
                  }}
                  onClick={() => {
                    if (field.type === 'signature') {
                      setShowSignPad(field.id);
                      requestAnimationFrame(() => {
                        if (canvasRef.current) {
                          const ctx = canvasRef.current.getContext('2d');
                          if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
                        }
                      });
                    }
                  }}
                >
                  {/* Required indicator */}
                  {field.required && !isFilled && (
                    <span
                      style={{
                        position: 'absolute',
                        top: 2,
                        right: 4,
                        fontSize: 10,
                        color: '#B64400',
                        fontWeight: 700,
                        lineHeight: 1,
                        zIndex: 1,
                      }}
                    >
                      *
                    </span>
                  )}

                  {isSignatureField ? (
                    isFilled && fieldValue?.value ? (
                      <img src={fieldValue.value} alt="Signature" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    ) : (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          height: '100%',
                          gap: 4,
                          color: '#0071E3',
                          fontSize: 12,
                          fontWeight: 500,
                          userSelect: 'none',
                        }}
                      >
                        <PenTool style={{ width: 12, height: 12 }} />
                        Click to sign
                      </div>
                    )
                  ) : isCheckbox ? (
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '100%',
                        height: '100%',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={fieldValue?.value === 'true'}
                        onChange={(e) => updateFieldValue(field.id, e.target.checked ? 'true' : '')}
                        style={{ width: 16, height: 16, accentColor: '#0071E3', cursor: 'pointer' }}
                      />
                    </label>
                  ) : (
                    <input
                      type={field.type === 'date' ? 'date' : 'text'}
                      value={fieldValue?.value || ''}
                      onChange={(e) => updateFieldValue(field.id, e.target.value)}
                      placeholder={field.placeholder || (field.type === 'date' ? '' : 'Type here...')}
                      style={{
                        width: '100%',
                        height: '100%',
                        padding: '0 6px',
                        fontSize: 13,
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        color: '#1D1D1F',
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Sticky bottom action bar ─────────────────────────────────────────── */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: '#FFFFFF',
          borderTop: '1px solid #E8E8ED',
          padding: '12px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          zIndex: 40,
        }}
      >
        {/* Progress indicator */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, maxWidth: 200 }}>
          <div style={{ fontSize: 12, color: '#6E6E73', fontWeight: 500 }}>
            {filledCount} of {totalRequired} required fields
          </div>
          <div
            style={{
              height: 4,
              background: '#E8E8ED',
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: totalRequired > 0 ? `${(filledCount / totalRequired) * 100}%` : '0%',
                background: filledCount === totalRequired ? '#34C759' : '#0071E3',
                borderRadius: 2,
                transition: 'width 0.3s ease-out',
              }}
            />
          </div>
        </div>

        {/* Submit button */}
        <MotionButton
          onClick={handleSubmit}
          disabled={submitting}
          style={{
            background: '#0071E3',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: 8,
            height: 44,
            padding: '0 24px',
            fontSize: 15,
            fontWeight: 600,
            cursor: submitting ? 'not-allowed' : 'pointer',
            opacity: submitting ? 0.7 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'background 0.15s ease-in-out',
            flexShrink: 0,
          }}
          onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
            if (!submitting) (e.currentTarget as HTMLButtonElement).style.background = '#0066CC';
          }}
          onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
            (e.currentTarget as HTMLButtonElement).style.background = '#0071E3';
          }}
        >
          <Check style={{ width: 16, height: 16 }} />
          {submitting ? 'Submitting...' : 'Submit Signature'}
        </MotionButton>
      </div>

      {/* ── Signature pad modal ──────────────────────────────────────────────── */}
      <ModalOverlay isOpen={!!showSignPad} onClose={() => setShowSignPad(null)}>
        <div
          style={{
            background: '#FFFFFF',
            borderRadius: 18,
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            maxWidth: 520,
            width: '100%',
            padding: '28px 24px 24px',
          }}
        >
          <h3
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: '#1D1D1F',
              marginBottom: 20,
            }}
          >
            Draw Your Signature
          </h3>

          {/* Canvas */}
          <div
            style={{
              background: '#F5F5F7',
              border: '1px solid #E8E8ED',
              borderRadius: 8,
              marginBottom: 20,
              overflow: 'hidden',
              touchAction: 'none',
            }}
          >
            <canvas
              ref={canvasRef}
              width={Math.min(460, viewportWidth - 64) * (typeof window !== 'undefined' ? Math.min(window.devicePixelRatio, 2) : 1)}
              height={Math.max(140, Math.round(Math.min(460, viewportWidth - 64) * (160 / 460))) * (typeof window !== 'undefined' ? Math.min(window.devicePixelRatio, 2) : 1)}
              style={{
                width: Math.min(460, viewportWidth - 64),
                height: Math.max(140, Math.round(Math.min(460, viewportWidth - 64) * (160 / 460))),
                cursor: 'crosshair',
                display: 'block',
              }}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={(e) => { e.preventDefault(); startDrawing(e); }}
              onTouchMove={(e) => { e.preventDefault(); draw(e); }}
              onTouchEnd={(e) => { e.preventDefault(); stopDrawing(); }}
            />
          </div>

          {/* Modal action buttons */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {/* Clear — left-aligned */}
            <MotionButton
              onClick={clearCanvas}
              style={{
                background: '#F5F5F7',
                color: '#1D1D1F',
                border: '1px solid #E8E8ED',
                borderRadius: 8,
                height: 44,
                padding: '0 16px',
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
            >
              Clear
            </MotionButton>

            <div style={{ flex: 1 }} />

            {/* Cancel */}
            <MotionButton
              onClick={() => setShowSignPad(null)}
              style={{
                background: '#F5F5F7',
                color: '#1D1D1F',
                border: '1px solid #E8E8ED',
                borderRadius: 8,
                height: 44,
                padding: '0 16px',
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
            >
              Cancel
            </MotionButton>

            {/* Apply — primary */}
            <MotionButton
              onClick={() => showSignPad && applySignature(showSignPad)}
              style={{
                background: '#0071E3',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 8,
                height: 44,
                padding: '0 20px',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
                (e.currentTarget as HTMLButtonElement).style.background = '#0066CC';
              }}
              onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
                (e.currentTarget as HTMLButtonElement).style.background = '#0071E3';
              }}
            >
              Apply Signature
            </MotionButton>
          </div>
        </div>
      </ModalOverlay>
    </PageEntrance>
  );
}
