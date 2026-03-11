import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api } from '../lib/api';
import type { Document } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { Upload, FileText, Clock, CheckCircle, Send, Trash2, Download, Link as LinkIcon, Loader2 } from 'lucide-react';
import { PageEntrance, StaggerList, StaggerItem, MotionButton, FadeIn } from '../components/Motion';
import { EmptyDocumentsIllustration, UploadIllustration } from '../components/Illustrations';

export default function Dashboard() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
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
    if (!confirm('Delete this document?')) return;
    try {
      await api.deleteDocument(id);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'draft': return <Clock className="h-4 w-4 text-gray-400" />;
      case 'sent': return <Send className="h-4 w-4 text-blue-500" />;
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />;
      default: return <FileText className="h-4 w-4 text-gray-400" />;
    }
  };

  const statusLabel = (status: string) => {
    const styles: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-700',
      sent: 'bg-blue-100 text-blue-700',
      completed: 'bg-green-100 text-green-700',
      voided: 'bg-red-100 text-red-700',
    };
    return (
      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${styles[status] || styles.draft}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  return (
    <div>
      <PageEntrance>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
          <p className="text-sm text-gray-500 mt-1">
            {user?.credits ?? 0} credits remaining
          </p>
        </div>
        <MotionButton
          className={`inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-md text-sm font-medium hover:bg-blue-700 active:bg-blue-800 cursor-pointer transition-colors duration-150 ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {uploading ? 'Uploading...' : 'Upload PDF'}
        </MotionButton>
        <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleUpload} className="hidden" />
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 text-sm p-3 rounded-md mb-4">{error}</div>
      )}

      {loadingDocs ? (
        <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
          <Loader2 className="h-8 w-8 text-gray-300 mx-auto mb-3 animate-spin" />
          <p className="text-sm text-gray-500">Loading documents...</p>
        </div>
      ) : documents.length === 0 ? (
        <FadeIn delay={0.2}>
        <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
          <EmptyDocumentsIllustration size={180} />
          <h3 className="text-lg font-medium text-gray-900 mb-1">No documents yet</h3>
          <p className="text-sm text-gray-500 mb-4">Upload a PDF to get started</p>
          <MotionButton
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-md text-sm font-medium hover:bg-blue-700 active:bg-blue-800 cursor-pointer transition-colors duration-150"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-4 w-4" />
            Upload PDF
          </MotionButton>
        </div>
        </FadeIn>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="hidden md:block">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Document</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Status</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Recipients</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Date</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {documents.map((doc, index) => {
                const envelope = doc.envelopes?.[0];
                const recipients = envelope?.recipients || [];

                return (
                  <motion.tr key={doc.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: index * 0.05 }} className="hover:bg-gray-50 transition-colors duration-100 cursor-pointer" onClick={() => doc.status === 'draft' ? navigate(`/prepare/${doc.id}`) : undefined}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {statusIcon(doc.status)}
                        <button
                          className="text-sm font-medium text-gray-900 hover:text-blue-600 transition-colors duration-150 text-left"
                          onClick={(e) => { e.stopPropagation(); navigate(`/prepare/${doc.id}`); }}
                        >
                          {doc.name}
                        </button>
                        <span className="text-xs text-gray-400">{doc.pageCount} pg</span>
                        {doc.status === 'draft' && <span className="text-xs text-blue-500">click to edit</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">{statusLabel(doc.status)}</td>
                    <td className="px-4 py-3">
                      {recipients.length > 0 ? (
                        <div className="text-sm text-gray-600">
                          {recipients.map((r) => (
                            <div key={r.id} className="flex items-center gap-1">
                              <span>{r.name}</span>
                              {r.status === 'signed' && <CheckCircle className="h-3 w-3 text-green-500" />}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(doc.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-0.5">
                        {doc.status === 'draft' && (
                          <button
                            onClick={() => navigate(`/prepare/${doc.id}`)}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors duration-150"
                            aria-label="Prepare and send document"
                          >
                            <Send className="h-4 w-4" />
                          </button>
                        )}
                        {doc.status === 'sent' && envelope && (
                          <button
                            onClick={() => handleCopyLinks(doc.id, recipients)}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors duration-150"
                            aria-label="Copy signing links"
                          >
                            {copied === doc.id ? <CheckCircle className="h-4 w-4 text-green-500" /> : <LinkIcon className="h-4 w-4" />}
                          </button>
                        )}
                        {doc.status === 'completed' && (
                          <a
                            href={api.downloadDocument(doc.id)}
                            className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-md transition-colors duration-150"
                            aria-label="Download signed PDF"
                          >
                            <Download className="h-4 w-4" />
                          </a>
                        )}
                        <button
                          onClick={() => handleDelete(doc.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors duration-150"
                          aria-label="Delete document"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
          </div>

          <div className="md:hidden space-y-2 p-2">
            {documents.map((doc, index) => {
              const envelope = doc.envelopes?.[0];
              const recipients = envelope?.recipients || [];
              return (
                <motion.div
                  key={doc.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className="bg-white rounded-lg border border-gray-200 p-3"
                  onClick={() => doc.status === 'draft' ? navigate(`/prepare/${doc.id}`) : undefined}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {statusIcon(doc.status)}
                      <span className="text-sm font-medium text-gray-900 truncate">{doc.name}</span>
                    </div>
                    {statusLabel(doc.status)}
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{doc.pageCount} pages &middot; {new Date(doc.createdAt).toLocaleDateString()}</span>
                    <div className="flex items-center gap-1">
                      {doc.status === 'draft' && (
                        <button onClick={(e) => { e.stopPropagation(); navigate(`/prepare/${doc.id}`); }} className="p-1.5 text-gray-400 hover:text-blue-600 rounded">
                          <Send className="h-4 w-4" />
                        </button>
                      )}
                      {doc.status === 'sent' && envelope && (
                        <button onClick={(e) => { e.stopPropagation(); handleCopyLinks(doc.id, recipients); }} className="p-1.5 text-gray-400 hover:text-blue-600 rounded">
                          {copied === doc.id ? <CheckCircle className="h-4 w-4 text-green-500" /> : <LinkIcon className="h-4 w-4" />}
                        </button>
                      )}
                      {doc.status === 'completed' && (
                        <a href={api.downloadDocument(doc.id)} className="p-1.5 text-gray-400 hover:text-green-600 rounded" onClick={(e) => e.stopPropagation()}>
                          <Download className="h-4 w-4" />
                        </a>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(doc.id); }} className="p-1.5 text-gray-400 hover:text-red-600 rounded">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  {recipients.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-500">
                      {recipients.map((r) => (
                        <span key={r.id} className="mr-2">{r.name} {r.status === 'signed' ? '\u2713' : ''}</span>
                      ))}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
      </PageEntrance>
    </div>
  );
}
