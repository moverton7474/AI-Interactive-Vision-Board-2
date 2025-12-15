import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

interface KnowledgeSource {
  id: string;
  user_id: string;
  source_type: string;
  name: string;
  word_count: number;
  chunk_count: number;
  include_in_context: boolean;
  team_visible: boolean;
  created_at: string;
  email?: string;
}

interface MemberKnowledge {
  user_id: string;
  email: string;
  source_count: number;
  total_words: number;
  chunk_count: number;
  active_sources: number;
  last_updated: string | null;
  sources?: KnowledgeSource[];
}

interface TeamStats {
  total_sources: number;
  total_words: number;
  total_chunks: number;
  active_sources: number;
  members_with_knowledge: number;
}

/**
 * TeamKnowledgeView - View team members' knowledge base content
 *
 * Allows platform admins and team managers to:
 * - View aggregated knowledge statistics per team
 * - See individual member's knowledge sources
 * - Browse knowledge chunks (with permission)
 */
const TeamKnowledgeView: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [memberKnowledge, setMemberKnowledge] = useState<MemberKnowledge[]>([]);
  const [teamStats, setTeamStats] = useState<TeamStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedMember, setExpandedMember] = useState<string | null>(null);
  const [memberSources, setMemberSources] = useState<Record<string, KnowledgeSource[]>>({});

  useEffect(() => {
    loadKnowledgeData();
  }, []);

  const loadKnowledgeData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get team members with their knowledge stats
      const { data: members, error: membersError } = await supabase
        .from('team_members')
        .select(`
          user_id,
          profiles:user_id (email)
        `)
        .eq('is_active', true);

      if (membersError) throw membersError;

      // Get knowledge sources for all team members
      const userIds = members?.map(m => m.user_id) || [];

      const { data: sources, error: sourcesError } = await supabase
        .from('user_knowledge_sources')
        .select('*')
        .in('user_id', userIds)
        .eq('is_active', true);

      if (sourcesError) {
        console.warn('Could not load knowledge sources:', sourcesError);
      }

      // Get chunk counts
      const { data: chunks, error: chunksError } = await supabase
        .from('user_knowledge_chunks')
        .select('source_id')
        .in('source_id', sources?.map(s => s.id) || []);

      if (chunksError) {
        console.warn('Could not load chunks:', chunksError);
      }

      // Count chunks per source
      const chunkCounts: Record<string, number> = {};
      chunks?.forEach(c => {
        chunkCounts[c.source_id] = (chunkCounts[c.source_id] || 0) + 1;
      });

      // Aggregate by member
      const memberMap: Record<string, MemberKnowledge> = {};

      members?.forEach(m => {
        const email = (m.profiles as any)?.email || 'Unknown';
        memberMap[m.user_id] = {
          user_id: m.user_id,
          email,
          source_count: 0,
          total_words: 0,
          chunk_count: 0,
          active_sources: 0,
          last_updated: null
        };
      });

      sources?.forEach(s => {
        if (memberMap[s.user_id]) {
          memberMap[s.user_id].source_count++;
          memberMap[s.user_id].total_words += s.word_count || 0;
          memberMap[s.user_id].chunk_count += chunkCounts[s.id] || 0;
          if (s.include_in_context) {
            memberMap[s.user_id].active_sources++;
          }
          if (!memberMap[s.user_id].last_updated || s.created_at > memberMap[s.user_id].last_updated!) {
            memberMap[s.user_id].last_updated = s.created_at;
          }
        }
      });

      const memberList = Object.values(memberMap).sort((a, b) => b.source_count - a.source_count);
      setMemberKnowledge(memberList);

      // Calculate team stats
      const stats: TeamStats = {
        total_sources: sources?.length || 0,
        total_words: sources?.reduce((sum, s) => sum + (s.word_count || 0), 0) || 0,
        total_chunks: chunks?.length || 0,
        active_sources: sources?.filter(s => s.include_in_context).length || 0,
        members_with_knowledge: memberList.filter(m => m.source_count > 0).length
      };
      setTeamStats(stats);

    } catch (err: any) {
      console.error('Error loading knowledge data:', err);
      setError(err.message || 'Failed to load knowledge data');
    } finally {
      setLoading(false);
    }
  };

  const loadMemberSources = async (userId: string) => {
    if (memberSources[userId]) return;

    try {
      const { data, error } = await supabase
        .from('user_knowledge_sources')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setMemberSources(prev => ({
        ...prev,
        [userId]: data || []
      }));
    } catch (err) {
      console.error('Error loading member sources:', err);
    }
  };

  const toggleMember = (userId: string) => {
    if (expandedMember === userId) {
      setExpandedMember(null);
    } else {
      setExpandedMember(userId);
      loadMemberSources(userId);
    }
  };

  const getSourceTypeIcon = (type: string) => {
    switch (type) {
      case 'notes':
        return (
          <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        );
      case 'url':
        return (
          <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        );
      case 'document':
        return (
          <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-indigo-200">Loading knowledge base...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
        <h2 className="text-xl font-semibold text-white mb-2">Team Knowledge Overview</h2>
        <p className="text-indigo-200 text-sm">
          View and monitor team members' knowledge base content for AI coaching
        </p>
      </div>

      {error && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 text-red-200">
          {error}
        </div>
      )}

      {/* Team Stats */}
      {teamStats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
            <p className="text-3xl font-bold text-white">{teamStats.total_sources}</p>
            <p className="text-indigo-200 text-sm">Sources</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
            <p className="text-3xl font-bold text-white">{teamStats.active_sources}</p>
            <p className="text-indigo-200 text-sm">Active for AI</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
            <p className="text-3xl font-bold text-white">{teamStats.total_chunks}</p>
            <p className="text-indigo-200 text-sm">Chunks</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
            <p className="text-3xl font-bold text-white">{teamStats.total_words.toLocaleString()}</p>
            <p className="text-indigo-200 text-sm">Words</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
            <p className="text-3xl font-bold text-white">{teamStats.members_with_knowledge}</p>
            <p className="text-indigo-200 text-sm">Members Active</p>
          </div>
        </div>
      )}

      {/* Member Knowledge List */}
      <div className="bg-white/10 backdrop-blur-sm rounded-xl overflow-hidden border border-white/20">
        <div className="p-4 border-b border-white/10">
          <h3 className="text-lg font-semibold text-white">Member Knowledge Sources</h3>
        </div>

        <div className="divide-y divide-white/10">
          {memberKnowledge.map((member) => (
            <div key={member.user_id}>
              {/* Member Row */}
              <div
                onClick={() => toggleMember(member.user_id)}
                className="p-4 hover:bg-white/5 cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-semibold">
                      {member.email.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-white">{member.email.split('@')[0]}</p>
                      <p className="text-sm text-indigo-300">{member.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-center">
                      <p className="font-medium text-white">{member.source_count}</p>
                      <p className="text-indigo-300">Sources</p>
                    </div>
                    <div className="text-center">
                      <p className="font-medium text-white">{member.total_words.toLocaleString()}</p>
                      <p className="text-indigo-300">Words</p>
                    </div>
                    <div className="text-center">
                      <p className="font-medium text-white">{member.chunk_count}</p>
                      <p className="text-indigo-300">Chunks</p>
                    </div>
                    <div className="text-center min-w-[80px]">
                      <p className="font-medium text-white">
                        {member.last_updated
                          ? new Date(member.last_updated).toLocaleDateString()
                          : '-'}
                      </p>
                      <p className="text-indigo-300">Updated</p>
                    </div>
                    <svg
                      className={`w-5 h-5 text-indigo-300 transition-transform ${expandedMember === member.user_id ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Expanded Sources */}
              {expandedMember === member.user_id && (
                <div className="bg-white/5 p-4 border-t border-white/10">
                  {memberSources[member.user_id]?.length ? (
                    <div className="space-y-3">
                      {memberSources[member.user_id].map((source) => (
                        <div
                          key={source.id}
                          className="flex items-center justify-between p-3 bg-white/5 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            {getSourceTypeIcon(source.source_type)}
                            <div>
                              <p className="font-medium text-white">{source.name}</p>
                              <p className="text-xs text-indigo-300">
                                {source.source_type} • {source.word_count || 0} words
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {source.include_in_context ? (
                              <span className="px-2 py-1 text-xs rounded-full bg-green-500/20 text-green-400">
                                AI Active
                              </span>
                            ) : (
                              <span className="px-2 py-1 text-xs rounded-full bg-gray-500/20 text-gray-400">
                                Inactive
                              </span>
                            )}
                            <span className="text-xs text-indigo-300">
                              {new Date(source.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : member.source_count === 0 ? (
                    <p className="text-center text-indigo-300 py-4">
                      No knowledge sources yet
                    </p>
                  ) : (
                    <div className="flex items-center justify-center py-4">
                      <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {memberKnowledge.length === 0 && (
            <div className="p-8 text-center text-indigo-200">
              No team members found
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeamKnowledgeView;
