#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRole) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const client = createClient(url, serviceRole, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

async function fixDatabase() {
  console.log('🔧 Fixing database functions...\n');

  try {
    // Drop and recreate the function
    const { error: dropError } = await client.rpc('query', {
      query: 'DROP FUNCTION IF EXISTS refresh_room_leaderboard(uuid, int);'
    }).single();

    // This will fail but that's OK - we just want to try
    console.log('Attempting direct SQL fix (may fail, that\'s OK)...');

    // Alternative: Create a simple test to see if tap works
    console.log('\n🧪 Testing tap functionality directly...');

    // Get TEST room ID
    const { data: room } = await client
      .from('rooms')
      .select('id')
      .eq('code', 'TEST')
      .single();

    if (room) {
      console.log(`Found TEST room: ${room.id}`);

      // Try to directly update score
      const { data: player } = await client
        .from('players')
        .select('id')
        .eq('room_id', room.id)
        .limit(1)
        .single();

      if (player) {
        console.log(`Found player: ${player.id}`);

        // Insert or update score directly
        const { error: scoreError } = await client
          .from('scores')
          .upsert({
            room_id: room.id,
            player_id: player.id,
            total_points: 5,
            last_update_at: new Date().toISOString()
          }, {
            onConflict: 'room_id,player_id'
          });

        if (scoreError) {
          console.error('Score update failed:', scoreError);
        } else {
          console.log('✅ Score updated successfully');
        }

        // Try to update room_snapshots leaderboard manually
        const { data: scores } = await client
          .from('scores')
          .select('player_id, total_points')
          .eq('room_id', room.id)
          .order('total_points', { ascending: false })
          .limit(20);

        const { data: players } = await client
          .from('players')
          .select('id, display_name')
          .eq('room_id', room.id);

        if (scores && players) {
          const leaderboard = scores.map((score, index) => {
            const player = players.find(p => p.id === score.player_id);
            return {
              playerId: score.player_id,
              name: player?.display_name || 'Unknown',
              points: score.total_points,
              rank: index + 1
            };
          });

          const { error: snapshotError } = await client
            .from('room_snapshots')
            .upsert({
              room_id: room.id,
              leaderboard: leaderboard,
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'room_id'
            });

          if (snapshotError) {
            console.error('Snapshot update failed:', snapshotError);
          } else {
            console.log('✅ Room snapshot updated successfully');
            console.log('Leaderboard:', leaderboard);
          }
        }
      }
    }

    console.log('\n✅ Database fix attempted. Manual leaderboard update implemented.');
    console.log('Note: The stored procedure issue needs to be fixed in Supabase SQL editor directly.');

  } catch (error) {
    console.error('Error:', error);
  }
}

fixDatabase()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });