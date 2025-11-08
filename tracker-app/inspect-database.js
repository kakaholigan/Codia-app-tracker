#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://pmqocxdtypxobihxusqj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBtcW9jeGR0eXB4b2JpaHh1c3FqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgxNDYwMjEsImV4cCI6MjA3MzcyMjAyMX0.32zS3ZG9Y7eRYPXZE2dfVIGd1NHGVThVYN-Y4UXx9O8';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function inspectDatabase() {
  console.log('🔍 KIỂM TRA DATABASE SUPABASE\n');
  console.log('📊 Đang kết nối tới:', SUPABASE_URL);
  console.log('=' .repeat(60));

  try {
    // 1. Kiểm tra bảng tasks
    console.log('\n📋 BẢNG TASKS:');
    const { data: tasks, error: tasksError, count: tasksCount } = await supabase
      .from('tasks')
      .select('*', { count: 'exact' })
      .limit(5);

    if (tasksError) {
      console.log('❌ Lỗi khi truy vấn tasks:', tasksError.message);
    } else {
      console.log(`✅ Tổng số tasks: ${tasksCount}`);
      console.log(`📝 5 tasks đầu tiên:`);
      tasks.forEach(task => {
        console.log(`   - [${task.id}] ${task.title} (${task.status})`);
      });
    }

    // 2. Kiểm tra bảng phases
    console.log('\n🎯 BẢNG PHASES:');
    const { data: phases, error: phasesError, count: phasesCount } = await supabase
      .from('phases')
      .select('*', { count: 'exact' })
      .order('id');

    if (phasesError) {
      console.log('❌ Lỗi khi truy vấn phases:', phasesError.message);
    } else {
      console.log(`✅ Tổng số phases: ${phasesCount}`);
      console.log(`📝 Danh sách phases:`);
      phases.forEach(phase => {
        console.log(`   - [${phase.id}] ${phase.name} (${phase.status})`);
      });
    }

    // 3. Kiểm tra bảng activity_logs
    console.log('\n📜 BẢNG ACTIVITY_LOGS:');
    const { data: logs, error: logsError, count: logsCount } = await supabase
      .from('activity_logs')
      .select('*', { count: 'exact' })
      .order('timestamp', { ascending: false })
      .limit(5);

    if (logsError) {
      console.log('❌ Lỗi khi truy vấn activity_logs:', logsError.message);
    } else {
      console.log(`✅ Tổng số logs: ${logsCount}`);
      console.log(`📝 5 logs gần nhất:`);
      logs.forEach(log => {
        console.log(`   - [${log.id}] ${log.action} - ${log.details} (${new Date(log.timestamp).toLocaleString()})`);
      });
    }

    // 4. Thống kê tasks theo status
    console.log('\n📊 THỐNG KÊ TASKS THEO STATUS:');
    const { data: stats, error: statsError } = await supabase
      .from('tasks')
      .select('status');

    if (statsError) {
      console.log('❌ Lỗi khi lấy thống kê:', statsError.message);
    } else {
      const statusCount = stats.reduce((acc, task) => {
        acc[task.status] = (acc[task.status] || 0) + 1;
        return acc;
      }, {});

      Object.entries(statusCount).forEach(([status, count]) => {
        console.log(`   - ${status}: ${count} tasks`);
      });
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ HOÀN THÀNH KIỂM TRA DATABASE');

  } catch (error) {
    console.error('❌ Lỗi:', error.message);
  }
}

inspectDatabase();
