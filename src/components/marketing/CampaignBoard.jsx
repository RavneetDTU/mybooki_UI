import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, CircleHelp, Download, FileText, Search, Upload, X } from 'lucide-react';
import { marketingError, marketingService } from '../../services/marketing';

const DELAYS = [24, 48, 72];

const SLOT_COPY = {
    initial: {
        empty: '+ Assign WhatsApp Template',
        tone: 'bg-emerald-50 text-emerald-800',
        title: 'Select Template',
        hint: 'Choose a WhatsApp message template to send to NEW leads',
    },
    reminder: {
        empty: '+ Reminder template',
        tone: 'bg-violet-50 text-violet-800',
        title: 'Reminder template',
        hint: 'Choose the reminder sent before an appointment',
    },
    missed: {
        empty: '+ Missed appointment template',
        tone: 'bg-rose-50 text-rose-800',
        title: 'Missed appointment template',
        hint: 'Choose the message sent after a missed appointment',
    },
    followUp: {
        empty: '+ Follow-up sequence',
        tone: 'bg-amber-50 text-amber-900',
        title: 'Follow-up sequence',
        hint: 'Choose the follow-up and the final message, with the wait before each one',
    },
};

function fileToCsv(file) {
    if (/\.xlsx?$/i.test(file.name)) {
        return import('xlsx').then(async (XLSX) => {
            const book = XLSX.read(await file.arrayBuffer(), { type: 'array' });
            return XLSX.utils.sheet_to_csv(book.Sheets[book.SheetNames[0]]);
        });
    }
    return file.text();
}

