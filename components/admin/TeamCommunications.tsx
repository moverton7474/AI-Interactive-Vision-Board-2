import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

// Icons
const EnvelopeIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

const PlusIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const ChevronRightIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

const CheckCircleIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ExclamationCircleIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ClockIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const CalendarIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const XMarkIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const EyeIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

// Types
interface Communication {
  id: string;
  team_id: string;
  team_name: string;
  sender_id: string;
  sender_name: string;
  sender_email: string;
  subject: string;
  template_type: string;
  recipient_filter: any;
  stats: {
    total_recipients: number;
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    failed: number;
    bounced: number;
  };
  open_rate: number;
  click_rate: number;
  status: string;
  scheduled_for?: string;
  sent_at?: string;
  completed_at?: string;
  created_at: string;
}

interface TeamMemberForSelect {
  user_id: string;
  email: string;
  role: string;
  status: string;
}

interface Props {
  teamId: string;
  teamName: string;
  isPlatformAdmin: boolean;
}

type ViewMode = 'list' | 'compose' | 'detail';
type TemplateType = 'announcement' | 'recognition' | 'reminder' | 'custom';

const TEMPLATE_OPTIONS: { value: TemplateType; label: string; description: string }[] = [
  { value: 'announcement', label: 'Announcement', description: 'General team-wide announcements' },
  { value: 'recognition', label: 'Recognition', description: 'Celebrate member achievements' },
  { value: 'reminder', label: 'Reminder', description: 'Activity or engagement reminders' },
  { value: 'custom', label: 'Custom Message', description: 'Freeform message to your team' },
];

/**
 * TeamCommunications - Manager communication center
 *
 * Allows team managers to send announcements, recognition,
 * and reminders to team members via email.
 */
