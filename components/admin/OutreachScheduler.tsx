import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

interface OutreachSchedulerProps {
  teamId: string;
  teamName: string;
  isPlatformAdmin?: boolean;
}

interface OutreachItem {
  id: string;
  user_id: string;
  outreach_type: string;
  scheduled_for: string;
  priority: number;
  context: any;
  status: string;
  attempt_count: number;
  last_attempt_at: string | null;
  completed_at: string | null;
  result: any;
  created_at: string;
  // Joined
  user_email?: string;
  user_name?: string;
}

interface TeamMember {
  user_id: string;
  email: string;
  name: string;
  current_streak: number;
  role: string;
}

const outreachTypes = [
  { value: 'morning_motivation', label: 'Morning Motivation', icon: '🌅', description: 'Inspiring start to the day' },
  { value: 'habit_reminder', label: 'Habit Reminder', icon: '⏰', description: 'Gentle nudge for habits' },
  { value: 'celebration', label: 'Celebration', icon: '🎉', description: 'Celebrate achievements' },
  { value: 'check_in', label: 'Check-In', icon: '💬', description: 'Personal wellness check' },
  { value: 'goal_review', label: 'Goal Review', icon: '🎯', description: 'Progress on goals' },
  { value: 'weekly_summary', label: 'Weekly Summary', icon: '📊', description: 'Week in review' }
];

