# Comprehensive System Testing Guide

This guide outlines the steps to verify the functionality of the Visionary AI platform, focusing on the newly integrated Enterprise & Partner features and the Vision Board ecosystem.

## 1. Database & Schema Verification
- [ ] **Run Cleanup Script:** Execute `CLEANUP_VISION_BOARDS.sql` in the Supabase SQL Editor to remove legacy broken images.
- [ ] **Verify Tables:** Ensure `partner_invitations`, `partner_connections`, `shared_goals`, `teams`, etc., exist in the Table Editor.

## 2. Vision Board & Gallery
- [ ] **Create Vision:** Go to the Visualizer, upload a base image (or use a blank one), enter a prompt, and generate an image.
- [ ] **Save Vision:** Click "Save" and verify a success toast appears.
- [ ] **View Gallery:** Navigate to the Gallery. Ensure the new image appears and does NOT show a broken icon.
- [ ] **Delete Vision:** Test the delete functionality on an image.

## 3. Partner Workspace (Enterprise)
- [ ] **Navigation:** Click "Partner Workspace" in the Dashboard Quick Actions.
- [ ] **Invite Partner:** Enter an email address and send an invitation.
- [ ] **Check Status:** Verify the status shows "Pending".
- [ ] **Accept Invite (Simulation):** You may need to manually update the `partner_invitations` table status to 'accepted' or use a second account to accept.
- [ ] **Shared Goals:** Create a shared goal and verify it appears in the list.

## 4. Morning Briefing (Communication Router)
- [ ] **Trigger Briefing:** Click the "Morning Briefing" button on the Dashboard.
- [ ] **Verify Logs:** Check the Supabase Edge Function logs for `communication-router` to see if it received the request and processed it (even if Twilio/Voice is mocked).

## 5. Print Shop
- [ ] **Open Modal:** Click the printer icon on any vision board image.
- [ ] **Select Product:** Choose a product (e.g., Poster).
- [ ] **Simulate Order:** Click "Order" and verify the flow (it might be in simulation mode for Stripe).

## 6. User Profile & Identity
- [ ] **Theme Selection:** Ensure the correct theme (e.g., "Faith & Purpose") is loaded based on your settings.
- [ ] **Credits:** Verify credit deduction when generating images.

## Troubleshooting
- **Images not loading:** Check browser console for 403/404 errors. Ensure Supabase Storage bucket `visions` is set to Public.
- **Edge Function Errors:** Check the logs in Supabase Dashboard > Edge Functions.
