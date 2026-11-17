import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import WebsiteWidgetPreviewModal from '../components/landingpage/booking-demo/WebsiteWidgetPreviewModal';

const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;

export function WidgetEmbed() {
    const [params] = useSearchParams();
    const restaurantId = String(params.get('restaurant') || '').trim();
    const site = String(params.get('site') || '').trim();
    const siteHost = /^[A-Za-z0-9.-]{1,120}$/.test(site) ? site : '';

    useEffect(() => {
        const previousBody = document.body.style.background;
        const previousHtml = document.documentElement.style.background;
        document.body.style.background = 'transparent';
        document.documentElement.style.background = 'transparent';
        return () => {
            document.body.style.background = previousBody;
            document.documentElement.style.background = previousHtml;
        };
    }, []);

    if (!SAFE_ID.test(restaurantId)) {
        return <p className="p-4 text-sm text-slate-700">This install code is missing a restaurant.</p>;
    }

    return <WebsiteWidgetPreviewModal isOpen embedded restaurantId={restaurantId} siteHost={siteHost} onClose={() => {}} />;
}
