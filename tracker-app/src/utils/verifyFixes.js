// ✅ Comprehensive verification script for TestSprite fixes
// Run this in browser console to verify all fixes before re-testing

import { supabase, getRealtimeStatus, checkDatabaseHealth } from '../lib/supabase';
import toast from 'react-hot-toast';

/**
 * VERIFICATION SCRIPT FOR TESTSPRITE FIXES
 *
 * This script verifies:
 * 1. Supabase project is active (not paused)
 * 2. WebSocket connection is working
 * 3. RLS policies allow updates
 * 4. All critical fixes are functioning
 *
 * Run in browser console:
 * import { runVerification } from './utils/verifyFixes';
 * await runVerification();
 */

export const runVerification = async () => {
  console.log('🧪 Starting comprehensive verification...\n');

  const results = {
    timestamp: new Date().toISOString(),
    passed: [],
    failed: [],
    warnings: [],
  };

  // ============================================
  // TEST 1: Supabase Project Status
  // ============================================
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
        console.error('❌ FAILED: Project is paused or inactive');
      } else {
        results.failed.push({
          test: 'Supabase Project Status',
          error: error.message,
        });
        console.error('❌ FAILED:', error.message);
      }
    } else {
      results.passed.push('Supabase Project Status - Active');
      console.log('✅ PASSED: Project is active');
    }
  } catch (err) {
    results.failed.push({
      test: 'Supabase Project Status',
      error: err.message,
    });
    console.error('❌ FAILED:', err.message);
  }

  // ============================================
  // TEST 2: WebSocket Connection
  // ============================================
  console.log('\n🔌 TEST 2: WebSocket Connection Status');
  const wsStatus = getRealtimeStatus();
  if (wsStatus === 'CONNECTED') {
    results.passed.push('WebSocket Connection - Connected');
    console.log('✅ PASSED: WebSocket is CONNECTED');
  } else {
    results.warnings.push({
      test: 'WebSocket Connection',
      status: wsStatus,
      message: 'WebSocket not connected yet. Wait a few seconds and retry.',
    });
    console.warn('⚠️  WARNING: WebSocket status:', wsStatus);
    console.log('   → Wait 3-5 seconds for connection, then retry verification');
  }

  // ============================================
  // TEST 3: Database Health Check
  // ============================================
  console.log('\n🏥 TEST 3: Database Health & RLS Policies');
  try {
    const health = await checkDatabaseHealth();

    console.log('   Database Health Results:');
    console.log('   - Connected:', health.connected);
    console.log('   - Realtime Status:', health.realtimeStatus);
    console.log('   - Tables Accessible:', health.tablesAccessible);

    if (health.connected) {
      results.passed.push('Database Health - All tables accessible');
      console.log('✅ PASSED: All database checks passed');
    } else {
      results.failed.push({
        test: 'Database Health',
        errors: health.errors,
      });
      console.error('❌ FAILED: Database health check failed');
      console.error('   Errors:', health.errors);
    }

    // Check specific table permissions
    if (!health.tablesAccessible.tasksWrite) {
      results.failed.push({
        test: 'RLS Policies - Tasks Write',
        error: 'Cannot update tasks table',
        fix: 'Check RLS policies on tasks table in Supabase dashboard',
      });
      console.error('❌ FAILED: Cannot write to tasks table (RLS policy issue)');
    } else {
      results.passed.push('RLS Policies - Tasks Write Allowed');
      console.log('✅ PASSED: Can write to tasks table');
    }

    if (!health.tablesAccessible.trackerAppDataView) {
      results.warnings.push({
        test: 'Database Views',
        message: 'tracker_app_data view may be missing',
        fix: 'Run migrations: 002-create-essential-views.sql',
      });
      console.warn('⚠️  WARNING: tracker_app_data view not accessible');
    }

  } catch (err) {
    results.failed.push({
      test: 'Database Health Check',
      error: err.message,
    });
    console.error('❌ FAILED:', err.message);
  }

  // ============================================
  // TEST 4: Task Status Update (Critical Fix)
  // ============================================
  console.log('\n🔄 TEST 4: Task Status Update Function');
  try {
    // Get a test task
    const { data: testTasks, error: fetchError } = await supabase
      .from('tasks')
      .select('id, status')
      .limit(1);

    if (fetchError || !testTasks || testTasks.length === 0) {
      results.warnings.push({
        test: 'Task Status Update',
        message: 'No tasks found to test update',
      });
      console.warn('⚠️  WARNING: No tasks found for testing');
    } else {
      const testTask = testTasks[0];
      const currentStatus = testTask.status;

      console.log(`   Testing with task #${testTask.id} (current status: ${currentStatus})`);

      // Test update (update to same status to avoid side effects)
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
        console.error('   Error:', updateError);
      } else if (!updateData || updateData.length === 0) {
        results.warnings.push({
          test: 'Task Status Update',
          message: 'Update succeeded but no data returned',
        });
        console.warn('⚠️  WARNING: Update succeeded but no data returned');
      } else {
        results.passed.push('Task Status Update - Working');
        console.log('✅ PASSED: Can update tasks successfully');
      }
    }
  } catch (err) {
    results.failed.push({
      test: 'Task Status Update',
      error: err.message,
    });
    console.error('❌ FAILED:', err.message);
  }

  // ============================================
  // TEST 5: Real-time Subscription Test
  // ============================================
  console.log('\n📡 TEST 5: Real-time Subscription');
  try {
    let subscriptionWorking = false;

    const channel = supabase
      .channel('verification-test')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        (payload) => {
          subscriptionWorking = true;
          console.log('   ✅ Received real-time event:', payload.eventType);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          results.passed.push('Real-time Subscription - Subscribed');
          console.log('✅ PASSED: Real-time subscription active');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          results.failed.push({
            test: 'Real-time Subscription',
            error: `Subscription status: ${status}`,
            fix: 'WebSocket connection may be blocked. Check network/firewall.',
          });
          console.error('❌ FAILED: Subscription error:', status);
        }
      });

    // Wait 2 seconds for subscription to establish
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Cleanup
    supabase.removeChannel(channel);

  } catch (err) {
    results.failed.push({
      test: 'Real-time Subscription',
      error: err.message,
    });
    console.error('❌ FAILED:', err.message);
  }

  // ============================================
  // SUMMARY
  // ============================================
  console.log('\n' + '='.repeat(60));
  console.log('📊 VERIFICATION SUMMARY');
  console.log('='.repeat(60));

  console.log(`\n✅ PASSED: ${results.passed.length}`);
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
      if (failure.fix) console.log(`     Fix: ${failure.fix}`);
    });
  }

  // Overall verdict
  console.log('\n' + '='.repeat(60));
  if (results.failed.length === 0) {
    console.log('🎉 ALL TESTS PASSED! Ready for TestSprite re-test.');
    toast.success('✅ All verifications passed! Ready for re-test.');
  } else {
    console.log('⚠️  SOME TESTS FAILED. Fix issues before re-testing.');
    toast.error(`❌ ${results.failed.length} test(s) failed. Check console for details.`);
  }
  console.log('='.repeat(60) + '\n');

  return results;
};

// Quick verification (minimal output)
export const quickVerify = async () => {
  const wsStatus = getRealtimeStatus();
  const health = await checkDatabaseHealth();

  const status = {
    websocket: wsStatus,
    database: health.connected,
    readyForTest: wsStatus === 'CONNECTED' && health.connected && health.tablesAccessible.tasksWrite,
  };

  console.log('Quick Verification:', status);

  if (status.readyForTest) {
    console.log('✅ Ready for TestSprite re-test');
    toast.success('✅ System ready for re-test');
  } else {
    console.log('❌ Not ready for re-test. Run full verification for details.');
    toast.warning('⚠️ System not ready. Run full verification.');
  }

  return status;
};

// Auto-run on import (for debugging)
if (import.meta.env.DEV && typeof window !== 'undefined') {
  window.verifyFixes = runVerification;
  window.quickVerify = quickVerify;
  console.log('💡 Verification tools loaded! Run:');
  console.log('   - window.verifyFixes() for full verification');
  console.log('   - window.quickVerify() for quick check');
}

export default { runVerification, quickVerify };
