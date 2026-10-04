const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const cfg = JSON.parse(fs.readFileSync('supabase-config.json', 'utf8'));
const supabase = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);

async function run() {
  console.log('1. Purging all empty 0-participant placeholder rows from Supabase attendance_logs...');
  
  // Fetch empty rows in chunks
  let hasMore = true;
  let totalPurged = 0;
  while (hasMore) {
    const { data: emptyBatch, error: fetchErr } = await supabase
      .from('attendance_logs')
      .select('id')
      .is('mentor_join_time', null)
      .is('student_join_time', null)
      .or('duration_seconds.is.null,duration_seconds.eq.0')
      .neq('punctuality', 'no_show')
      .limit(100);

    if (fetchErr) {
      console.error('Error fetching empty rows:', fetchErr);
      break;
    }
    if (!emptyBatch || emptyBatch.length === 0) {
      hasMore = false;
      break;
    }

    const idsToDelete = emptyBatch.map(r => r.id);
    const { error: delErr } = await supabase
      .from('attendance_logs')
      .delete()
      .in('id', idsToDelete);

    if (delErr) {
      console.error('Error deleting batch:', delErr);
      break;
    }
    totalPurged += idsToDelete.length;
    console.log(`Purged ${totalPurged} empty placeholder rows...`);
  }

  console.log(`Finished purging. Total empty rows removed: ${totalPurged}`);

  // Fetch trainers to map IDs
  const { data: trainers } = await supabase.from('trainers').select('*');
  const getTrainer = (name) => {
    return (trainers || []).find(t => t.name.toLowerCase().includes(name.toLowerCase())) || {};
  };

  const muskan = getTrainer('Muskan');
  const arsalan = getTrainer('Arsalan');
  const bhupendra = getTrainer('Bhupendra');
  const priyanka = getTrainer('Priyanka');
  const vanshika = getTrainer('Vanshika');

  console.log('2. Upserting verified today sessions...');
  const verifiedLogs = [
    {
      id: 'log-slot-muskan-2026-09-17-1000',
      slot_id: 'slot-muskan-2026-09-17-1000',
      trainer_id: muskan.id || 'tr-muskan',
      trainer_name: 'Muskan Bhatia',
      meet_url: 'https://meet.google.com/wyd-wqrm-unm',
      student_name: 'RAIHANA SIHAM M (Presentation)',
      student_email: 'raihanasihamm@gmail.com',
      date: '2026-09-17',
      start_time: '10:00',
      end_time: '10:30',
      mentor_join_time: '2026-09-17T04:29:00.000Z',
      mentor_leave_time: '2026-09-17T05:00:00.000Z',
      student_join_time: '2026-09-17T04:27:00.000Z',
      student_leave_time: '2026-09-17T05:00:00.000Z',
      duration_seconds: 1800,
      mentor_status: 'On Time',
      student_status: 'Joined',
      punctuality: 'completed',
      user_email: null,
      updated_at: new Date().toISOString()
    },
    {
      id: 'log-slot-arsalan-2026-09-17-1030',
      slot_id: 'slot-arsalan-2026-09-17-1030',
      trainer_id: arsalan.id || 'tr-arsalan',
      trainer_name: 'Arsalan Adeeb',
      meet_url: 'https://meet.google.com/uio-ighz-ktu',
      student_name: 'Thotchanngam Shimrah',
      student_email: 'tshimrah@outlook.com',
      date: '2026-09-17',
      start_time: '10:30',
      end_time: '11:00',
      mentor_join_time: null,
      mentor_leave_time: null,
      student_join_time: '2026-09-17T05:13:00.000Z',
      student_leave_time: '2026-09-17T05:30:00.000Z',
      duration_seconds: 0,
      mentor_status: 'Did Not Join',
      student_status: 'Late 13m',
      punctuality: 'completed',
      user_email: null,
      updated_at: new Date().toISOString()
    },
    {
      id: 'log-slot-bhupendra-2026-09-17-1030',
      slot_id: 'slot-bhupendra-2026-09-17-1030',
      trainer_id: bhupendra.id || 'tr-bhupendra',
      trainer_name: 'Bhupendra Yadav',
      meet_url: 'https://meet.google.com/uem-ospu-chg',
      student_name: 'Srinivas Yadav',
      student_email: 'sreenuyad@gmail.com',
      date: '2026-09-17',
      start_time: '10:30',
      end_time: '11:00',
      mentor_join_time: '2026-09-17T05:12:00.000Z',
      mentor_leave_time: '2026-09-17T05:30:00.000Z',
      student_join_time: '2026-09-17T05:03:00.000Z',
      student_leave_time: '2026-09-17T05:30:00.000Z',
      duration_seconds: 1620,
      mentor_status: 'Late 12m',
      student_status: 'Late 3m',
      punctuality: 'completed',
      user_email: null,
      updated_at: new Date().toISOString()
    },
    {
      id: 'log-slot-arsalan-2026-09-17-1100',
      slot_id: 'slot-arsalan-2026-09-17-1100',
      trainer_id: arsalan.id || 'tr-arsalan',
      trainer_name: 'Arsalan Adeeb',
      meet_url: 'https://meet.google.com/uio-ighz-ktu',
      student_name: 'Externalmentors',
      student_email: 'externalmentors@be10x.com',
      date: '2026-09-17',
      start_time: '11:00',
      end_time: '11:30',
      mentor_join_time: '2026-09-17T05:31:00.000Z',
      mentor_leave_time: '2026-09-17T05:31:00.000Z',
      student_join_time: null,
      student_leave_time: null,
      duration_seconds: 0,
      mentor_status: 'Late 1m',
      student_status: 'Absent (No Show)',
      punctuality: 'no_show',
      user_email: null,
      updated_at: new Date().toISOString()
    },
    {
      id: 'log-slot-priyanka-2026-09-17-1130',
      slot_id: 'slot-priyanka-2026-09-17-1130',
      trainer_id: priyanka.id || 'tr-priyanka',
      trainer_name: 'Priyanka Jha',
      meet_url: 'https://meet.google.com/pgg-tbwy-xpx',
      student_name: 'jayant',
      student_email: 'jayant.biswas83@gmail.com',
      date: '2026-09-17',
      start_time: '11:30',
      end_time: '12:00',
      mentor_join_time: '2026-09-17T05:55:00.000Z',
      mentor_leave_time: '2026-09-17T05:55:00.000Z',
      student_join_time: '2026-09-17T05:59:00.000Z',
      student_leave_time: '2026-09-17T06:00:00.000Z',
      duration_seconds: 60,
      mentor_status: 'On Time',
      student_status: 'Joined',
      punctuality: 'completed',
      user_email: null,
      updated_at: new Date().toISOString()
    }
  ];

  for (const log of verifiedLogs) {
    const { error: upsertErr } = await supabase
      .from('attendance_logs')
      .upsert(log, { onConflict: 'id' });
    if (upsertErr) {
      console.error(`Error upserting ${log.id}:`, upsertErr);
    } else {
      console.log(`Successfully upserted ${log.trainer_name} - ${log.student_name}`);
    }
  }

  // Update data_store.json if exists
  if (fs.existsSync('data_store.json')) {
    try {
      const dataStore = JSON.parse(fs.readFileSync('data_store.json', 'utf8'));
      if (Array.isArray(dataStore.attendanceLogs)) {
        // Clean out empty rows for today
        dataStore.attendanceLogs = dataStore.attendanceLogs.filter(l => {
          if (l.date !== '2026-09-17') return true;
          return Boolean(l.mentorJoinedAt || l.studentJoinedAt || (l.trackedDurationSeconds && l.trackedDurationSeconds > 0) || l.status === 'no_show');
        });

        // Add verified logs in camelCase
        for (const vl of verifiedLogs) {
          const idx = dataStore.attendanceLogs.findIndex(l => l.id === vl.id || l.slotId === vl.slot_id);
          const camel = {
            id: vl.id,
            slotId: vl.slot_id,
            trainerId: vl.trainer_id,
            trainerName: vl.trainer_name,
            meetUrl: vl.meet_url,
            studentName: vl.student_name,
            studentEmail: vl.student_email,
            date: vl.date,
            scheduledStartTime: vl.start_time,
            scheduledEndTime: vl.end_time,
            mentorJoinedAt: vl.mentor_join_time,
            mentorLeftAt: vl.mentor_leave_time,
            studentJoinedAt: vl.student_join_time,
            studentLeftAt: vl.student_leave_time,
            trackedDurationSeconds: vl.duration_seconds,
            totalOverlapMinutes: Math.round(vl.duration_seconds / 60),
            status: vl.punctuality,
            notes: vl.punctuality === 'no_show' ? 'Student No Show' : 'Both On-Time'
          };
          if (idx >= 0) {
            dataStore.attendanceLogs[idx] = camel;
          } else {
            dataStore.attendanceLogs.push(camel);
          }
        }
        fs.writeFileSync('data_store.json', JSON.stringify(dataStore, null, 2), 'utf8');
        console.log('Updated data_store.json successfully.');
      }
    } catch (dsErr) {
      console.error('Error updating data_store.json:', dsErr);
    }
  }

  // Check today's final count in Supabase
  const { data: finalToday } = await supabase.from('attendance_logs').select('*').eq('date', '2026-09-17');
  console.log('Final today rows in Supabase:', (finalToday || []).length);
  (finalToday || []).forEach(r => {
    console.log(`- [${r.start_time} - ${r.end_time}] ${r.trainer_name} | Student: ${r.student_name} | Mentor In: ${r.mentor_join_time ? 'Yes' : 'No'} | Student In: ${r.student_join_time ? 'Yes' : 'No'} | Duration: ${r.duration_seconds}s | Status: ${r.punctuality}`);
  });
}

run();
