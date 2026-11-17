import { Check, Copy, MessageSquare } from 'lucide-react';
import { useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';

const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;

export function WidgetInstall() {
    const { restaurantId } = useAuthStore();
    const [copied, setCopied] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const ready = SAFE_ID.test(String(restaurantId || ''));
    const origin = window.location.origin;
    const snippet = ready
        ? `<script src="${origin}/widget.js" data-restaurant-id="${restaurantId}" async></script>`
        : '';
    const example = ready
        ? `<body>\n  <!-- your restaurant website stays here -->\n  ${snippet}\n</body>`
        : '';

    const copyCode = async () => {
        if (!snippet) return;
        try {
            await navigator.clipboard.writeText(snippet);
        } catch {
            const area = document.createElement('textarea');
            area.value = snippet;
            document.body.appendChild(area);
            area.select();
            document.execCommand('copy');
            area.remove();
        }
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
    };

    return (
        <section className="bg-white border border-border rounded-lg overflow-hidden mt-5">
            <div className="bg-muted/30 border-b border-border px-5 py-3">
                <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-foreground" />
                    <h2 className="font-heading font-semibold text-foreground">Install Widget on Your Website</h2>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                    Add your MyBooki AI booking assistant to your restaurant website. Copy the installation code, add it to your website, and let visitors chat or call your AI assistant directly.
                </p>
            </div>

            <div className="p-5 space-y-5">
                <div className="grid gap-3 sm:grid-cols-2">
                    <Status label="Widget configuration" value={ready ? 'Ready for this restaurant' : 'Sign in to a restaurant first'} />
                    <Status label="Embed code" value={ready ? 'Available' : 'Unavailable'} />
                    <Status label="Website installation" value="Not verified from MyBooki" />
                    <Status label="Connected website domain" value="Not set. Each chat stores the site address after a visitor opens the widget." />
                </div>

                {ready ? (
                    <>
                        <div>
                            <div className="flex items-center justify-between gap-3 mb-1.5">
                                <p className="text-xs font-medium text-foreground">Installation code</p>
                                <button type="button" onClick={copyCode} className="px-3 py-1.5 rounded-md bg-foreground text-white text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer">
                                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                    {copied ? 'Copied' : 'Copy code'}
                                </button>
                            </div>
                            <pre className="text-xs bg-slate-50 border border-border rounded-md p-3 overflow-x-auto whitespace-pre-wrap">{snippet}</pre>
                            <p className="text-xs text-muted-foreground mt-1.5">This code belongs to restaurant {restaurantId}. Another restaurant gets a different code.</p>
                        </div>

                        <div>
                            <p className="text-xs font-medium text-foreground mb-1.5">How to add it</p>
                            <ol className="text-sm text-slate-700 space-y-1 list-decimal pl-5">
                                <li>Copy the widget installation code.</li>
                                <li>Open your restaurant website's HTML or custom code settings.</li>
                                <li>Paste the code before the closing <code className="text-xs bg-slate-100 px-1 rounded">&lt;/body&gt;</code> tag.</li>
                                <li>Save and publish your website.</li>
                                <li>Open your restaurant website.</li>
                                <li>Check that the floating MyBooki widget appears.</li>
                                <li>Test both chat and the call button.</li>
                            </ol>
                        </div>

                        <div>
                            <p className="text-xs font-medium text-foreground mb-1.5">Where the code goes</p>
                            <pre className="text-xs bg-slate-50 border border-border rounded-md p-3 overflow-x-auto whitespace-pre-wrap">{example}</pre>
                        </div>

                        <div className="bg-slate-50 border border-border rounded-lg p-4">
                            <p className="text-xs font-medium text-foreground mb-1.5">If the widget does not appear</p>
                            <ul className="text-xs text-slate-700 space-y-1">
                                <li>• The code must be on the published page, before the end of the page.</li>
                                <li>• Publish the website again after you paste it, then refresh the page.</li>
                                <li>• A call asks the visitor to allow the microphone.</li>
                                <li>• Chats and calls from the widget show in Website Widget in this dashboard.</li>
                            </ul>
                        </div>

                        <div>
                            <button type="button" onClick={() => setShowPreview(true)} className="px-3 py-1.5 rounded-md border border-border text-xs font-medium cursor-pointer">
                                Preview the live widget
                            </button>
                            {showPreview ? (
                                <iframe
                                    title="Live widget preview"
                                    src={`/widget-embed?restaurant=${encodeURIComponent(restaurantId)}`}
                                    className="mt-3 w-full h-[640px] rounded-lg border border-border bg-slate-100"
                                    allow="microphone; autoplay"
                                />
                            ) : null}
                        </div>
                    </>
                ) : (
                    <p className="text-sm text-slate-700">Sign in to a restaurant to get an install code.</p>
                )}
            </div>
        </section>
    );
}

function Status({ label, value }) {
    return (
        <div className="border border-border rounded-lg px-3 py-2">
            <p className="text-[11px] text-muted-foreground">{label}</p>
            <p className="text-sm text-foreground mt-0.5">{value}</p>
        </div>
    );
}
