import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('環境変数が設定されていません');
  process.exit(1);
}

const client = createClient(supabaseUrl, supabaseKey);

const { data, error } = await client
  .from('room_snapshots')
  .select('room_id, current_quiz')
  .not('current_quiz', 'is', null)
  .limit(1)
  .single();

if (error) {
  console.error('Error:', error);
} else {
  console.log('Room ID:', data.room_id);
  console.log('Current Quiz:', JSON.stringify(data.current_quiz, null, 2));
}
