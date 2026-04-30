import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api } from '../lib/api';
import type { Document } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { Upload, FileText, Clock, CheckCircle, Send, Trash2, Download, Link as LinkIcon, Loader2, Eye } from 'lucide-react';
import { PageEntrance, FadeIn } from '../components/Motion';
import { EmptyDocumentsIllustration } from '../components/Illustrations';

// ─── Apple-style design tokens (inline styles where Tailwind can't express exact values) ───

const STATUS_BADGE: Record<string, React.CSSProperties> = {
  draft: { background: '#F5F5F7', color: '#6E6E73' },
  sent: { background: 'rgba(0,113,227,0.1)', color: '#0071E3' },
  completed: { background: 'rgba(52,199,89,0.1)', color: '#34C759' },
  voided: { background: 'rgba(182,68,0,0.1)', color: '#B64400' },
};

const cardBase: React.CSSProperties = {
  background: '#FFFFFF',
  border: '1px solid #E8E8ED',
  borderRadius: 18,
  boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
  padding: 20,
  transition: 'box-shadow 0.2s ease-out, transform 0.2s ease-out',
};

export default function Dashboard() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadDocuments = useCallback(async () => {
    try {
      const docs = await api.getDocuments();
      setDocuments(docs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setLoadingDocs(false);
    }
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError('');
    try {
      const doc = await api.uploadDocument(file);
      navigate(`/prepare/${doc.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file || file.type !== 'application/pdf') return;

    setUploading(true);
    setError('');
    try {
      const doc = await api.uploadDocument(file);
      navigate(`/prepare/${doc.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleCopyLinks = (docId: string, recipients: { name: string; role: string; uniqueLink: string }[]) => {
    const links = recipients
      .filter((r) => r.role === 'signer')
      .map((r) => `${r.name}: ${window.location.origin}/sign/${r.uniqueLink}`)
      .join('\n');
    navigator.clipboard.writeText(links);
    setCopied(docId);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleDelete = async (id: string) => {
    const doc = documents.find((d) => d.id === id);
    if (doc?.status === 'sent') {
      setError('This document has active signing links. Void it first before deleting.');
      return;
    }
    if (!confirm('Delete this document?')) return;
    try {
      await api.deleteDocument(id);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const filteredDocuments = documents.filter((d) => {
    const matchSearch = !search || d.name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || d.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const StatusBadge = ({ status }: { status: string }) => (
    <span
      style={{
        ...(STATUS_BADGE[status] || STATUS_BADGE.draft),
        fontSize: 12,
        fontWeight: 600,
        padding: '2px 8px',
        borderRadius: 4,
        display: 'inline-block',
        letterSpacing: 0,
      }}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );

  const StatusIcon = ({ status }: { status: string }) => {
    switch (status) {
      case 'draft': return <Clock className="h-4 w-4" style={{ color: '#6E6E73' }} />;
      case 'sent': return <Send className="h-4 w-4" style={{ color: '#0071E3' }} />;
      case 'completed': return <CheckCircle className="h-4 w-4" style={{ color: '#34C759' }} />;
      default: return <FileText className="h-4 w-4" style={{ color: '#6E6E73' }} />;
    }
  };

  return (
    <div style={{ background: '#F5F5F7', minHeight: '100vh' }}>
      <PageEntrance>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '40px 40px 60px' }}>

          {/* ── Page header ── */}
          <div className="flex items-start justify-between mb-8">
            <div>
              <h1 style={{ fontSize: 30, fontWeight: 600, color: '#1D1D1F', lineHeight: 1.2, margin: 0 }}>
                Documents
              </h1>
              <p style={{ fontSize: 14, color: '#6E6E73', marginTop: 4 }}>
                {user?.credits ?? 0} credit{(user?.credits ?? 0) !== 1 ? 's' : ''} remaining
              </p>
            </div>

            <motion.button
              whileHover={uploading ? {} : { scale: 1.02 }}
              whileTap={uploading ? {} : { scale: 0.97 }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: uploading ? '#6E6E73' : '#0071E3',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 8,
                height: 44,
                padding: '0 24px',
                fontSize: 14,
                fontWeight: 600,
                cursor: uploading ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s ease-in-out',
              }}
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              onMouseEnter={(e) => { if (!uploading) (e.currentTarget as HTMLElement).style.background = '#0066CC'; }}
              onMouseLeave={(e) => { if (!uploading) (e.currentTarget as HTMLElement).style.background = '#0071E3'; }}
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? 'Uploading…' : 'Upload PDF'}
            </motion.button>

            <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleUpload} className="hidden" />
          </div>

          {/* ── Error banner ── */}
          {error && (
            <div
              role="alert"
              style={{
                background: 'rgba(182,68,0,0.08)',
                border: '1px solid rgba(182,68,0,0.2)',
                color: '#B64400',
                fontSize: 14,
                padding: '10px 16px',
                borderRadius: 10,
                marginBottom: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>{error}</span>
              <button
                onClick={() => setError('')}
                aria-label="Dismiss error"
                style={{ background: 'none', border: 'none', cursor: 'pointer', marginLeft: '8px', color: 'inherit', fontWeight: 600 }}
              >×</button>
            </div>
          )}

          {/* ── Loading state ── */}
          {loadingDocs ? (
            <div
              style={{
                ...cardBase,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '64px 20px',
              }}
            >
              <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#E8E8ED', marginBottom: 12 }} />
              <p style={{ fontSize: 14, color: '#6E6E73', margin: 0 }}>Loading documents…</p>
            </div>

          /* ── Empty state ── */
          ) : documents.length === 0 ? (
            <FadeIn delay={0.2}>
              <div
                style={{
                  ...cardBase,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '64px 20px',
                  textAlign: 'center',
                }}
              >
                <EmptyDocumentsIllustration size={160} />
                <h3 style={{ fontSize: 21, fontWeight: 600, color: '#1D1D1F', margin: '16px 0 6px' }}>
                  No documents yet
                </h3>
                <p style={{ fontSize: 15, color: '#6E6E73', margin: '0 0 24px' }}>
                  Upload a PDF to get started
                </p>

                {/* Drop zone */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: dragOver ? '2px dashed #0071E3' : '2px dashed #E8E8ED',
                    borderRadius: 18,
                    background: dragOver ? 'rgba(0,113,227,0.03)' : '#F5F5F7',
                    padding: '32px 48px',
                    cursor: 'pointer',
                    transition: 'border-color 0.15s ease-in-out, background 0.15s ease-in-out',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 20,
                  }}
                >
                  <Upload className="h-8 w-8" style={{ color: dragOver ? '#0071E3' : '#6E6E73' }} />
                  <span style={{ fontSize: 14, color: '#6E6E73' }}>Drop PDF here or click to browse</span>
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    background: '#0071E3',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: 8,
                    height: 44,
                    padding: '0 24px',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#0066CC'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#0071E3'; }}
                >
                  <Upload className="h-4 w-4" />
                  Upload PDF
                </motion.button>
              </div>
            </FadeIn>

          /* ── Document grid ── */
          ) : (
            <>
              {/* Upload drop zone strip above cards */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: dragOver ? '2px dashed #0071E3' : '2px dashed #E8E8ED',
                  borderRadius: 18,
                  background: dragOver ? 'rgba(0,113,227,0.03)' : '#F5F5F7',
                  padding: '20px 24px',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s ease-in-out, background 0.15s ease-in-out',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  marginBottom: 24,
                }}
              >
                <Upload className="h-5 w-5" style={{ color: dragOver ? '#0071E3' : '#6E6E73' }} />
                <span style={{ fontSize: 14, color: dragOver ? '#0071E3' : '#6E6E73' }}>
                  Drop a PDF here or click to browse
                </span>
              </div>

              {/* Section heading + search/filter row */}
              <div className="flex items-center justify-between" style={{ marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                <h2 style={{ fontSize: 21, fontWeight: 600, color: '#1D1D1F', margin: 0 }}>
                  All Documents
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <input
                    type="search"
                    placeholder="Search documents…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{
                      height: 36,
                      padding: '0 12px',
                      borderRadius: 8,
                      border: '1px solid #E8E8ED',
                      fontSize: 14,
                      color: '#1D1D1F',
                      backgroundColor: '#FFFFFF',
                      outline: 'none',
                      minWidth: 180,
                    }}
                    aria-label="Search documents"
                  />
                  {(['all', 'draft', 'sent', 'completed', 'voided'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatusFilter(s)}
                      style={{
                        height: 36,
                        padding: '0 14px',
                        borderRadius: 20,
                        border: statusFilter === s ? '1px solid #0071E3' : '1px solid #E8E8ED',
                        backgroundColor: statusFilter === s ? 'rgba(0,113,227,0.08)' : '#FFFFFF',
                        color: statusFilter === s ? '#0071E3' : '#6E6E73',
                        fontSize: 13,
                        fontWeight: 500,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Card grid — 3 col desktop / 2 col tablet / 1 col mobile */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                  gap: 24,
                }}
              >
                {filteredDocuments.map((doc, index) => {
                  const envelope = doc.envelopes?.[0];
                  const recipients = envelope?.recipients || [];
                  const isHovered = hoveredCard === doc.id;

                  return (
                    <motion.div
                      key={doc.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, delay: index * 0.06, ease: 'easeOut' }}
                      style={{
                        ...cardBase,
                        boxShadow: isHovered
                          ? '0 6px 20px rgba(0,0,0,0.1)'
                          : '0 2px 10px rgba(0,0,0,0.05)',
                        transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
                        cursor: doc.status === 'draft' ? 'pointer' : 'default',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 0,
                      }}
                      onMouseEnter={() => setHoveredCard(doc.id)}
                      onMouseLeave={() => setHoveredCard(null)}
                      onClick={() => doc.status === 'draft' ? navigate(`/prepare/${doc.id}`) : undefined}
                    >
                      {/* Card top: icon area + status badge */}
                      <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
                        <div
                          style={{
                            background: '#F5F5F7',
                            borderRadius: 12,
                            width: 40,
                            height: 40,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <StatusIcon status={doc.status} />
                        </div>
                        <StatusBadge status={doc.status} />
                      </div>

                      {/* Document name */}
                      <button
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          textAlign: 'left',
                          cursor: 'pointer',
                          fontSize: 15,
                          fontWeight: 600,
                          color: '#1D1D1F',
                          lineHeight: 1.3,
                          marginBottom: 4,
                          width: '100%',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        onClick={(e) => { e.stopPropagation(); navigate(`/prepare/${doc.id}`); }}
                      >
                        {doc.name}
                      </button>

                      {/* Meta row: page count + date */}
                      <div className="flex items-center gap-2" style={{ marginBottom: 12 }}>
                        <span style={{ fontSize: 12, color: '#6E6E73' }}>
                          {doc.pageCount} {doc.pageCount === 1 ? 'page' : 'pages'}
                        </span>
                        <span style={{ fontSize: 12, color: '#E8E8ED' }}>·</span>
                        <span style={{ fontSize: 12, color: '#6E6E73' }}>
                          {new Date(doc.createdAt).toLocaleDateString('en-AU', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                      </div>

                      {/* Recipients */}
                      {recipients.length > 0 && (
                        <div
                          style={{
                            borderTop: '1px solid #E8E8ED',
                            paddingTop: 10,
                            marginBottom: 12,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 4,
                          }}
                        >
                          {recipients.map((r) => (
                            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 13, color: '#1D1D1F' }}>{r.name}</span>
                              {r.status === 'signed' ? (
                                <CheckCircle className="h-3.5 w-3.5" style={{ color: '#34C759' }} />
                              ) : r.status === 'viewed' ? (
                                <Eye className="h-3.5 w-3.5" style={{ color: '#0071E3' }} />
                              ) : (
                                <Clock className="h-3.5 w-3.5" style={{ color: '#6E6E73' }} />
                              )}
                              {r.signedAt && <span style={{ fontSize: '10px', color: '#6E6E73' }}>Signed {new Date(r.signedAt).toLocaleDateString('en-AU')}</span>}
                              {!r.signedAt && r.viewedAt && <span style={{ fontSize: '10px', color: '#6E6E73' }}>Viewed {new Date(r.viewedAt).toLocaleDateString('en-AU')}</span>}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Action buttons */}
                      <div
                        className="flex items-center gap-1"
                        style={{ marginTop: 'auto', paddingTop: recipients.length > 0 ? 0 : 10, borderTop: recipients.length > 0 ? 'none' : '1px solid #E8E8ED' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {doc.status === 'draft' && (
                          <ActionButton
                            label="Prepare & send"
                            icon={<Send className="h-4 w-4" />}
                            variant="primary"
                            onClick={() => navigate(`/prepare/${doc.id}`)}
                          />
                        )}

                        {doc.status === 'sent' && envelope && (
                          <ActionButton
                            label={copied === doc.id ? 'Copied!' : 'Copy links'}
                            icon={copied === doc.id
                              ? <CheckCircle className="h-4 w-4" style={{ color: '#34C759' }} />
                              : <LinkIcon className="h-4 w-4" />}
                            variant="secondary"
                            onClick={() => handleCopyLinks(doc.id, recipients)}
                          />
                        )}

                        {doc.status === 'completed' && (
                          <ActionButton
                            label={downloading === doc.id ? 'Downloading…' : 'Download'}
                            icon={downloading === doc.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                            variant="secondary"
                            disabled={downloading === doc.id}
                            onClick={async () => {
                              setDownloading(doc.id);
                              try { await api.downloadDocument(doc.id); }
                              catch (err) { setError(err instanceof Error ? err.message : 'Download failed'); }
                              finally { setDownloading(null); }
                            }}
                          />
                        )}

                        <div style={{ marginLeft: 'auto' }}>
                          <ActionButton
                            label="Delete"
                            icon={<Trash2 className="h-4 w-4" />}
                            variant="danger"
                            onClick={() => handleDelete(doc.id)}
                          />
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </PageEntrance>
    </div>
  );
}

// ─── Reusable action button ───────────────────────────────────────────────────

interface ActionButtonProps {
  label: string;
  icon: React.ReactNode;
  variant: 'primary' | 'secondary' | 'danger';
  onClick: () => void;
  disabled?: boolean;
}

function ActionButton({ label, icon, variant, onClick, disabled }: ActionButtonProps) {
  const [hovered, setHovered] = useState(false);

  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    border: 'none',
    borderRadius: 8,
    height: 36,
    padding: '0 14px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 0.15s ease-in-out, color 0.15s ease-in-out',
    whiteSpace: 'nowrap',
  };

  const variantStyles: Record<string, React.CSSProperties> = {
    primary: {
      background: hovered ? '#0066CC' : '#0071E3',
      color: '#FFFFFF',
    },
    secondary: {
      background: hovered ? '#E8E8ED' : '#F5F5F7',
      color: '#1D1D1F',
      border: '1px solid #E8E8ED',
    },
    danger: {
      background: hovered ? 'rgba(182,68,0,0.15)' : 'rgba(182,68,0,0.08)',
      color: '#B64400',
      border: '1px solid rgba(182,68,0,0.15)',
    },
  };

  return (
    <button
      style={{ ...base, ...variantStyles[variant], ...(disabled ? { opacity: 0.5, cursor: 'not-allowed' } : {}) }}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {icon}
      {label}
    </button>
  );
}
