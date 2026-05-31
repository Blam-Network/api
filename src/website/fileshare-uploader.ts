import { Prisma } from "@prisma/client";
import { PrismaService } from "src/db/prisma.service";

export type FileshareUploader = {
    uploader: string;
    uploaderXuid: string;
};

export async function lookupHalo3FileshareUploader(
    prisma: PrismaService,
    shareId: Prisma.Decimal,
): Promise<FileshareUploader | null> {
    const sr = await prisma.halo3_service_record.findUnique({
        where: { player_xuid: shareId },
        select: { player_xuid: true, player_name: true },
    });

    if (!sr?.player_name?.trim()) {
        return null;
    }

    return {
        uploader: sr.player_name,
        uploaderXuid: String(sr.player_xuid),
    };
}

export async function lookupReachFileshareUploader(
    prisma: PrismaService,
    shareId: Prisma.Decimal,
): Promise<FileshareUploader | null> {
    const sr = await prisma.reach_service_record.findUnique({
        where: { player_xuid: shareId },
        select: { player_xuid: true, player_name: true },
    });

    if (!sr?.player_name?.trim()) {
        return null;
    }

    return {
        uploader: sr.player_name,
        uploaderXuid: String(sr.player_xuid),
    };
}