const OutreachScheduler: React.FC<OutreachSchedulerProps> = ({
  teamId,
  teamName,
  isPlatformAdmin = false
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [outreachQueue, setOutreachQueue] = useState<OutreachItem[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [filter, setFilter] = useState<'pending' | 'completed' | 'failed' | 'all'>('pending');

  // New outreach form
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [selectedType, setSelectedType] = useState('morning_motivation');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('09:00');
  const [priority, setPriority] = useState(5);
  const [customMessage, setCustomMessage] = useState('');
  const [scheduling, setScheduling] = useState(false);
  const [sendingNowId, setSendingNowId] = useState<string | null>(null);
  const [sendNowMode, setSendNowMode] = useState(false); // For modal toggle
  const [sendChannel, setSendChannel] = useState<'voice' | 'sms'>('voice'); // Channel for immediate sends

  useEffect(() => {
    loadData();
  }, [teamId, filter]);

  const loadData = async () => {
    if (!teamId || teamId === 'all') {
      setError('Please select a specific team');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Load outreach queue
      let query = supabase
        .from('voice_outreach_queue')
        .select('*')
        .order('scheduled_for', { ascending: true });

      // Filter by team members
      const { data: memberIds } = await supabase
        .from('team_members')
        .select('user_id')
        .eq('team_id', teamId)
        .eq('is_active', true);

      if (memberIds && memberIds.length > 0) {
        query = query.in('user_id', memberIds.map(m => m.user_id));
      }

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data: queueData, error: queueError } = await query.limit(100);

      if (queueError) throw queueError;

      // Fetch profiles separately to avoid FK ambiguity
      const queueUserIds = (queueData || []).map((item: any) => item.user_id).filter(Boolean);
      let emailMap: Record<string, string> = {};
      if (queueUserIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, email')
          .in('id', queueUserIds);
        emailMap = (profilesData || []).reduce((acc: Record<string, string>, p: any) => {
          acc[p.id] = p.email || '';
          return acc;
        }, {});
      }

      const queueWithNames = (queueData || []).map((item: any) => ({
        ...item,
        user_email: emailMap[item.user_id] || '',
        user_name: emailMap[item.user_id]?.split('@')[0] || 'User'
      }));

      setOutreachQueue(queueWithNames);

      // Load team members for scheduling
      const { data: membersData, error: membersError } = await supabase
        .from('team_members')
        .select('user_id, role, current_streak')
        .eq('team_id', teamId)
        .eq('is_active', true);

      if (membersError) throw membersError;

      // Fetch profiles for team members
      const memberUserIds = (membersData || []).map((m: any) => m.user_id).filter(Boolean);
      let memberEmailMap: Record<string, string> = {};
      if (memberUserIds.length > 0) {
        const { data: memberProfilesData } = await supabase
          .from('profiles')
          .select('id, email')
          .in('id', memberUserIds);
        memberEmailMap = (memberProfilesData || []).reduce((acc: Record<string, string>, p: any) => {
          acc[p.id] = p.email || '';
          return acc;
        }, {});
      }

      const members = (membersData || []).map((m: any) => ({
        user_id: m.user_id,
        email: memberEmailMap[m.user_id] || '',
        name: memberEmailMap[m.user_id]?.split('@')[0] || 'User',
        current_streak: m.current_streak || 0,
        role: m.role
      }));

      setTeamMembers(members);
    } catch (err: any) {
      console.error('Error loading data:', err);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const scheduleOutreach = async () => {
    if (selectedMembers.length === 0) {
      setError('Please select at least one team member');
      return;
    }

    if (!scheduledDate) {
      setError('Please select a date');
      return;
    }

    setScheduling(true);
    setError(null);

    try {
      const scheduledFor = new Date(`${scheduledDate}T${scheduledTime}`);

      const insertData = selectedMembers.map(userId => ({
        team_id: teamId,
        user_id: userId,
        outreach_type: selectedType,
        scheduled_for: scheduledFor.toISOString(),
        priority,
        context: customMessage ? { message: customMessage } : {},
        status: 'pending'
      }));

      const { error: insertError } = await supabase
        .from('voice_outreach_queue')
        .insert(insertData);

      if (insertError) throw insertError;

      // Reset form
      setShowScheduleModal(false);
      setSelectedMembers([]);
      setScheduledDate('');
      setScheduledTime('09:00');
      setPriority(5);
      setCustomMessage('');

      // Reload data
      await loadData();
    } catch (err: any) {
      console.error('Error scheduling outreach:', err);
      setError(err.message || 'Failed to schedule outreach');
    } finally {
      setScheduling(false);
    }
  };

  // Send outreach immediately (for testing or urgent needs)
  const sendNow = async (outreachId?: string) => {
    setSendingNowId(outreachId || 'new');
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      let targetOutreachId = outreachId;

      // If creating a new immediate outreach
      if (!outreachId && selectedMembers.length > 0) {
        // Create outreach entry with 'processing' status (to be sent immediately)
        const insertData = selectedMembers.map(userId => ({
          team_id: teamId,
          user_id: userId,
          outreach_type: selectedType,
          scheduled_for: new Date().toISOString(), // Now
          priority: 10, // High priority for immediate sends
          context: customMessage ? { message: customMessage } : {},
          status: 'processing' // Skip pending, go straight to processing
        }));

        const { data: inserted, error: insertError } = await supabase
          .from('voice_outreach_queue')
          .insert(insertData)
          .select('id');

        if (insertError) throw insertError;
        targetOutreachId = inserted?.[0]?.id;
      }

      if (!targetOutreachId) {
        throw new Error('No outreach to send');
      }

      // Call edge function to process this specific outreach
      const { data, error: fnError } = await supabase.functions.invoke('admin-manage-outreach', {
        body: {
          action: 'send_now',
          outreach_id: targetOutreachId,
          channel: sendChannel // 'voice' or 'sms'
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (fnError) throw fnError;

      // Close modal and refresh
      setShowScheduleModal(false);
      setSelectedMembers([]);
      setCustomMessage('');
      setSendNowMode(false);
      setSendChannel('voice');

      await loadData();

      // Show success toast or message
      alert(data?.message || 'Outreach sent successfully!');
    } catch (err: any) {
      console.error('Error sending outreach:', err);
      setError(err.message || 'Failed to send outreach');
    } finally {
      setSendingNowId(null);
    }
  };

  const cancelOutreach = async (id: string) => {
    try {
      const { error: updateError } = await supabase
        .from('voice_outreach_queue')
        .update({ status: 'skipped' })
        .eq('id', id);

      if (updateError) throw updateError;

      await loadData();
    } catch (err: any) {
      console.error('Error cancelling outreach:', err);
      setError('Failed to cancel outreach');
    }
  };

  const getTypeInfo = (type: string) => {
    return outreachTypes.find(t => t.value === type) || outreachTypes[0];
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-blue-500/20 text-blue-300',
      processing: 'bg-yellow-500/20 text-yellow-300',
      completed: 'bg-green-500/20 text-green-300',
      failed: 'bg-red-500/20 text-red-300',
      skipped: 'bg-gray-500/20 text-gray-300'
    };
    return (
      <span className={`px-2 py-1 text-xs rounded-full ${colors[status] || colors.pending}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const pendingCount = outreachQueue.filter(o => o.status === 'pending').length;
  const todayCount = outreachQueue.filter(o => {
    const scheduled = new Date(o.scheduled_for);
    const today = new Date();
    return scheduled.toDateString() === today.toDateString() && o.status === 'pending';
  }).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-indigo-200">Loading outreach queue...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <span className="text-2xl">📞</span>
            Proactive Outreach
            {pendingCount > 0 && (
              <span className="px-2 py-1 text-sm bg-blue-500/20 text-blue-300 rounded-full">
                {pendingCount} pending
              </span>
            )}
          </h2>
          <p className="text-indigo-200 text-sm mt-1">
            Schedule AI coaching outreach for team members
          </p>
        </div>
        <button
          onClick={() => setShowScheduleModal(true)}
          className="px-6 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Schedule Outreach
        </button>
      </div>

      {/* Stats */}
      {todayCount > 0 && (
        <div className="bg-indigo-500/20 border border-indigo-500/30 rounded-xl p-4 flex items-center gap-4">
          <div className="p-3 bg-indigo-500/30 rounded-full">
            <span className="text-2xl">📅</span>
          </div>
          <div>
            <p className="font-semibold text-white">
              {todayCount} outreach{todayCount > 1 ? 'es' : ''} scheduled for today
            </p>
            <p className="text-indigo-200 text-sm">
              These will be sent automatically at the scheduled times.
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2">
        {(['pending', 'completed', 'failed', 'all'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-indigo-500 text-white'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 text-red-200">
          {error}
        </div>
      )}

      {/* Queue List */}
      {outreachQueue.length > 0 ? (
        <div className="bg-white/10 backdrop-blur-sm rounded-xl overflow-hidden border border-white/20">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/5">
                <tr>
                  <th className="text-left p-4 text-indigo-200 font-medium">Member</th>
                  <th className="text-left p-4 text-indigo-200 font-medium">Type</th>
                  <th className="text-left p-4 text-indigo-200 font-medium">Scheduled</th>
                  <th className="text-center p-4 text-indigo-200 font-medium">Priority</th>
                  <th className="text-center p-4 text-indigo-200 font-medium">Status</th>
                  <th className="text-right p-4 text-indigo-200 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {outreachQueue.map((item) => {
                  const typeInfo = getTypeInfo(item.outreach_type);
                  return (
                    <tr key={item.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-semibold">
                            {item.user_name?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-white">{item.user_name}</p>
                            <p className="text-sm text-indigo-200">{item.user_email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full text-white text-sm">
                          <span>{typeInfo.icon}</span>
                          {typeInfo.label}
                        </span>
                      </td>
                      <td className="p-4">
                        <p className="text-white">
                          {new Date(item.scheduled_for).toLocaleDateString()}
                        </p>
                        <p className="text-indigo-300 text-sm">
                          {new Date(item.scheduled_for).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-white font-medium ${
                          item.priority >= 8 ? 'bg-red-500/40' :
                          item.priority >= 5 ? 'bg-yellow-500/40' : 'bg-green-500/40'
                        }`}>
                          {item.priority}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        {getStatusBadge(item.status)}
                        {item.attempt_count > 0 && (
                          <span className="text-indigo-300 text-xs ml-2">
                            ({item.attempt_count} attempts)
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        {item.status === 'pending' && (
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => sendNow(item.id)}
                              disabled={sendingNowId === item.id}
                              className="px-3 py-1 bg-green-500/20 hover:bg-green-500/30 text-green-300 rounded-lg text-sm transition-colors disabled:opacity-50 flex items-center gap-1"
                            >
                              {sendingNowId === item.id ? (
                                <>
                                  <div className="w-3 h-3 border-2 border-green-300 border-t-transparent rounded-full animate-spin" />
                                  Sending...
                                </>
                              ) : (
                                <>
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                  </svg>
                                  Send Now
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => cancelOutreach(item.id)}
                              className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg text-sm transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-12 border border-white/20 text-center">
          <div className="text-6xl mb-4">📞</div>
          <h3 className="text-xl font-semibold text-white mb-2">No Outreach Scheduled</h3>
          <p className="text-indigo-200 max-w-md mx-auto mb-6">
            Schedule proactive AI coaching calls to keep your team engaged and motivated.
          </p>
          <button
            onClick={() => setShowScheduleModal(true)}
            className="px-6 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-medium transition-colors"
          >
            Schedule First Outreach
          </button>
        </div>
      )}

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-purple-900 rounded-xl p-6 max-w-2xl w-full border border-white/20 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white">Schedule Outreach</h3>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-white"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-6">
              {/* Send Now vs Schedule Toggle */}
              <div className="flex rounded-lg bg-white/10 p-1">
                <button
                  type="button"
                  onClick={() => setSendNowMode(true)}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                    sendNowMode
                      ? 'bg-green-500 text-white'
                      : 'text-white hover:bg-white/10'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Send Now (Test)
                </button>
                <button
                  type="button"
                  onClick={() => setSendNowMode(false)}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                    !sendNowMode
                      ? 'bg-indigo-500 text-white'
                      : 'text-white hover:bg-white/10'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Schedule Later
                </button>
              </div>

              {sendNowMode && (
                <>
                  <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-4 flex items-center gap-3">
                    <span className="text-2xl">⚡</span>
                    <div>
                      <p className="font-medium text-white">Immediate Send Mode</p>
                      <p className="text-green-200 text-sm">Outreach will be sent immediately to selected members</p>
                    </div>
                  </div>

                  {/* Channel Selector for Send Now */}
                  <div>
                    <label className="block text-sm font-medium text-indigo-200 mb-2">Send Via</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setSendChannel('voice')}
                        className={`p-4 rounded-lg text-center transition-colors ${
                          sendChannel === 'voice'
                            ? 'bg-indigo-500 border-indigo-400'
                            : 'bg-white/10 border-white/20 hover:bg-white/20'
                        } border`}
                      >
                        <span className="text-3xl">📞</span>
                        <p className="font-medium text-white mt-2">Voice Call</p>
                        <p className="text-xs text-indigo-300">AI will call and speak</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSendChannel('sms')}
                        className={`p-4 rounded-lg text-center transition-colors ${
                          sendChannel === 'sms'
                            ? 'bg-indigo-500 border-indigo-400'
                            : 'bg-white/10 border-white/20 hover:bg-white/20'
                        } border`}
                      >
                        <span className="text-3xl">💬</span>
                        <p className="font-medium text-white mt-2">SMS Text</p>
                        <p className="text-xs text-indigo-300">Send text message</p>
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* Outreach Type */}
              <div>
                <label className="block text-sm font-medium text-indigo-200 mb-2">Outreach Type</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {outreachTypes.map((type) => (
                    <button
                      key={type.value}
                      onClick={() => setSelectedType(type.value)}
                      className={`p-3 rounded-lg text-left transition-colors ${
                        selectedType === type.value
                          ? 'bg-indigo-500 border-indigo-400'
                          : 'bg-white/10 border-white/20 hover:bg-white/20'
                      } border`}
                    >
                      <span className="text-2xl">{type.icon}</span>
                      <p className="font-medium text-white mt-1 text-sm">{type.label}</p>
                      <p className="text-xs text-indigo-300">{type.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Select Members */}
              <div>
                <label className="block text-sm font-medium text-indigo-200 mb-2">
                  Select Members ({selectedMembers.length} selected)
                </label>
                <div className="flex gap-2 mb-2">
                  <button
                    onClick={() => setSelectedMembers(teamMembers.map(m => m.user_id))}
                    className="px-3 py-1 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 rounded-lg text-sm"
                  >
                    Select All
                  </button>
                  <button
                    onClick={() => setSelectedMembers([])}
                    className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm"
                  >
                    Clear
                  </button>
                </div>
                <div className="max-h-40 overflow-y-auto bg-white/5 rounded-lg p-2 space-y-1">
                  {teamMembers.map((member) => (
                    <label
                      key={member.user_id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/10 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedMembers.includes(member.user_id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedMembers([...selectedMembers, member.user_id]);
                          } else {
                            setSelectedMembers(selectedMembers.filter(id => id !== member.user_id));
                          }
                        }}
                        className="w-4 h-4 rounded border-white/20 bg-white/10 text-indigo-500 focus:ring-indigo-500"
                      />
                      <div className="flex-1">
                        <p className="text-white text-sm">{member.name}</p>
                        <p className="text-indigo-300 text-xs">{member.email}</p>
                      </div>
                      {member.current_streak > 0 && (
                        <span className="text-orange-400 text-xs">🔥 {member.current_streak}</span>
                      )}
                    </label>
                  ))}
                </div>
              </div>

              {/* Date/Time - Only show when scheduling */}
              {!sendNowMode && (
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-indigo-200 mb-2">Date</label>
                    <input
                      type="date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-indigo-200 mb-2">Time</label>
                    <input
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              )}

              {/* Priority - Only show when scheduling */}
              {!sendNowMode && (
                <div>
                  <label className="block text-sm font-medium text-indigo-200 mb-2">
                    Priority: {priority}/10
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={priority}
                    onChange={(e) => setPriority(parseInt(e.target.value))}
                    className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-indigo-300 mt-1">
                    <span>Low priority</span>
                    <span>High priority</span>
                  </div>
                </div>
              )}

              {/* Custom Message */}
              <div>
                <label className="block text-sm font-medium text-indigo-200 mb-2">
                  Custom Message (optional)
                </label>
                <textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  rows={2}
                  placeholder="Add a custom message for this outreach..."
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="flex-1 px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                {sendNowMode ? (
                  <button
                    type="button"
                    onClick={() => sendNow()}
                    disabled={sendingNowId !== null || selectedMembers.length === 0}
                    className="flex-1 px-4 py-3 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    {sendingNowId !== null ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Send Now to {selectedMembers.length} Member{selectedMembers.length > 1 ? 's' : ''}
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={scheduleOutreach}
                    disabled={scheduling || selectedMembers.length === 0 || !scheduledDate}
                    className="flex-1 px-4 py-3 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    {scheduling ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Scheduling...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Schedule {selectedMembers.length} Outreach{selectedMembers.length > 1 ? 'es' : ''}
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OutreachScheduler;
