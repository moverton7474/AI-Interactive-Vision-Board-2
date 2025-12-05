import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface FeedItem {
    id: string;
    title: string;
    url: string;
    content_type: 'video' | 'article' | 'book';
    relevance_score: number;
    ai_summary: string;
    thumbnail_url?: string;
    created_at: string;
}

const IdentityFeedWidget: React.FC = () => {
    const [feed, setFeed] = useState<FeedItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadFeed();
    }, []);

    const loadFeed = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const { data, error } = await supabase
                .from('resource_feed')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(5);

            if (error) throw error;
            setFeed(data || []);
        } catch (error) {
            console.error('Error loading feed:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="animate-pulse h-32 bg-gray-100 rounded-xl"></div>;

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-navy-900 flex items-center gap-2">
                    <span className="text-xl">🧠</span> Identity Feed
                </h3>
                <button
                    onClick={loadFeed}
                    className="text-xs text-navy-600 hover:text-navy-800"
                >
                    Refresh
                </button>
            </div>

            {feed.length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                    <p>No curated content yet.</p>
                    <p className="text-xs mt-1">The Input Diet engine runs daily.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {feed.map(item => (
                        <a
                            key={item.id}
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block group"
                        >
                            <div className="flex gap-3 items-start">
                                {item.thumbnail_url ? (
                                    <img
                                        src={item.thumbnail_url}
                                        alt={item.title}
                                        className="w-20 h-14 object-cover rounded-lg border border-gray-200 group-hover:border-navy-300 transition-colors"
                                    />
                                ) : (
                                    <div className="w-20 h-14 bg-gray-100 rounded-lg flex items-center justify-center text-2xl">
                                        {item.content_type === 'video' ? '📺' : '📄'}
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-sm font-medium text-navy-900 line-clamp-2 group-hover:text-gold-600 transition-colors">
                                        {item.title}
                                    </h4>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold ${item.relevance_score > 0.8 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                                            }`}>
                                            {Math.round(item.relevance_score * 100)}% Match
                                        </span>
                                        <span className="text-xs text-gray-400">
                                            {new Date(item.created_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </a>
                    ))}
                </div>
            )}
        </div>
    );
};

export default IdentityFeedWidget;