function createdLabel(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function leadStatus(status) {
    if (status === 'member' || status === 'pending') return 'Imported';
    if (status === 'sent' || status === 'delivered') return 'Template Sent';
    if (status === 'read') return 'Read';
    if (status === 'replied') return 'Responded';
    if (status === 'failed') return 'Failed';
    if (status === 'opted_out' || status === 'suppressed') return 'OPT OUT';
    return status || 'Imported';
}

function statusClass(status) {
    if (status === 'replied') return 'bg-emerald-50 text-emerald-800 border border-emerald-200/80';
    if (status === 'failed' || status === 'opted_out' || status === 'suppressed') return 'bg-rose-50 text-rose-700 border border-rose-200/80';
    if (status === 'read') return 'bg-sky-50 text-sky-800 border border-sky-200/80';
    if (status === 'sent' || status === 'delivered') return 'bg-indigo-50 text-indigo-800 border border-indigo-200/80';
    return 'bg-slate-50 text-slate-600 border border-slate-200';
}

const toolButton = 'inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 hover:bg-slate-50 cursor-pointer';

function Switch({ on, onClick, label }) {
    return (
        <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onClick} className={`relative inline-flex shrink-0 items-center w-10 h-5 rounded-full border-2 border-transparent cursor-pointer transition-colors ${on ? 'bg-foreground' : 'bg-slate-300'}`}>
            <span className={`inline-block w-4 h-4 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
    );
}

function templateName(templates, id) {
    return templates.find((item) => item.id === id)?.name || '';
}

function slotsOf(campaign) {
    const follow = campaign.slots?.followUp || {};
    return {
        initial: campaign.slots?.initial?.templateId || campaign.templateId || null,
        reminder: campaign.slots?.reminder?.templateId || null,
        missed: campaign.slots?.missed?.templateId || null,
        followUp: follow.templateId || null,
        delayHours: follow.delayHours || 24,
        finalTemplateId: follow.finalTemplateId || null,
        finalDelayHours: follow.finalDelayHours || 48,
    };
}

function Modal({ title, hint, onClose, children }) {
    return (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg my-10" onClick={(event) => event.stopPropagation()}>
                <div className="px-5 pt-5 pb-3 border-b border-border">
                    <h2 className="font-heading text-lg font-semibold">{title}</h2>
                    {hint && <p className="text-sm text-muted-foreground mt-1">{hint}</p>}
                </div>
                <div className="p-5">{children}</div>
            </div>
        </div>
    );
}

export function CampaignBoard({ restaurantId, campaignId, onError, onNotice }) {
    const navigate = useNavigate();
    const [campaigns, setCampaigns] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [name, setName] = useState('');
    const [picker, setPicker] = useState(null);
    const [query, setQuery] = useState('');
    const [choice, setChoice] = useState('');
    const [finalChoice, setFinalChoice] = useState('');
    const [delayHours, setDelayHours] = useState(24);
    const [finalDelayHours, setFinalDelayHours] = useState(48);
    const [csvOpen, setCsvOpen] = useState(false);
    const [csvText, setCsvText] = useState('');
    const [csvName, setCsvName] = useState('');
    const [busy, setBusy] = useState(false);
    const [leads, setLeads] = useState([]);
    const [leadTotal, setLeadTotal] = useState(0);
    const [leadOffset, setLeadOffset] = useState(0);
    const [leadQuery, setLeadQuery] = useState('');
    const [csvHelp, setCsvHelp] = useState(false);
    const [detail, setDetail] = useState(null);
    const [leadsLoading, setLeadsLoading] = useState(false);

    const load = async () => {
        const [list, templateRows, overview] = await Promise.all([
            marketingService.campaigns(restaurantId),
            marketingService.templates(restaurantId),
            marketingService.overview(restaurantId).catch(() => null),
        ]);
        setCampaigns(list.campaigns || []);
        setTemplates(templateRows.templates || []);
        setStats(overview);
    };

    useEffect(() => {
        let live = true;
        setLoading(true);
        load()
            .catch((error) => { if (live) onError(marketingError(error)); })
            .finally(() => { if (live) setLoading(false); });
        return () => { live = false; };
    }, [restaurantId]);

    useEffect(() => {
        setLeadOffset(0);
        setLeadQuery('');
    }, [campaignId]);

    useEffect(() => {
        if (!campaignId) {
            setDetail(null);
            return undefined;
        }
        if (campaigns.some((item) => item.id === campaignId)) return undefined;
        let live = true;
        marketingService.campaign(restaurantId, campaignId)
            .then((row) => { if (live) setDetail(row); })
            .catch((error) => { if (live) onError(marketingError(error)); });
        return () => { live = false; };
    }, [restaurantId, campaignId, campaigns]);

    const shownCampaign = useRef('');
    useEffect(() => {
        if (!campaignId) return undefined;
        let live = true;
        if (shownCampaign.current !== campaignId) {
            shownCampaign.current = campaignId;
            setLeads([]);
            setLeadTotal(0);
        }
        setLeadsLoading(true);
        marketingService.recipients(restaurantId, campaignId, { limit: 50, offset: leadOffset })
            .then((row) => {
                if (!live) return;
                setLeads(row.recipients || []);
                setLeadTotal(row.total || 0);
            })
            .catch((error) => { if (live) onError(marketingError(error)); })
            .finally(() => { if (live) setLeadsLoading(false); });
        return () => { live = false; };
    }, [restaurantId, campaignId, leadOffset]);

    const approved = templates.filter((item) => item.status === 'approved');
    const marketingApproved = approved.filter((item) => String(item.category).toUpperCase() === 'MARKETING');
    const current = detail || campaigns.find((item) => item.id === campaignId) || null;

    const refreshLeads = async (offset = leadOffset) => {
        const row = await marketingService.recipients(restaurantId, campaignId, { limit: 50, offset });
        setLeads(row.recipients || []);
        setLeadTotal(row.total || 0);
        const fresh = await marketingService.campaign(restaurantId, campaignId);
        setDetail(fresh);
        await load();
    };

    const openPicker = (slot, campaign) => {
        const slots = slotsOf(campaign);
        setChoice(slot === 'initial' ? slots.initial || '' : slot === 'reminder' ? slots.reminder || '' : slot === 'missed' ? slots.missed || '' : slots.followUp || '');
        setFinalChoice(slots.finalTemplateId || '');
        setDelayHours(slots.delayHours);
        setFinalDelayHours(slots.finalDelayHours);
        setQuery('');
        setPicker({ slot, campaignId: campaign.id });
    };

    const applySlot = async () => {
        if (!picker || !choice) return;
        setBusy(true);
        try {
            const body = picker.slot === 'followUp'
                ? { slot: 'followUp', templateId: choice, delayHours, finalTemplateId: finalChoice || null, finalDelayHours }
                : { slot: picker.slot, templateId: choice };
            await marketingService.saveSequence(restaurantId, picker.campaignId, body);
            onNotice('Template saved.');
            setPicker(null);
            await load();
            if (campaignId) setDetail(await marketingService.campaign(restaurantId, campaignId));
        } catch (error) {
            onError(marketingError(error));
        } finally {
            setBusy(false);
        }
    };

    const toggleAuto = (campaign, event) => {
        event.stopPropagation();
        const next = campaign.autoMessage === false;
        const apply = (value) => {
            setCampaigns((list) => list.map((item) => (item.id === campaign.id ? { ...item, autoMessage: value } : item)));
            setDetail((row) => (row?.id === campaign.id ? { ...row, autoMessage: value } : row));
        };
        apply(next);
        marketingService.saveSequence(restaurantId, campaign.id, { autoMessage: next }).catch((error) => {
            apply(!next);
            onError(marketingError(error));
        });
    };

    const create = async (event) => {
        event.preventDefault();
        setBusy(true);
        try {
            const created = await marketingService.createCampaign(restaurantId, {
                name: name.trim(),
                kind: 'manual',
                audience: { type: 'campaign' },
            });
            setCreating(false);
            setName('');
            onNotice('Campaign created.');
            navigate(`/marketing/campaigns/${created.id}`);
        } catch (error) {
            onError(marketingError(error));
        } finally {
            setBusy(false);
        }
    };

    const importCsv = async () => {
        setBusy(true);
        try {
            const result = await marketingService.importLeads(restaurantId, campaignId, {
                csv: csvText,
                confirm: true,
                optInSource: 'campaign csv',
            });
            const problems = result.problems?.length ? ` ${result.problems.length} row${result.problems.length === 1 ? '' : 's'} could not be imported.` : '';
            onNotice(`Imported ${result.imported} lead${result.imported === 1 ? '' : 's'} into this campaign.${problems}`);
            setCsvOpen(false);
            setCsvText('');
            setCsvName('');
            setLeadOffset(0);
            await refreshLeads(0);
        } catch (error) {
            onError(marketingError(error));
        } finally {
            setBusy(false);
        }
    };

    const removeLead = async (recipientId) => {
        try {
            await marketingService.removeLead(restaurantId, campaignId, recipientId);
            onNotice('Removed from this campaign.');
            await refreshLeads();
        } catch (error) {
            onError(marketingError(error));
        }
    };

    const start = async () => {
        setBusy(true);
        try {
            await marketingService.launch(restaurantId, campaignId);
            onNotice('Campaign started. The first template will be sent to this campaign’s leads.');
            await refreshLeads();
        } catch (error) {
            onError(marketingError(error));
        } finally {
            setBusy(false);
        }
    };

    const visibleTemplates = useMemo(() => {
        const pool = picker?.slot === 'initial' ? marketingApproved : approved;
        const needle = query.trim().toLowerCase();
        return needle ? pool.filter((item) => `${item.name} ${item.body || ''}`.toLowerCase().includes(needle)) : pool;
    }, [picker, marketingApproved, approved, query]);

    const visibleLeads = leads.filter((row) => `${row.name || ''} ${row.phoneE164 || ''}`.toLowerCase().includes(leadQuery.trim().toLowerCase()));

    if (campaignId && current) {
        const slots = slotsOf(current);
        const autoOn = current.autoMessage !== false;
        return (
            <div className="space-y-5">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                    <button type="button" onClick={() => navigate('/marketing')} className="hover:text-slate-700 cursor-pointer">Campaigns</button>
                    <ChevronRight className="w-3.5 h-3.5" />
                    <span className="text-slate-800 font-medium truncate">{current.name}</span>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                            <Switch on={autoOn} label="Toggle Auto Message" onClick={(event) => toggleAuto(current, event)} />
                            <span className="text-sm text-slate-600">Auto Message</span>
                        </div>
                        <div className="relative flex items-center">
                            <button type="button" onClick={() => setCsvOpen(true)} className={toolButton}><Upload className="w-4 h-4" /> Upload CSV</button>
                            <button type="button" aria-label="CSV upload help" onClick={() => setCsvHelp((open) => !open)} className="p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"><CircleHelp className="w-4 h-4" /></button>
                            {csvHelp && <p className="absolute right-0 top-10 z-10 w-64 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600 shadow-lg">Required columns: First name, Last name, Phone number.</p>}
                        </div>
                        <button type="button" onClick={() => openPicker('initial', current)} className={toolButton}><FileText className="w-4 h-4" /> Select Template</button>
                        <button type="button" onClick={() => openPicker('reminder', current)} className={toolButton}><FileText className="w-4 h-4" />{slots.reminder ? `Reminder: ${templateName(templates, slots.reminder)}` : 'Reminder template'}</button>
                        <button type="button" onClick={() => openPicker('missed', current)} className={toolButton}><FileText className="w-4 h-4" />{slots.missed ? `Missed: ${templateName(templates, slots.missed)}` : 'Missed appointment'}</button>
                        <button type="button" onClick={() => openPicker('followUp', current)} className={toolButton}><FileText className="w-4 h-4" /> Follow-up sequence</button>
                </div>
                {(current.status === 'draft' || current.status === 'scheduled' || current.status === 'running' || current.status === 'queued' || current.status === 'paused') && (
                    <div className="flex justify-end">
                        {current.status === 'draft' || current.status === 'scheduled' ? (
                            <button type="button" disabled={busy || !slots.initial} onClick={start} className="px-3 py-2 rounded-lg bg-slate-900 text-white text-sm cursor-pointer disabled:opacity-40">Start campaign</button>
                        ) : null}
                        {current.status === 'running' || current.status === 'queued' ? <button type="button" onClick={() => marketingService.control(restaurantId, campaignId, 'pause').then(refreshLeads).catch((error) => onError(marketingError(error)))} className={toolButton}>Pause</button> : null}
                        {current.status === 'paused' ? <button type="button" onClick={() => marketingService.control(restaurantId, campaignId, 'resume').then(refreshLeads).catch((error) => onError(marketingError(error)))} className={toolButton}>Resume</button> : null}
                    </div>
                )}
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                    <div className="p-3 border-b border-slate-100">
                        <div className="relative">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input value={leadQuery} onChange={(event) => setLeadQuery(event.target.value)} placeholder="Search by name or phone..." className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm" />
                        </div>
                    </div>
                    {leadsLoading ? <p className="p-8 text-center text-sm text-muted-foreground">Loading leads…</p> : visibleLeads.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">No leads in this campaign yet.</p> : (
                        <table className="w-full text-sm">
                            <thead className="text-left text-[11px] uppercase tracking-wider text-slate-400 bg-white">
                                <tr>{['Name', 'Phone', 'Status', 'Date', ''].map((label) => <th key={label || 'action'} className="px-4 py-3 font-medium">{label}</th>)}</tr>
                            </thead>
                            <tbody>
                                {visibleLeads.map((row) => (
                                    <tr key={row.id} className="border-t border-border">
                                        <td className="px-4 py-3 font-medium">{row.name || '—'}</td>
                                        <td className="px-4 py-3 text-muted-foreground">{row.phoneE164}</td>
                                        <td className="px-4 py-3"><span className={`text-[11px] font-medium px-2 py-0.5 rounded-md ${statusClass(row.status)}`}>{leadStatus(row.status)}</span></td>
                                        <td className="px-4 py-3 text-muted-foreground">{createdLabel(row.createdAt) || '—'}</td>
                                        <td className="px-4 py-3 text-right">
                                            {!row.wamid && !['sent', 'delivered', 'read', 'replied', 'sending'].includes(row.status) ? (
                                                <button type="button" onClick={() => removeLead(row.id)} className="text-xs text-rose-700 cursor-pointer">Remove</button>
                                            ) : null}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                    <div className="px-4 py-3 flex justify-between items-center text-xs text-slate-500 border-t border-slate-100">
                        <span>Showing {leadTotal === 0 ? 0 : leadOffset + 1}–{Math.min(leadOffset + leads.length, leadTotal)} of {leadTotal}</span>
                        <div className="flex gap-1">
                            <button type="button" aria-label="Previous page" disabled={leadOffset === 0} onClick={() => setLeadOffset(Math.max(0, leadOffset - 50))} className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-40 cursor-pointer"><ChevronLeft className="w-4 h-4" /></button>
                            <button type="button" aria-label="Next page" disabled={leadOffset + 50 >= leadTotal} onClick={() => setLeadOffset(leadOffset + 50)} className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-40 cursor-pointer"><ChevronRight className="w-4 h-4" /></button>
                        </div>
                    </div>
                </div>
                {picker && <TemplateModal picker={picker} templates={visibleTemplates} choice={choice} setChoice={setChoice} finalChoice={finalChoice} setFinalChoice={setFinalChoice} delayHours={delayHours} setDelayHours={setDelayHours} finalDelayHours={finalDelayHours} setFinalDelayHours={setFinalDelayHours} query={query} setQuery={setQuery} busy={busy} onClose={() => setPicker(null)} onApply={applySlot} />}
                {csvOpen && (
                    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-start justify-center p-4 overflow-y-auto" onClick={() => setCsvOpen(false)}>
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl my-16" onClick={(event) => event.stopPropagation()}>
                            <div className="px-6 pt-5 pb-4 border-b border-slate-200 flex items-start justify-between gap-4">
                                <div>
                                    <h2 className="font-heading text-2xl font-semibold tracking-tight text-slate-900">Upload CSV</h2>
                                    <p className="text-sm text-slate-500 mt-1">Add leads to this campaign from a spreadsheet</p>
                                </div>
                                <button type="button" aria-label="Close" onClick={() => setCsvOpen(false)} className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="px-6 py-5">
                                <p className="text-sm text-slate-600">CSV file</p>
                                <input type="file" accept=".csv,.xlsx,.xls,text/csv" className="mt-2 block w-full text-sm text-slate-800 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-foreground hover:file:bg-slate-200" onChange={async (event) => {
                                    const file = event.target.files?.[0];
                                    if (!file) return;
                                    setCsvName(file.name);
                                    setCsvText(await fileToCsv(file));
                                }} />
                                <p className="mt-4 text-sm text-slate-500">Required columns: First name, Last name, Phone number.</p>
                                <button type="button" className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 cursor-pointer hover:bg-slate-50" onClick={() => {
                                    const blob = new Blob(['First name,Last name,Phone number,Email ID\nJane,Doe,+27821234567,jane@example.com\n'], { type: 'text/csv' });
                                    const url = URL.createObjectURL(blob);
                                    const link = document.createElement('a');
                                    link.href = url;
                                    link.download = 'campaign-leads.csv';
                                    link.click();
                                    URL.revokeObjectURL(url);
                                }}><Download className="w-4 h-4" /> Download template</button>
                            </div>
                            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2">
                                <button type="button" onClick={() => setCsvOpen(false)} className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium cursor-pointer hover:bg-slate-50">Cancel</button>
                                <button type="button" disabled={!csvText || busy} onClick={importCsv} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-foreground text-white text-sm font-medium cursor-pointer disabled:opacity-40"><Upload className="w-4 h-4" /> Import leads</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    const totalLeads = campaigns.reduce((sum, campaign) => sum + (campaign.leadCount || 0), 0);
    const sent = stats?.messagesSent ?? campaigns.reduce((sum, campaign) => sum + (campaign.metrics?.sent || 0), 0);
    const replied = stats?.repliesReceived ?? campaigns.reduce((sum, campaign) => sum + (campaign.metrics?.replied || 0), 0);

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-start gap-3">
                <div className="mr-auto">
                    <p className="text-xs text-muted-foreground">Marketing / Campaigns</p>
                    <h1 className="font-heading text-3xl font-semibold tracking-tight mt-1">AI Lead Campaigns</h1>
                    <p className="text-sm text-muted-foreground mt-1">WhatsApp sequences linked to this restaurant.</p>
                </div>
                <button type="button" onClick={() => { setCreating(true); setName(''); }} className="px-4 py-2 rounded-xl bg-foreground text-white text-sm cursor-pointer">+ Create new campaign</button>
            </div>
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                {[
                    ['Total campaigns', campaigns.length, ''],
                    ['Total leads', totalLeads, ''],
                    ['WhatsApp messages', sent, ''],
                    ['Replied leads', replied, ''],
                ].map(([label, value]) => (
                    <div key={label} className="bg-white rounded-2xl border border-border p-4">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
                        <p className="font-heading text-3xl mt-2">{loading ? '—' : value}</p>
                    </div>
                ))}
            </div>
            <div className="flex items-center justify-between">
                <h2 className="font-heading font-semibold">Active campaigns</h2>
                <p className="text-xs text-muted-foreground">{campaigns.length} campaign{campaigns.length === 1 ? '' : 's'}</p>
            </div>
            {loading ? <p className="text-sm text-muted-foreground">Loading campaigns…</p> : campaigns.length === 0 ? (
                <div className="bg-white rounded-2xl border border-border p-10 text-center text-sm text-muted-foreground">No campaigns yet. Create one to assign templates and import leads.</div>
            ) : (
                <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-4">
                    {campaigns.map((campaign) => {
                        const slots = slotsOf(campaign);
                        const metrics = campaign.metrics || {};
                        const autoOn = campaign.autoMessage !== false;
                        return (
                            <article key={campaign.id} role="button" tabIndex={0} onClick={() => navigate(`/marketing/campaigns/${campaign.id}`)} onKeyDown={(event) => { if (event.key === 'Enter') navigate(`/marketing/campaigns/${campaign.id}`); }} className="bg-white rounded-2xl border border-border p-6 flex flex-col gap-5 cursor-pointer hover:border-foreground/30">
                                <header className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <h3 className="font-semibold truncate">{campaign.name}</h3>
                                        <p className="text-xs text-muted-foreground mt-1 truncate">{campaign.kind === 'meta' ? 'Meta' : 'Manual'} · {campaign.externalId || campaign.id}</p>
                                    </div>
                                    <span className={`shrink-0 text-[11px] rounded-full px-2 py-1 ${autoOn ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{autoOn ? 'Auto ON' : 'Auto OFF'}</span>
                                </header>
                                <div className="space-y-2" onClick={(event) => event.stopPropagation()}>
                                    <SlotRow tone={slots.initial ? SLOT_COPY.initial.tone : ''} label={slots.initial ? templateName(templates, slots.initial) : SLOT_COPY.initial.empty} onChange={() => openPicker('initial', campaign)} />
                                    <SlotRow tone={slots.reminder ? SLOT_COPY.reminder.tone : ''} label={slots.reminder ? `Reminder: ${templateName(templates, slots.reminder)}` : SLOT_COPY.reminder.empty} onChange={() => openPicker('reminder', campaign)} />
                                    <SlotRow tone={slots.missed ? SLOT_COPY.missed.tone : ''} label={slots.missed ? `Missed: ${templateName(templates, slots.missed)}` : SLOT_COPY.missed.empty} onChange={() => openPicker('missed', campaign)} />
                                    <SlotRow tone={slots.followUp ? SLOT_COPY.followUp.tone : ''} label={slots.followUp ? templateName(templates, slots.followUp) : SLOT_COPY.followUp.empty} extra={slots.followUp ? `${slots.delayHours}h` : '24h'} detail={slots.followUp ? (slots.finalTemplateId ? `Final: ${templateName(templates, slots.finalTemplateId)} after ${slots.finalDelayHours}h` : 'Final template not set') : ''} onChange={() => openPicker('followUp', campaign)} />
                                </div>
                                <footer className="grid grid-cols-4 text-center">
                                    {[['Total', campaign.leadCount || metrics.total || 0], ['Sent', metrics.sent || 0], ['Read', metrics.read || 0], ['Conv.', metrics.replied || 0]].map(([label, value]) => (
                                        <div key={label}>
                                            <p className="text-lg font-semibold leading-none">{value}</p>
                                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground mt-1">{label}</p>
                                        </div>
                                    ))}
                                </footer>
                                {createdLabel(campaign.createdAt) ? <p className="text-xs text-muted-foreground">Created {createdLabel(campaign.createdAt)}</p> : null}
                            </article>
                        );
                    })}
                </div>
            )}
            {creating && (
                <Modal title="Create new campaign" hint="Name the campaign, then assign templates and import its leads." onClose={() => setCreating(false)}>
                    <form onSubmit={create} className="space-y-3">
                        <input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Campaign name" className="w-full px-3 py-2 rounded-xl border border-border text-sm" />
                        <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => setCreating(false)} className="px-3 py-2 rounded-xl border text-sm cursor-pointer">Cancel</button>
                            <button disabled={busy} className="px-3 py-2 rounded-xl bg-foreground text-white text-sm cursor-pointer disabled:opacity-40">Create campaign</button>
                        </div>
                    </form>
                </Modal>
            )}
            {picker && <TemplateModal picker={picker} templates={visibleTemplates} choice={choice} setChoice={setChoice} finalChoice={finalChoice} setFinalChoice={setFinalChoice} delayHours={delayHours} setDelayHours={setDelayHours} finalDelayHours={finalDelayHours} setFinalDelayHours={setFinalDelayHours} query={query} setQuery={setQuery} busy={busy} onClose={() => setPicker(null)} onApply={applySlot} />}
        </div>
    );
}

