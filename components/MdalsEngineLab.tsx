import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { SparklesIcon, MicIcon, SearchIcon, MusicIcon } from './Icons';

interface SongResult {
    title: string;
    artist: string;
    confidence: number;
    reasoning: string;
}

const MdalsEngineLab: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    // Search State
    const [description, setDescription] = useState('');
    const [genre, setGenre] = useState('Christian/Gospel');
    const [mood, setMood] = useState('');
    const [era, setEra] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [searchResult, setSearchResult] = useState<SongResult | null>(null);

    // Input State
    const [title, setTitle] = useState('');
    const [artist, setArtist] = useState('');
    const [source, setSource] = useState('YouTube');
    const [link, setLink] = useState('');
    const [meaning, setMeaning] = useState('');
    const [selectedDomains, setSelectedDomains] = useState<string[]>(['Spiritual/Christian']);

    const genres = ['Christian/Gospel', 'Worship', 'Pop', 'Rock', 'R&B/Soul', 'Country', 'Hip-Hop', 'Classical'];
    const domains = ['Spiritual/Christian', 'Leadership', 'Business', 'Personal Growth', 'Healing/Emotional', 'Relationships'];

    const handleFindSong = async () => {
        if (!description) return;
        setIsSearching(true);
        setSearchResult(null);

        try {
            const { data, error } = await supabase.functions.invoke('mdals-engine', {
                body: {
                    action: 'find_song',
                    description,
                    genre,
                    mood,
                    era
                }
            });

            if (error) throw error;

            if (data.found) {
                setSearchResult(data);
                // Auto-fill form
                setTitle(data.title);
                setArtist(data.artist);
            } else {
                alert('Could not find a high-confidence match. Please try adding more details.');
            }
        } catch (err) {
            console.error('Song finding error:', err);
            alert('Failed to search for song. Edge Function might be cold or missing API key.');
        } finally {
            setIsSearching(false);
        }
    };

    const toggleDomain = (d: string) => {
        if (selectedDomains.includes(d)) {
            setSelectedDomains(prev => prev.filter(x => x !== d));
        } else {
            setSelectedDomains(prev => [...prev, d]);
        }
    };

    return (
        <div className="fixed inset-0 bg-navy-900/95 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-navy-900 w-full max-w-4xl rounded-xl border border-gray-700 shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-navy-900 to-navy-800 p-6 border-b border-gray-700 flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-serif font-bold text-white flex items-center gap-3">
                            <span className="text-gold-400 text-3xl">V</span>
                            MDALS Engine Lab
                        </h2>
                        <p className="text-gray-400 text-sm mt-1">Music-Driven Adaptive Learning Systems - Test Panel</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        Close
                    </button>
                </div>

                <div className="p-8 space-y-8">
                    {/* Error Banner (Simulated based on screenshot, dynamic in reality) */}
                    {/* <div className="bg-red-500/10 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg text-sm">
            Edge Function returned a non-2xx status code
          </div> */}

                    {/* Song Finder Section */}
                    <div className="bg-navy-800 rounded-xl p-6 border border-gray-700">
                        <div className="flex items-center justify-between mb-4 cursor-pointer">
                            <div className="flex items-center gap-3">
                                <div className="bg-purple-500/20 p-2 rounded-lg">
                                    <SparklesIcon className="w-6 h-6 text-purple-400" />
                                </div>
                                <h3 className="text-lg font-bold text-white">Can't Remember the Song?</h3>
                            </div>
                            <span className="text-gray-500">▼</span>
                        </div>

                        <p className="text-gray-400 text-sm mb-4">Let AI help you find it from your description</p>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
                                    Describe the song you're looking for
                                </label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="victory is mine"
                                    className="w-full bg-navy-900 border border-gray-700 rounded-lg p-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-gold-500 focus:border-transparent transition-all h-24 resize-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
                                    Genre (optional)
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {genres.map(g => (
                                        <button
                                            key={g}
                                            onClick={() => setGenre(g)}
                                            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${genre === g
                                                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/50'
                                                    : 'bg-navy-900 text-gray-400 border border-gray-700 hover:border-gray-500'
                                                }`}
                                        >
                                            {g}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
                                        Mood/Feel (optional)
                                    </label>
                                    <input
                                        type="text"
                                        value={mood}
                                        onChange={(e) => setMood(e.target.value)}
                                        placeholder="e.g., uplifting, peaceful, powerful"
                                        className="w-full bg-navy-900 border border-gray-700 rounded-lg p-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-gold-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
                                        Era/Time Period (optional)
                                    </label>
                                    <input
                                        type="text"
                                        value={era}
                                        onChange={(e) => setEra(e.target.value)}
                                        placeholder="e.g., 2010s, 90s, recent"
                                        className="w-full bg-navy-900 border border-gray-700 rounded-lg p-3 text-white placeholder-gray-500 focus:ring-2 focus:ring-gold-500"
                                    />
                                </div>
                            </div>

                            <button
                                onClick={handleFindSong}
                                disabled={isSearching}
                                className="bg-gold-500 text-black font-bold px-6 py-3 rounded-lg hover:bg-gold-400 transition-all flex items-center justify-center gap-2 w-full md:w-auto"
                            >
                                {isSearching ? 'Searching...' : 'Find My Song'}
                            </button>

                            {searchResult && (
                                <div className="mt-4 bg-green-900/20 border border-green-500/30 p-4 rounded-lg">
                                    <p className="text-green-400 text-sm font-bold flex items-center gap-2">
                                        <span className="text-lg">✓</span> Match Found: {searchResult.title} by {searchResult.artist}
                                    </p>
                                    <p className="text-gray-400 text-xs mt-1">{searchResult.reasoning}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Add Song Section */}
                    <div>
                        <h3 className="text-xl font-bold text-white mb-6">Step 1: Add a Song</h3>
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
                                        Song Title *
                                    </label>
                                    <input
                                        type="text"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        placeholder="e.g., Amazing Grace"
                                        className="w-full bg-navy-800 border border-gray-700 rounded-lg p-4 text-white placeholder-gray-500 focus:ring-2 focus:ring-gold-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
                                        Artist
                                    </label>
                                    <input
                                        type="text"
                                        value={artist}
                                        onChange={(e) => setArtist(e.target.value)}
                                        placeholder="e.g., Chris Tomlin"
                                        className="w-full bg-navy-800 border border-gray-700 rounded-lg p-4 text-white placeholder-gray-500 focus:ring-2 focus:ring-gold-500"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
                                        Source
                                    </label>
                                    <select
                                        value={source}
                                        onChange={(e) => setSource(e.target.value)}
                                        className="w-full bg-navy-800 border border-gray-700 rounded-lg p-4 text-white focus:ring-2 focus:ring-gold-500 appearance-none"
                                    >
                                        <option>YouTube</option>
                                        <option>Spotify</option>
                                        <option>Apple Music</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
                                        Link (optional)
                                    </label>
                                    <input
                                        type="text"
                                        value={link}
                                        onChange={(e) => setLink(e.target.value)}
                                        placeholder="https://..."
                                        className="w-full bg-navy-800 border border-gray-700 rounded-lg p-4 text-white placeholder-gray-500 focus:ring-2 focus:ring-gold-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
                                    What does this song mean to you?
                                </label>
                                <textarea
                                    value={meaning}
                                    onChange={(e) => setMeaning(e.target.value)}
                                    placeholder="Share your personal connection to this song..."
                                    className="w-full bg-navy-800 border border-gray-700 rounded-lg p-4 text-white placeholder-gray-500 focus:ring-2 focus:ring-gold-500 h-32 resize-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
                                    Learning Domains
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {domains.map(d => (
                                        <button
                                            key={d}
                                            onClick={() => toggleDomain(d)}
                                            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${selectedDomains.includes(d)
                                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50'
                                                    : 'bg-navy-800 text-gray-400 border border-gray-700 hover:border-gray-500'
                                                }`}
                                        >
                                            {d}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MdalsEngineLab;
