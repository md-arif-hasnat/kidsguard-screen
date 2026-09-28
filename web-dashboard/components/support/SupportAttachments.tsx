"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FileText, Image as ImageIcon, Loader2, Paperclip } from 'lucide-react';
import {
  SupportAttachment,
  SupportRepository
} from '@/lib/repositories/SupportRepository';

interface Props {
  parentUid: string;
  ticketId: string;
  canUpload?: boolean;
  dark?: boolean;
}

export default function SupportAttachments({
  parentUid,
  ticketId,
  canUpload = false,
  dark = false
}: Props) {
  const [attachments, setAttachments] = useState<SupportAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const objectUrls = useRef<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const items = await SupportRepository.listTicketAttachments(
        parentUid,
        ticketId
      );
      objectUrls.current.forEach(url => URL.revokeObjectURL(url));
      objectUrls.current = items.map(item => item.objectUrl);
      setAttachments(items);
    } catch {
      setError('Attachments could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [parentUid, ticketId]);

  useEffect(() => {
    void load();
    return () => {
      objectUrls.current.forEach(url => URL.revokeObjectURL(url));
      objectUrls.current = [];
    };
  }, [load]);

  const handleUpload = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      await SupportRepository.uploadAttachment(parentUid, ticketId, file);
      await load();
    } catch (uploadError) {
      setError(uploadError instanceof Error
        ? uploadError.message
        : 'Attachment upload failed.');
    } finally {
      setUploading(false);
    }
  };

  if (!canUpload && !loading && attachments.length === 0 && !error) {
    return null;
  }

  return (
    <section className={`rounded-2xl border p-4 ${dark
      ? 'border-slate-700 bg-slate-950/40'
      : 'border-slate-200 bg-slate-50'}`}>
      <div className="flex items-center justify-between gap-4">
        <p className={`text-[10px] font-black uppercase tracking-widest ${dark
          ? 'text-slate-400'
          : 'text-slate-500'}`}>
          Attachments
        </p>
        {canUpload && (
          <label className="cursor-pointer rounded-xl bg-primary-600 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-white hover:bg-primary-700">
            <input
              type="file"
              className="hidden"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              disabled={uploading}
              onChange={event => {
                void handleUpload(event.target.files?.[0]);
                event.currentTarget.value = '';
              }}
            />
            <span className="flex items-center gap-2">
              {uploading
                ? <Loader2 size={14} className="animate-spin" />
                : <Paperclip size={14} />}
              Add file
            </span>
          </label>
        )}
      </div>

      <p className={`mt-2 text-[10px] ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
        JPG, PNG, WebP or PDF • maximum 5 MB
      </p>

      {loading && (
        <Loader2 size={18} className="mt-4 animate-spin text-primary-500" />
      )}
      {error && <p className="mt-3 text-xs font-bold text-rose-500">{error}</p>}

      {attachments.length > 0 && (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {attachments.map(attachment => (
            <a
              key={attachment.objectUrl}
              href={attachment.objectUrl}
              target="_blank"
              rel="noreferrer"
              className={`flex items-center gap-3 rounded-xl border p-3 ${dark
                ? 'border-slate-700 bg-slate-900 text-slate-200'
                : 'border-slate-200 bg-white text-slate-700'}`}
            >
              {attachment.contentType.startsWith('image/')
                ? <ImageIcon size={18} />
                : <FileText size={18} />}
              <span className="min-w-0">
                <span className="block truncate text-xs font-bold">{attachment.name}</span>
                <span className="block text-[9px] opacity-60">
                  {(attachment.size / 1024).toFixed(0)} KB
                </span>
              </span>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
