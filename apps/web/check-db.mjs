#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

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

async function checkDatabase() {
  console.log('\n=== Checking Supabase Database ===\n');

  // Check rooms table
  const { data: rooms, error: roomsError } = await client
    .from('rooms')
    .select('id, code')
    .eq('code', 'TEST');

  if (roomsError) {
    console.error('❌ Error checking rooms:', roomsError.message);
  } else if (rooms && rooms.length > 0) {
    console.log('✅ TEST room found:');
    console.log('   Room ID:', rooms[0].id);
    console.log('   Room Code:', rooms[0].code);

    // Check room_admins for this room
    const { data: admins, error: adminsError } = await client
      .from('room_admins')
      .select('*')
      .eq('room_id', rooms[0].id);

    if (adminsError) {
      console.error('❌ Error checking room_admins:', adminsError.message);
    } else if (admins && admins.length > 0) {
      console.log('\n✅ room_admins record found:');
      console.log('   Has PIN hash:', !!admins[0].pin_hash);
      console.log('   Disabled:', admins[0].disabled);

      // Test PIN verification
      const testPin = '1234';
      const isValid = await bcrypt.compare(testPin, admins[0].pin_hash);
      console.log('   PIN "1234" valid:', isValid);

      if (!isValid) {
        // Create correct hash
        const correctHash = await bcrypt.hash(testPin, 10);
        console.log('\n🔧 Fixing PIN hash...');
        const { error: updateError } = await client
          .from('room_admins')
          .update({ pin_hash: correctHash })
          .eq('room_id', rooms[0].id);

        if (updateError) {
          console.error('   Failed to update:', updateError.message);
        } else {
          console.log('   ✅ PIN hash updated successfully');
        }
      }
    } else {
      console.log('\n⚠️ No room_admins record found for TEST room');
      console.log('🔧 Creating room_admins record...');

      const pinHash = await bcrypt.hash('1234', 10);
      const { error: insertError } = await client
        .from('room_admins')
        .insert({
          room_id: rooms[0].id,
          pin_hash: pinHash,
          disabled: false
        });

      if (insertError) {
        console.error('   Failed to create:', insertError.message);
      } else {
        console.log('   ✅ room_admins record created');
      }
    }
  } else {
    console.log('⚠️ TEST room not found');
  }

  // Check environment variables
  console.log('\n=== Environment Variables ===');
  console.log('APP_JWT_SECRET:', process.env.APP_JWT_SECRET ? '✅ Set' : '❌ Missing');
  console.log('ADMIN_SHARED_PASSCODE:', process.env.ADMIN_SHARED_PASSCODE ? '✅ Set' : '❌ Missing');

  console.log('\n=== Summary ===');
  console.log('Admin login URL should be: https://weddingtool.vercel.app/admin/TEST');
  console.log('PIN to use: 1234');
}

checkDatabase()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });