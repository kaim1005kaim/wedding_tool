# Participant Display Limit Fix & Performance Optimization Walkthrough

## 1. Participant Display Limit Fix

### Issue
The projector view was only displaying up to 20 participants, even when more than 20 users were registered.

### Root Cause
The PostgreSQL function `refresh_room_leaderboard` had a default parameter `p_limit` set to `20`. This function is called internally by `apply_tap_delta` and `reveal_quiz` without arguments, causing the limit to apply.

### Resolution
- **Database**: Updated `refresh_room_leaderboard` default limit to **100**.
- **Code**: Updated [room-engine.ts](file:///Volumes/SSD02/Private/%E7%B5%90%E5%A9%9A%E3%83%91%E3%83%BC%E3%83%86%E3%82%A3%E3%83%BC/ContentsDEV/apps/web/lib/server/room-engine.ts) to explicitly pass `limit: 100` in all RPC calls.

## 2. Realtime Performance Optimization

### Issue
During the "Tap Game", 100 participants tapping simultaneously could generate up to 1,000 requests/second. This would trigger 1,000 database updates and Realtime broadcasts per second, potentially overwhelming the server and causing lag.

### Resolution

#### Database Throttling
Modified `apply_tap_delta` in [optimize-performance.sql](file:///Volumes/SSD02/Private/%E7%B5%90%E5%A9%9A%E3%83%91%E3%83%BC%E3%83%86%E3%82%A3%E3%83%BC/ContentsDEV/optimize-performance.sql) to throttle leaderboard updates.
- **Logic**: The leaderboard is now refreshed at most **once every 0.5 seconds**, regardless of how many tap events are received.
- **Impact**: Reduces broadcast load from ~1,000/sec to ~2/sec while keeping scores accurate in the background.

#### Final Score Guarantee
Updated [stopGame](file:///Volumes/SSD02/Private/%E7%B5%90%E5%A9%9A%E3%83%91%E3%83%BC%E3%83%86%E3%82%A3%E3%83%BC/ContentsDEV/apps/web/lib/server/room-engine.ts#84-102) in [room-engine.ts](file:///Volumes/SSD02/Private/%E7%B5%90%E5%A9%9A%E3%83%91%E3%83%BC%E3%83%86%E3%82%A3%E3%83%BC/ContentsDEV/apps/web/lib/server/room-engine.ts) to force a final leaderboard refresh when the game ends.
- **Why**: Throttling might skip the very last few tap updates. This ensures the final result displayed on the screen is 100% accurate.

## Verification
1. **Limit Fix**: Confirmed SQL function now defaults to 100.
2. **Throttling**: Confirmed `apply_tap_delta` includes a time-based check (`EXTRACT(EPOCH FROM (now() - last_update)) > 0.5`).
3. **Final Refresh**: Confirmed [stopGame](file:///Volumes/SSD02/Private/%E7%B5%90%E5%A9%9A%E3%83%91%E3%83%BC%E3%83%86%E3%82%A3%E3%83%BC/ContentsDEV/apps/web/lib/server/room-engine.ts#84-102) calls `refresh_room_leaderboard` explicitly.

## Next Steps
- Deploy the code changes ([room-engine.ts](file:///Volumes/SSD02/Private/%E7%B5%90%E5%A9%9A%E3%83%91%E3%83%BC%E3%83%86%E3%82%A3%E3%83%BC/ContentsDEV/apps/web/lib/server/room-engine.ts)) to production (Vercel).
- The SQL changes have already been applied to the Supabase database.