function SlotRow({ tone, label, extra, detail, onChange }) {
    return (
        <div>
            <div className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm ${tone || 'border border-dashed border-border text-muted-foreground'}`}>
                <span className="truncate">{label}</span>
                <span className="flex items-center gap-2 shrink-0">
                    {extra && <span className="text-xs">{extra}</span>}
                    <button type="button" onClick={onChange} className="text-xs underline cursor-pointer">Change</button>
                </span>
            </div>
            {detail && <p className="text-[11px] text-muted-foreground mt-1 px-1">{detail}</p>}
        </div>
    );
}

function TemplateModal({ picker, templates, choice, setChoice, finalChoice, setFinalChoice, delayHours, setDelayHours, finalDelayHours, setFinalDelayHours, query, setQuery, busy, onClose, onApply }) {
    const copy = SLOT_COPY[picker.slot];
    return (
        <Modal title={copy.title} hint={copy.hint} onClose={onClose}>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search templates" className="w-full px-3 py-2 rounded-xl border border-border text-sm mb-3" />
            <div className="max-h-72 overflow-y-auto space-y-2">
                {templates.length === 0 && <p className="text-sm text-muted-foreground">No approved template is available for this slot.</p>}
                {templates.map((item) => (
                    <button key={item.id} type="button" onClick={() => setChoice(item.id)} className={`w-full text-left rounded-xl border px-3 py-2 cursor-pointer ${choice === item.id ? 'border-foreground' : 'border-border'}`}>
                        <span className="text-sm font-medium">{item.name}</span>
                        <span className="ml-2 text-[11px] uppercase text-muted-foreground">{item.language} · {item.category}</span>
                        {item.body && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.body}</p>}
                    </button>
                ))}
            </div>
            {picker.slot === 'followUp' && (
                <div className="grid grid-cols-2 gap-2 mt-3">
                    <label className="text-xs text-muted-foreground">Wait before follow-up
                        <select value={delayHours} onChange={(event) => setDelayHours(Number(event.target.value))} className="mt-1 w-full px-2 py-2 rounded-xl border border-border text-sm text-foreground">
                            {DELAYS.map((hours) => <option key={hours} value={hours}>{hours}h</option>)}
                        </select>
                    </label>
                    <label className="text-xs text-muted-foreground">Final template
                        <select value={finalChoice} onChange={(event) => setFinalChoice(event.target.value)} className="mt-1 w-full px-2 py-2 rounded-xl border border-border text-sm text-foreground">
                            <option value="">Not set</option>
                            {templates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                        </select>
                    </label>
                    <label className="text-xs text-muted-foreground col-span-2">Wait before final message
                        <select value={finalDelayHours} onChange={(event) => setFinalDelayHours(Number(event.target.value))} className="mt-1 w-full px-2 py-2 rounded-xl border border-border text-sm text-foreground">
                            {DELAYS.map((hours) => <option key={hours} value={hours}>{hours}h</option>)}
                        </select>
                    </label>
                </div>
            )}
            <div className="mt-4 flex justify-end gap-2">
                <button type="button" onClick={onClose} className="px-3 py-2 rounded-xl border text-sm cursor-pointer">Cancel</button>
                <button type="button" disabled={!choice || busy} onClick={onApply} className="px-3 py-2 rounded-xl bg-foreground text-white text-sm cursor-pointer disabled:opacity-40">Apply Template</button>
            </div>
        </Modal>
    );
}
