#!/usr/bin/env node

/**
 * Backend Verification Script for TestSprite Fixes
 * Tests Supabase connectivity, database health, and WebSocket without browser
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://pmqocxdtypxobihxusqj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBtcW9jeGR0eXB4b2JpaHh1c3FqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgxNDYwMjEsImV4cCI6MjA3MzcyMjAyMX0.32zS3ZG9Y7eRYPXZE2dfVIGd1NHGVThVYN-Y4UXx9O8';

console.log('🔍 BACKEND VERIFICATION SCRIPT');
console.log('=' + '='.repeat(59) + '\n');

// Create Supabase client with enhanced config
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  realtime: {
    params: { eventsPerSecond: 10 },
    timeout: 30000, // 30s timeout as per fix
  },
  auth: {
    autoRefreshToken: true,
    persistSession: false, // No persistence needed for Node.js
    detectSessionInUrl: false,
  },
});

const results = {
  timestamp: new Date().toISOString(),
  passed: [],
  failed: [],
  warnings: [],
};

// ============================================
// TEST 1: Supabase Project Status
// ============================================
async function testProjectStatus() {
  console.log('📊 TEST 1: Supabase Project Status');

  try {
    const { data, error } = await supabase
      .from('tasks')
      .select('id')
      .limit(1);

    if (error) {
      if (error.message.includes('paused') || error.message.includes('inactive')) {
        results.failed.push({
          test: 'Supabase Project Status',
          error: 'Project appears to be paused or inactive',
          fix: 'Go to https://supabase.com/dashboard and unpause the project',
        });
        console.error('❌ FAILED: Project is paused or inactive\n');
        return false;
      } else {
        results.failed.push({
          test: 'Supabase Project Status',
          error: error.message,
          code: error.code,
        });
        console.error(`❌ FAILED: ${error.message} (Code: ${error.code})\n`);
        return false;
      }
    } else {
      results.passed.push('Supabase Project Status - Active');
      console.log('✅ PASSED: Project is active and responding\n');
      return true;
    }
  } catch (err) {
    results.failed.push({
      test: 'Supabase Project Status',
      error: err.message,
    });
    console.error(`❌ FAILED: ${err.message}\n`);
    return false;
  }
}

// ============================================
// TEST 2: Database Tables Accessibility
// ============================================
async function testDatabaseAccess() {
  console.log('📊 TEST 2: Database Tables & Views');

  let allPassed = true;

  // Test tasks table read
  try {
    const { data, error } = await supabase
      .from('tasks')
      .select('id, status, title')
      .limit(5);

    if (error) {
      results.failed.push({
        test: 'Tasks Table - Read',
        error: error.message,
        code: error.code,
      });
      console.error(`❌ FAILED: Cannot read tasks table (${error.code})`);
      allPassed = false;
    } else {
      results.passed.push(`Tasks Table - Read (${data?.length || 0} rows)`);
      console.log(`✅ PASSED: Can read tasks table (${data?.length || 0} rows found)`);
    }
  } catch (err) {
    console.error(`❌ FAILED: ${err.message}`);
    allPassed = false;
  }

  // Test phases table
  try {
    const { data, error } = await supabase
      .from('phases')
      .select('id, name')
      .limit(5);

    if (error) {
      results.failed.push({
        test: 'Phases Table - Read',
        error: error.message,
      });
      console.error(`❌ FAILED: Cannot read phases table`);
      allPassed = false;
    } else {
      results.passed.push(`Phases Table - Read (${data?.length || 0} rows)`);
      console.log(`✅ PASSED: Can read phases table (${data?.length || 0} rows found)`);
    }
  } catch (err) {
    console.error(`❌ FAILED: ${err.message}`);
    allPassed = false;
  }

  // Test tracker_app_data view
  try {
    const { data, error } = await supabase
      .from('tracker_app_data')
      .select('id, title, status')
      .limit(5);

    if (error) {
      results.warnings.push({
        test: 'tracker_app_data View',
        message: 'View may be missing or inaccessible',
        error: error.message,
      });
      console.warn(`⚠️  WARNING: tracker_app_data view not accessible`);
    } else {
      results.passed.push(`tracker_app_data View - Read (${data?.length || 0} rows)`);
      console.log(`✅ PASSED: Can read tracker_app_data view (${data?.length || 0} rows)`);
    }
  } catch (err) {
    console.warn(`⚠️  WARNING: ${err.message}`);
  }

  console.log('');
  return allPassed;
}

// ============================================
// TEST 3: Task Status Update (CRITICAL FIX)
// ============================================
async function testTaskStatusUpdate() {
  console.log('📊 TEST 3: Task Status Update Function');

  try {
    // Get a test task
    const { data: testTasks, error: fetchError } = await supabase
      .from('tasks')
      .select('id, status, title')
      .limit(1);

    if (fetchError || !testTasks || testTasks.length === 0) {
      results.warnings.push({
        test: 'Task Status Update',
        message: 'No tasks found to test update',
      });
      console.warn('⚠️  WARNING: No tasks found for testing\n');
      return false;
    }

    const testTask = testTasks[0];
    console.log(`   Testing with task: "${testTask.title}" (ID: ${testTask.id})`);
    console.log(`   Current status: ${testTask.status}`);

    // Test update (just update updated_at to avoid side effects)
    const { data: updateData, error: updateError } = await supabase
      .from('tasks')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', testTask.id)
      .select();

    if (updateError) {
      results.failed.push({
        test: 'Task Status Update',
        error: updateError.message,
        code: updateError.code,
        fix: updateError.code === '42501'
          ? 'RLS policy blocks updates. Check Supabase policies.'
          : 'Check error details above',
      });
      console.error('❌ FAILED: Cannot update task');
      console.error(`   Error: ${updateError.message} (Code: ${updateError.code})\n`);
      return false;
    } else if (!updateData || updateData.length === 0) {
      results.warnings.push({
        test: 'Task Status Update',
        message: 'Update succeeded but no data returned',
      });
      console.warn('⚠️  WARNING: Update succeeded but no data returned\n');
      return true;
    } else {
      results.passed.push('Task Status Update - Working');
      console.log('✅ PASSED: Can update tasks successfully');
      console.log(`   Updated task confirmed: ${updateData[0].title}\n`);
      return true;
    }
  } catch (err) {
    results.failed.push({
      test: 'Task Status Update',
      error: err.message,
    });
    console.error(`❌ FAILED: ${err.message}\n`);
    return false;
  }
}

// ============================================
// TEST 4: RLS Policy Check (Write Permission)
// ============================================
async function testRLSPolicies() {
  console.log('📊 TEST 4: RLS Policies - Write Permissions');

  try {
    // Try to get a task first
    const { data: tasks, error: fetchError } = await supabase
      .from('tasks')
      .select('id, status')
      .limit(1);

    if (fetchError || !tasks || tasks.length === 0) {
      console.warn('⚠️  WARNING: No tasks to test RLS policies\n');
      return false;
    }

    const taskId = tasks[0].id;
    const currentStatus = tasks[0].status;

    // Test update with same status (no side effects)
    const { data, error } = await supabase
      .from('tasks')
      .update({
        status: currentStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', taskId)
      .select();

    if (error) {
      if (error.code === '42501') {
        results.failed.push({
          test: 'RLS Policies - Tasks Write',
          error: 'RLS policy blocks updates',
          fix: 'Check RLS policies on tasks table in Supabase dashboard',
        });
        console.error('❌ FAILED: RLS policy blocks updates');
        console.error('   Fix: Enable UPDATE permission for anon role\n');
        return false;
      } else {
        results.failed.push({
          test: 'RLS Policies - Tasks Write',
          error: error.message,
          code: error.code,
        });
        console.error(`❌ FAILED: ${error.message} (Code: ${error.code})\n`);
        return false;
      }
    } else {
      results.passed.push('RLS Policies - Tasks Write Allowed');
      console.log('✅ PASSED: RLS policies allow task updates\n');
      return true;
    }
  } catch (err) {
    console.error(`❌ FAILED: ${err.message}\n`);
    return false;
  }
}

// ============================================
// TEST 5: WebSocket/Realtime Capability
// ============================================
async function testRealtimeCapability() {
  console.log('📊 TEST 5: WebSocket/Realtime Subscription');

  return new Promise((resolve) => {
    let subscribed = false;
    let receivedEvent = false;
    let timeoutId;

    const channel = supabase
      .channel('verification-test-channel')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        (payload) => {
          receivedEvent = true;
          console.log(`   ✅ Received real-time event: ${payload.eventType}`);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          subscribed = true;
          results.passed.push('Real-time Subscription - Subscribed');
          console.log('✅ PASSED: Real-time subscription active');

          // Wait 3 seconds for potential events, then cleanup
          timeoutId = setTimeout(() => {
            supabase.removeChannel(channel);
            if (!receivedEvent) {
              console.log('   (No events received during test, but subscription worked)\n');
            } else {
              console.log('');
            }
            resolve(true);
          }, 3000);

        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          results.failed.push({
            test: 'Real-time Subscription',
            error: `Subscription status: ${status}`,
            fix: 'WebSocket connection may be blocked. Check network/firewall.',
          });
          console.error(`❌ FAILED: Subscription error: ${status}\n`);
          if (timeoutId) clearTimeout(timeoutId);
          supabase.removeChannel(channel);
          resolve(false);
        }
      });

    // Timeout after 10 seconds if no response
    setTimeout(() => {
      if (!subscribed) {
        results.failed.push({
          test: 'Real-time Subscription',
          error: 'Subscription timeout after 10s',
        });
        console.error('❌ FAILED: Subscription timeout (10s)\n');
        supabase.removeChannel(channel);
        resolve(false);
      }
    }, 10000);
  });
}

// ============================================
// SUMMARY
// ============================================
function printSummary() {
  console.log('=' + '='.repeat(59));
  console.log('📊 VERIFICATION SUMMARY');
  console.log('=' + '='.repeat(59) + '\n');

  console.log(`✅ PASSED: ${results.passed.length}`);
  results.passed.forEach(test => console.log(`   - ${test}`));

  if (results.warnings.length > 0) {
    console.log(`\n⚠️  WARNINGS: ${results.warnings.length}`);
    results.warnings.forEach(warning => {
      console.log(`   - ${warning.test}: ${warning.message}`);
      if (warning.fix) console.log(`     Fix: ${warning.fix}`);
    });
  }

  if (results.failed.length > 0) {
    console.log(`\n❌ FAILED: ${results.failed.length}`);
    results.failed.forEach(failure => {
      console.log(`   - ${failure.test}`);
      console.log(`     Error: ${failure.error || 'Unknown'}`);
      if (failure.code) console.log(`     Code: ${failure.code}`);
      if (failure.fix) console.log(`     Fix: ${failure.fix}`);
    });
  }

  // Overall verdict
  console.log('\n' + '=' + '='.repeat(59));
  if (results.failed.length === 0) {
    console.log('🎉 ALL CRITICAL TESTS PASSED!');
    console.log('✅ Backend is ready for TestSprite re-test');
    console.log('\nNext: Start dev server and verify UI components');
  } else {
    console.log('⚠️  SOME TESTS FAILED - Fix issues before re-testing');
    console.log('\nRecommended Actions:');
    console.log('1. Check Supabase project is active (not paused)');
    console.log('2. Verify RLS policies allow anon updates');
    console.log('3. Check network/firewall for WebSocket blocks');
  }
  console.log('=' + '='.repeat(59) + '\n');

  // Exit with appropriate code
  process.exit(results.failed.length > 0 ? 1 : 0);
}

// ============================================
// RUN ALL TESTS
// ============================================
async function runVerification() {
  console.log(`Timestamp: ${results.timestamp}`);
  console.log('Supabase URL: ' + SUPABASE_URL);
  console.log('Timeout Config: 30s (enhanced from 10s)\n');

  await testProjectStatus();
  await testDatabaseAccess();
  await testTaskStatusUpdate();
  await testRLSPolicies();
  await testRealtimeCapability();

  printSummary();
}

// Run verification
runVerification().catch(error => {
  console.error('\n❌ VERIFICATION CRASHED:', error);
  process.exit(1);
});
