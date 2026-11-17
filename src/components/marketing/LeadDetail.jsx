import { useEffect, useState } from 'react';
import { Bot, Check, CheckCheck, Inbox, Send, X } from 'lucide-react';
import { marketingError, marketingService } from '../../services/marketing';

const TABS = [
    ['info', 'Basic Info'],
    ['notes', 'Notes'],
    ['whatsapp', 'WhatsApp'],
];

function stamp(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function messageLabel(message) {
    if (message.direction === 'inbound') return { text: 'Lead', tone: 'text' };
    if (message.kind === 'template') return { text: 'Template', tone: 'badge' };
    if (message.actor === 'human') return { text: 'You', tone: 'badge' };
    return { text: 'AI', tone: 'badge' };
}

export function LeadDetail({ restaurantId, lead, onClose, onLead, onError, onNotice }) {
    const [tab, setTab] = useState('info');
    const [name, setName] = useState(lead.name || '');
    const [email, setEmail] = useState(lead.email || '');
    const [author, setAuthor] = useState('');
    const [note, setNote] = useState('');
    const [saving, setSaving] = useState(false);
    const [savingNote, setSavingNote] = useState(false);
    const [thread, setThread] = useState(null);
    const [threadError, setThreadError] = useState('');
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);

    useEffect(() => {
        setTab('info');
        setName(lead.name || '');
        setEmail(lead.email || '');
        setAuthor('');
        setNote('');
        setThread(null);
        setThreadError('');
        setText('');
    }, [lead.id]);

    useEffect(() => {
        if (tab !== 'whatsapp' || !lead.conversationId) return undefined;
        let live = true;
        marketingService.conversation(restaurantId, lead.conversationId)
            .then((result) => { if (live) setThread(result); })
            .catch((error) => { if (live) setThreadError(marketingError(error)); });
        return () => { live = false; };
    }, [tab, restaurantId, lead.conversationId]);

    const extras = [
        lead.email ? ['Email', lead.email] : null,
        lead.city ? ['City', lead.city] : null,
        lead.tags?.length ? ['Tags', lead.tags.join(', ')] : null,
    ].filter(Boolean);
    const notes = [...(lead.notes || [])].reverse();
    const aiOn = (thread?.handler || lead.handler) !== 'human' && (thread?.handler || lead.handler) !== 'resolved';

    const saveDetails = async () => {
        const nextName = name.trim();
        const nextEmail = email.trim();
        if (!nextName) {
            onError('Enter a name before saving.');
            return;
        }
        setSaving(true);
        try {
            const updated = await marketingService.updateContact(restaurantId, lead.id, {
                name: nextName,
                email: nextEmail,
                phone: lead.phoneE164 || lead.phoneDigits,
            });
            onLead({ ...lead, name: updated.name, email: updated.email || '' });
            onNotice?.('Lead saved.');
        } catch (error) {
            onError(marketingError(error));
        } finally {
            setSaving(false);
        }
    };

    const saveNote = async () => {
        const body = note.trim();
        if (!body || savingNote) return;
        setSavingNote(true);
        try {
            const updated = await marketingService.addNote(restaurantId, lead.id, { author: author.trim(), body });
            onLead({ ...lead, notes: updated.notes || [] });
            setNote('');
        } catch (error) {
            onError(marketingError(error));
        } finally {
            setSavingNote(false);
        }
    };

    const setAi = (on) => {
        if (!lead.conversationId) return;
        const next = on ? 'ai' : 'human';
        const previous = thread?.handler || lead.handler;
        onLead({ ...lead, handler: next });
        setThread((row) => (row ? { ...row, handler: next } : row));
        marketingService.setMode(restaurantId, lead.conversationId, next).catch((error) => {
            onLead({ ...lead, handler: previous });
            setThread((row) => (row ? { ...row, handler: previous } : row));
            onError(marketingError(error));
        });
    };

    const send = async () => {
        const body = text.trim();
        if (!body || sending || !lead.conversationId || aiOn) return;
        setSending(true);
        try {
            await marketingService.sendMessage(restaurantId, lead.conversationId, body);
            setText('');
            setThread(await marketingService.conversation(restaurantId, lead.conversationId));
        } catch (error) {
            onError(marketingError(error));
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex justify-center bg-black/50 backdrop-blur-sm pt-6 pr-6 pb-6 pl-6 md:pl-[calc(13rem+1.5rem)]" role="dialog" aria-modal="true" aria-labelledby="lead-modal-title" onClick={onClose}>
            <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden min-h-0 max-h-full" onClick={(event) => event.stopPropagation()}>
                <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-slate-100 shrink-0">
                    <div>
                        <h2 id="lead-modal-title" className="text-lg font-semibold text-slate-800">Edit Lead</h2>
                        <p className="text-sm text-slate-500 mt-0.5">Update lead details</p>
                    </div>
                    <button type="button" className="ml-4 p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer" aria-label="Close modal" onClick={onClose}>
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="flex border-b border-slate-200 px-6 shrink-0">
                    {TABS.map(([id, label]) => (
                        <button key={id} type="button" onClick={() => setTab(id)} className={`px-4 py-2.5 text-sm font-medium border-b-2 cursor-pointer ${tab === id ? 'border-foreground text-foreground' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>{label}</button>
                    ))}
                </div>
                {tab === 'info' && (
                    <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
                        <div className="space-y-5">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <label className="block text-xs font-medium text-slate-600 mb-1.5">Full Name
                                    <input value={name} onChange={(event) => setName(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-slate-900" />
                                </label>
                                <label className="block text-xs font-medium text-slate-600 mb-1.5">Phone
                                    <input readOnly value={lead.phoneDigits || lead.phoneE164 || ''} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 cursor-default" />
                                </label>
                                <label className="block text-xs font-medium text-slate-600 mb-1.5">Email
                                    <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-slate-900" />
                                </label>
                                <label className="block text-xs font-medium text-slate-600 mb-1.5">Campaign
                                    <input readOnly value={(lead.campaigns || []).join(', ') || '—'} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 cursor-default" />
                                </label>
                                <label className="block text-xs font-medium text-slate-600 mb-1.5">Status
                                    <input readOnly value={lead.activityStatus || 'New Lead'} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 cursor-default" />
                                </label>
                                <label className="block text-xs font-medium text-slate-600 mb-1.5">Created
                                    <input readOnly value={stamp(lead.createdAt)} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 cursor-default" />
                                </label>
                            </div>
                            {extras.length > 0 && (
                                <div>
                                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Form Responses</h3>
                                    <div className="bg-slate-50 rounded-xl border border-slate-200 divide-y divide-slate-200">
                                        {extras.map(([label, value]) => (
                                            <div key={label} className="flex gap-3 px-4 py-2.5">
                                                <span className="text-xs text-slate-400 capitalize min-w-[120px] shrink-0">{label}</span>
                                                <span className="text-xs text-slate-700 font-medium">{value}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
                {tab === 'info' && (
                    <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2 shrink-0">
                        <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200 text-sm cursor-pointer hover:bg-slate-50">Cancel</button>
                        <button type="button" disabled={saving || !name.trim()} onClick={saveDetails} className="px-4 py-2 rounded-lg bg-foreground text-white text-sm cursor-pointer disabled:opacity-40">Save changes</button>
                    </div>
                )}
                {tab === 'notes' && (
                    <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <input value={author} onChange={(event) => setAuthor(event.target.value)} placeholder="Your name / email" className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm" />
                                <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add a note…" className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm resize-none h-24" />
                                <div className="flex justify-end">
                                    <button type="button" disabled={!note.trim() || savingNote} onClick={saveNote} className="px-4 py-2 rounded-lg bg-foreground text-white text-sm cursor-pointer disabled:opacity-40">Save Note</button>
                                </div>
                            </div>
                            {notes.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 px-4 text-center select-none">
                                    <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-3.5 text-slate-700 border border-slate-200 shadow-sm">
                                        <Inbox className="w-7 h-7" />
                                    </div>
                                    <h3 className="text-slate-900 font-semibold text-sm mb-1 tracking-tight">No notes yet</h3>
                                    <p className="text-slate-500 text-xs max-w-xs leading-relaxed">Add the first note above.</p>
                                </div>
                            ) : notes.map((item) => (
                                <div key={item.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                                    <div className="flex items-center justify-between gap-3 text-xs">
                                        <span className="font-semibold text-slate-800">{item.author || 'Note'}</span>
                                        <span className="text-slate-400 shrink-0">{stamp(item.createdAt)}</span>
                                    </div>
                                    <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">{item.body}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {tab === 'whatsapp' && (
                    <div className="flex flex-col flex-1 min-h-0 bg-[#E5DDD5]/20">
                        <div className="flex items-center justify-end gap-3 px-4 py-3 bg-white border-b border-slate-200 shadow-sm shrink-0">
                            <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
                                <Bot className="w-4 h-4 text-foreground" />
                                <span className="text-xs font-semibold text-slate-700">AI Mode</span>
                                <button type="button" role="switch" aria-checked={aiOn} aria-label="Switch AI mode" disabled={!lead.conversationId} onClick={() => setAi(!aiOn)} className={`relative inline-flex shrink-0 items-center w-8 h-4 rounded-full border-2 border-transparent ${lead.conversationId ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed'} ${aiOn ? 'bg-foreground' : 'bg-slate-300'}`}>
                                    <span className={`inline-block w-3 h-3 rounded-full bg-white shadow transition-transform ${aiOn ? 'translate-x-4' : 'translate-x-0'}`} />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4 bg-[#F0F2F5]/80">
                            {!lead.conversationId ? (
                                <p className="py-16 text-center text-sm text-slate-500">No WhatsApp conversation yet.</p>
                            ) : threadError ? (
                                <p className="py-16 text-center text-sm text-rose-700">{threadError}</p>
                            ) : !thread ? (
                                <p className="py-16 text-center text-sm text-slate-500">Loading conversation…</p>
                            ) : (thread.messages || []).length === 0 ? (
                                <p className="py-16 text-center text-sm text-slate-500">No messages yet.</p>
                            ) : (thread.messages || []).map((message) => {
                                const outbound = message.direction === 'outbound';
                                const label = messageLabel(message);
                                return (
                                    <div key={message.id} className={`flex min-w-0 ${outbound ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[65%] min-w-0 flex flex-col ${outbound ? 'items-end' : 'items-start'}`}>
                                            <div className="flex items-center gap-1.5 mb-1 px-1">
                                                {label.tone === 'badge' ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold text-[10px]">{label.text === 'AI' && <Bot className="w-3 h-3" />}{label.text}</span>
                                                ) : (
                                                    <span className="text-[11px] text-slate-500 font-medium">{label.text}</span>
                                                )}
                                            </div>
                                            <div className={`px-4 py-2.5 text-sm leading-relaxed shadow-sm rounded-2xl ${outbound ? 'bg-[#DCF8C6] text-slate-900 border border-[#C5E8AC]' : 'bg-white text-slate-900 border border-slate-200/80'}`}>
                                                <p className="whitespace-pre-wrap break-words">{message.body}</p>
                                                <div className="flex items-center justify-end gap-1 text-[10px] mt-1 text-slate-500">
                                                    <span>{stamp(message.createdAt)}</span>
                                                    {outbound && (message.status === 'read' || message.status === 'delivered') && <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />}
                                                    {outbound && message.status === 'sent' && <Check className="w-3.5 h-3.5 text-slate-400" />}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        {lead.conversationId && (
                            <div className="p-4 bg-white border-t border-slate-200 shadow-sm shrink-0">
                                {aiOn && (
                                    <div className="mb-2 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-xs text-slate-700 flex items-center gap-1.5">
                                        <Bot className="w-3.5 h-3.5 shrink-0" />
                                        <span>AI is on. Turn it off to type yourself.</span>
                                    </div>
                                )}
                                <form className="flex items-center gap-3" onSubmit={(event) => { event.preventDefault(); send(); }}>
                                    <input value={text} onChange={(event) => setText(event.target.value)} disabled={aiOn || sending} placeholder="Type a WhatsApp message…" className="flex-1 rounded-full border border-slate-200 bg-slate-50 px-5 py-2.5 text-sm disabled:bg-slate-100 disabled:cursor-not-allowed" />
                                    <button type="submit" disabled={aiOn || sending || !text.trim()} aria-label="Send message" className="w-10 h-10 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shrink-0 disabled:bg-slate-200 disabled:cursor-not-allowed cursor-pointer">
                                        <Send className="w-4 h-4" />
                                    </button>
                                </form>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
