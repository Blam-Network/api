/*
  Warnings:

  - A unique constraint covering the columns `[sessionid,session_start_date]` on the table `datamine_session` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "datamine_session_sessionid_session_start_date_key" ON "public"."datamine_session"("sessionid", "session_start_date");
