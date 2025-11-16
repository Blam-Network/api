-- CreateEnum
CREATE TYPE "public"."DatamineParameterType" AS ENUM ('LONG', 'INT64', 'FLOAT', 'STRING');

-- CreateTable
CREATE TABLE "public"."datamine_session" (
    "id" UUID NOT NULL,
    "sessionid" VARCHAR(128) NOT NULL,
    "build_string" VARCHAR(32) NOT NULL,
    "build_number" INTEGER NOT NULL,
    "systemid" VARCHAR(160) NOT NULL,
    "title" VARCHAR(32) NOT NULL,
    "session_start_date" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "datamine_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."datamine_event" (
    "event_index" INTEGER NOT NULL,
    "session_id" UUID NOT NULL,
    "priority" INTEGER NOT NULL,
    "categories" TEXT[],
    "game_instance" DECIMAL(20,0) NOT NULL,
    "map" VARCHAR(260) NOT NULL,
    "event_date" TIMESTAMP(3) NOT NULL,
    "message" VARCHAR(2048) NOT NULL,

    CONSTRAINT "datamine_event_pkey" PRIMARY KEY ("event_index","session_id")
);

-- CreateTable
CREATE TABLE "public"."datamine_event_parameter" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "event_index" INTEGER NOT NULL,
    "session_id" UUID NOT NULL,
    "key" VARCHAR(128) NOT NULL,
    "type" "public"."DatamineParameterType" NOT NULL,
    "numeric_value" DECIMAL(30,10),
    "string_value" TEXT,

    CONSTRAINT "datamine_event_parameter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "datamine_event_parameter_event_index_session_id_idx" ON "public"."datamine_event_parameter"("event_index", "session_id");

-- CreateIndex
CREATE INDEX "datamine_event_parameter_key_idx" ON "public"."datamine_event_parameter"("key");

-- AddForeignKey
ALTER TABLE "public"."datamine_event" ADD CONSTRAINT "datamine_event_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."datamine_session"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."datamine_event_parameter" ADD CONSTRAINT "datamine_event_parameter_event_index_session_id_fkey" FOREIGN KEY ("event_index", "session_id") REFERENCES "public"."datamine_event"("event_index", "session_id") ON DELETE CASCADE ON UPDATE NO ACTION;
