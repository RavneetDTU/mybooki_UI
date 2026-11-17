import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, UserPlus } from 'lucide-react';
import { marketingError, marketingService } from '../../services/marketing';
import { LeadDetail } from './LeadDetail';

const STATUSES = ['New Lead', 'Template Sent', 'Read', 'Responded', 'Failed', 'OPT OUT'];

function when(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function badge(status) {
    if (status === 'Responded') return 'bg-emerald-50 text-emerald-800 border-emerald-200/80';
    if (status === 'Hot Lead / Qualified') return 'bg-amber-50 text-amber-900 border-amber-200/80';
    if (status === 'Template Sent') return 'bg-sky-50 text-sky-800 border-sky-200/80';
    if (status === 'Read') return 'bg-indigo-50 text-indigo-800 border-indigo-200/80';
    if (status === 'OPT OUT' || status === 'Failed') return 'bg-rose-50 text-rose-700 border-rose-200/80';
    return 'bg-slate-50 text-slate-600 border-slate-200';
}

function Switch({ on, disabled, onClick }) {
    return (
        <button type="button" role="switch" aria-checked={on} aria-label="Toggle AI mode" disabled={disabled} onClick={onClick} className={`relative inline-flex shrink-0 items-center w-8 h-4 rounded-full border-2 border-transparent transition-colors ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'} ${on ? 'bg-foreground' : 'bg-slate-300'}`}>
            <span className={`inline-block w-3 h-3 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-4' : 'translate-x-0'}`} />
        </button>
    );
}

export function LeadLogs({ restaurantId, onError, onNotice }) {
    const navigate = useNavigate();
    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [summary, setSummary] = useState(null);
    const [campaigns, setCampaigns] = useState([]);
    const [q, setQ] = useState('');
    const [campaign, setCampaign] = useState('');
    const [status, setStatus] = useState('');
    const [sort, setSort] = useState('last_activity_desc');
    const [offset, setOffset] = useState(0);
    const [loading, setLoading] = useState(true);
    const [adding, setAdding] = useState(false);
    const [draft, setDraft] = useState({ name: '', phone: '', email: '' });
    const [open, setOpen] = useState(null);

    const load = () => {
        setLoading(true);
        marketingService.contacts(restaurantId, { q, campaign: campaign || undefined, status: status || undefined, sort, offset, limit: 50 })
            .then((result) => {
                setRows(result.contacts || []);
                setTotal(result.total || 0);
                setSummary(result.summary || null);
            })
            .catch((error) => onError(marketingError(error)))
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, [restaurantId, q, campaign, status, sort, offset]);
    useEffect(() => {
        marketingService.campaigns(restaurantId).then((result) => setCampaigns(result.campaigns || [])).catch(() => setCampaigns([]));
    }, [restaurantId]);

    const add = async (event) => {
        event.preventDefault();
        try {
            await marketingService.saveContact(restaurantId, { ...draft, optIn: true, optInSource: 'added by hand' });
            setDraft({ name: '', phone: '', email: '' });
            setAdding(false);
            onNotice('Lead added.');
            load();
        } catch (error) {
            onError(marketingError(error));
        }
    };

    const toggleAi = (row) => {
        if (!row.conversationId) return;
        const next = row.handler === 'human' ? 'ai' : 'human';
        const previous = row.handler;
        setRows((list) => list.map((item) => (item.id === row.id ? { ...item, handler: next } : item)));
        marketingService.setMode(restaurantId, row.conversationId, next).catch((error) => {
            setRows((list) => list.map((item) => (item.id === row.id ? { ...item, handler: previous } : item)));
            onError(marketingError(error));
        });
    };

    const replaceLead = (next) => {
        setRows((list) => list.map((item) => (item.id === next.id ? { ...item, ...next } : item)));
        setOpen(next);
    };

    const counts = summary || { total, newLeads: 0, templateSent: 0, unread: 0, responded: 0 };

    return (
        <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
                <div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
                        <span>Marketing</span><span>/</span><span className="text-foreground">Lead Logs</span>
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Lead Activity & Logs</h1>
                    <p className="text-xs text-slate-500 mt-0.5">Status tracking for leads across your campaigns.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button type="button" onClick={() => setAdding(true)} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 hover:bg-slate-50 cursor-pointer"><UserPlus className="w-4 h-4" /> Add a lead</button>
                    <button type="button" onClick={() => navigate('/marketing/conversations')} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-foreground text-white text-sm cursor-pointer"><MessageSquare className="w-4 h-4" /> Open Conversations →</button>
                </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {[
                    ['Total Inbound', counts.total],
                    ['New Leads', counts.newLeads],
                    ['Template Sent', counts.templateSent],
                    ['Unread', counts.unread],
                    ['Responded', counts.responded],
                ].map(([label, value]) => (
                    <div key={label} className="bg-white rounded-2xl border border-slate-200 p-4">
                        <p className="text-2xl font-bold text-slate-900">{value ?? 0}</p>
                        <p className="text-xs text-slate-500 mt-1">{label}</p>
                    </div>
                ))}
            </div>
            <div className="flex flex-wrap gap-2">
                <input value={q} onChange={(event) => { setOffset(0); setQ(event.target.value); }} placeholder="Search name or phone" className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs min-w-[180px]" />
                <select aria-label="Filter by campaign" value={campaign} onChange={(event) => { setOffset(0); setCampaign(event.target.value); }} className="px-2 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs">
                    <option value="">All Campaigns</option>
                    {campaigns.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
                <select aria-label="Filter by status" value={status} onChange={(event) => { setOffset(0); setStatus(event.target.value); }} className="px-2 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs">
                    <option value="">All Statuses</option>
                    {STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
                <select aria-label="Sort leads" value={sort} onChange={(event) => { setOffset(0); setSort(event.target.value); }} className="px-2 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs">
                    <option value="last_activity_desc">Last activity</option>
                    <option value="created_desc">Newest created</option>
                    <option value="created_asc">Oldest created</option>
                    <option value="last_reply_desc">Newest reply</option>
                    <option value="last_reply_asc">Oldest reply</option>
                    <option value="name_asc">Name A–Z</option>
                </select>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                {loading ? <p className="p-6 text-sm text-slate-500">Loading leads…</p> : rows.length === 0 ? <p className="p-10 text-center text-sm text-slate-500">No leads match these filters.</p> : (
                    <table className="w-full text-sm">
                        <thead className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                            <tr>{['Contact', 'Campaign', 'Created', 'Status', 'Last reply', 'AI', 'Action'].map((label) => <th key={label} className="px-3 py-3 font-medium">{label}</th>)}</tr>
                        </thead>
                        <tbody>
                            {rows.map((row) => (
                                <tr key={row.id} onClick={() => setOpen(row)} className="border-t border-slate-100 cursor-pointer hover:bg-slate-50/80">
                                    <td className="px-3 py-3">
                                        <p className="font-semibold text-slate-900 leading-tight truncate">{row.name || '—'}</p>
                                        <p className="font-mono text-xs text-slate-500 mt-0.5">{row.phoneDigits || row.phoneE164}</p>
                                    </td>
                                    <td className="px-3 py-3 text-slate-700 truncate">{(row.campaigns || []).join(', ') || '—'}</td>
                                    <td className="px-3 py-3 text-slate-600 whitespace-nowrap tabular-nums">{when(row.createdAt)}</td>
                                    <td className="px-3 py-3"><span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${badge(row.activityStatus)}`}>{row.activityStatus || 'New Lead'}</span></td>
                                    <td className="px-3 py-3 text-slate-600 whitespace-nowrap tabular-nums">{when(row.lastReplyAt)}</td>
                                    <td className="px-3 py-3"><Switch on={row.handler !== 'human' && row.handler !== 'resolved'} disabled={!row.conversationId} onClick={(event) => { event.stopPropagation(); toggleAi(row); }} /></td>
                                    <td className="px-3 py-3">
                                        <button type="button" aria-label="Open WhatsApp Chat" disabled={!row.conversationId} onClick={(event) => { event.stopPropagation(); navigate(`/marketing/conversations?chat=${row.conversationId}`); }} className="p-1.5 rounded-lg border border-slate-200 text-emerald-600 hover:bg-emerald-50 disabled:opacity-40 cursor-pointer"><MessageSquare className="w-4 h-4" /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
                <div className="px-4 py-3 flex justify-between text-xs text-slate-500 border-t border-slate-100">
                    <span>{total} leads</span>
                    <div className="flex gap-2">
                        <button type="button" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 50))} className="px-2 py-1 border border-slate-200 rounded disabled:opacity-40 cursor-pointer">Previous</button>
                        <button type="button" disabled={offset + 50 >= total} onClick={() => setOffset(offset + 50)} className="px-2 py-1 border border-slate-200 rounded disabled:opacity-40 cursor-pointer">Next</button>
                    </div>
                </div>
            </div>
            {open && (
                <LeadDetail restaurantId={restaurantId} lead={open} onClose={() => setOpen(null)} onLead={replaceLead} onError={onError} onNotice={onNotice} />
            )}
            {adding && (
                <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-start justify-center p-4" onClick={() => setAdding(false)}>
                    <form onClick={(event) => event.stopPropagation()} onSubmit={add} className="bg-white rounded-2xl shadow-xl w-full max-w-md mt-16 p-5 space-y-3">
                        <h2 className="font-semibold text-lg">Add a lead</h2>
                        <input required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Name" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" />
                        <input required value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} placeholder="WhatsApp number" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" />
                        <input value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} placeholder="Email" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm" />
                        <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => setAdding(false)} className="px-3 py-2 rounded-lg border text-sm cursor-pointer">Cancel</button>
                            <button className="px-3 py-2 rounded-lg bg-foreground text-white text-sm cursor-pointer">Save lead</button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
