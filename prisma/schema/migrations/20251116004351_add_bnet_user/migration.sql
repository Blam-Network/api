-- CreateTable
CREATE TABLE "public"."bnet_user" (
    "player_xuid" VARCHAR(20) NOT NULL,
    "is_registered" BOOLEAN NOT NULL DEFAULT false,
    "datamine_access" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "bnet_user_pkey" PRIMARY KEY ("player_xuid")
);
