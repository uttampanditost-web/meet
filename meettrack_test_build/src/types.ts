export interface JoinRequest {
  id: string;
  studentName: string;
  studentEmail: string;
  askToJoinTime: string; // ISO timestamp string when student clicked "Ask to Join"
  acceptedTime?: string | null; // ISO timestamp string when admitted/accepted
  status: 'requested' | 'admitted' | 'rejected' | 'left';
}

export type MeetingStatus =
  | 'Waiting'
  | 'Host Joined'
  | 'Students Waiting'
  | 'Participants in Call (Ready to Track)'
  | 'Meeting Started'
  | 'Meeting Ended'
  | 'Meeting Paused (Waiting for Student)'
  | 'Not Started'
  | 'Waiting for Mentor'
  | 'Waiting for Student';

export interface Trainer {
  id: string;
  name: string;
  email: string;
  avatar: string;
  meetUrl: string;
  specialization: string;
  phone?: string;
  slotDuration?: 30 | 45 | 60;
  status: 'active' | 'inactive';
  userEmail?: string;
}

export interface Slot {
  id: string;
  trainerId: string;
  trainerName: string;
  date: string; // YYYY-MM-DD
  startTime: string; // e.g. "14:00"
  endTime: string; // e.g. "14:30"
  studentName: string;
  studentEmail: string;
  studentPhone?: string;
  topic: string;
  status: 'scheduled' | 'live' | 'completed' | 'cancelled' | 'no_show';
  userEmail?: string;
  meetUrl?: string;
  gcalEventId?: string;
  calendarSynced?: boolean;
  meetingStatus?: MeetingStatus;
  meetingId?: string;
  askToJoinTime?: string | null;
  trackingActive?: boolean;
  trackingPaused?: boolean;
  trackedDurationSeconds?: number | null;
}

export interface AttendanceLog {
  id: string;
  slotId: string;
  trainerId: string;
  trainerName: string;
  studentName: string;
  studentEmail: string;
  date: string;
  scheduledStartTime: string;
  scheduledEndTime: string;
  meetUrl: string;
  meetingId?: string;
  mentorJoinedAt: string | null; // ISO timestamp string
  mentorLeftAt: string | null;
  askToJoinTime?: string | null; // ISO timestamp string when student clicked "Ask to Join"
  acceptedTime?: string | null; // ISO timestamp string when mentor accepted
  studentJoinedAt: string | null;
  studentLeftAt: string | null;
  joinRequests?: JoinRequest[];
  meetingStatus?: MeetingStatus;
  mentorJoinDelayMinutes: number | null; // positive = late, 0/negative = early/on-time
  studentJoinDelayMinutes: number | null;
  totalOverlapMinutes: number | null; // actual 1-on-1 time spent
  totalMeetDurationMinutes?: number | null; // total duration of the meet session
  trackingStartedAt?: string | null; // ISO timestamp when mentor clicked Track Attendance
  trackingStoppedAt?: string | null; // ISO timestamp when mentor clicked Stop Tracking
  trackedDurationSeconds?: number | null; // Exact seconds tracked between Track Attendance and Stop Tracking
  trackingActive?: boolean; // Whether active attendance timer is currently ticking
  trackingPaused?: boolean; // Whether attendance timer is paused due to participant disconnection or mentor pause
  status: 'on_time' | 'mentor_late' | 'student_late' | 'mentor_absent' | 'student_absent' | 'early_leave' | 'completed' | 'in_progress' | 'no_show' | 'student_no_show' | 'live' | 'scheduled';
  userEmail?: string;
  notes?: string;
  joinedViaSmartLink?: boolean;
  lastUpdated: string;
}

export interface LiveRoomStatus {
  trainerId: string;
  trainerName: string;
  meetUrl: string;
  currentSlot: Slot | null;
  isTrainerPresent: boolean;
  isStudentPresent: boolean;
  activeParticipants: { name: string; role: 'mentor' | 'student' | 'guest'; joinedAt: string }[];
  currentAttendanceLog: AttendanceLog | null;
}

export interface AttendanceSummaryStats {
  totalSlotsToday: number;
  completedSlots: number;
  liveSlots: number;
  upcomingSlots: number;
  mentorOnTimeRate: number | null; // percentage e.g. 95% or null if no sessions
  studentOnTimeRate: number | null;
  avgMentorDelayMinutes: number;
  avgStudentDelayMinutes: number;
  flaggedAlertsCount: number;
  totalMentorshipHours?: number;
  totalMentorshipMinutes?: number;
}

export type UserRole = 'admin' | 'viewer';

export interface UserAccessRecord {
  email: string;
  role: UserRole;
  name?: string;
  grantedAt?: string;
  grantedBy?: string;
  addedAt?: string;
  addedBy?: string;
}

export interface AIAnalysisReport {
  summary: string;
  punctualityScore: number;
  keyInsights: string[];
  trainerPerformance: {
    trainerName: string;
    sessionsCompleted: number;
    avgPunctualityMinutes: number;
    rating: 'Excellent' | 'Good' | 'Needs Attention';
  }[];
  flaggedSessions: {
    slotInfo: string;
    issue: string;
    recommendation: string;
    solution?: string;
  }[];
  actionItems: string[];
  solutions?: string[];
  modelUsed?: string;
}
