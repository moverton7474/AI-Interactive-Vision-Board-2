import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface SystemSOP {
    id: string;
    title: string;
    trigger_type: string;
    schedule_cron: string;
    sop_content: string;
    is_active: boolean;
}

const SystemSOPWidget: React.FC = () => {
    const [systems, setSystems] = useState<SystemSOP[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadSystems();
    }, []);

    const loadSystems = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const { data, error } = await supabase
                .from('system_sops')
                .select('*')
                .eq('is_active', true)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setSystems(data || []);
        } catch (error) {
            console.error('Error loading systems:', error);
        } finally {
            setLoading(false);
        }
    };

    const addToCalendar = (system: SystemSOP) => {
        // Mock functionality for now - opens Google Calendar template
        // In a real app, this would use the Google Calendar API
        const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(system.title)}&details=${encodeURIComponent(system.sop_content)}&recur=RRULE:FREQ=WEEKLY`;
        window.open(googleCalendarUrl, '_blank');
    };

    if (loading) return <div className="animate-pulse h-32 bg-gray-100 rounded-xl"></div>;

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-navy-900 flex items-center gap-2">
                    <span className="text-xl">⚙️</span> My Systems (SOPs)
                </h3>
                <span className="text-xs bg-navy-100 text-navy-800 px-2 py-1 rounded-full">
                    {systems.length} Active
                </span>
            </div>

            {systems.length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                    <p>No systems installed yet.</p>
                    <p className="text-xs mt-1">Ask the Identity Architect to build one.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {systems.map(system => (
                        <div key={system.id} className="p-3 bg-gray-50 rounded-lg border border-gray-100 hover:border-navy-200 transition-colors">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h4 className="font-medium text-navy-900">{system.title}</h4>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Trigger: <span className="font-mono bg-gray-200 px-1 rounded">{system.trigger_type}</span>
                                    </p>
                                </div>
                                <button
                                    onClick={() => addToCalendar(system)}
                                    className="text-xs bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-2 py-1 rounded flex items-center gap-1"
                                    title="Add to Google Calendar"
                                >
                                    📅 Sync
                                </button>
                            </div>
                            <div className="mt-2 text-xs text-gray-600 line-clamp-2">
                                {system.sop_content}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default SystemSOPWidget;