const TeamCommunications: React.FC<Props> = ({ teamId, teamName, isPlatformAdmin }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Communication list state
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Compose state
  const [templateType, setTemplateType] = useState<TemplateType>('announcement');
  const [subject, setSubject] = useState('');
  const [messageHtml, setMessageHtml] = useState('');
  const [recipientFilter, setRecipientFilter] = useState<{
    roles: string[];
    status: string[];
  }>({
    roles: ['owner', 'admin', 'manager', 'member'],
    status: ['active']
  });
  const [eligibleRecipients, setEligibleRecipients] = useState<TeamMemberForSelect[]>([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);

  // Scheduling state
  const [scheduleForLater, setScheduleForLater] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');

  // Detail view state
  const [selectedCommunication, setSelectedCommunication] = useState<Communication | null>(null);
  const [communicationDetail, setCommunicationDetail] = useState<any>(null);

  const PAGE_SIZE = 10;

  // Load communications list - using direct Supabase query
  const loadCommunications = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('Please sign in to view communications');
        return;
      }

      const offset = (currentPage - 1) * PAGE_SIZE;

      // Build query
      let query = supabase
        .from('team_communications')
        .select('*', { count: 'exact' })
        .eq('team_id', teamId)
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }

      const { data: comms, error: fetchError, count } = await query;

      if (fetchError) {
        throw fetchError;
      }

      // Transform to Communication type
      const transformed: Communication[] = (comms || []).map((c: any) => ({
        id: c.id,
        team_id: c.team_id,
        team_name: teamName,
        sender_id: c.sender_id,
        sender_name: 'Team Manager',
        sender_email: '',
        subject: c.subject,
        template_type: c.template_type || 'custom',
        recipient_filter: c.recipient_filter || {},
        stats: {
          total_recipients: c.total_recipients || 0,
          sent: c.sent_count || 0,
          delivered: c.delivered_count || 0,
          opened: c.opened_count || 0,
          clicked: c.clicked_count || 0,
          failed: c.failed_count || 0,
          bounced: c.bounced_count || 0
        },
        open_rate: c.delivered_count > 0 ? Math.round((c.opened_count || 0) / c.delivered_count * 100) : 0,
        click_rate: c.opened_count > 0 ? Math.round((c.clicked_count || 0) / c.opened_count * 100) : 0,
        status: c.status || 'draft',
        scheduled_for: c.scheduled_for,
        sent_at: c.sent_at,
        completed_at: c.completed_at,
        created_at: c.created_at
      }));

      setCommunications(transformed);
      setTotalCount(count || 0);
    } catch (err) {
      console.error('Error loading communications:', err);
      setError(err instanceof Error ? err.message : 'Failed to load communications');
    } finally {
      setLoading(false);
    }
  }, [teamId, teamName, currentPage, statusFilter]);

  // Load eligible recipients based on filter - using direct Supabase query
  const loadEligibleRecipients = useCallback(async () => {
    setLoadingRecipients(true);

    try {
      // Query team_members with profiles to get emails
      const { data: members, error } = await supabase
        .from('team_members')
        .select('user_id, role, is_active, profiles:user_id(email)')
        .eq('team_id', teamId)
        .eq('is_active', true);

      if (error) throw error;

      // Filter by roles
      const filtered = (members || [])
        .filter((m: any) => recipientFilter.roles.includes(m.role))
        .map((m: any) => ({
          user_id: m.user_id,
          email: m.profiles?.email || '',
          role: m.role,
          status: 'active'
        }));

      setEligibleRecipients(filtered);
    } catch (err) {
      console.error('Error loading recipients:', err);
      // Don't show error, just set empty
      setEligibleRecipients([]);
    } finally {
      setLoadingRecipients(false);
    }
  }, [teamId, recipientFilter]);

  // Load communication detail - using direct Supabase query
  const loadCommunicationDetail = useCallback(async (commId: string) => {
    try {
      const { data, error } = await supabase
        .from('team_communications')
        .select('*')
        .eq('id', commId)
        .single();

      if (error) throw error;

      setCommunicationDetail(data);
    } catch (err) {
      console.error('Error loading communication detail:', err);
      setError(err instanceof Error ? err.message : 'Failed to load details');
    }
  }, []);

  useEffect(() => {
    if (viewMode === 'list') {
      loadCommunications();
    }
  }, [viewMode, loadCommunications]);

  useEffect(() => {
    if (viewMode === 'compose') {
      loadEligibleRecipients();
    }
  }, [viewMode, recipientFilter, loadEligibleRecipients]);

  useEffect(() => {
    if (selectedCommunication) {
      loadCommunicationDetail(selectedCommunication.id);
    }
  }, [selectedCommunication, loadCommunicationDetail]);

  // Send communication - saves to DB and optionally sends emails immediately or schedules
  const handleSend = async (immediate: boolean = true) => {
    if (!subject.trim()) {
      setError('Subject is required');
      return;
    }
    if (!messageHtml.trim()) {
      setError('Message is required');
      return;
    }
    if (eligibleRecipients.length === 0) {
      setError('No eligible recipients found');
      return;
    }

    // Validate scheduling if selected
    if (scheduleForLater && immediate) {
      if (!scheduledDate || !scheduledTime) {
        setError('Please select a date and time for scheduling');
        return;
      }
      const scheduledDateTime = new Date(`${scheduledDate}T${scheduledTime}`);
      if (scheduledDateTime <= new Date()) {
        setError('Scheduled time must be in the future');
        return;
      }
    }

    setSending(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('Please sign in to send communications');
        return;
      }

      const recipientCount = eligibleRecipients.length;

      // Determine if this is immediate send or scheduled
      const isScheduled = scheduleForLater && scheduledDate && scheduledTime;
      const scheduledFor = isScheduled ? new Date(`${scheduledDate}T${scheduledTime}`).toISOString() : null;

      // Insert communication record
      const { data: communication, error: insertError } = await supabase
        .from('team_communications')
        .insert({
          team_id: teamId,
          sender_id: user.id,
          subject,
          body_html: messageHtml,
          body_text: messageHtml.replace(/<[^>]*>/g, ''), // Strip HTML for text version
          template_type: templateType,
          recipient_filter: recipientFilter,
          total_recipients: recipientCount,
          status: isScheduled ? 'scheduled' : 'sending',
          scheduled_for: scheduledFor,
          sent_at: isScheduled ? null : new Date().toISOString(),
          sent_count: 0
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Insert recipient records for queue processing
      const recipientRecords = eligibleRecipients.map(r => ({
        communication_id: communication.id,
        user_id: r.user_id,
        email: r.email,
        status: 'pending'
      }));

      const { error: recipientsError } = await supabase
        .from('team_communication_recipients')
        .insert(recipientRecords);

      if (recipientsError) {
        console.error('Error inserting recipients:', recipientsError);
        // Continue anyway - emails can still be sent
      }

      // If scheduled, we're done - the queue processor will handle it
      if (isScheduled) {
        setSuccessMessage(`Communication scheduled for ${new Date(scheduledFor!).toLocaleString()} to ${recipientCount} recipients`);
        setTimeout(() => {
          resetForm();
          setViewMode('list');
        }, 2000);
        return;
      }

      // Otherwise, send immediately
      const emailTemplate = 'generic'; // Use generic for now as team templates may not be deployed

      // Build HTML content for the email body
      const emailHtmlContent = `
        <h2 style="color: #F5F5F5; font-size: 22px; margin: 0 0 15px 0;">
          ${templateType === 'announcement' ? '📢 Team Announcement' :
            templateType === 'recognition' ? '🏆 Recognition' :
            templateType === 'reminder' ? '⏰ Reminder' : '💬 Message'}
        </h2>
        <p style="color: #9CA3AF; font-size: 14px; margin: 0 0 20px 0;">
          From: Team Manager at <strong style="color: #D4AF37;">${teamName}</strong>
        </p>
        <div style="background: rgba(30, 58, 95, 0.3); border-left: 4px solid #D4AF37; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0;">
          <div style="color: #F5F5F5; font-size: 16px; line-height: 1.8;">
            ${messageHtml}
          </div>
        </div>
        <p style="color: #9CA3AF; font-size: 13px; margin-top: 20px;">
          This message was sent to members of ${teamName}.
        </p>
      `;

      // Send emails to each recipient
      let sentCount = 0;
      let failedCount = 0;
      const errors: string[] = [];

      for (const recipient of eligibleRecipients) {
        if (!recipient.email) {
          failedCount++;
          continue;
        }

        try {
          const { error: emailError } = await supabase.functions.invoke('send-email', {
            body: {
              to: recipient.email,
              template: emailTemplate,
              subject: subject,
              data: {
                subject: subject,
                html: emailHtmlContent,
                content: emailHtmlContent // fallback
              }
            }
          });

          if (emailError) {
            console.error(`Failed to send to ${recipient.email}:`, emailError);
            failedCount++;
            errors.push(`${recipient.email}: ${emailError.message}`);

            // Update recipient status to failed
            await supabase
              .from('team_communication_recipients')
              .update({ status: 'failed', error_message: emailError.message })
              .eq('communication_id', communication.id)
              .eq('email', recipient.email);
          } else {
            sentCount++;

            // Update recipient status to sent
            await supabase
              .from('team_communication_recipients')
              .update({ status: 'sent', sent_at: new Date().toISOString() })
              .eq('communication_id', communication.id)
              .eq('email', recipient.email);
          }
        } catch (emailErr) {
          console.error(`Error sending to ${recipient.email}:`, emailErr);
          failedCount++;
        }
      }

      // Update communication record with final status
      const finalStatus = failedCount === 0 ? 'sent' : sentCount === 0 ? 'failed' : 'partial';
      await supabase
        .from('team_communications')
        .update({
          status: finalStatus,
          sent_count: sentCount,
          failed_count: failedCount,
          completed_at: new Date().toISOString()
        })
        .eq('id', communication.id);

      if (sentCount > 0) {
        setSuccessMessage(`Successfully sent to ${sentCount} of ${recipientCount} recipients${failedCount > 0 ? ` (${failedCount} failed)` : ''}`);
      } else {
        setError(`Failed to send emails. ${errors.length > 0 ? errors[0] : 'Please check email configuration.'}`);
      }

      // Reset form and go back to list after delay
      if (sentCount > 0) {
        setTimeout(() => {
          resetForm();
          setViewMode('list');
        }, 2000);
      }
    } catch (err) {
      console.error('Error sending communication:', err);
      setError(err instanceof Error ? err.message : 'Failed to send communication');
    } finally {
      setSending(false);
    }
  };

  // Reset form helper
  const resetForm = () => {
    setSubject('');
    setMessageHtml('');
    setTemplateType('announcement');
    setScheduleForLater(false);
    setScheduledDate('');
    setScheduledTime('');
    setSuccessMessage(null);
  };

  // View communication detail
  const handleViewDetail = (comm: Communication) => {
    setSelectedCommunication(comm);
    setViewMode('detail');
  };

  // Format date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent': return 'bg-green-500/20 text-green-300 border-green-500/30';
      case 'partial': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      case 'failed': return 'bg-red-500/20 text-red-300 border-red-500/30';
      case 'scheduled': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'sending': return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'draft': return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
      default: return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    }
  };

  // Render list view
  const renderListView = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold text-white">Team Communications</h3>
          <p className="text-indigo-200 text-sm mt-1">
            Send announcements, recognition, and reminders to your team
          </p>
        </div>
        <button
          onClick={() => setViewMode('compose')}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg hover:from-indigo-600 hover:to-purple-700 transition-all"
        >
          <PlusIcon className="w-5 h-5" />
          New Message
        </button>
      </div>

      {/* Filter */}
      <div className="flex gap-4">
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setCurrentPage(1);
          }}
          className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Status</option>
          <option value="sent">Sent</option>
          <option value="scheduled">Scheduled</option>
          <option value="partial">Partial</option>
          <option value="failed">Failed</option>
          <option value="draft">Draft</option>
        </select>
      </div>

      {/* Communications List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto"></div>
          <p className="text-indigo-200 mt-4">Loading communications...</p>
        </div>
      ) : communications.length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-xl p-12 text-center">
          <EnvelopeIcon className="w-16 h-16 text-indigo-400 mx-auto mb-4 opacity-50" />
          <h4 className="text-lg font-medium text-white mb-2">No communications yet</h4>
          <p className="text-indigo-200 mb-6">
            Start engaging with your team by sending an announcement or recognition.
          </p>
          <button
            onClick={() => setViewMode('compose')}
            className="px-6 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors"
          >
            Send Your First Message
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {communications.map((comm) => (
            <div
              key={comm.id}
              onClick={() => handleViewDetail(comm)}
              className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-colors cursor-pointer"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`px-2 py-1 text-xs rounded-full border ${getStatusColor(comm.status)}`}>
                      {comm.status}
                    </span>
                    <span className="text-xs text-indigo-300 capitalize">{comm.template_type}</span>
                  </div>
                  <h4 className="text-white font-medium mb-1">{comm.subject}</h4>
                  <p className="text-indigo-200 text-sm">
                    Sent by {comm.sender_name} • {formatDate(comm.sent_at || comm.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-6 text-right">
                  <div>
                    <p className="text-white font-semibold">{comm.stats.total_recipients}</p>
                    <p className="text-indigo-300 text-xs">Recipients</p>
                  </div>
                  <div>
                    <p className="text-white font-semibold">{comm.open_rate}%</p>
                    <p className="text-indigo-300 text-xs">Open Rate</p>
                  </div>
                  <ChevronRightIcon className="w-5 h-5 text-indigo-400" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalCount > PAGE_SIZE && (
        <div className="flex justify-center gap-2 mt-6">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 bg-white/10 text-white rounded-lg disabled:opacity-50 hover:bg-white/20 transition-colors"
          >
            Previous
          </button>
          <span className="px-4 py-2 text-indigo-200">
            Page {currentPage} of {Math.ceil(totalCount / PAGE_SIZE)}
          </span>
          <button
            onClick={() => setCurrentPage(p => p + 1)}
            disabled={currentPage >= Math.ceil(totalCount / PAGE_SIZE)}
            className="px-4 py-2 bg-white/10 text-white rounded-lg disabled:opacity-50 hover:bg-white/20 transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );

  // Render compose view
  const renderComposeView = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold text-white">Compose Message</h3>
          <p className="text-indigo-200 text-sm mt-1">
            Send a message to {teamName} members
          </p>
        </div>
        <button
          onClick={() => setViewMode('list')}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
        >
          <XMarkIcon className="w-6 h-6 text-indigo-300" />
        </button>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-4 flex items-center gap-3">
          <CheckCircleIcon className="w-6 h-6 text-green-400" />
          <p className="text-green-200">{successMessage}</p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 flex items-center gap-3">
          <ExclamationCircleIcon className="w-6 h-6 text-red-400" />
          <p className="text-red-200">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto">
            <XMarkIcon className="w-5 h-5 text-red-400" />
          </button>
        </div>
      )}

      {/* Template Type */}
      <div>
        <label className="block text-sm font-medium text-indigo-200 mb-2">Message Type</label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {TEMPLATE_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setTemplateType(option.value)}
              className={`p-4 rounded-xl border text-left transition-all ${
                templateType === option.value
                  ? 'bg-indigo-500/20 border-indigo-500 text-white'
                  : 'bg-white/5 border-white/10 text-indigo-200 hover:bg-white/10'
              }`}
            >
              <p className="font-medium">{option.label}</p>
              <p className="text-xs mt-1 opacity-70">{option.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Recipients Filter */}
      <div>
        <label className="block text-sm font-medium text-indigo-200 mb-2">Recipients</label>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <div className="flex flex-wrap gap-4 mb-4">
            <div>
              <label className="text-xs text-indigo-300 block mb-1">Roles</label>
              <div className="flex gap-2">
                {['owner', 'admin', 'manager', 'member'].map((role) => (
                  <label key={role} className="flex items-center gap-1 text-sm text-white">
                    <input
                      type="checkbox"
                      checked={recipientFilter.roles.includes(role)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setRecipientFilter(f => ({ ...f, roles: [...f.roles, role] }));
                        } else {
                          setRecipientFilter(f => ({ ...f, roles: f.roles.filter(r => r !== role) }));
                        }
                      }}
                      className="rounded bg-white/10 border-white/30 text-indigo-500 focus:ring-indigo-500"
                    />
                    <span className="capitalize">{role}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-indigo-300 block mb-1">Status</label>
              <div className="flex gap-2">
                {['active', 'at_risk', 'inactive'].map((status) => (
                  <label key={status} className="flex items-center gap-1 text-sm text-white">
                    <input
                      type="checkbox"
                      checked={recipientFilter.status.includes(status)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setRecipientFilter(f => ({ ...f, status: [...f.status, status] }));
                        } else {
                          setRecipientFilter(f => ({ ...f, status: f.status.filter(s => s !== status) }));
                        }
                      }}
                      className="rounded bg-white/10 border-white/30 text-indigo-500 focus:ring-indigo-500"
                    />
                    <span className="capitalize">{status.replace('_', ' ')}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between pt-3 border-t border-white/10">
            <p className="text-indigo-200 text-sm">
              {loadingRecipients ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full"></span>
                  Loading recipients...
                </span>
              ) : (
                <span>
                  <strong className="text-white">{eligibleRecipients.length}</strong> eligible recipients
                </span>
              )}
            </p>
          </div>

          {/* Recipient List Preview */}
          {!loadingRecipients && eligibleRecipients.length > 0 && (
            <div className="mt-4 pt-3 border-t border-white/10">
              <p className="text-xs text-indigo-300 mb-2">Recipients:</p>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {eligibleRecipients.map((r) => (
                  <div key={r.user_id} className="flex items-center gap-2 text-sm">
                    <div className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-300 text-xs font-medium">
                      {r.email ? r.email[0].toUpperCase() : '?'}
                    </div>
                    <span className="text-white">{r.email || 'No email'}</span>
                    <span className="text-indigo-400 text-xs capitalize">({r.role})</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Subject */}
      <div>
        <label className="block text-sm font-medium text-indigo-200 mb-2">Subject</label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Enter email subject..."
          className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Message */}
      <div>
        <label className="block text-sm font-medium text-indigo-200 mb-2">Message</label>
        <textarea
          value={messageHtml}
          onChange={(e) => setMessageHtml(e.target.value)}
          placeholder="Write your message here..."
          rows={8}
          className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
        />
        <p className="text-xs text-indigo-300 mt-2">
          Tip: Keep messages concise. Recipients' names will be automatically personalized.
        </p>
      </div>

      {/* Scheduling */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={scheduleForLater}
            onChange={(e) => {
              setScheduleForLater(e.target.checked);
              if (!e.target.checked) {
                setScheduledDate('');
                setScheduledTime('');
              }
            }}
            className="w-5 h-5 rounded bg-white/10 border-white/30 text-indigo-500 focus:ring-indigo-500"
          />
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-indigo-300" />
            <span className="text-white font-medium">Schedule for later</span>
          </div>
        </label>

        {scheduleForLater && (
          <div className="mt-4 pl-8 flex flex-wrap gap-4">
            <div>
              <label className="block text-xs text-indigo-300 mb-1">Date</label>
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs text-indigo-300 mb-1">Time</label>
              <input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            {scheduledDate && scheduledTime && (
              <div className="flex items-end">
                <p className="text-indigo-200 text-sm py-2">
                  Will be sent on {new Date(`${scheduledDate}T${scheduledTime}`).toLocaleString()}
                </p>
              </div>
            )}
          </div>
        )}

        {!scheduleForLater && (
          <p className="text-indigo-300 text-xs mt-2 pl-8">
            Email will be sent immediately when you click the button below.
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
        <button
          onClick={() => {
            resetForm();
            setViewMode('list');
          }}
          className="px-6 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => handleSend()}
          disabled={
            sending ||
            !subject.trim() ||
            !messageHtml.trim() ||
            eligibleRecipients.length === 0 ||
            (scheduleForLater && (!scheduledDate || !scheduledTime))
          }
          className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg hover:from-indigo-600 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {sending ? (
            <>
              <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
              {scheduleForLater ? 'Scheduling...' : 'Sending...'}
            </>
          ) : scheduleForLater ? (
            <>
              <CalendarIcon className="w-5 h-5" />
              Schedule for {eligibleRecipients.length} Recipients
            </>
          ) : (
            <>
              <EnvelopeIcon className="w-5 h-5" />
              Send Now to {eligibleRecipients.length} Recipients
            </>
          )}
        </button>
      </div>
    </div>
  );

  // Render detail view
  const renderDetailView = () => {
    if (!selectedCommunication) return null;

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <button
              onClick={() => {
                setViewMode('list');
                setSelectedCommunication(null);
                setCommunicationDetail(null);
              }}
              className="text-indigo-300 hover:text-white text-sm mb-2 flex items-center gap-1"
            >
              ← Back to list
            </button>
            <h3 className="text-xl font-semibold text-white">{selectedCommunication.subject}</h3>
            <p className="text-indigo-200 text-sm mt-1">
              Sent by {selectedCommunication.sender_name} • {formatDate(selectedCommunication.sent_at || selectedCommunication.created_at)}
            </p>
          </div>
          <span className={`px-3 py-1 text-sm rounded-full border ${getStatusColor(selectedCommunication.status)}`}>
            {selectedCommunication.status}
          </span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-white">{selectedCommunication.stats.total_recipients}</p>
            <p className="text-indigo-300 text-sm">Total Recipients</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-green-400">{selectedCommunication.stats.sent}</p>
            <p className="text-indigo-300 text-sm">Sent</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-blue-400">{selectedCommunication.open_rate}%</p>
            <p className="text-indigo-300 text-sm">Open Rate</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-purple-400">{selectedCommunication.click_rate}%</p>
            <p className="text-indigo-300 text-sm">Click Rate</p>
          </div>
        </div>

        {/* Message Content */}
        {communicationDetail && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <h4 className="text-white font-medium mb-4">Message Content</h4>
            <div
              className="prose prose-invert max-w-none text-indigo-100"
              dangerouslySetInnerHTML={{ __html: communicationDetail.body_html || '' }}
            />
          </div>
        )}

        {/* Recipients List */}
        {communicationDetail?.recipients && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <h4 className="text-white font-medium mb-4">
              Recipients ({communicationDetail.recipients_meta?.total || 0})
            </h4>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {communicationDetail.recipients.map((recipient: any) => (
                <div
                  key={recipient.id}
                  className="flex items-center justify-between py-2 border-b border-white/5 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-300 text-sm font-medium">
                      {recipient.name?.[0]?.toUpperCase() || recipient.email[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-white text-sm">{recipient.name || recipient.email.split('@')[0]}</p>
                      <p className="text-indigo-300 text-xs">{recipient.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {recipient.status === 'opened' || recipient.status === 'clicked' ? (
                      <span className="flex items-center gap-1 text-green-400 text-xs">
                        <EyeIcon className="w-4 h-4" />
                        Opened
                      </span>
                    ) : recipient.status === 'sent' || recipient.status === 'delivered' ? (
                      <span className="flex items-center gap-1 text-blue-400 text-xs">
                        <CheckCircleIcon className="w-4 h-4" />
                        Delivered
                      </span>
                    ) : recipient.status === 'failed' || recipient.status === 'bounced' ? (
                      <span className="flex items-center gap-1 text-red-400 text-xs">
                        <ExclamationCircleIcon className="w-4 h-4" />
                        {recipient.status}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-gray-400 text-xs">
                        <ClockIcon className="w-4 h-4" />
                        {recipient.status}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
      {viewMode === 'list' && renderListView()}
      {viewMode === 'compose' && renderComposeView()}
      {viewMode === 'detail' && renderDetailView()}
    </div>
  );
};

export default TeamCommunications;
