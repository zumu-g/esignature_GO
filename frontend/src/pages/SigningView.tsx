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

  if (error && !signingDoc) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg border border-gray-200 p-6 text-center">
          <div className="text-red-500 text-lg font-medium mb-2">Unable to load document</div>
          <p className="text-sm text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <SuccessEntrance className="max-w-md w-full bg-white rounded-lg border border-gray-200 p-6 text-center">
          <SuccessIllustration size={140} className="mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Document Signed!</h2>
          <p className="text-sm text-gray-500">
            {allComplete
              ? 'All parties have signed. The completed document will be sent to everyone.'
              : 'Your signature has been recorded. Waiting for other signers to complete.'
            }
          </p>
          {!allComplete && (
            <div className="mt-4">
              <WaitingIllustration size={100} className="mx-auto" />
            </div>
          )}
        </SuccessEntrance>
      </div>
    );
  }

  if (!signingDoc) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  const pageFields = signingDoc.fields.filter((f) => f.page === currentPage - 1);
  const filledCount = fieldValues.filter((fv) => fv.value).length;
  const totalRequired = signingDoc.fields.filter((f) => f.required).length;

  return (
    <PageEntrance className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-lg font-bold text-blue-600">
              <PenTool className="h-5 w-5" />
              eSignatureGO
            </div>
            <p className="text-xs text-gray-500">
              {signingDoc.subject} - Signing as {signingDoc.recipientName}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">
              {filledCount}/{totalRequired} fields completed
            </span>
            <MotionButton
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-green-600 text-white px-4 py-2.5 rounded-md text-sm font-medium hover:bg-green-700 active:bg-green-800 disabled:opacity-50 transition-colors duration-150 flex items-center gap-1.5"
            >
              <Check className="h-4 w-4" />
              {submitting ? 'Submitting...' : 'Finish Signing'}
            </MotionButton>
          </div>
        </div>
      </div>

      {error && (
        <div className="max-w-4xl mx-auto mt-4 px-4">
          <div className="bg-red-50 text-red-600 text-sm p-3 rounded-md">{error}</div>
        </div>
      )}

      {/* Message */}
      {signingDoc.message && (
        <div className="max-w-4xl mx-auto mt-4 px-4">
          <div className="bg-blue-50 text-blue-700 text-sm p-3 rounded-md">
            {signingDoc.message}
          </div>
        </div>
      )}

      {/* Page navigation */}
      <div className="max-w-4xl mx-auto flex items-center justify-center gap-3 py-3">
        <button
          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          disabled={currentPage <= 1}
          className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="text-sm text-gray-600">
          Page {currentPage} of {signingDoc.pageCount}
        </span>
        <button
          onClick={() => setCurrentPage((p) => Math.min(signingDoc.pageCount, p + 1))}
          disabled={currentPage >= signingDoc.pageCount}
          className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* PDF with fields */}
      <div className="flex justify-center pb-8 px-4">
        <div className="relative bg-white shadow-lg">
          <PdfDocument
            file={`/api/sign/${link}/pdf`}
            loading={<div className="w-[612px] h-[792px] bg-gray-100 animate-pulse" />}
          >
            <Page pageNumber={currentPage} width={pdfWidth} renderTextLayer={true} renderAnnotationLayer={true} />
          </PdfDocument>

          {/* Field overlays */}
          {pageFields.map((field) => {
            const fieldValue = fieldValues.find((fv) => fv.id === field.id);
            const isFilled = !!fieldValue?.value;

            return (
              <div
                key={field.id}
                className={`absolute border-2 rounded cursor-pointer transition-colors ${
                  isFilled ? 'border-green-400 bg-green-50/50' : 'border-blue-400 bg-blue-50/50 hover:bg-blue-100/50'
                }`}
                style={{
                  left: field.x,
                  top: field.y,
                  width: field.width,
                  height: field.height,
                }}
                onClick={() => {
                  if (field.type === 'signature') {
                    setShowSignPad(field.id);
                  }
                }}
              >
                {field.type === 'signature' ? (
                  isFilled && fieldValue?.value ? (
                    <img src={fieldValue.value} alt="Signature" className="w-full h-full object-contain" />
                  ) : (
                    <div className="flex items-center justify-center h-full text-blue-500 text-xs gap-1">
                      <PenTool className="h-3 w-3" />
                      Click to sign
                    </div>
                  )
                ) : field.type === 'checkbox' ? (
                  <label className="flex items-center justify-center w-full h-full cursor-pointer">
                    <input
                      type="checkbox"
                      checked={fieldValue?.value === 'true'}
                      onChange={(e) => updateFieldValue(field.id, e.target.checked ? 'true' : '')}
                      className="w-4 h-4 text-blue-600"
                    />
                  </label>
                ) : (
                  <input
                    type={field.type === 'date' ? 'date' : 'text'}
                    value={fieldValue?.value || ''}
                    onChange={(e) => updateFieldValue(field.id, e.target.value)}
                    placeholder={field.placeholder || (field.type === 'date' ? '' : 'Type here...')}
                    className="w-full h-full px-1 text-sm bg-transparent border-none outline-none"
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Signature pad modal */}
      <ModalOverlay isOpen={!!showSignPad} onClose={() => setShowSignPad(null)}>
        <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Draw Your Signature</h3>

          <div className="border-2 border-gray-200 rounded-lg mb-4 touch-none">
            <canvas
              ref={canvasRef}
              width={Math.min(460, viewportWidth - 64)}
              height={Math.round(Math.min(460, viewportWidth - 64) * (160 / 460))}
              className="w-full cursor-crosshair"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
          </div>

          <div className="flex items-center gap-2">
            <MotionButton
              onClick={clearCanvas}
              className="px-4 py-2.5 border border-gray-200 rounded-md text-sm text-gray-600 hover:bg-gray-50 active:bg-gray-100 transition-colors duration-150"
            >
              Clear
            </MotionButton>
            <div className="flex-1" />
            <MotionButton
              onClick={() => setShowSignPad(null)}
              className="px-4 py-2.5 border border-gray-200 rounded-md text-sm text-gray-600 hover:bg-gray-50 active:bg-gray-100 transition-colors duration-150"
            >
              Cancel
            </MotionButton>
            <MotionButton
              onClick={() => showSignPad && applySignature(showSignPad)}
              className="px-4 py-2.5 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 active:bg-blue-800 transition-colors duration-150"
            >
              Apply Signature
            </MotionButton>
          </div>
        </div>
      </ModalOverlay>
    </PageEntrance>
  );
}
