import { NextResponse } from 'next/server';
import { getSupabaseServiceRoleClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const client = getSupabaseServiceRoleClient();

    // Check if tables exist
    const { data: tables, error: tablesError } = await client
      .from('rooms')
      .select('id, code')
      .limit(5);

    if (tablesError) {
      return NextResponse.json({
        error: 'Failed to query rooms table',
        details: tablesError.message
      }, { status: 500 });
    }

    // Check room_admins table
    const { data: admins, error: adminsError } = await client
      .from('room_admins')
      .select('room_id, disabled')
      .limit(5);

    if (adminsError) {
      return NextResponse.json({
        error: 'Failed to query room_admins table',
        details: adminsError.message
      }, { status: 500 });
    }

    // Find TEST room
    const { data: testRoom, error: testRoomError } = await client
      .from('rooms')
      .select('*')
      .eq('code', 'TEST')
      .single();

    let testRoomAdmin = null;
    if (testRoom && !testRoomError) {
      const { data: adminData } = await client
        .from('room_admins')
        .select('*')
        .eq('room_id', testRoom.id)
        .single();
      testRoomAdmin = adminData;
    }

    return NextResponse.json({
      success: true,
      tables: {
        rooms: tables?.length ?? 0,
        room_admins: admins?.length ?? 0
      },
      testRoom: testRoom ?? null,
      testRoomAdmin: testRoomAdmin ?? null,
      message: testRoom ? `TEST room found with ID: ${testRoom.id}` : 'TEST room not found'
    });
  } catch (error) {
    return NextResponse.json({
      error: 'Unexpected error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}