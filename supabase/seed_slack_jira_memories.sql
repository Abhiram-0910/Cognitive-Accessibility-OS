-- Fake Slack + Jira seed data for Memory Agent demo
-- Run in Supabase SQL Editor to populate the memory/memories table
-- so the Memory Agent at /memory shows real results

-- Insert fake "memories" representing Slack messages + Jira tickets
-- Table: memories (id UUID, user_id UUID, content TEXT, embedding VECTOR, created_at TIMESTAMP)
-- Note: embedding will be set to null; populate via /api/embed endpoint or manually via pgvector

BEGIN;

-- Clear demo data flag (won't affect real user data because of user_id filter)
-- Replace 'YOUR_USER_ID' with the actual UUID from Supabase Auth
-- (find it at Supabase > Auth > Users > dronaabhiram@gmail.com)

DO $$
DECLARE
  demo_user UUID := (
    SELECT id FROM auth.users 
    WHERE email = 'dronaabhiram@gmail.com'
    LIMIT 1
  );
BEGIN

  -- Slack message memories
  INSERT INTO public.memories (user_id, content, source, created_at) VALUES
  (demo_user, 'Slack from Priya (PM): "Hey, the Q4 dashboard feature demo is moved to Friday 3pm. Can you make sure the biometric graphs are working by then? Also the manager wants a PDF export."', 'slack', NOW() - INTERVAL '2 days'),

  (demo_user, 'Slack from Arjun (Design): "I pushed the Figma updates for the parent portal. The Bento grid layout needs 3 columns on desktop. Check Notion for specs."', 'slack', NOW() - INTERVAL '1 day'),

  (demo_user, 'Slack from Rohit (Tech Lead): "Reminder: the HuggingFace API token needs to be added to server/.env before the hackathon demo. Also make sure the extension manifest covers all_urls."', 'slack', NOW() - INTERVAL '3 hours'),

  (demo_user, 'Slack DM from Arjun: "Quick Q — did we decide on using 432Hz or 40Hz for the Crisis Mode? I need this for the pitch deck audio section."', 'slack', NOW() - INTERVAL '5 hours'),

  -- Jira ticket memories
  (demo_user, 'Jira NEXUS-47: [BUG] Game.tsx fatal crash — TypeError: catch is not a function on Supabase insert. Priority: Critical. Assigned to: Me. Deadline: Tomorrow.', 'jira', NOW() - INTERVAL '3 days'),

  (demo_user, 'Jira NEXUS-52: [FEATURE] Parent Portal — HuggingFace ViT emotion analysis report for each game session. Must use GET /agents/session-report/:sessionId. Status: In Review.', 'jira', NOW() - INTERVAL '2 days'),

  (demo_user, 'Jira NEXUS-61: [TASK] Extension manifest.json — expand from 3 domains to all_urls for Wikipedia and GitHub support. Status: Done.', 'jira', NOW() - INTERVAL '1 day'),

  (demo_user, 'Jira NEXUS-65: [STORY] Breathe With Bear — add 432Hz binaural audio to the calming breathing modal in GameSelection. Child role only. Status: Done.', 'jira', NOW() - INTERVAL '12 hours'),

  (demo_user, 'Jira NEXUS-71: [ACTION ITEM] Present demo to IEEE judges by March 1. Need: live HF report, working extension on Wikipedia, PDF upload, all 13 routes green, no console errors.', 'jira', NOW() - INTERVAL '6 hours');

  RAISE NOTICE 'Seeded % demo memories', 9;
END $$;

COMMIT;
